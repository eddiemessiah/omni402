import type { GatewayEvent } from "@omni402/x402ify";
import { NETWORKS, type NetworkKey, explorerTx } from "@omni402/config";

/**
 * Synthesizes realistic-looking traffic so the dashboard can be demoed without
 * real funds. NOT a payment path — it only emits events. Real payments come
 * from actual buyers hitting the gateways.
 */
const DEMO_APIS = [
  { name: "Chuck Norris Jokes", price: "0.001", upstream: "https://api.chucknorris.io" },
  { name: "Etherscan", price: "0.01", upstream: "https://api.etherscan.io/v2/api" },
  { name: "Alpha Vantage", price: "0.01", upstream: "https://www.alphavantage.co" },
];

function randHex(len: number): string {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function startDemo(publish: (e: GatewayEvent) => void, networkKey: string): void {
  const net = NETWORKS[networkKey as NetworkKey] ?? NETWORKS.celo;
  const decimals = net.assets[net.defaultAsset]!.decimals;

  // Register the demo APIs so they appear immediately.
  for (const a of DEMO_APIS) {
    publish({
      type: "register",
      ts: Date.now(),
      api: a.name,
      upstream: a.upstream,
      price: a.price,
      assetSymbol: net.defaultAsset,
      network: net.key,
    });
  }

  setInterval(() => {
    const a = DEMO_APIS[Math.floor(Math.random() * DEMO_APIS.length)]!;
    const paid = Math.random() > 0.25;
    const ts = Date.now();
    if (paid) {
      const atomic = (
        BigInt(Math.round(parseFloat(a.price) * 10 ** decimals))
      ).toString();
      const tx = "0x" + randHex(64);
      publish({
        type: "payment",
        ts,
        api: a.name,
        method: "GET",
        path: "/",
        status: 200,
        amount: atomic,
        assetSymbol: net.defaultAsset,
        network: net.key,
        payer: "0x" + randHex(40),
        txHash: tx,
        explorerUrl: explorerTx(net, tx),
      });
    } else {
      publish({ type: "request", ts, api: a.name, method: "GET", path: "/", status: 402 });
    }
  }, 1800);
}
