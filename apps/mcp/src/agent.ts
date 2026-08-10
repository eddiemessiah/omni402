#!/usr/bin/env node
/**
 * Omni Agent — an autonomous buyer that continuously pays Omni402 endpoints,
 * settling real x402 payments on Celo. This is the agentic use case: an agent
 * with a funded wallet and no accounts/keys buys data on a loop, and every call
 * is a counted x402 settlement (Celo Agentic Payments hackathon, Track 2).
 *
 * Env:
 *   BUYER_PRIVATE_KEY  wallet funded with a little USDC (NO native gas)
 *   X402_NETWORK       celo | celo-sepolia
 *   PUBLIC_BASE        the deployed Omni402 base, e.g. https://omni402.up.railway.app
 *   AGENT_INTERVAL_MS  ms between purchases (default 15000)
 *   MAX_PER_CALL       safety cap per call (default 0.05)
 *
 * Run:  BUYER_PRIVATE_KEY=0x… X402_NETWORK=celo PUBLIC_BASE=https://… pnpm agent
 */
import { createBuyer } from "@omni402/x402ify";
import { loadCatalog } from "./catalog.js";

const pk = process.env.BUYER_PRIVATE_KEY;
if (!pk) {
  console.error("BUYER_PRIVATE_KEY is required (an agent wallet funded with USDC).");
  process.exit(1);
}

const interval = Number(process.env.AGENT_INTERVAL_MS || 15000);
const buyer = createBuyer({
  privateKey: pk,
  network: process.env.X402_NETWORK,
  maxAmount: process.env.MAX_PER_CALL || "0.05",
});
const catalog = loadCatalog();

if (!catalog.length) {
  console.error("No endpoints in the catalog. Set PUBLIC_BASE and check lanes.json.");
  process.exit(1);
}

let calls = 0;
let paid = 0;

console.log(`\n  ◇ Omni Agent`);
console.log(`    wallet   ${buyer.account}`);
console.log(`    network  ${buyer.network.name}`);
console.log(`    market   ${catalog.length} endpoints`);
console.log(`    cadence  every ${interval / 1000}s\n`);

async function tick(): Promise<void> {
  const api = catalog[Math.floor(Math.random() * catalog.length)]!;
  calls++;
  const t = new Date().toISOString().slice(11, 19);
  try {
    const r = await buyer.pay(api.url);
    if (r.paid) {
      paid++;
      console.log(
        `  [${t}] 💸 paid ${api.price} ${api.asset} → ${api.name}` +
          (r.reference ? `  tx ${r.reference.slice(0, 12)}…` : "") +
          `   (${paid}/${calls} settled)`,
      );
      if (r.explorerUrl) console.log(`           ${r.explorerUrl}`);
    } else {
      console.log(`  [${t}] · ${api.name} → HTTP ${r.status} (no settlement)`);
    }
  } catch (err) {
    console.log(`  [${t}] ⚠ ${api.name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

await tick();
setInterval(() => void tick(), interval);
