import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import express, { type Express } from "express";
import { WebSocketServer, WebSocket } from "ws";
import type { GatewayEvent } from "@glasscelo/x402ify";
import { Store } from "./store.js";

export interface Hub {
  store: Store;
  /** Feed an event in-process (used when the hub runs the gateways itself). */
  publish(e: GatewayEvent): void;
  /** Mount a lane's gateway under /pay/<slug> on the hub's public port. */
  mountLane(slug: string, laneApp: Express): void;
  listen(port: number): Promise<{ url: string; server: Server }>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Dashboard build output, served as static files (single-port deployment).
const DASHBOARD_DIST = path.resolve(__dirname, "../../dashboard/dist");

export function createHub(): Hub {
  const store = new Store();
  const app = express();
  app.set("trust proxy", true); // honor X-Forwarded-* behind Railway/Render/Fly
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });

  const broadcast = (e: GatewayEvent) => {
    const msg = JSON.stringify({ kind: "event", event: e });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
  };

  const publish = (e: GatewayEvent) => {
    store.ingest(e);
    broadcast(e);
  };

  // Lanes mount here. Registered BEFORE the static/SPA routes so /pay/* reaches
  // the gateways, not the dashboard fallback. Lanes are added after boot; an
  // Express Router matches its sub-routes at request time, so that's fine.
  const laneRouter = express.Router();
  app.use("/pay", laneRouter);

  // JSON parsing is scoped to /events ONLY — a global parser would swallow the
  // request body before a mounted lane's raw-body proxy could read it.
  app.post("/events", express.json({ limit: "1mb" }), (req, res) => {
    const e = req.body as GatewayEvent;
    if (!e || typeof e.type !== "string" || typeof e.api !== "string") {
      res.status(400).json({ error: "invalid event" });
      return;
    }
    publish(e);
    res.json({ ok: true });
  });

  app.get("/api/state", (_req, res) => res.json(store.snapshot()));
  app.get("/api/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

  // Serve the built dashboard if present (SPA fallback to index.html) — LAST.
  if (fs.existsSync(DASHBOARD_DIST)) {
    app.use(express.static(DASHBOARD_DIST));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(DASHBOARD_DIST, "index.html"));
    });
  } else {
    app.get("/", (_req, res) =>
      res
        .type("html")
        .send(
          `<pre>Hub is live. Dashboard not built yet — run:\n\n  pnpm build\n\nAPI: <a href="/api/state">/api/state</a></pre>`,
        ),
    );
  }

  // On connect, send the current snapshot so the client starts populated.
  wss.on("connection", (ws) => {
    ws.send(JSON.stringify({ kind: "snapshot", snapshot: store.snapshot() }));
  });

  return {
    store,
    publish,
    mountLane(slug: string, laneApp: Express) {
      laneRouter.use(`/${slug}`, laneApp);
    },
    listen(port: number) {
      return new Promise((resolve) => {
        server.listen(port, () => {
          resolve({ url: `http://localhost:${port}`, server });
        });
      });
    },
  };
}
