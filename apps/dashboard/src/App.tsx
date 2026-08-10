import { useMemo, useState } from "react";
import { useHub } from "./useHub";
import type { ApiStat, GatewayEvent, Snapshot } from "./types";
import { formatAtomic, formatRevenueByAsset, shortAddr, timeAgo } from "./format";

type Tab = "overview" | "apis" | "payments" | "analytics";

export function App() {
  const { snapshot, connected } = useHub();
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo">◇</span>
          <div>
            <div className="brand-name">Omni402</div>
            <div className="brand-sub">x402 control tower · Celo</div>
          </div>
        </div>
        <div className={`conn ${connected ? "on" : "off"}`}>
          <span className="dot" /> {connected ? "live" : "reconnecting"}
        </div>
      </header>

      <nav className="tabs">
        {(["overview", "apis", "payments", "analytics"] as Tab[]).map((t) => (
          <button
            key={t}
            className={tab === t ? "tab active" : "tab"}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>

      <main className="content">
        {!snapshot ? (
          <div className="empty">Connecting to the hub…</div>
        ) : tab === "overview" ? (
          <Overview s={snapshot} />
        ) : tab === "apis" ? (
          <ApisView s={snapshot} />
        ) : tab === "payments" ? (
          <PaymentsView s={snapshot} />
        ) : (
          <AnalyticsView s={snapshot} />
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function KpiRow({ s }: { s: Snapshot }) {
  return (
    <div className="kpi-row">
      <Kpi label="Revenue" value={formatRevenueByAsset(s.totals.revenueByAsset)} sub="settled on Celo" />
      <Kpi label="Paid calls" value={String(s.totals.payments)} />
      <Kpi label="Total requests" value={String(s.totals.requests)} />
      <Kpi label="Wrapped APIs" value={String(s.apis.length)} />
    </div>
  );
}

function Overview({ s }: { s: Snapshot }) {
  return (
    <div className="stack">
      <KpiRow s={s} />
      <div className="grid-2">
        <Card title="Revenue by API">
          <ApiBars apis={s.apis} />
        </Card>
        <Card title="Latest payments">
          <PaymentList events={s.recentPayments.slice(0, 6)} compact />
        </Card>
      </div>
    </div>
  );
}

function ApisView({ s }: { s: Snapshot }) {
  return (
    <div className="stack">
      <KpiRow s={s} />
      <Card title="Wrapped APIs">
        <table className="table">
          <thead>
            <tr>
              <th>API</th>
              <th>Upstream</th>
              <th>Price</th>
              <th className="num">Paid</th>
              <th className="num">Requests</th>
              <th className="num">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {s.apis.map((a) => (
              <tr key={a.name}>
                <td className="strong">{a.name}</td>
                <td className="muted">{a.upstream ? new URL(a.upstream).host : "—"}</td>
                <td>{a.price ? `${a.price} ${a.assetSymbol ?? ""}` : "—"}</td>
                <td className="num">{a.payments}</td>
                <td className="num">{a.requests}</td>
                <td className="num accent">
                  {formatAtomic(a.revenueAtomic)} {a.assetSymbol ?? "USDC"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function PaymentsView({ s }: { s: Snapshot }) {
  return (
    <div className="stack">
      <KpiRow s={s} />
      <Card title="Payments — live">
        <PaymentList events={s.recentPayments} />
      </Card>
    </div>
  );
}

function AnalyticsView({ s }: { s: Snapshot }) {
  const byPayer = useMemo(() => topBy(s.recentPayments, (e) => e.payer), [s]);
  const byApi = useMemo(() => topBy(s.recentPayments, (e) => e.api), [s]);
  return (
    <div className="stack">
      <Card title="Calls by hour">
        <HourChart data={s.callsByHour} />
      </Card>
      <div className="grid-2">
        <Card title="Top APIs (by paid calls)">
          <RankList rows={byApi} />
        </Card>
        <Card title="Top payers">
          <RankList rows={byPayer.map(([k, v]) => [shortAddr(k), v])} />
        </Card>
      </div>
    </div>
  );
}

/* ---------- building blocks ---------- */

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-title">{title}</div>
      {children}
    </section>
  );
}

function PaymentList({ events, compact }: { events: GatewayEvent[]; compact?: boolean }) {
  if (!events.length) return <div className="empty small">No payments yet.</div>;
  return (
    <ul className="paylist">
      {events.map((e, i) => (
        <li key={(e.txHash ?? "") + i}>
          <span className="pay-amt">
            +{formatAtomic(e.amount)} {e.assetSymbol ?? "USDC"}
          </span>
          <span className="pay-api">{e.api}</span>
          {!compact && <span className="pay-payer">{shortAddr(e.payer)}</span>}
          <span className="pay-time">{timeAgo(e.ts)}</span>
          {e.explorerUrl && (
            <a className="pay-tx" href={e.explorerUrl} target="_blank" rel="noreferrer">
              receipt ↗
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function ApiBars({ apis }: { apis: ApiStat[] }) {
  const max = Math.max(1, ...apis.map((a) => Number(BigInt(a.revenueAtomic || "0"))));
  if (!apis.length) return <div className="empty small">No APIs registered.</div>;
  return (
    <div className="bars">
      {apis.map((a) => {
        const v = Number(BigInt(a.revenueAtomic || "0"));
        return (
          <div className="bar-row" key={a.name}>
            <div className="bar-label">{a.name}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${(v / max) * 100}%` }} />
            </div>
            <div className="bar-val">
              {formatAtomic(a.revenueAtomic)} {a.assetSymbol ?? "USDC"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HourChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).slice(-24);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <div className="empty small">No traffic yet.</div>;
  return (
    <div className="hourchart">
      {entries.map(([hour, v]) => (
        <div className="hbar" key={hour} title={`${hour}:00 — ${v} calls`}>
          <div className="hbar-fill" style={{ height: `${(v / max) * 100}%` }} />
          <div className="hbar-x">{hour.slice(11)}</div>
        </div>
      ))}
    </div>
  );
}

function RankList({ rows }: { rows: [string, number][] }) {
  if (!rows.length) return <div className="empty small">No data yet.</div>;
  const max = Math.max(1, ...rows.map(([, v]) => v));
  return (
    <div className="ranklist">
      {rows.map(([label, v]) => (
        <div className="rank-row" key={label}>
          <span className="rank-label">{label}</span>
          <span className="rank-bar">
            <span style={{ width: `${(v / max) * 100}%` }} />
          </span>
          <span className="rank-val">{v}</span>
        </div>
      ))}
    </div>
  );
}

function topBy(
  events: GatewayEvent[],
  key: (e: GatewayEvent) => string | undefined,
): [string, number][] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const k = key(e);
    if (!k) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}
