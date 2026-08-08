import type { GatewayEvent } from "@glasscelo/x402ify";
import { NETWORKS, type NetworkKey } from "@glasscelo/config";

/**
 * In-memory aggregator for gateway events. Everything the dashboard shows is
 * derived from the stream of GatewayEvents the gateways emit. Revenue is summed
 * in atomic units with BigInt (never floats) and formatted at the edge.
 */

export interface ApiStat {
  name: string;
  upstream?: string;
  network?: string;
  price?: string;
  assetSymbol?: string;
  requests: number;
  payments: number;
  /** atomic base units, as a string */
  revenueAtomic: string;
}

export interface Totals {
  requests: number;
  payments: number;
  /** symbol -> atomic units */
  revenueByAsset: Record<string, string>;
}

export interface Snapshot {
  apis: ApiStat[];
  recentPayments: GatewayEvent[];
  recentEvents: GatewayEvent[];
  totals: Totals;
  /** calls bucketed by ISO hour, for the analytics chart */
  callsByHour: Record<string, number>;
  updatedAt: number;
}

const MAX_PAYMENTS = 200;
const MAX_EVENTS = 500;

export class Store {
  private apis = new Map<string, ApiStat>();
  private payments: GatewayEvent[] = [];
  private events: GatewayEvent[] = [];
  private callsByHour = new Map<string, number>();

  ingest(e: GatewayEvent): void {
    const api = this.ensureApi(e.api);

    switch (e.type) {
      case "register":
        api.upstream = e.upstream ?? api.upstream;
        api.price = e.price ?? api.price;
        api.assetSymbol = e.assetSymbol ?? api.assetSymbol;
        api.network = e.network ?? api.network;
        break;
      case "request":
        api.requests++;
        this.bump(e.ts);
        break;
      case "payment":
        api.requests++;
        api.payments++;
        if (e.amount) api.revenueAtomic = addAtomic(api.revenueAtomic, e.amount);
        if (e.assetSymbol) api.assetSymbol = e.assetSymbol;
        this.payments.unshift(e);
        this.payments.length = Math.min(this.payments.length, MAX_PAYMENTS);
        this.bump(e.ts);
        break;
      case "error":
        break;
    }

    this.events.unshift(e);
    this.events.length = Math.min(this.events.length, MAX_EVENTS);
  }

  snapshot(): Snapshot {
    const revenueByAsset: Record<string, string> = {};
    let requests = 0;
    let payments = 0;
    for (const a of this.apis.values()) {
      requests += a.requests;
      payments += a.payments;
      const sym = a.assetSymbol || "USDC";
      revenueByAsset[sym] = addAtomic(revenueByAsset[sym] || "0", a.revenueAtomic);
    }
    return {
      apis: [...this.apis.values()].sort((a, b) =>
        cmpAtomic(b.revenueAtomic, a.revenueAtomic),
      ),
      recentPayments: this.payments.slice(0, 50),
      recentEvents: this.events.slice(0, 100),
      totals: { requests, payments, revenueByAsset },
      callsByHour: Object.fromEntries(this.callsByHour),
      updatedAt: Date.now(),
    };
  }

  private ensureApi(name: string): ApiStat {
    let api = this.apis.get(name);
    if (!api) {
      api = { name, requests: 0, payments: 0, revenueAtomic: "0" };
      this.apis.set(name, api);
    }
    return api;
  }

  private bump(ts: number): void {
    const hour = new Date(ts).toISOString().slice(0, 13); // YYYY-MM-DDTHH
    this.callsByHour.set(hour, (this.callsByHour.get(hour) || 0) + 1);
  }
}

/** Format atomic base units to a human decimal string for a 6-dp stablecoin. */
export function formatAtomic(atomic: string, decimals = 6): string {
  const neg = atomic.startsWith("-");
  const digits = (neg ? atomic.slice(1) : atomic).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, "");
  return (neg ? "-" : "") + (frac ? `${whole}.${frac}` : whole);
}

/** Decimals for a network's default asset (all Celo stablecoins are 6-dp). */
export function assetDecimals(network?: string): number {
  const net = network ? NETWORKS[network as NetworkKey] : undefined;
  return net ? net.assets[net.defaultAsset]!.decimals : 6;
}

function addAtomic(a: string, b: string): string {
  return (BigInt(a || "0") + BigInt(b || "0")).toString();
}

function cmpAtomic(a: string, b: string): number {
  const d = BigInt(a || "0") - BigInt(b || "0");
  return d > 0n ? 1 : d < 0n ? -1 : 0;
}
