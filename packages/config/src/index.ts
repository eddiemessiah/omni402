/**
 * @glasscelo/config
 * ------------------------------------------------------------------
 * Every Celo-specific value the rest of the monorepo needs lives here,
 * so switching networks or assets is a one-line change, not a hunt.
 *
 * Verified against Celo's x402 docs (docs.celo.org/build-on-celo/
 * build-with-ai/x402) and the live facilitator at x402.celo.org.
 */

/** Display brand — the one place the product name lives. */
export const BRAND = {
  name: "Omni402",
  tagline: "Turn any API into an agent-payable endpoint on Celo.",
} as const;

export type NetworkKey = "celo" | "celo-sepolia";

export interface AssetConfig {
  symbol: string;
  /** ERC-20 contract address. */
  address: `0x${string}`;
  decimals: number;
  /**
   * EIP-712 domain used by the token's transferWithAuthorization (EIP-3009).
   * NOTE: USDT has no on-chain version(); its domain is name "Tether USD",
   * version "1" — do not derive it, set it explicitly.
   */
  eip712: { name: string; version: string };
}

export interface NetworkConfig {
  key: NetworkKey;
  /** CAIP-2 id passed to the x402 middleware, e.g. "eip155:42220". */
  caip2: string;
  chainId: number;
  name: string;
  rpcUrl: string;
  /** Block explorer base, used to build tx receipt links. */
  explorer: string;
  /** x402-rs facilitator (Coinbase-style /verify /settle). */
  facilitator: string;
  /** MPP facilitator API host (mppx SDK; needs X402_API_KEY). */
  mppFacilitator: string;
  assets: Record<string, AssetConfig>;
  defaultAsset: string;
}

/** The Celo Core-hosted facilitator. Override via X402_FACILITATOR_URL. */
export const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || "https://x402.celo.org";

/**
 * Mainnet token addresses are taken from Celo's published x402 docs and are
 * safe to hardcode. The Celo Sepolia USDC address is intentionally NOT
 * hardcoded — pass it via CELO_SEPOLIA_USDC_ADDRESS or discover it with
 * `pnpm supported` (queries the facilitator's /supported endpoint).
 */
export const NETWORKS: Record<NetworkKey, NetworkConfig> = {
  celo: {
    key: "celo",
    caip2: "eip155:42220",
    chainId: 42220,
    name: "Celo Mainnet",
    rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
    explorer: "https://celoscan.io",
    facilitator: FACILITATOR_URL,
    mppFacilitator: "https://api.x402.celo.org",
    defaultAsset: "USDC",
    assets: {
      USDC: {
        symbol: "USDC",
        address: "0xcEBA9300f2b948710d2653dD7B07f33A8B32118C",
        decimals: 6,
        eip712: { name: "USDC", version: "2" },
      },
      USDT: {
        symbol: "USDT",
        address: "0x48065fBBE25f71C9282dDf5e1cd6D6a887483D5e",
        decimals: 6,
        eip712: { name: "Tether USD", version: "1" },
      },
    },
  },
  "celo-sepolia": {
    key: "celo-sepolia",
    caip2: "eip155:11142220",
    chainId: 11142220,
    name: "Celo Sepolia",
    rpcUrl:
      process.env.CELO_SEPOLIA_RPC_URL ||
      "https://forno.celo-sepolia.celo-testnet.org",
    explorer: "https://celo-sepolia.blockscout.com",
    facilitator: FACILITATOR_URL,
    mppFacilitator: "https://api.x402.sepolia.celo.org",
    defaultAsset: "USDC",
    assets: {
      USDC: {
        symbol: "USDC",
        // Verified from Celo's MPP docs (celo-org/mpp-celo-example). Override
        // via CELO_SEPOLIA_USDC_ADDRESS if Celo rotates it.
        address: (process.env.CELO_SEPOLIA_USDC_ADDRESS ||
          "0x01C5C0122039549AD1493B8220cABEdD739BC44E") as `0x${string}`,
        decimals: 6,
        eip712: { name: "USDC", version: "2" },
      },
    },
  },
};

/** Resolve a network by key, throwing a helpful error on typos. */
export function getNetwork(key: string): NetworkConfig {
  const net = NETWORKS[key as NetworkKey];
  if (!net) {
    throw new Error(
      `Unknown network "${key}". Use one of: ${Object.keys(NETWORKS).join(", ")}`,
    );
  }
  return net;
}

/** Resolve an asset within a network, validating it's configured. */
export function getAsset(network: NetworkConfig, symbol?: string): AssetConfig {
  const sym = (symbol || network.defaultAsset).toUpperCase();
  const asset = network.assets[sym];
  if (!asset) {
    throw new Error(
      `Asset "${sym}" is not configured for ${network.name}. ` +
        `Available: ${Object.keys(network.assets).join(", ")}`,
    );
  }
  if (!asset.address) {
    throw new Error(
      `${sym} on ${network.name} has no address configured. ` +
        `Set CELO_SEPOLIA_USDC_ADDRESS (discover it with \`pnpm supported\`).`,
    );
  }
  return asset;
}

/**
 * Convert a human price string ("0.01") to the token's atomic base units
 * ("10000" for a 6-decimal token). Integer/BigInt math only — never floats,
 * because this is money.
 */
export function priceToAtomic(human: string, decimals: number): string {
  const trimmed = human.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid price "${human}" — expected a positive decimal.`);
  }
  const [whole = "0", frac = ""] = trimmed.split(".");
  if (frac.length > decimals) {
    throw new Error(
      `Price "${human}" has more than ${decimals} decimal places (the token's precision).`,
    );
  }
  const fracPadded = frac.padEnd(decimals, "0");
  const atomic =
    BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
  if (atomic <= 0n) throw new Error(`Price "${human}" must be greater than 0.`);
  return atomic.toString();
}

/** Build a block-explorer link for a settled transaction. */
export function explorerTx(network: NetworkConfig, txHash: string): string {
  return `${network.explorer}/tx/${txHash}`;
}

/** URL-safe slug for a lane name, e.g. "The Graph" → "the-graph". */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Ask the facilitator which (network, asset) pairs it actually settles today.
 * Authoritative and self-updating — prefer this over trusting hardcoded lists
 * when you can reach the network.
 */
export async function fetchSupported(
  facilitatorUrl: string = FACILITATOR_URL,
): Promise<unknown> {
  const url = `${facilitatorUrl.replace(/\/$/, "")}/supported`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Facilitator /supported returned ${res.status} at ${url}`);
  }
  return res.json();
}
