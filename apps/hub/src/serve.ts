/**
 * Boots the hub + a gateway per lane in lanes.json, all streaming into one
 * dashboard. Run:  pnpm hub   (from repo root)   — or with a live .env:
 *   node --env-file=.env --import tsx apps/hub/src/serve.ts
 *
 * DEMO=1 synthesizes payment traffic so the dashboard is alive without funds.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wrap } from "@glasscelo/x402ify";
import { getNetwork, slugify, BRAND } from "@glasscelo/config";
import { createHub } from "./hub.js";
import { startDemo } from "./demo.js";

interface Lane {
  name: string;
  upstream: string;
  price: string;
  sample?: string;
  header?: string;
  query?: string;
  asset?: string;
  description?: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

/** Replace ${VAR} with env values; return null if any referenced var is missing. */
function interpolate(spec: string | undefined): string | null | undefined {
  if (!spec) return spec;
  let missing = false;
  const out = spec.replace(/\$\{(\w+)\}/g, (_, k) => {
    const v = process.env[k];
    if (!v) missing = true;
    return v ?? "";
  });
  return missing ? null : out;
}

async function main(): Promise<void> {
  // Railway/Render/Fly inject PORT; fall back to HUB_PORT, then 4021.
  const hubPort = Number(process.env.PORT || process.env.HUB_PORT || 4021);
  const wallet =
    process.env.SELLER_PAY_TO ||
    process.env.WALLET ||
    "0x0000000000000000000000000000000000000000";
  const networkKey = process.env.X402_NETWORK || "celo-sepolia";
  const network = getNetwork(networkKey);
  const liveSettlement = Boolean(process.env.X402_API_KEY && process.env.MPP_SECRET_KEY);

  const hub = createHub();
  const { url } = await hub.listen(hubPort);

  const lanesPath = path.join(REPO_ROOT, "lanes.json");
  const lanes: Lane[] = fs.existsSync(lanesPath)
    ? JSON.parse(fs.readFileSync(lanesPath, "utf8"))
    : [];

  const started: string[] = [];
  for (const lane of lanes) {
    const query = interpolate(lane.query);
    const header = interpolate(lane.header);
    if (query === null || header === null) {
      console.warn(`  ⚠ skipping "${lane.name}" — its API key env var is not set`);
      continue;
    }
    const gateway = wrap({
      upstream: lane.upstream,
      price: lane.price,
      wallet,
      network: networkKey,
      asset: lane.asset,
      name: lane.name,
      description: lane.description,
      header: header ?? undefined,
      query: query ?? undefined,
      onEvent: hub.publish,
    });
    // Mount on the hub's public port under /pay/<slug> instead of a private port.
    const slug = slugify(lane.name);
    hub.mountLane(slug, gateway.app, {
      slug,
      name: lane.name,
      price: lane.price,
      asset: gateway.asset.symbol,
      method: "GET",
      sample: lane.sample ?? "",
      description: lane.description,
    });
    started.push(`${lane.name} → /pay/${slug} (${lane.price} ${gateway.asset.symbol})`);
  }
  hub.finalizeLanes(network.key);

  console.log(`\n  ● ${BRAND.name} hub — ${network.name}`);
  console.log(`    dashboard   ${url}`);
  console.log(`    payout      ${wallet}`);
  console.log(
    `    settlement  ${liveSettlement ? `MPP live → ${network.mppFacilitator}` : "challenge-only (set X402_API_KEY + MPP_SECRET_KEY)"}`,
  );
  if (started.length) {
    console.log(`    lanes:`);
    for (const s of started) console.log(`      • ${s}`);
  } else {
    console.log(`    (no lanes started — add keys to .env or entries to lanes.json)`);
  }

  if (process.env.DEMO === "1") {
    console.log(`\n  ▸ DEMO mode: synthesizing payments into the dashboard`);
    startDemo(hub.publish, network.key);
  }
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
