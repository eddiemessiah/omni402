import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import type { GatewayEvent } from "@glasscelo/x402ify";
import { Store } from "./store.js";

export interface Hub {
  store: Store;
  /** Feed an event in-process (used when the hub runs the gateways itself). */
  publish(e: GatewayEvent): void;
  listen(port: number): Promise<{ url: string; server: Server }>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Dashboard build output, served as static files (single-port deployment).
const DASHBOARD_DIST = path.resolve(__dirname, "../../dashboard/dist");

export function createHub(): Hub {
  const store = new Store();
  const app = express();
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

  app.use(express.json({ limit: "1mb" }));

  // Gateways running elsewhere stream their events here.
  app.post("/events", (req, res) => {
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

  // Serve the built dashboard if present (SPA fallback to index.html).
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
          `<pre>Hub is live. Dashboard not built yet — run:\n\n  pnpm --filter @glasscelo/dashboard build\n\nAPI: <a href="/api/state">/api/state</a></pre>`,
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
    listen(port: number) {
      return new Promise((resolve) => {
        server.listen(port, () => {
          resolve({ url: `http://localhost:${port}`, server });
        });
      });
    },
  };
}
