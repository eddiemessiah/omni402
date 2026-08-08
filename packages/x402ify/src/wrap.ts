import express, { type Express } from "express";
import type { Request as ExRequest, Response as ExResponse } from "express";
import {
  getNetwork,
  getAsset,
  priceToAtomic,
  explorerTx,
  type NetworkConfig,
  type AssetConfig,
} from "@glasscelo/config";
import { CeloFacilitator } from "./facilitator.js";
import { createMppSettler, mppConfigured, type MppSettler } from "./mpp.js";
import type { GatewayEvent, PaymentRequirements } from "./types.js";

export interface WrapOptions {
  /** Base URL of the API being wrapped, e.g. "https://api.etherscan.io/v2/api". */
  upstream: string;
  /** Human price per call in display units, e.g. "0.01". */
  price: string;
  /** Seller payout address (0x…). No private key needed on the server. */
  wallet: string;
  /** "celo" | "celo-sepolia". Defaults to $X402_NETWORK or "celo-sepolia". */
  network?: string;
  /** "USDC" | "USDT". Defaults to the network's default asset. */
  asset?: string;
  port?: number;
  name?: string;
  description?: string;
  /** Inject an upstream auth header after payment, e.g. "Api-Key: SECRET". */
  header?: string;
  /** Inject an upstream query param after payment, e.g. "apikey=SECRET". */
  query?: string;
  facilitatorUrl?: string;
  onEvent?: (e: GatewayEvent) => void;
}

export interface Gateway {
  app: Express;
  name: string;
  port: number;
  network: NetworkConfig;
  asset: AssetConfig;
  /** "mpp" = real settlement via mppx; "challenge" = 402 only (no keys set). */
  mode: "mpp" | "challenge";
  start(): Promise<{ url: string; close: () => Promise<void> }>;
}

const ZERO = "0x0000000000000000000000000000000000000000";
const isAddress = (a: string): a is `0x${string}` =>
  /^0x[0-9a-fA-F]{40}$/.test(a) && a.toLowerCase() !== ZERO;

function parseHeader(spec?: string): { name: string; value: string } | null {
  if (!spec) return null;
  const i = spec.indexOf(":");
  if (i === -1) throw new Error(`--header must be "Name: value", got "${spec}"`);
  return { name: spec.slice(0, i).trim(), value: spec.slice(i + 1).trim() };
}
function parseQuery(spec?: string): { name: string; value: string } | null {
  if (!spec) return null;
  const i = spec.indexOf("=");
  if (i === -1) throw new Error(`--query must be "name=value", got "${spec}"`);
  return { name: spec.slice(0, i).trim(), value: spec.slice(i + 1).trim() };
}

function buildTargetUrl(
  upstream: string,
  req: ExRequest,
  injected: { name: string; value: string } | null,
): URL {
  const base = new URL(upstream);
  const caller = new URL(req.originalUrl, "http://placeholder");
  const callerPath = caller.pathname === "/" ? "" : caller.pathname;
  const basePath = base.pathname.replace(/\/$/, "");
  const target = new URL(base.origin + basePath + callerPath);
  base.searchParams.forEach((v, k) => target.searchParams.set(k, v));
  caller.searchParams.forEach((v, k) => target.searchParams.append(k, v));
  if (injected) target.searchParams.set(injected.name, injected.value);
  return target;
}

/** Bridge an Express request into a web-standard Request (for mppx). */
function toWebRequest(req: ExRequest): Request {
  const url = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (typeof v === "string") headers.set(k, v);
    else if (Array.isArray(v)) headers.set(k, v.join(", "));
  }
  const method = req.method.toUpperCase();
  const hasBody =
    Buffer.isBuffer(req.body) && req.body.length > 0 && method !== "GET" && method !== "HEAD";
  const init: RequestInit & { duplex?: "half" } = { method, headers };
  if (hasBody) {
    init.body = new Uint8Array(req.body as Buffer);
    init.duplex = "half";
  }
  return new Request(url, init);
}

/** Relay a web-standard Response back through Express. */
async function relayWebResponse(res: ExResponse, web: Response): Promise<void> {
  res.status(web.status);
  web.headers.forEach((val, key) => {
    if (key.toLowerCase() === "content-length") return; // set by send()
    res.setHeader(key, val);
  });
  res.send(Buffer.from(await web.arrayBuffer()));
}

interface UpstreamResult {
  status: number;
  ok: boolean;
  contentType: string | null;
  body: Buffer;
}

async function proxyUpstream(
  opts: WrapOptions,
  req: ExRequest,
  injectHeader: { name: string; value: string } | null,
  injectQuery: { name: string; value: string } | null,
): Promise<UpstreamResult> {
  const target = buildTargetUrl(opts.upstream, req, injectQuery);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    const lk = k.toLowerCase();
    if (["host", "content-length", "connection", "x-payment", "authorization"].includes(lk))
      continue;
    if (typeof v === "string") headers.set(k, v);
  }
  if (injectHeader) headers.set(injectHeader.name, injectHeader.value);
  const method = req.method.toUpperCase();
  const hasBody =
    Buffer.isBuffer(req.body) && req.body.length > 0 && method !== "GET" && method !== "HEAD";
  const upstreamRes = await fetch(target, {
    method,
    headers,
    body: hasBody ? (req.body as Buffer) : undefined,
  });
  return {
    status: upstreamRes.status,
    ok: upstreamRes.ok,
    contentType: upstreamRes.headers.get("content-type"),
    body: Buffer.from(await upstreamRes.arrayBuffer()),
  };
}

