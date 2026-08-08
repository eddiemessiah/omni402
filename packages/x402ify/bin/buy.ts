#!/usr/bin/env node
/**
 * x402buy — pay an MPP/x402-gated endpoint from an agent wallet.
 *
 * Reads BUYER_PRIVATE_KEY from the environment (a wallet with a little USDC and
 * no native gas). Usage:
 *   x402buy <url> [--network celo|celo-sepolia] [--max 1] [--method GET] [--data '{"q":1}']
 */
import { parseArgs } from "node:util";
import { createBuyer } from "../src/buyer.js";

const USAGE = `
x402buy — pay an MPP/x402 endpoint as an agent.

Usage:
  x402buy <url> [options]

Options:
  --network <name>   celo | celo-sepolia         (default: $X402_NETWORK or celo-sepolia)
  --asset <symbol>   USDC | USDT                  (default: network default)
  --max <amount>     max to pay per request       (default: 1)
  --method <verb>    HTTP method                  (default: GET)
  --data <body>      request body for POST/PUT
  -h, --help

Env:
  BUYER_PRIVATE_KEY  a wallet funded with USDC (NO native gas needed)
`;

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      network: { type: "string" },
      asset: { type: "string" },
      max: { type: "string" },
      method: { type: "string" },
      data: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(USAGE);
    return;
  }
  const url = positionals[0]!;
  const pk = process.env.BUYER_PRIVATE_KEY;
  if (!pk) throw new Error("BUYER_PRIVATE_KEY is not set (an agent wallet funded with USDC).");

  const buyer = createBuyer({
    privateKey: pk,
    network: values.network,
    asset: values.asset,
    maxAmount: values.max,
  });

  console.log(`\n  buyer   ${buyer.account}`);
  console.log(`  network ${buyer.network.name}`);
  console.log(`  paying  ${url}\n`);

  const init: RequestInit | undefined = values.method
    ? {
        method: values.method.toUpperCase(),
        body: values.data,
        headers: values.data ? { "content-type": "application/json" } : undefined,
      }
    : undefined;

  const r = await buyer.pay(url, init);

  console.log(`  status  ${r.status}  ${r.paid ? "💸 paid" : "(no payment settled)"}`);
  if (r.reference) {
    console.log(`  tx      ${r.reference}`);
    console.log(`  receipt ${r.explorerUrl}`);
  }
  console.log(`\n  response:`);
  console.log(typeof r.body === "string" ? r.body : JSON.stringify(r.body, null, 2));
  console.log("");
}

main(process.argv.slice(2)).catch((err) => {
  console.error(`\n  ✗ ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
