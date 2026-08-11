/**
 * Every claim shown in the video, in one place.
 *
 * All of these were verified against Celo mainnet by decoding the transaction
 * receipt from an RPC node, not copied from a UI. If any of it changes, edit it
 * here so the video can never drift from the chain.
 *
 * Verification (block 74,479,633):
 *   status                 0x1 (success)
 *   contract               0xcEBA9300f2b948710d2653dD7B07f33A8B32118C  (Celo USDC)
 *   EIP-3009 event         AuthorizationUsed, authorizer = the buyer agent
 *   ERC-20 Transfer        buyer -> seller, raw 1000 = 0.001000 USDC (6dp)
 *   tx.from                the facilitator, NOT the buyer -> settlement was gasless
 */
export const PROOF = {
  txHash: "0xf6f71df2f84279c483b138a43c8adcfcd7c1e319459f2b1b2497cdb706a38b38",
  celoscan:
    "https://celoscan.io/tx/0xf6f71df2f84279c483b138a43c8adcfcd7c1e319459f2b1b2497cdb706a38b38",
  block: 74479633,
  amountUsdc: "0.001",
  buyer: "0x4F43Cf9E7D0Cfe47185ac97BDa737217cEA3EDE3",
  seller: "0x20ECAe56e1c21a0d4079bDD0202D0fb6d1FD5000",
  usdc: "0xcEBA9300f2b948710d2653dD7B07f33A8B32118C",
  network: "Celo Mainnet",
  caip2: "eip155:42220",
  gateway: "https://omni402-production.up.railway.app",
  site: "https://omni402.vercel.app",
  repo: "https://github.com/eddiemessiah/omni402",
  agentId: "9765",
  agent8004: "https://8004scan.io/agents/celo/9765",
  lane: "celo-token-prices",
} as const;

/** Brand tokens, matched to the landing page so the video and site agree. */
export const T = {
  paper: "#f3f1ea",
  paper2: "#eae6db",
  ink: "#0e0e0d",
  ink2: "#2b2a27",
  muted: "#6b675e",
  orange: "#ff5a1f",
  green: "#12b76a",
  black: "#0b0b0a",
  disp: '"Archivo", "Arial Black", system-ui, sans-serif',
  mono: '"Space Mono", ui-monospace, "Cascadia Code", Menlo, monospace',
} as const;