/**
 * Extract the settlement tx hash from the MPP `Payment-Receipt` header.
 * The header is base64url-encoded JSON whose `reference` is the tx hash
 * (matches celo-org/mpp-celo-example). Falls back to a raw hex scan.
 */
function extractTx(web: Response): string | undefined {
  const hdr = web.headers.get("payment-receipt");
  if (!hdr) return undefined;
  try {
    const receipt = JSON.parse(Buffer.from(hdr, "base64url").toString("utf8"));
    const ref = (receipt as { reference?: unknown }).reference;
    if (typeof ref === "string" && /^0x[a-fA-F0-9]{64}$/.test(ref)) return ref;
    const m = JSON.stringify(receipt).match(/0x[0-9a-fA-F]{64}/);
    if (m) return m[0];
  } catch {
    const m = hdr.match(/0x[0-9a-fA-F]{64}/);
    if (m) return m[0];
  }
  return undefined;
}

export function wrap(opts: WrapOptions): Gateway {
  const network = getNetwork(opts.network || process.env.X402_NETWORK || "celo-sepolia");
  const asset = getAsset(network, opts.asset);
  const facilitator = new CeloFacilitator(opts.facilitatorUrl || network.facilitator);
  const injectHeader = parseHeader(opts.header);
  const injectQuery = parseQuery(opts.query);
  const name = opts.name || new URL(opts.upstream).host;
  const port = opts.port ?? 4100;
  const atomicPrice = priceToAtomic(opts.price, asset.decimals);

  // Real settlement (MPP) turns on when the facilitator key + server secret are
  // set AND we have a real payout address; otherwise we serve 402 challenges only.
  let mpp: MppSettler | null = null;
  if (mppConfigured() && isAddress(opts.wallet)) {
    mpp = createMppSettler({
      network,
      recipient: opts.wallet,
      secretKey: process.env.MPP_SECRET_KEY!,
      apiKey: process.env.X402_API_KEY!,
    });
  }
  const mode: Gateway["mode"] = mpp ? "mpp" : "challenge";

  const emit = (e: Omit<GatewayEvent, "ts" | "api">) =>
    opts.onEvent?.({ ...e, ts: Date.now(), api: name });

  emit({
    type: "register",
    upstream: opts.upstream,
    price: opts.price,
    assetSymbol: asset.symbol,
    network: network.key,
  });

  const app = express();
  app.use(express.raw({ type: () => true, limit: "5mb" }));

  app.all(/.*/, async (req, res) => {
    try {
      // ─── Real MPP settlement path ───────────────────────────────────────
      if (mpp) {
        const result = await mpp.charge(opts.price, toWebRequest(req));
        if (result.status === 402 && result.challenge) {
          emit({ type: "request", method: req.method, path: req.path, status: 402 });
          await relayWebResponse(res, result.challenge);
          return;
        }
        // Paid + settled by the facilitator → serve upstream with the receipt.
        const up = await proxyUpstream(opts, req, injectHeader, injectQuery);
        const upstreamWeb = new Response(up.body, {
          status: up.status,
          headers: up.contentType ? { "content-type": up.contentType } : {},
        });
        const finalWeb = result.withReceipt ? result.withReceipt(upstreamWeb) : upstreamWeb;
        const tx = extractTx(finalWeb);
        emit({
          type: "payment",
          method: req.method,
          path: req.path,
          status: up.status,
          amount: atomicPrice,
          assetSymbol: asset.symbol,
          network: network.key,
          txHash: tx,
          explorerUrl: tx ? explorerTx(network, tx) : undefined,
        });
        await relayWebResponse(res, finalWeb);
        return;
      }

      // ─── Fallback: 402 challenge only (no keys configured) ──────────────
      const resource = `${req.protocol}://${req.get("host")}${req.originalUrl}`;
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: network.caip2,
        maxAmountRequired: atomicPrice,
        resource,
        description: opts.description || `${name} — pay per call`,
        mimeType: "application/json",
        payTo: opts.wallet,
        maxTimeoutSeconds: 60,
        asset: asset.address,
        extra: asset.eip712,
      };
      const paymentHeader = req.header("X-PAYMENT");
      if (!paymentHeader) {
        emit({ type: "request", method: req.method, path: req.path, status: 402 });
        res.status(402).json({
          x402Version: 1,
          error: "X-PAYMENT header is required",
          accepts: [requirements],
        });
        return;
      }
      // With a payment header but no MPP keys, we can only verify, not settle.
      let payment: unknown;
      try {
        payment = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf8"));
      } catch {
        res.status(400).json({ error: "X-PAYMENT header is not valid base64 JSON" });
        return;
      }
      const verified = await facilitator.verify(payment, requirements);
      if (!verified.isValid) {
        res.status(402).json({
          x402Version: 1,
          error: verified.invalidReason || "payment verification failed",
          accepts: [requirements],
        });
        return;
      }
      const up = await proxyUpstream(opts, req, injectHeader, injectQuery);
      if (up.contentType) res.setHeader("Content-Type", up.contentType);
      res.status(up.status).send(up.body);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit({ type: "error", method: req.method, path: req.path, error: msg });
      if (!res.headersSent) res.status(502).json({ error: `gateway error: ${msg}` });
    }
  });

  return {
    app,
    name,
    port,
    network,
    asset,
    mode,
    start() {
      return new Promise((resolve) => {
        const server = app.listen(port, () => {
          resolve({
            url: `http://localhost:${port}`,
            close: () => new Promise<void>((r) => server.close(() => r())),
          });
        });
      });
    },
  };
}
