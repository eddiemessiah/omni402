/**
 * Smoke test: does an unpaid request get a correct x402 402 challenge?
 * No chain, no funds — just verifies the gateway wiring and PaymentRequirements.
 * Run: pnpm --filter @glasscelo/x402ify exec tsx test/challenge.smoke.ts
 */
import { wrap } from "../src/wrap.js";

const gw = wrap({
  upstream: "https://example.com",
  price: "0.01",
  wallet: "0x1111111111111111111111111111111111111111",
  network: "celo", // mainnet has USDC hardcoded, so no env needed
  name: "smoke-test",
});

const { url, close } = await gw.start();
let failures = 0;
const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
};

try {
  const res = await fetch(`${url}/some/path?q=1`);
  const body = (await res.json()) as {
    x402Version: number;
    accepts: Array<Record<string, unknown>>;
  };
  console.log(JSON.stringify(body, null, 2), "\n");

  const req = body.accepts?.[0] ?? {};
  check(res.status === 402, "returns HTTP 402");
  check(body.x402Version === 1, "advertises x402Version 1");
  check(req.network === "eip155:42220", 'network is Celo mainnet "eip155:42220"');
  check(
    req.asset === "0xcEBA9300f2b948710d2653dD7B07f33A8B32118C",
    "asset is Celo USDC",
  );
  check(req.maxAmountRequired === "10000", "0.01 USDC → 10000 atomic units");
  check(req.payTo === "0x1111111111111111111111111111111111111111", "payTo is seller");
  check(req.scheme === "exact", 'scheme is "exact"');
  check(
    JSON.stringify(req.extra) === JSON.stringify({ name: "USDC", version: "2" }),
    "extra carries USDC EIP-712 domain",
  );
} finally {
  await close();
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
