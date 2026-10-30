/* Semis basket lens · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   Takes the Hyperdash cohort snapshot (latest.json from Cohort Sniper's data branch) and reads the smart vs fools positioning
   on each SOXX holding that has a Hyperliquid perp, weighted like the index. Also: the leveraged-ETF rebalance estimate and
   what the data says about market makers and after-hours. */
(function () {
  "use strict";
  // iShares SOXX holdings (shares, price on Oct 19, 2026). SOXL and SOXS track the same index (3x and -3x).
  const SOXX = [["AMD",7238421,538.05],["INTC",38065618,92.03],["NVDA",15432753,217.09],["MU",3553911,904.90],["AVGO",9200353,334.59],["MRVL",8048886,237.09],
    ["ADI",4704344,394.35],["TXN",6529544,276.15],["QCOM",9993092,173.53],["KLAC",9710042,166.40],["LRCX",5650728,272.20],["AMAT",3716527,413.11],["MPWR",1116597,1253.66],
    ["NXPI",5932961,230.19],["TSM",3138972,420.22],["TER",3655792,335.53],["SKHY",7921227,142.87],["ALAB",3349157,286.58],["MCHP",12564758,74.43],["CRDO",3979476,172.81],
    ["ON",9109823,73.12],["ASML",384320,1647.12],["ENTG",3577920,144.52],["TSEM",2473129,200.30],["MTSI",1675641,265.79],["ASX",9560768,40.80],["CBRS",2262279,120.66],
    ["UMC",13186806,20.08],["ARM",818109,228.05],["STM",3718027,45.61]];
  const AUM = { SOXL: 12.5e9, SOXS: 1.2e9 };   // approximate; SOXX Sniper keeps the same numbers
  const SMART = ["extremely_profitable", "very_profitable"], FOOLS = ["unprofitable", "very_unprofitable", "rekt"];
  const DATA_URL = "https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/data/latest.json";

  function agg(rows, w) {
    let L = 0, S = 0, lt = 0, st = 0; rows.forEach(r => { if (!r) return; L += r[2]; S += r[3]; lt += r[0]; st += r[1]; });
    const n = L + S, tc = lt + st, bd = n ? (L - S) / n : 0, bc = tc ? (lt - st) / tc : 0;
    return { L, S, n, b: tc ? w * bd + (1 - w) * bc : bd, traders: tc };
  }
  // venue perps for a stock symbol: keys with a venue prefix whose ticker matches (XYZ:NVDA, PARA:AVGO, ...)
  const keysFor = (D, sym) => Object.keys(D.m || {}).filter(k => k.includes(":") && k.split(":").pop() === sym);

  function compute(D, opts) {
    opts = opts || {}; const wD = opts.wD == null ? 0.6 : opts.wD, px = opts.px || (() => null);
    if (!D || !D.m || !D.pnl) return null;
    const sI = SMART.map(id => D.pnl.findIndex(c => c.id === id)).filter(i => i >= 0), fI = FOOLS.map(id => D.pnl.findIndex(c => c.id === id)).filter(i => i >= 0);
    const tot = SOXX.reduce((a, h) => a + h[1] * (px(h[0]) || h[2]), 0);
    const one = keys => {
      if (!keys.length) return null;
      const sm = agg(keys.flatMap(k => sI.map(i => D.m[k].p[i])), wD), fo = agg(keys.flatMap(k => fI.map(i => D.m[k].p[i])), wD);
      const main = keys.slice().sort((a, b) => (agg(sI.concat(fI).map(i => D.m[b].p[i]), wD).n) - (agg(sI.concat(fI).map(i => D.m[a].p[i]), wD).n))[0];
      const tr = (D.tr || {})[main] || {}, d = k => tr[k] ? tr[k][0] : null;   // gap change in points, + = toward smart long
      return { keys, main, sm, fo, gap: (sm.b - fo.b) / 2, d1h: d("1h"), d4h: d("4h"), d24h: d("24h"), ctx: (D.ctx || {})[main] || null };
    };
    const rows = SOXX.map(([sym, sh, p0]) => { const w = sh * (px(sym) || p0) / tot, r = one(keysFor(D, sym)); return { sym, w, ...(r || {}), has: !!r }; });
    const cov = rows.filter(r => r.has && r.sm.n + r.fo.n > 0), cw = cov.reduce((a, r) => a + r.w, 0);
    const wav = f => cw ? cov.reduce((a, r) => a + r.w * f(r), 0) / cw : null;
    const wavN = k => { const v = cov.filter(r => r[k] != null), w = v.reduce((a, r) => a + r.w, 0); return w ? v.reduce((a, r) => a + r.w * r[k], 0) / w : null; };
    const basket = { cov: cw, n: cov.length, sm: wav(r => r.sm.b), fo: wav(r => r.fo.b), gap: wav(r => r.gap), smN: cov.reduce((a, r) => a + r.sm.n, 0), foN: cov.reduce((a, r) => a + r.fo.n, 0),
      smLong: cov.reduce((a, r) => a + r.sm.L, 0), smShort: cov.reduce((a, r) => a + r.sm.S, 0), d1h: wavN("d1h"), d4h: wavN("d4h"), d24h: wavN("d24h"),
      agree: cov.filter(r => Math.abs(r.gap) >= 0.15).reduce((a, r) => a + (Math.sign(r.gap) === Math.sign(wav(x => x.gap) || 0) ? r.w : 0), 0) / (cw || 1) };
    const etf = ["SOXL", "SMH"].map(s => { const r = one(keysFor(D, s)); return r ? { sym: s, ...r } : null; }).filter(Boolean);
    return { rows, basket, etf, t: D.t };
  }

  // Leveraged-ETF rebalance: a fund with leverage L must trade (L² − L) × AUM × index return at the close.
  // SOXL (3x): 6 × AUM × r. SOXS (−3x): 12 × AUM × r. Both trade in the SAME direction as the day's move.
  function rebalance(idxRet, aum) { aum = aum || AUM; if (idxRet == null || !isFinite(idxRet)) return null;
    return { usd: (aum.SOXL * 6 + aum.SOXS * 12) * idxRet, soxl: aum.SOXL * 6 * idxRet, soxs: aum.SOXS * 12 * idxRet }; }

  const fmtB = n => { const a = Math.abs(n); return (n < 0 ? "-$" : "$") + (a >= 1e9 ? (a / 1e9).toFixed(2) + "B" : a >= 1e6 ? (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? (a / 1e3).toFixed(0) + "K" : Math.round(a)); };
  const b100 = b => b == null ? "–" : (Math.round(b * 100) > 0 ? "+" : "") + Math.round(b * 100);
  const cl = v => v == null ? "" : v > 0 ? "bk-L" : v < 0 ? "bk-S" : "";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const css = `.bk{font:12px var(--mono)}.bk-L{color:var(--bull,var(--up))}.bk-S{color:var(--bear,var(--down))}.bk-f{color:var(--faint,var(--mute))}
.bk-sum{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:6px 0 10px}
.bk-sum>div{border:1px solid var(--line);border-radius:8px;padding:6px 9px;background:var(--panel2)}.bk-sum b{display:block;font-size:16px;color:var(--text,var(--ink))}
.bk table{width:100%;border-collapse:collapse}.bk th,.bk td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
.bk th{color:var(--dim);font-weight:600;font-size:11px}.bk td:first-child,.bk th:first-child{text-align:left}.bk .bar{display:inline-block;height:6px;border-radius:3px;vertical-align:middle;background:var(--accent)}
.bk-wrap{overflow-x:auto}.bk-k{font:12.5px/1.55 var(--sans);color:var(--text,var(--ink))}.bk-k li{margin:3px 0}`;
  let cssOn = false; const addCss = () => { if (cssOn) return; cssOn = true; const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); };

  function html(res, opts) {
    addCss(); opts = opts || {};
    if (!res) return `<div class="bk bk-f">Loading the cohort snapshot…</div>`;
    const B = res.basket, side = B.gap == null ? "" : B.gap >= 0.05 ? "smart LONG the semis basket" : B.gap <= -0.05 ? "smart SHORT the semis basket" : "no clear edge";
    const d = v => v == null ? "–" : `<span class="${cl(v)}">${v > 0 ? "▲" : v < 0 ? "▼" : ""}${Math.abs(Math.round(v))}</span>`;
    const rows = res.rows.slice().sort((a, b) => b.w - a.w).map(r => r.has ? `<tr><td><b>${esc(r.sym)}</b> <span class="bk-f">${r.keys.map(k => k.split(":")[0]).join("/")}</span></td><td>${(r.w * 100).toFixed(1)}% <span class="bar" style="width:${Math.round(r.w * 300)}px"></span></td>
      <td class="${cl(r.sm.b)}">${b100(r.sm.b)}</td><td class="${cl(r.fo.b)}">${b100(r.fo.b)}</td><td class="${cl(r.gap)}"><b>${b100(r.gap)}</b></td><td>${fmtB(r.sm.n)} <span class="bk-f">${r.sm.traders}</span></td><td>${fmtB(r.fo.n)} <span class="bk-f">${r.fo.traders}</span></td>
      <td>${d(r.d1h)}</td><td>${d(r.d4h)}</td><td>${d(r.d24h)}</td><td class="${r.ctx && r.ctx.ch != null ? cl(r.ctx.ch) : ""}">${r.ctx && r.ctx.ch != null ? (r.ctx.ch > 0 ? "+" : "") + r.ctx.ch.toFixed(2) + "%" : "–"}</td></tr>`
      : `<tr class="bk-f"><td>${esc(r.sym)}</td><td>${(r.w * 100).toFixed(1)}%</td><td colspan="9" style="text-align:left">no Hyperliquid perp</td></tr>`).join("");
    const etf = res.etf.map(e => `<div><span class="bk-f">${e.sym} perp itself</span><b class="${cl(e.gap)}">gap ${b100(e.gap)}</b>smart ${b100(e.sm.b)} · fools ${b100(e.fo.b)}</div>`).join("");
    return `<div class="bk"><div class="bk-sum">
      <div><span class="bk-f">Basket gap (index-weighted)</span><b class="${cl(B.gap)}">${b100(B.gap)}</b>${side}</div>
      <div><span class="bk-f">Smart bias</span><b class="${cl(B.sm)}">${b100(B.sm)}</b>${fmtB(B.smN)} on ${B.n} holdings</div>
      <div><span class="bk-f">Fools bias</span><b class="${cl(B.fo)}">${b100(B.fo)}</b>${fmtB(B.foN)}</div>
      <div><span class="bk-f">Gap change 1h / 4h / 24h</span><b>${d(B.d1h)} ${d(B.d4h)} ${d(B.d24h)}</b>points, + = toward smart long</div>
      <div><span class="bk-f">Coverage</span><b>${Math.round(B.cov * 100)}%</b>of SOXX weight has a perp</div>
      <div><span class="bk-f">Holdings that agree</span><b>${Math.round(B.agree * 100)}%</b>of covered weight with a clear gap on the basket side</div>${etf}</div>
      <div class="bk-wrap"><table><thead><tr><th>Holding</th><th>SOXX weight</th><th>Smart</th><th>Fools</th><th>Gap</th><th>Smart $</th><th>Fools $</th><th>Δ1h</th><th>Δ4h</th><th>Δ24h</th><th>Perp 24h</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="bk-f" style="margin-top:6px">Bias −100 (all short) … +100 (all long). Smart = Extremely + Very Profitable cohorts; fools = Unprofitable + Very Unprofitable + Rekt. Gap = (smart − fools) ÷ 2. Δ = gap change in points. Hyperdash cohort snapshot ${res.t ? new Date(res.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}; refreshes every 5 minutes. Perps trade 24/7, so this positioning also moves when the stock market is closed.</div></div>`;
  }

  // What the market-structure research and our own data say about the nightly rebalance and market makers.
  function knowledge(rb, lab) {
    addCss();
    const L = lab && lab.rebal ? lab.rebal.filter(x => x.n >= 15) : [];
    const pc = v => v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : "") + (v * 100).toFixed(2) + "%", pr = v => v == null || !isFinite(v) ? "–" : Math.round(v * 100) + "%";
    const tbl = L.length ? `<div class="bk-wrap" style="margin:6px 0"><table><thead><tr><th>SOXL day (rebalance size)</th><th>Days</th><th>Rebalance ≈</th><th>Last hour</th><th>That evening AH</th><th>AH reverses</th><th>Next gap</th><th>Gap reverses</th><th>Next day</th></tr></thead><tbody>${L.map(x => `<tr><td>${x.lab}</td><td>${x.n}</td><td class="${cl(x.usd)}">${fmtB(x.usd)}</td><td class="${cl(x.l60)}">${pc(x.l60)}</td><td class="${cl(x.nAh)}">${pc(x.nAh)}</td><td>${pr(x.ahRev)}</td><td class="${cl(x.nGap)}">${pc(x.nGap)}</td><td>${pr(x.gapRev)}</td><td class="${cl(x.nCC)}">${pc(x.nCC)}</td></tr>`).join("")}</tbody></table></div>
      <div class="bk-f">From ${lab.n} SOXL sessions (${esc(lab.first)} – ${esc(lab.last)}) in SOXX Sniper's history${lab.at ? `, updated ${new Date(lab.at).toLocaleDateString()}` : ""}. "Reverses" = share of days where the move goes against the day's direction. ${(lab.rules || []).filter(r => /^letf|^ahOver|^mmGap|^lastGap/.test(r.id) && r.r != null).map(r => `${esc(r.title)}: r ${r.r.toFixed(2)} (${esc(r.verdict)})`).join(" · ")}</div>`
      : `<div class="bk-f">Open SOXX Sniper once in this browser to build the 2-year rebalance study; this panel then shows its results here too.</div>`;
    return `<div class="bk-k">
      ${rb ? `<div class="bk-sum"><div><span class="bk-f">Rebalance into today's close</span><b class="${cl(rb.usd)}">${rb.usd > 0 ? "BUY" : "SELL"} ${fmtB(Math.abs(rb.usd))}</b>SOXL ${fmtB(rb.soxl)} · SOXS ${fmtB(rb.soxs)} of chip exposure</div></div>` : ""}
      <ul>
        <li><b>Why it happens.</b> A 3x fund must keep 3x exposure every day. After an up day it is under-exposed and must buy; after a down day it must sell. Size = (L² − L) × assets × index move: 6× for SOXL and 12× for SOXS, and <b>both trade in the direction of the day's move</b>. The swap dealers who hedge the funds do most of it from 3:00 to 4:00 pm and in the closing auction, in the chip stocks (NVDA, AVGO, AMD, MU, …) and in SOXX/SMH.</li>
        <li><b>What market makers do.</b> They see the same arithmetic, so they front-run it in the last hour and take the other side at the close. After 4 pm, liquidity is thin: dealers who are left long or short from the auction re-hedge in after-hours and pre-market, which often pulls price back toward where it was before the push. On big days the forced flow can be a large share of the closing volume, so the overshoot and the reversal are larger.</li>
        <li><b>How to use it.</b> Check the table: if big rebalance days show a high "AH reverses" or "Gap reverses" share, fade the closing push overnight; if the share is low, the push carries. Combine it with the cohort basket above: when smart money on the holdings' perps is on the other side of the rebalance, a reversal is more likely.</li>
        <li><b>Other nightly flows.</b> Index changes and quarterly rebalances (SOXX holdings change each quarter), options expiry pinning (max pain), and creations/redemptions of SOXL/SOXS shares also move the close. Earnings after the bell in a large holding dominate everything else.</li>
      </ul>${tbl}</div>`;
  }

  let cache = null, cacheT = 0;
  async function load(force) {
    if (!force && cache && Date.now() - cacheT < 240000) return cache;
    try { const r = await fetch(DATA_URL + "?t=" + Math.floor(Date.now() / 120000), { cache: "no-store" }); if (r.ok) { cache = await r.json(); cacheT = Date.now(); } } catch (e) { }
    return cache;
  }
  // Lab results that SOXX Sniper saves for the sister site (same browser, same github.io origin)
  const lab = () => { try { return JSON.parse(localStorage.getItem("soxx_lab_share") || "null"); } catch (e) { return null; } };
  window.Basket = { SOXX, AUM, compute, rebalance, html, knowledge, load, lab };
})();
