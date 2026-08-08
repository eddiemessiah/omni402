import { useEffect, useRef, useState } from "react";
import type { GatewayEvent, Snapshot } from "./types";

export interface HubState {
  snapshot: Snapshot | null;
  connected: boolean;
  /** last payment event, for a transient "just paid" flash */
  lastPayment: GatewayEvent | null;
}

/**
 * Connects to the hub: fetches an initial snapshot, then keeps it fresh over the
 * websocket. Individual events trigger a throttled refetch of /api/state so the
 * client never re-implements the server's aggregation (single source of truth).
 */
export function useHub(): HubState {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastPayment, setLastPayment] = useState<GatewayEvent | null>(null);
  const refetchTimer = useRef<number | null>(null);

  useEffect(() => {
    let closed = false;

    const refetch = () => {
      if (refetchTimer.current) return;
      refetchTimer.current = window.setTimeout(async () => {
        refetchTimer.current = null;
        try {
          const res = await fetch("/api/state");
          if (!closed && res.ok) setSnapshot(await res.json());
        } catch {
          /* ignore transient errors */
        }
      }, 400);
    };

    fetch("/api/state")
      .then((r) => r.json())
      .then((s) => !closed && setSnapshot(s))
      .catch(() => undefined);

    const wsUrl =
      (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws";
    let ws: WebSocket | null = null;
    let reconnect: number | null = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        if (!closed) reconnect = window.setTimeout(connect, 1500);
      };
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data.kind === "snapshot") setSnapshot(data.snapshot);
          else if (data.kind === "event") {
            if (data.event?.type === "payment") setLastPayment(data.event);
            refetch();
          }
        } catch {
          /* ignore */
        }
      };
    };
    connect();

    return () => {
      closed = true;
      if (reconnect) clearTimeout(reconnect);
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      ws?.close();
    };
  }, []);

  return { snapshot, connected, lastPayment };
}
