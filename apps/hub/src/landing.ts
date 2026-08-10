import { BRAND } from "@omni402/config";

export interface LaneMeta {
  slug: string;
  name: string;
  price: string;
  asset: string;
  method: string;
  sample: string;
  description?: string;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * The public /pay index — a lightweight, on-brand catalog of live payable
 * endpoints. Palette + type match the Relay/Verdict family (deep indigo ground,
 * cream, mint + gold, Playfair Display / Space Mono / Work Sans).
 */
export function renderPayLanding(lanes: LaneMeta[], base: string, network: string): string {
  const cards = lanes
    .map((l) => {
      const url = `${base}/pay/${l.slug}${l.sample && l.sample !== "/" ? l.sample : ""}`;
      return `<article class="lane">
        <div class="lane-top">
          <h2>${esc(l.name)}</h2>
          <span class="price">${esc(l.price)} ${esc(l.asset)}<em>/call</em></span>
        </div>
        ${l.description ? `<p class="desc">${esc(l.description)}</p>` : ""}
        <a class="url" href="${esc(url)}"><span class="verb">${esc(l.method)}</span> ${esc(url)}</a>
      </article>`;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(BRAND.name)} — pay-per-call APIs on Celo</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Space+Mono:wght@400;700&family=Work+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
  :root{
    --ground:#0a0611; --panel:#140d1f; --panel-2:#1b1329; --line:#2a1f3d;
    --cream:#f3ecdd; --muted:#a99bbd; --mint:#3fd9a8; --gold:#f2ce7b; --rose:#ff5e8a; --violet:#8b5cf6;
    --sans:'Work Sans',system-ui,sans-serif; --serif:'Playfair Display',Georgia,serif; --mono:'Space Mono',ui-monospace,monospace;
  }
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(1200px 600px at 70% -10%, #1a1030 0%, var(--ground) 55%);color:var(--cream);font-family:var(--sans);line-height:1.6;min-height:100vh}
  .wrap{max-width:900px;margin:0 auto;padding:56px 22px 80px}
  .badge{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--mint);border:1px solid var(--line);background:var(--panel);padding:6px 12px;border-radius:999px;display:inline-flex;gap:8px;align-items:center}
  .badge::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--mint);box-shadow:0 0 10px var(--mint)}
  h1{font-family:var(--serif);font-size:clamp(40px,7vw,68px);line-height:1;margin:20px 0 0;letter-spacing:-.02em}
  h1 .o{color:var(--mint)}
  .tag{color:var(--muted);font-size:clamp(16px,2.2vw,19px);margin:16px 0 0;max-width:56ch}
  .how{font-family:var(--mono);font-size:13px;color:var(--gold);margin-top:22px}
  .lanes{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:40px}
  @media(max-width:680px){.lanes{grid-template-columns:1fr}}
  .lane{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:20px;transition:border-color .2s,transform .2s}
  .lane:hover{border-color:var(--mint);transform:translateY(-2px)}
  .lane-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
  .lane h2{font-family:var(--serif);font-size:21px;margin:0;font-weight:600}
  .price{font-family:var(--mono);font-size:13px;color:var(--gold);white-space:nowrap}
  .price em{color:var(--muted);font-style:normal}
  .desc{color:var(--muted);font-size:14px;margin:10px 0 14px}
  .url{display:block;font-family:var(--mono);font-size:12px;color:var(--cream);background:var(--panel-2);border:1px solid var(--line);border-radius:8px;padding:9px 11px;text-decoration:none;overflow-x:auto;white-space:nowrap}
  .url:hover{border-color:var(--mint)}
  .verb{color:var(--mint);font-weight:700}
  .foot{margin-top:44px;padding-top:22px;border-top:1px solid var(--line);color:var(--muted);font-size:14px;display:flex;flex-wrap:wrap;gap:18px;align-items:center}
  .foot a{color:var(--mint);text-decoration:none}
  .foot code{font-family:var(--mono);font-size:12px;color:var(--gold)}
</style></head>
<body><div class="wrap">
  <span class="badge">${esc(network)} · live</span>
  <h1><span class="o">${esc(BRAND.name[0] ?? "O")}</span>${esc(BRAND.name.slice(1))}</h1>
  <p class="tag">${esc(BRAND.tagline)} Pay per call over x402/MPP — no account, no API key, no gas. USDC settles on Celo.</p>
  <p class="how">// an agent just calls the URL — the 402 is paid automatically</p>
  <div class="lanes">${lanes.length ? cards : '<p class="desc">No endpoints are live yet.</p>'}</div>
  <div class="foot">
    <a href="/">↗ Open the dashboard</a>
    <span>Pay from an agent: <code>x402buy &lt;url&gt;</code> or the MCP server.</span>
  </div>
</div></body></html>`;
}
