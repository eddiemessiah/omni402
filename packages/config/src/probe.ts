/**
 * `pnpm supported` — ask the live Celo facilitator what it settles today.
 * Use this to discover the Celo Sepolia USDC address instead of guessing.
 */
import { FACILITATOR_URL, fetchSupported } from "./index.js";

const url = FACILITATOR_URL;
console.log(`Querying facilitator: ${url}/supported\n`);

try {
  const supported = await fetchSupported(url);
  console.log(JSON.stringify(supported, null, 2));
} catch (err) {
  console.error(`Could not reach the facilitator's /supported endpoint.`);
  console.error(String(err instanceof Error ? err.message : err));
  console.error(
    `\nIf this keeps failing, the base path may differ — check ` +
      `docs.celo.org/build-on-celo/build-with-ai/x402 and set X402_FACILITATOR_URL.`,
  );
  process.exit(1);
}
