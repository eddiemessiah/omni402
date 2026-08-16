/**
 * Round-trip test for dashboard persistence.
 *
 *   1. Fresh store, ingest a real-looking payment event, flush.
 *   2. Fresh store, restore from the same file, verify totals + payment list.
 *
 * No HTTP, no timing, so the test is deterministic.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Store } from "../src/store.js";
import { createPersistence } from "../src/persist.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-persist-"));
process.env.OMNI402_DATA_DIR = dir;

const check = (cond: boolean, label: string) => {
  console.log(`  ${cond ? "✓" : "✗"} ${label}`);
  if (!cond) failures++;
};
let failures = 0;

// Phase 1: boot, ingest, flush.
{
  const store = new Store();
  const persist = createPersistence(store);
  check(!persist.restored, "empty dir → no snapshot to restore");

  store.ingest({
    type: "register",
    ts: 1_786_400_000_000,
    api: "Persistence Test",
    price: "0.01",
    assetSymbol: "USDC",
    network: "celo",
  });
  store.ingest({
    type: "payment",
    ts: 1_786_400_000_500,
    api: "Persistence Test",
    method: "GET",
    path: "/",
    status: 200,
    amount: "12345",
    assetSymbol: "USDC",
    network: "celo",
    txHash: "0xabc123",
    explorerUrl: "https://celoscan.io/tx/0xabc123",
  });
  persist.markDirty();
  await persist.flush();
  check(fs.existsSync(persist.path), "snapshot written to disk");
}

// Phase 2: fresh store, restore from same file.
{
  const store = new Store();
  const persist = createPersistence(store);
  check(persist.restored, "second boot restored from disk");

  const snap = store.snapshot();
  check(snap.totals.payments === 1, `payment count preserved (got ${snap.totals.payments})`);
  check(
    snap.totals.revenueByAsset.USDC === "12345",
    `USDC revenue preserved (got ${snap.totals.revenueByAsset.USDC})`,
  );
  check(snap.apis.length === 1, `apis preserved (got ${snap.apis.length})`);
  check(snap.apis[0]?.name === "Persistence Test", "api name preserved");
  check(snap.recentPayments[0]?.txHash === "0xabc123", "payment tx hash preserved");
}

fs.rmSync(dir, { recursive: true, force: true });
console.log(failures === 0 ? "\nPERSISTENCE OK" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
