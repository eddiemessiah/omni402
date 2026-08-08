/** Atomic base units (string) → human decimal for a 6-dp stablecoin. */
export function formatAtomic(atomic: string | undefined, decimals = 6): string {
  if (!atomic) return "0";
  const neg = atomic.startsWith("-");
  const digits = (neg ? atomic.slice(1) : atomic).padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals).replace(/0+$/, "");
  return (neg ? "-" : "") + (frac ? `${whole}.${frac}` : whole);
}

/** Sum a revenueByAsset map into a "1.23 USDC + 0.5 USDT" style label. */
export function formatRevenueByAsset(map: Record<string, string>): string {
  const parts = Object.entries(map)
    .filter(([, v]) => v && v !== "0")
    .map(([sym, atomic]) => `${formatAtomic(atomic)} ${sym}`);
  return parts.length ? parts.join("  +  ") : "0 USDC";
}

export function shortAddr(a?: string): string {
  if (!a) return "—";
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
