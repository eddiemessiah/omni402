import { Mppx } from "mppx/server";
import { evm, assets } from "mppx/evm/server";
import type { NetworkConfig } from "@omni402/config";

/**
 * MPP (Machine Payments Protocol) settlement via the `mppx` SDK, pinned to the
 * version Celo verified end-to-end (celo-org/mpp-celo-example, mppx 0.8.7).
 *
 * This is the real money path: mppx issues the 402 Challenge, verifies the
 * buyer's signed Credential, and settles USDC on Celo through the metered
 * facilitator (which pays the on-chain gas). We never hold a private key or
 * move funds ourselves — the buyer signs, the facilitator settles.
 */
export interface MppConfig {
  network: NetworkConfig;
  /** The wallet that receives the stablecoin (seller payout). */
  recipient: `0x${string}`;
  /** Settlement asset symbol, pinned per lane: "USDC" | "USDT". */
  assetSymbol: string;
  /** MPP server secret (>= 32 bytes). `openssl rand -base64 32`. */
  secretKey: string;
  /** Facilitator credits key from x402.celo.org, sent as X-API-Key. */
  apiKey: string;
}

/**
 * Resolve the mppx known-asset for an exact (network, symbol) pair. Throws on
 * combinations the facilitator can't settle rather than silently substituting a
 * different token — this is money.
 */
function knownAsset(networkKey: string, symbol: string) {
  const sym = symbol.toUpperCase();
  if (networkKey === "celo") {
    if (sym === "USDC") return assets.celo.USDC;
    if (sym === "USDT") return assets.celo.USDT;
  } else if (networkKey === "celo-sepolia") {
    if (sym === "USDC") return assets.celoSepolia.USDC;
  }
  throw new Error(
    `MPP settlement of ${sym} on ${networkKey} is not supported ` +
      `(Celo mainnet: USDC or USDT; Celo Sepolia: USDC).`,
  );
}

/** The subset of the mppx charge-result we consume. */
export interface ChargeResult {
  status: number;
  /** present when status === 402 — the MPP challenge, as a web Response */
  challenge?: Response;
  /** present when paid — attaches the MPP receipt to your real response */
  withReceipt?: (response: Response) => Response;
}

export interface MppSettler {
  /** Charge `amountUsd` (e.g. "0.01") for a request; returns the mppx result. */
  charge(amountUsd: string, request: Request): Promise<ChargeResult>;
}

export function createMppSettler(cfg: MppConfig): MppSettler {
  // The facilitator is metered — attach the API key to every facilitator RPC.
  const apiKeyFetch: typeof fetch = (input, init = {}) => {
    const headers = new Headers(init.headers);
    headers.set("X-API-Key", cfg.apiKey);
    return fetch(input, { ...init, headers });
  };

  // The exact, pinned settlement asset — lets mppx infer chain id, decimals,
  // and the EIP-712 domain.
  const currency = knownAsset(cfg.network.key, cfg.assetSymbol);

  const mppx = Mppx.create({
    methods: [
      evm.charge({
        currency,
        recipient: cfg.recipient,
        x402: { facilitator: cfg.network.mppFacilitator, fetch: apiKeyFetch },
      }),
    ],
    secretKey: cfg.secretKey,
  });

  return {
    charge(amountUsd: string, request: Request): Promise<ChargeResult> {
      return mppx.charge({ amount: amountUsd })(request) as Promise<ChargeResult>;
    },
  };
}

/** True when the env is fully configured for real MPP settlement. */
export function mppConfigured(): boolean {
  return Boolean(process.env.X402_API_KEY && process.env.MPP_SECRET_KEY);
}
