#!/usr/bin/env node
/**
 * Register your agent's on-chain identity (ERC-8004) on Celo.
 *
 *   AGENT_PRIVATE_KEY=0x… X402_NETWORK=celo \
 *     node --import tsx bin/register-8004.ts <agentURI>
 *
 * The signing wallet OWNS the agent NFT and needs a little CELO for gas.
 * We never see the key — it's read from the environment and used locally.
 */
import { registerAgent } from "../src/erc8004.js";

const pk = process.env.AGENT_PRIVATE_KEY || process.env.BUYER_PRIVATE_KEY;
const agentURI = process.argv[2] || process.env.AGENT_URI;

if (!pk) {
  console.error("Set AGENT_PRIVATE_KEY (the wallet that will own the agent NFT, with a little CELO).");
  process.exit(1);
}
if (!agentURI) {
  console.error("Usage: register-8004 <agentURI>   (a public URL to your agent.json)");
  process.exit(1);
}

console.log(`\n  Registering agent on ERC-8004 (${process.env.X402_NETWORK || "celo"})…`);
console.log(`  agentURI: ${agentURI}\n`);

registerAgent({ privateKey: pk, agentURI, network: process.env.X402_NETWORK })
  .then((r) => {
    console.log(`  ✅ Registered`);
    console.log(`     agent ID : ${r.agentId}`);
    console.log(`     owner    : ${r.owner}`);
    console.log(`     tx       : ${r.explorerUrl}`);
    console.log(`     8004scan : ${r.scanUrl}\n`);
  })
  .catch((err) => {
    console.error(`\n  ✗ ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
