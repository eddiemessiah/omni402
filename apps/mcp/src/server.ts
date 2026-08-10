#!/usr/bin/env node
/**
 * GlassCelo402 MCP server — makes an AI agent a paying customer.
 *
 * Exposes two tools over stdio:
 *   list_paid_apis  — discover what's for sale (name, price, URL)
 *   paid_fetch      — pay the per-call price and return the data
 *
 * The agent needs only a wallet (BUYER_PRIVATE_KEY) funded with USDC — no
 * accounts, no API keys. Payment settles on Celo via x402/MPP; the facilitator
 * sponsors gas. IMPORTANT: stdout is the MCP channel — never write to it; all
 * diagnostics go to stderr.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createBuyer, type Buyer } from "@glasscelo/x402ify";
import { loadCatalog, findApi } from "./catalog.js";

const server = new McpServer({ name: "glasscelo402", version: "0.1.0" });

// The buyer wallet is created lazily so `list_paid_apis` works even before a
// key is configured (discovery is free; only paying needs the wallet).
let buyer: Buyer | null = null;
function getBuyer(): Buyer {
  if (!buyer) {
    const pk = process.env.BUYER_PRIVATE_KEY;
    if (!pk) {
      throw new Error(
        "BUYER_PRIVATE_KEY is not set. The agent needs a wallet funded with a little USDC (no native gas needed).",
      );
    }
    buyer = createBuyer({
      privateKey: pk,
      network: process.env.X402_NETWORK,
      maxAmount: process.env.MAX_PER_CALL || "1",
    });
  }
  return buyer;
}

function joinUrl(base: string, extra: string): string {
  if (!extra) return base;
  if (extra.startsWith("?")) return base.split("?")[0] + extra;
  return base.replace(/\/$/, "") + "/" + extra.replace(/^\//, "");
}

server.registerTool(
  "list_paid_apis",
  {
    title: "List paid APIs",
    description:
      "List the x402/MPP APIs for sale on Celo — each with its name, price per call, network, and the URL to pay. Call this first to discover what you can buy.",
  },
  async () => {
    const catalog = loadCatalog();
    if (!catalog.length) {
      return { content: [{ type: "text", text: "No APIs are currently listed." }] };
    }
    const lines = catalog.map(
      (a) =>
        `• ${a.name} — ${a.price} ${a.asset}/call on ${a.network}\n    ${a.method} ${a.url}\n    ${a.description}`,
    );
    return {
      content: [{ type: "text", text: `Paid APIs on Celo:\n\n${lines.join("\n\n")}` }],
    };
  },
);

server.registerTool(
  "paid_fetch",
  {
    title: "Pay and fetch",
    description:
      "Pay the per-call price for an API (by name from list_paid_apis, or a full gateway URL) and return its data. Payment is automatic via x402/MPP: USDC settles on Celo and gas is sponsored. Returns the response plus the settlement transaction.",
    inputSchema: {
      api: z
        .string()
        .describe("API name (from list_paid_apis) or a full gateway URL to pay."),
      path: z
        .string()
        .optional()
        .describe("Optional path or query to append, e.g. '/?symbol=ETH' or '/jokes/random'."),
      method: z.string().optional().describe("HTTP method (default GET)."),
      body: z.string().optional().describe("Optional request body for POST/PUT (JSON string)."),
      maxPrice: z
        .string()
        .optional()
        .describe("Refuse to pay more than this many USDC for the call (safety cap)."),
    },
  },
  async ({ api, path, method, body, maxPrice }) => {
    const catalog = loadCatalog();
    const entry = findApi(catalog, api);
    let url = entry?.url ?? api;
    if (path) url = joinUrl(url, path);

    if (maxPrice && entry && Number(entry.price) > Number(maxPrice)) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Refused: ${entry.name} costs ${entry.price} ${entry.asset}, above your cap of ${maxPrice}.`,
          },
        ],
      };
    }

    try {
      const b = getBuyer();
      const init: RequestInit | undefined = method
        ? {
            method: method.toUpperCase(),
            body,
            headers: body ? { "content-type": "application/json" } : undefined,
          }
        : undefined;
      const r = await b.pay(url, init);

      const header = r.paid
        ? `✅ Paid ${entry?.price ?? "?"} ${entry?.asset ?? "USDC"} on ${b.network.name}` +
          (r.reference ? ` — tx ${r.reference}` : "") +
          (r.explorerUrl ? `\n${r.explorerUrl}` : "")
        : `(no payment settled — HTTP ${r.status})`;
      const bodyText =
        typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2);

      return { content: [{ type: "text", text: `${header}\n\n${bodyText}` }] };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Payment/fetch failed: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
      };
    }
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("glasscelo402 MCP server ready (stdio).");
