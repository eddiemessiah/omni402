// Mirrors the hub's Store snapshot shape (apps/hub/src/store.ts).
export interface GatewayEvent {
  type: "register" | "request" | "payment" | "error";
  ts: number;
  api: string;
  method?: string;
  path?: string;
  status?: number;
  amount?: string;
  assetSymbol?: string;
  network?: string;
  payer?: string;
  txHash?: string;
  explorerUrl?: string;
  error?: string;
  upstream?: string;
  price?: string;
}

export interface ApiStat {
  name: string;
  upstream?: string;
  network?: string;
  price?: string;
  assetSymbol?: string;
  requests: number;
  payments: number;
  revenueAtomic: string;
}

export interface Snapshot {
  apis: ApiStat[];
  recentPayments: GatewayEvent[];
  recentEvents: GatewayEvent[];
  totals: {
    requests: number;
    payments: number;
    revenueByAsset: Record<string, string>;
  };
  callsByHour: Record<string, number>;
  updatedAt: number;
}
