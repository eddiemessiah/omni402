import fs from "node:fs";
import path from "node:path";
import type { GatewayEvent } from "@omni402/x402ify";
import type { ApiStat, Store } from "./store.js";

/**
 * Dashboard persistence.
 *
 * Design notes:
 *  - The store's state is small and bounded (200 payments, 500 events, N APIs),
 *    so a debounced full-snapshot write beats an event log for simplicity.
 *  - Writes are atomic: write to `.tmp` then rename, so a crash mid-write never
 *    leaves a torn file.
 *  - Debounced to 1 s so a burst of events costs one write. A hard flush runs
 *    on shutdown so the last debounce window is never lost.
 *  - On boot: if the snapshot file exists, restore into the store.
 *
 * Where the file lives:
 *  - `OMNI402_DATA_DIR` env var, if set (e.g. `/data` when a Railway Volume is
 *    mounted there). Otherwise falls back to `<repo>/data`, which is ephemeral
 *    on Railway but still survives graceful restarts.
 *
 * What this does NOT do:
 *  - It does not persist across container recreation without a mounted volume.
 *  - It does not backfill from chain: the source of truth for money is Celoscan;
 *    this file only caches the dashboard's view of events emitted by the hub.
 */

export interface PersistedState {
  version: 1;
  savedAt: number;
  apis: [string, ApiStat][];
  payments: GatewayEvent[];
  events: GatewayEvent[];
  callsByHour: [string, number][];
}

export interface Persistence {
  /** Call after every ingest to schedule a debounced flush. */
  markDirty(): void;
  /** Flush now, awaiting completion. Safe to call at shutdown. */
  flush(): Promise<void>;
  /** Where snapshots are written, for logs. */
  readonly path: string;
  /** True if a snapshot was successfully loaded at boot. */
  readonly restored: boolean;
}

const FLUSH_DEBOUNCE_MS = 1000;

export function createPersistence(store: Store): Persistence {
  const dir = process.env.OMNI402_DATA_DIR || path.resolve(process.cwd(), "data");
  const file = path.join(dir, "state.json");
  const tmp = file + ".tmp";

  let restored = false;
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error(`  ⚠ persistence: cannot create ${dir}: ${String(err)}`);
  }

  // Try to load previous state.
  if (fs.existsSync(file)) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      const parsed = JSON.parse(raw) as PersistedState;
      if (parsed && parsed.version === 1) {
        store.restore({
          apis: parsed.apis || [],
          payments: parsed.payments || [],
          events: parsed.events || [],
          callsByHour: parsed.callsByHour || [],
        });
        restored = true;
        console.log(
          `  ✓ persistence: restored from ${file} (apis=${parsed.apis?.length ?? 0}, payments=${parsed.payments?.length ?? 0})`,
        );
      }
    } catch (err) {
      // A corrupt snapshot must not crash boot; the dashboard just starts empty.
      console.error(`  ⚠ persistence: failed to restore ${file}: ${String(err)}`);
    }
  }

  let timer: NodeJS.Timeout | null = null;
  let flushing: Promise<void> | null = null;

  async function doFlush(): Promise<void> {
    const dump = store.serialize();
    const payload: PersistedState = {
      version: 1,
      savedAt: Date.now(),
      ...dump,
    };
    const body = JSON.stringify(payload);
    // Atomic write. If the process dies between tmp write and rename, the
    // previous state.json is still valid.
    await fs.promises.writeFile(tmp, body);
    await fs.promises.rename(tmp, file);
  }

  return {
    path: file,
    get restored() {
      return restored;
    },
    markDirty(): void {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        flushing = doFlush().catch((err) => {
          console.error(`  ⚠ persistence: flush failed: ${String(err)}`);
        });
      }, FLUSH_DEBOUNCE_MS);
    },
    async flush(): Promise<void> {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (flushing) await flushing.catch(() => undefined);
      await doFlush().catch((err) => {
        console.error(`  ⚠ persistence: final flush failed: ${String(err)}`);
      });
    },
  };
}
