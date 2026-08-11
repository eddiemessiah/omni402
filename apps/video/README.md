# Omni402 demo video (Remotion)

A programmatic 30-second demo, 1920x1080 at 30fps. Every fact on screen comes
from [`src/proof.ts`](./src/proof.ts), which holds only values verified against
Celo mainnet by decoding the transaction receipt from an RPC node.

## Run it

```bash
cd apps/video
pnpm install
pnpm studio          # opens Remotion Studio to preview and scrub
```

Render the MP4:

```bash
pnpm render          # writes out/omni402-demo.mp4
```

The first render downloads a headless Chrome (roughly 150MB), so it takes a few
minutes once and is fast afterwards. A single frame for a thumbnail:

```bash
pnpm still
```

## Scenes

| Frames | Seconds | Scene |
| --- | --- | --- |
| 0-150 | 0-5 | Title and the one-line promise |
| 150-300 | 5-10 | The wall: APIs assume a human |
| 300-450 | 10-15 | One command wraps any API |
| 450-600 | 15-20 | The live 402 challenge |
| 600-750 | 20-25 | Settlement, gasless, with the Celoscan receipt |
| 750-900 | 25-30 | Identity, payments, discovery, and the close |

## Changing the facts

Edit `src/proof.ts` only. The composition reads every address, hash, amount, and
URL from it, so the video cannot drift from what is actually on-chain.

If you re-run the demo and get a newer transaction, update `txHash`, `celoscan`,
`block`, and `amountUsdc` together, then re-render.
