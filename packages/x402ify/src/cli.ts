import { parseArgs } from "node:util";
import { wrap, type WrapOptions } from "./wrap.js";
import type { GatewayEvent } from "./types.js";

const USAGE = `
x402ify — turn any HTTP API into an x402 pay-per-call endpoint on Celo.

Usage:
  x402ify <upstream-url> --price <amount> --wallet <0x…> [options]

Required:
  <upstream-url>        The API to wrap, e.g. https://api.chucknorris.io
  --price <amount>      Price per call in the asset, e.g. 0.01
  --wallet <0x…>        Seller payout address (no private key needed here)

Options:
  --network <name>      celo | celo-sepolia            (default: $X402_NETWORK or celo-sepolia)
  --asset <symbol>      USDC | USDT                     (default: network default)
  --port <n>            Local port to serve on          (default: 4100)
  --name <label>        Display name for the dashboard
  --description <text>  Human description of the API
  --header <"K: v">     Inject an upstream auth header after payment
  --query <"k=v">       Inject an upstream query param after payment
  --facilitator <url>   Override the facilitator          (default: from config)
  --sample <path>       Print the buyer-facing URL for this path and exit info

Examples:
  x402ify https://api.chucknorris.io --price 0.01 --wallet 0xYourWallet --sample /jokes/random
  x402ify https://api.etherscan.io/v2/api --price 0.01 --wallet 0x… \\
    --query "apikey=$ETHERSCAN_KEY" --network celo
`;

export async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      price: { type: "string" },
      wallet: { type: "string" },
      network: { type: "string" },
      asset: { type: "string" },
      port: { type: "string" },
      name: { type: "string" },
      description: { type: "string" },
      header: { type: "string" },
      query: { type: "string" },
      facilitator: { type: "string" },
      sample: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help || positionals.length === 0) {
    console.log(USAGE);
    return;
  }

  const upstream = positionals[0]!;
  if (!values.price) throw new Error("--price is required (e.g. --price 0.01)");
  if (!values.wallet) throw new Error("--wallet is required (your 0x payout address)");

  const opts: WrapOptions = {
    upstream,
    price: values.price,
    wallet: values.wallet,
    network: values.network,
    asset: values.asset,
    port: values.port ? Number(values.port) : undefined,
    name: values.name,
    description: values.description,
    header: values.header,
    query: values.query,
    facilitatorUrl: values.facilitator,
    onEvent: logEvent,
  };

  const gateway = wrap(opts);
  const { url } = await gateway.start();

  const sample = values.sample ? url + values.sample : url;
  console.log(`\n  ▸ ${gateway.name}`);
  console.log(`    wrapping   ${upstream}`);
  console.log(
    `    price      ${values.price} ${gateway.asset.symbol} / call  →  ${gateway.network.name}`,
  );
  console.log(`    payout     ${values.wallet}`);
  if (gateway.mode === "mpp") {
    console.log(`    settlement MPP (live) → ${gateway.network.mppFacilitator}`);
  } else {
    console.log(`    settlement challenge-only — set X402_API_KEY + MPP_SECRET_KEY for live payments`);
  }
  console.log(`    buyer URL  ${sample}`);
  console.log(`\n  Live on ${url}. Ctrl-C to stop.\n`);
}

function logEvent(e: GatewayEvent): void {
  const t = new Date(e.ts).toISOString().slice(11, 19);
  if (e.type === "payment") {
    console.log(
      `  [${t}] 💸 ${e.method} ${e.path} — ${e.amount} ${e.assetSymbol} paid` +
        (e.txHash ? `  tx ${e.txHash.slice(0, 12)}…` : ""),
    );
    if (e.explorerUrl) console.log(`           ${e.explorerUrl}`);
  } else if (e.type === "error") {
    console.log(`  [${t}] ⚠️  ${e.method} ${e.path} — ${e.error}`);
  } else {
    console.log(`  [${t}] · ${e.method} ${e.path} → ${e.status}`);
  }
}
