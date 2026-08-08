/**
 * Smoke test: with MPP env configured, does the gateway boot in "mpp" mode and
 * emit a real MPP 402 challenge (WWW-Authenticate)? The challenge is signed
 * locally by mppx from MPP_SECRET_KEY — no facilitator call, so this runs
 * offline with a dummy API key.
 * Run: node --import tsx test/mpp.smoke.ts
 */
import { randomBytes } from "node:crypto";

process.env.MPP_SECRET_KEY = randomBytes(32).toString("base64");
process.env.X402_API_KEY = "x402_dummy_for_local_challenge";

const { wrap } = await import("../src/wrap.js");

const gw = wrap({
  upstream: "https://example.com",
  price: "0.01",
  wallet: "0x1111111111111111111111111111111111111111",
  network: "celo-sepolia",
  name: "mpp-smoke",
});

console.log(`  mode = ${gw.mode}`);
if (gw.mode !== "mpp") {
  console.log("  ✗ expected mpp mode");
  process.exit(1);
}

const { url, close } = await gw.start();
let failures = 0;
const check = (c: boolean, label: string) => {
  console.log(`  ${c ? "✓" : "✗"} ${label}`);
  if (!c) failures++;
};

try {
  const res = await fetch(`${url}/premium`);
  check(res.status === 402, "unpaid request → 402");
  const auth = res.headers.get("www-authenticate") || "";
  const body = await res.text();
  console.log(`  WWW-Authenticate: ${auth.slice(0, 80) || "(none)"}`);
  console.log(`  body: ${body.slice(0, 160)}`);
  check(
    /payment/i.test(auth) || /challenge|payment|402/i.test(body),
    "response carries an MPP payment challenge",
  );
} finally {
  await close();
}

console.log(failures === 0 ? "\nMPP MODE OK" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
