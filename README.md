# Omni402

> **Turn any HTTP API into a pay-per-call endpoint that AI agents can buy from directly — settled in stablecoins on Celo, tracked in one dashboard.**

APIs were built for humans with accounts and keys; machines can't sign up. Omni402 removes the human from both sides: a provider wraps an existing API in one command, and any agent pays per request over the **Machine Payments Protocol (MPP / x402)** with no account, no key, and no gas token. Every call becomes a real USDC settlement on Celo.

Inspired by [GlassBox402](https://github.com/dhernz/Glassbox402) (ETHGlobal Lisbon) — this is the Celo-native successor.

---

## How it works

```
your API  ->  x402ify (wrap)  ->  MPP challenge / verify / settle  ->  Celo facilitator  ->  Celo
                  |                                                     (pays gas, no custody)
                  +-- events -->  hub  -->  dashboard (live + analytics)
```

- The buyer signs an **EIP-3009 `transferWithAuthorization`** off-chain — gasless.
- The **Celo facilitator** (`api.x402.celo.org`) submits it on-chain and pays the gas; funds move buyer → seller inside the token contract. It never custodies funds.
- Settlement uses the **`mppx`** SDK, pinned to the version Celo verified end-to-end.

## Quick start

```bash
pnpm install
cp .env.example .env      # fill in SELLER_PAY_TO, MPP_SECRET_KEY, X402_API_KEY
pnpm build                # build the dashboard
pnpm hub                  # hub + lanes + dashboard on http://localhost:4021
```

See it without funds — synthesized traffic into the dashboard:

```bash
DEMO=1 pnpm hub
```

Wrap a single API by hand:

```bash
pnpm wrap https://api.chucknorris.io --price 0.01 --wallet 0xYourWallet --sample /jokes/random
```

## Configuration (`.env`)

| Variable | Required for | What it is |
| --- | --- | --- |
| `X402_NETWORK` | all | `celo` (mainnet) or `celo-sepolia` (testnet) |
| `SELLER_PAY_TO` | live settlement | the wallet that receives the USDC (your address) |
| `MPP_SECRET_KEY` | live settlement | MPP server secret — `openssl rand -base64 32` |
| `X402_API_KEY` | live settlement | facilitator credits key from [x402.celo.org](https://x402.celo.org) |
| `ETHERSCAN_KEY`, … | per lane | upstream API keys; injected only after payment, never leave the box |
| `HUB_PORT` | optional | dashboard port (default 4021) |

Without `MPP_SECRET_KEY` + `X402_API_KEY` the gateway runs in **challenge-only** mode (serves a correct `402` but can't settle). With them set, it settles live via MPP.

## Live mainnet test

1. At [x402.celo.org](https://x402.celo.org): connect a wallet → **Create API key** → copy `x402_…`.
2. In `.env`: set `X402_NETWORK=celo`, `SELLER_PAY_TO=<your address>`, `MPP_SECRET_KEY=$(openssl rand -base64 32)`, `X402_API_KEY=<the key>`.
3. `pnpm build && pnpm hub` — the hub logs `settlement MPP live → https://api.x402.celo.org`.
4. Drive a real payment from a buyer wallet funded with a little Celo USDC (no CELO needed — the facilitator sponsors gas). The payment appears live on the dashboard with a Celoscan receipt.

> Develop on **Celo Sepolia** first (`X402_NETWORK=celo-sepolia`, testnet USDC from [faucet.circle.com](https://faucet.circle.com)). Flip to `celo` only when you're ready for real money.

## Buy as an agent

The other half: a wallet-native client that pays MPP/x402 endpoints with no
account or API key. `createBuyer` patches `fetch`, so an agent just calls the
URL and the payment happens transparently (sign EIP-3009 → retry).

```bash
# BUYER_PRIVATE_KEY = a wallet with a little USDC and NO native gas
# Lanes are served under /pay/<slug> on the hub's public port.
pnpm --filter @omni402/x402ify exec tsx bin/buy.ts \
  http://localhost:4021/pay/chuck-norris-jokes/jokes/random --network celo-sepolia --max 0.10
```

It prints the response, the settlement tx hash, and the Celoscan receipt link.
Programmatically:

```ts
import { createBuyer } from "@omni402/x402ify";
const buyer = createBuyer({ privateKey: process.env.BUYER_PRIVATE_KEY!, network: "celo" });
const { status, body, reference } = await buyer.pay("https://your-api/premium");
```

## Any AI agent as a paying customer (MCP)

The repo ships an MCP server ([apps/mcp](./apps/mcp), wired in [`.mcp.json`](./.mcp.json)) so a
Claude or GPT agent can shop the market on its own:

- **`list_paid_apis`** — what's for sale: name, price per call, network, and the URL to pay.
- **`paid_fetch`** — pay the per-call price and get the data back, with the settlement tx.

Ask an agent something it can't answer for free ("get the ETH price, use omni402") and it
discovers the endpoint, pays USDC on Celo, and answers — the payment shows up live on the
dashboard. The agent needs only `BUYER_PRIVATE_KEY` (a wallet with a little USDC, no gas); set it
in the environment before launching the MCP server. Discovery is free — only `paid_fetch` spends.

```bash
# stdio server; your MCP client (Claude Desktop/Code) launches it via .mcp.json
BUYER_PRIVATE_KEY=0x… X402_NETWORK=celo pnpm mcp
```

## Add an API to sell

Add an entry to [`lanes.json`](./lanes.json) and put any key in `.env`. A lane whose key is missing is skipped with a warning rather than started.

## Deploy (one container, one port)

```bash
# Docker (Railway / Render / Fly / any host)
docker build -t omni402 .
docker run -p 4021:4021 --env-file .env omni402
```

Set the same variables as `.env` in your host's dashboard (do **not** set `PORT` —
the host injects it). Keep `MPP_SECRET_KEY` stable across redeploys. Set
`PUBLIC_BASE` to your public URL (e.g. `https://omni402.up.railway.app`) so
the MCP catalog advertises payable URLs correctly.

**Publicly payable:** every lane is served at `<public-base>/pay/<slug>` on the
one exposed port, so agents and the MCP server can pay your deployed endpoints
directly — e.g. `https://your-app.up.railway.app/pay/etherscan/?chainid=1&…`.
The dashboard, API, and WebSocket share the same port.

## Repo layout

```
packages/config/    Celo networks, assets, facilitator — one source of truth
packages/x402ify/   the wrapper: CLI + gateway + MPP settlement (mpp.ts)
apps/hub/           event hub + analytics + serves the dashboard
apps/dashboard/     the React "control tower"
lanes.json          every API being sold — add one line to sell another
Dockerfile          one container: hub + all lanes + dashboard
```

## Tests

```bash
pnpm test        # 402-challenge correctness + MPP-mode boot
pnpm typecheck
```

## License

MIT
