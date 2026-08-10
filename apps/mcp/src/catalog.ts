import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getNetwork } from "@glasscelo/config";

/**
 * The market an agent can shop: each wrapped API, its price, and the exact URL
 * to pay. Built from lanes.json — the same file the hub uses to run gateways —
 * so what's for sale and what's actually running never drift apart.
 */
export interface PaidApi {
  name: string;
  price: string;
  asset: string;
  network: string;
  description: string;
  /** Buyer-facing URL (gateway host + port + sample path). Pay this. */
  url: string;
  method: string;
}

interface Lane {
  name: string;
  upstream: string;
  price: string;
  sample?: string;
  port: number;
  asset?: string;
  method?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

/** Base the gateways are reachable at (each lane on its own port). */
function gatewayBase(): string {
  return (process.env.GATEWAY_BASE || "http://localhost").replace(/\/$/, "");
}

export function loadCatalog(): PaidApi[] {
  const networkKey = process.env.X402_NETWORK || "celo-sepolia";
  const network = getNetwork(networkKey);
  const lanesPath = path.join(REPO_ROOT, "lanes.json");
  if (!fs.existsSync(lanesPath)) return [];
  const lanes: Lane[] = JSON.parse(fs.readFileSync(lanesPath, "utf8"));

  return lanes.map((lane) => {
    const sample = lane.sample && lane.sample !== "/" ? lane.sample : "";
    return {
      name: lane.name,
      price: lane.price,
      asset: (lane.asset || network.defaultAsset).toUpperCase(),
      network: network.key,
      description: `${lane.name}: proxied from ${new URL(lane.upstream).host}, paid per call.`,
      url: `${gatewayBase()}:${lane.port}${sample}`,
      method: (lane.method || "GET").toUpperCase(),
    };
  });
}

/** Find a catalog entry by (case-insensitive) name or exact URL. */
export function findApi(catalog: PaidApi[], nameOrUrl: string): PaidApi | undefined {
  const q = nameOrUrl.trim().toLowerCase();
  return (
    catalog.find((a) => a.name.toLowerCase() === q) ||
    catalog.find((a) => a.url.toLowerCase() === q) ||
    catalog.find((a) => a.name.toLowerCase().includes(q))
  );
}
