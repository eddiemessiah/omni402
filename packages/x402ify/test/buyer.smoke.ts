/**
 * Smoke test: does the buyer wire up (viem account + mppx client) and derive
 * the expected address? Uses a well-known throwaway test key — no funds, no
 * network. Run: node --import tsx test/buyer.smoke.ts
 */
import { createBuyer } from "../src/buyer.js";

// Hardhat/anvil account #0 — a PUBLIC test key, never used for real funds.
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const EXPECTED = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

let failures = 0;
const check = (c: boolean, label: string) => {
  console.log(`  ${c ? "✓" : "✗"} ${label}`);
  if (!c) failures++;
};

const buyer = createBuyer({ privateKey: TEST_KEY, network: "celo-sepolia" });

check(buyer.account.toLowerCase() === EXPECTED.toLowerCase(), "derives the buyer address from the key");
check(buyer.network.key === "celo-sepolia", "selects the configured network");
check(buyer.network.chainId === 11142220, "resolves Celo Sepolia chain id");
check(typeof buyer.pay === "function", "exposes an auto-paying fetch");

console.log(failures === 0 ? "\nBUYER OK" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
