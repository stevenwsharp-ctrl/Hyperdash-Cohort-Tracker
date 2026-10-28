// Build the SOXL trader study page from rep.json.  node build.mjs rep.json soxl-trader-study.html
import fs from "node:fs";
import { timelineSvg, bucketSvg, fmtK, esc } from "./charts.mjs";
const [, , RF, OUT] = process.argv;
const R = JSON.parse(fs.readFileSync(RF, "utf8"));
const $ = v => v == null ? "—" : fmtK(v);
const pct = v => v == null ? "—" : `${v}%`;
const short = a => a.slice(0, 6) + "…" + a.slice(-4);
const link = a => `<a class="addr" href="https://hyperdash.com/address/${a}" target="_blank" rel="noopener" title="${a}">${short(a)}</a>`;
const cls = v => v > 0 ? "up" : v < 0 ? "down" : "";
const px = R.price, peak = px.reduce((m, r) => r[1] > m[1] ? r : m), low = px.filter(r => r[0] > peak[0]).reduce((m, r) => r[1] < m[1] ? r : m, [null, Infinity]);
const fall = Math.round((low[1] / peak[1] - 1) * 100), bounce = Math.round((R.last / low[1] - 1) * 100);
const sumP = L => L.reduce((a, t) => a + t.pnl, 0);
const B = R.bBest, W = R.bWorst, PB = R.posBest, PW = R.posWorst, PA = R.posAll;
const fd = d => new Date(d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const now = t => !t.now ? `<span class="dim">flat</span>` : `<span class="pill ${t.now.side === "long" ? "pl" : "ps"}">${t.now.side}</span> ${fmtK(t.now.usd)} <span class="dim">@ ${t.now.ep} · ${t.now.lev}× · liq ${t.now.lq ?? "—"}</span>`;
const row = (t, i) => `<tr><td class="n">${i + 1}</td><td>${link(t.a)}${t.label ? ` <span class="dim">${esc(t.label)}</span>` : ""}</td><td class="dim">${esc(t.coh || "—")}</td><td class="n ${cls(t.pnl)}">${fmtK(t.pnl)}</td><td class="n">${t.trades.toLocaleString()}</td><td class="n">${pct(t.wr)}</td><td>${esc(t.style === "—" ? "Recent fills only" : t.style)}</td><td class="nowc">${now(t)}</td></tr>`;
const tbl = L => `<div class="tw"><table><thead><tr><th class="n">#</th><th>Wallet</th><th>Hyperdash cohort (all markets)</th><th class="n">SOXL profit</th><th class="n">Trades</th><th class="n">Win rate</th><th>Style</th><th>Position now</th></tr></thead><tbody>${L.map(row).join("")}</tbody></table></div>`;
const cmp = [
  ["Win rate (closed trips)", pct(B.winRate), pct(W.winRate)],
  ["Long trips: win rate · net", `${pct(B.longWin)} · ${fmtK(B.longNet)}`, `${pct(W.longWin)} · ${fmtK(W.longNet)}`],
  ["Short trips: win rate · net", `${pct(B.shortWin)} · ${fmtK(B.shortNet)}`, `${pct(W.shortWin)} · ${fmtK(W.shortNet)}`],
  ["Median hold: winners / losers", `${B.holdWin} h / ${B.holdLoss} h`, `${W.holdWin} h / ${W.holdLoss} h`],
  ["Worst point inside losing trades (median)", `${B.maeLoss}%`, `${W.maeLoss}%`],
  ["Profit given back from the best point (median)", `${B.giveBack}%`, `${W.giveBack}%`],
  ["Adds per position (average)", B.addsPerTrip, W.addsPerTrip],
  ["Positions with a liquidation", `${B.liqTrips} of ${B.trips + B.open} (${Math.round(B.liqTrips / (B.trips + B.open) * 100)}%)`, `${W.liqTrips} of ${W.trips + W.open} (${Math.round(W.liqTrips / (W.trips + W.open) * 100)}%)`],
  ["Median position size", fmtK(B.medSize), fmtK(W.medSize)]
];
const sessRows = ["US pre-market", "US regular hours", "US after-hours", "overnight", "weekend"].map(k => { const b = B.bySess[k] || {}, w = W.bySess[k] || {}; return `<tr><td>${k[0].toUpperCase() + k.slice(1)}</td><td class="n">${b.n ?? 0}</td><td class="n">${pct(b.winRate)}</td><td class="n ${cls(b.net)}">${$(b.net)}</td><td class="n">${w.n ?? 0}</td><td class="n">${pct(w.winRate)}</td><td class="n ${cls(w.net)}">${$(w.net)}</td></tr>`; }).join("");
const holdRows = B.byHold.map((b, i) => { const w = W.byHold[i]; return `<tr><td>${b.l}</td><td class="n">${b.n}</td><td class="n">${pct(b.winRate)}</td><td class="n ${cls(b.net)}">${$(b.net)}</td><td class="n">${w.n}</td><td class="n">${pct(w.winRate)}</td><td class="n ${cls(w.net)}">${$(w.net)}</td></tr>`; }).join("");
const bigRows = R.bigBest.map((b, i) => { const w = R.bigWorst[i]; return `<tr><td>${fd(b.day)}</td><td class="n ${cls(b.move)}">${b.move > 0 ? "+" : ""}${b.move}%</td><td class="n ${cls(b.netBefore)}">${b.netBefore ? fmtK(b.netBefore) : "—"}</td><td class="n ${cls(b.netAfter)}">${b.netAfter ? fmtK(b.netAfter) : "—"}</td><td class="n ${cls(w.netBefore)}">${w.netBefore ? fmtK(w.netBefore) : "—"}</td><td class="n ${cls(w.netAfter)}">${w.netAfter ? fmtK(w.netAfter) : "—"}</td></tr>`; }).join("");
const liqList = (L, side) => L.map(([p, u]) => `<li><b>$${p}</b> <span class="dim">${fmtK(u)} ${side}</span></li>`).join("");
const allLiqL = PA.liqL.filter(x => x[1] >= 100000), bigLong = allLiqL.reduce((m, x) => x[1] > m[1] ? x : m, [0, 0]);

const html = `<title>SOXL Trader Study</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: one reading column (1040px); wide tables scroll inside their own box; charts are inline SVG on the same grid. */
:root{
  --bg:#f2f4f6;--panel:#ffffff;--ink:#101820;--dim:#5b6776;--line:#d9e0e7;--soft:#e9edf1;
  --accent:#a8581b;--best:#0b7a74;--worst:#b02858;--up:#0f845a;--down:#c42f3a;
  --display:'Archivo',ui-sans-serif,system-ui,sans-serif;--body:'IBM Plex Sans',ui-sans-serif,system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#0c1116;--panel:#131a21;--ink:#e6ecf2;--dim:#95a3b3;--line:#253141;--soft:#1a232d;--accent:#e2914f;--best:#3cc0b5;--worst:#ee6d97;--up:#3ccf8e;--down:#ff6f78;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0c1116;--panel:#131a21;--ink:#e6ecf2;--dim:#95a3b3;--line:#253141;--soft:#1a232d;--accent:#e2914f;--best:#3cc0b5;--worst:#ee6d97;--up:#3ccf8e;--down:#ff6f78;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:16px;line-height:1.6}
.wrap{max-width:1040px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:40px 64px}
h1,h2,h3{font-family:var(--display);text-wrap:balance;margin:0;letter-spacing:-.01em}
h1{font-size:clamp(34px,6vw,58px);font-weight:800;line-height:1.02}
h2{font-size:clamp(22px,3vw,30px);font-weight:700;line-height:1.15;margin-bottom:10px}
h3{font-size:17px;font-weight:700;margin-bottom:6px}
p{margin:0 0 12px;max-width:68ch}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);margin-bottom:14px}
.deck{font-size:19px;color:var(--dim);max-width:62ch;margin-top:16px}
.dim{color:var(--dim)}.up{color:var(--up)}.down{color:var(--down)}
.figs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:32px 0 8px}
.fig{background:var(--panel);padding:16px 18px}.fig b{display:block;font-family:var(--display);font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1}.fig span{font-size:13px;color:var(--dim)}
section{margin-top:56px}
.find{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:16px}
.f{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px 18px}
.f h3{display:flex;gap:10px;align-items:baseline}.f h3 i{font-style:normal;font-family:var(--mono);font-size:12px;color:var(--accent)}
.f p{font-size:15px;margin:0}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel);margin-top:14px}
table{border-collapse:collapse;width:100%;font-size:14px;min-width:640px}
th,td{padding:9px 12px;border-bottom:1px solid var(--soft);text-align:left;vertical-align:top}
th{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim);font-weight:500;background:var(--panel);position:sticky;top:0}
tbody tr:last-child td{border-bottom:0}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.nowc{white-space:nowrap;font-variant-numeric:tabular-nums}
.addr{font-family:var(--mono);font-size:13px;color:var(--accent);text-decoration:none;border-bottom:1px dotted currentColor}
.addr:hover,.addr:focus-visible{outline:none;border-bottom-style:solid}
.pill{display:inline-block;font-family:var(--mono);font-size:11px;padding:1px 7px;border-radius:99px;text-transform:uppercase;letter-spacing:.05em}
.pl{background:color-mix(in srgb,var(--up) 16%,transparent);color:var(--up)}.ps{background:color-mix(in srgb,var(--down) 16%,transparent);color:var(--down)}
.cmpt td:nth-child(2){color:var(--best);font-weight:600}.cmpt td:nth-child(3){color:var(--worst);font-weight:600}
.cmpt th:nth-child(2){color:var(--best)}.cmpt th:nth-child(3){color:var(--worst)}
.chart{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px;margin-top:14px;overflow-x:auto}
.chart svg{display:block;width:100%;min-width:560px;height:auto}
svg text{font-family:var(--mono);font-size:12px;fill:var(--dim)}svg .lab{fill:var(--ink);font-size:12px}svg .rl{fill:var(--ink);font-family:var(--body);font-size:13px}svg .val{fill:var(--ink)}svg .val.dim{fill:var(--dim)}
svg .grid{stroke:var(--soft);stroke-width:1}svg .zero{stroke:var(--line);stroke-width:1.5}svg .mid50{stroke:var(--line);stroke-dasharray:3 3}
svg .ln{fill:none;stroke-width:2;stroke-linejoin:round}svg .price{stroke:var(--ink);stroke-width:1.5}svg .best{stroke:var(--best)}svg .worst{stroke:var(--worst)}
svg .bb{fill:var(--best)}svg .bw{fill:var(--worst)}
.key{display:flex;flex-wrap:wrap;gap:16px;font-size:13px;color:var(--dim);margin-top:8px}.key i{display:inline-block;width:14px;height:3px;border-radius:2px;vertical-align:middle;margin-right:6px}
.cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px}
.col{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;min-width:0}
.col ul{list-style:none;margin:8px 0 0;padding:0;font-family:var(--mono);font-size:13px}.col li{display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px solid var(--soft)}.col li:last-child{border:0}
.big{font-family:var(--display);font-size:30px;font-weight:800;font-variant-numeric:tabular-nums}
.rules{counter-reset:r;list-style:none;padding:0;margin:14px 0 0;display:grid;gap:10px}
.rules li{counter-increment:r;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px 14px 56px;position:relative}
.rules li::before{content:counter(r);position:absolute;left:16px;top:12px;font-family:var(--display);font-weight:800;font-size:22px;color:var(--accent)}
.rules b{display:block}
.note{font-size:14px;color:var(--dim);border-left:3px solid var(--line);padding-left:14px;margin-top:14px;max-width:72ch}
footer{margin-top:56px;font-size:13px;color:var(--dim)}
@media (max-width:760px){.figs{grid-template-columns:repeat(2,minmax(0,1fr))}.find,.cols{grid-template-columns:minmax(0,1fr)}}
</style>
<div class="wrap">
<header>
  <div class="eyebrow">Hyperliquid · xyz:SOXL perpetual · ${fd(R.listing)} – ${fd(R.t.slice(0, 10))}, 2026</div>
  <h1>Who wins on SOXL, and how they do it</h1>
  <p class="deck">A study of ${R.walletsStudied} wallets that trade SOXL on Hyperliquid: ${(101246).toLocaleString()} fills, full SOXL profit from Hyperdash, and the open positions of each wallet. SOXL fell ${Math.abs(fall)}% from $${peak[1]} (${fd(peak[0])}) to $${low[1]} (${fd(low[0])}) and is now $${R.last}, ${bounce}% above the low.</p>
</header>
<div class="figs">
  <div class="fig"><b class="${cls(R.totals.hdPnlAll)}">${fmtK(R.totals.hdPnlAll)}</b><span>net SOXL profit of all ${R.walletsStudied} wallets</span></div>
  <div class="fig"><b class="up">${fmtK(R.best[0].pnl)}</b><span>the best wallet, in ${R.best[0].trades} trades</span></div>
  <div class="fig"><b>${PB.shorts} of ${PB.holders}</b><span>of the top 20 are short now</span></div>
  <div class="fig"><b class="down">${fmtK(W.longNet)}</b><span>lost by the 15 worst on long trades</span></div>
</div>

<section>
  <h2>What the data shows</h2>
  <div class="find">
    <div class="f"><h3><i>01</i>The money went to the short side</h3><p>In the October crash, the best traders were short. The worst traders bought the dips and held them. The 15 worst lost ${fmtK(-W.longNet)} on long trades and won only ${W.longWin}% of them.</p></div>
    <div class="f"><h3><i>02</i>They trade with the move</h3><p>The best won ${B.byR24[4].winRate}% of trades that they opened after a move of 8% or more in their direction. They won only ${B.byR24[0].winRate}% of trades opened after a move of 8% or more against them.</p></div>
    <div class="f"><h3><i>03</i>They cut losers fast and let big trades run</h3><p>The best close a losing trade in ${B.holdLoss} h (median). Their few holds of more than 3 days won ${B.byHold[4].winRate}% and made ${fmtK(B.byHold[4].net)}. The worst held losers for days: ${W.byHold[4].winRate}% win and ${fmtK(W.byHold[4].net)}.</p></div>
    <div class="f"><h3><i>04</i>They add less and get liquidated less</h3><p>The best add ${B.addsPerTrip} times per position, the worst ${W.addsPerTrip} times. ${Math.round(B.liqTrips / (B.trips + B.open) * 100)}% of the best positions had a liquidation, against ${Math.round(W.liqTrips / (W.trips + W.open) * 100)}% for the worst.</p></div>
    <div class="f"><h3><i>05</i>Pre-market and overnight hurt the worst most</h3><p>The worst lost ${fmtK(-(W.bySess["US pre-market"] || {}).net || 0)} on trades opened in the US pre-market and ${fmtK(-(W.bySess.overnight || {}).net || 0)} overnight. The best made ${fmtK((B.bySess["US pre-market"] || {}).net || 0)} in the pre-market.</p></div>
    <div class="f"><h3><i>06</i>Copy the rules, not single trades</h3><p>Changes in the position of the best traders do not predict the next 24 hours (correlation ${R.leadBest.corrFwd}). Their edge comes from direction in a trend and from risk control, not from short-term timing.</p></div>
  </div>
</section>

<section>
  <h2>The 20 best SOXL traders</h2>
  <p>Ranked by full SOXL profit from Hyperdash. Only wallets with 3 or more SOXL trades. Market makers are not in the list. The cohort label is Hyperdash's label for profit on all markets, so a wallet can be “Rekt” overall and still win on SOXL.</p>
  ${tbl(R.best)}
  <p class="note">Together these 20 wallets made ${fmtK(sumP(R.best))} on SOXL. “Recent fills only” means the wallet trades so much that Hyperliquid keeps only its last few days of fills, so its style is not clear from the fills.</p>
</section>

<section>
  <h2>How the best trade it, next to the worst</h2>
  <p>Trade-level numbers for the 15 best and the 15 worst wallets, from their SOXL fills (closed round trips).</p>
  <div class="tw"><table class="cmpt"><thead><tr><th>Measure</th><th>15 best</th><th>15 worst</th></tr></thead><tbody>${cmp.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</tbody></table></div>
</section>

<section>
  <h2>When they open trades</h2>
  <p>Win rate by the SOXL move in the 24 hours before the entry, measured in the direction of the trade. A long after a 10% rise and a short after a 10% fall are both “after a big move its way”. Each bar shows the win rate and the number of trades.</p>
  <div class="chart">${bucketSvg(B.byR24, W.byR24, "Win rate by the 24-hour move before the entry")}</div>
  <div class="key"><span><i style="background:var(--best)"></i>15 best</span><span><i style="background:var(--worst)"></i>15 worst</span></div>
  <p style="margin-top:18px">Win rate by where the entry was in the 5-day high–low range, for the side of the trade. “Top quarter” means a long near the 5-day high or a short near the 5-day low.</p>
  <div class="chart">${bucketSvg(B.byPos5d, W.byPos5d, "Win rate by place in the 5-day range")}</div>
  <p class="note">The best win most when they join a strong move. They do not try to catch the bottom: their trades against a big move won ${B.byR24[0].winRate}% of the time.</p>
</section>

<section>
  <h2>How long they hold</h2>
  <div class="tw"><table><thead><tr><th>Hold time</th><th class="n">Best: trades</th><th class="n">Win</th><th class="n">Net</th><th class="n">Worst: trades</th><th class="n">Win</th><th class="n">Net</th></tr></thead><tbody>${holdRows}</tbody></table></div>
  <h3 style="margin-top:26px">When in the day they open trades</h3>
  <div class="tw"><table><thead><tr><th>Session (US Eastern)</th><th class="n">Best: trades</th><th class="n">Win</th><th class="n">Net</th><th class="n">Worst: trades</th><th class="n">Win</th><th class="n">Net</th></tr></thead><tbody>${sessRows}</tbody></table></div>
</section>

<section>
  <h2>Position against price, last 60 days</h2>
  <p>The combined net position (US$) of the 10 best and the 10 worst wallets, every 6 hours, with the SOXL price. Only wallets with known history at each point count.</p>
  <div class="chart">${timelineSvg(R.timeline)}</div>
  <div class="key"><span><i style="background:var(--ink)"></i>SOXL price</span><span><i style="background:var(--best)"></i>10 best, net position</span><span><i style="background:var(--worst)"></i>10 worst, net position</span></div>
  <h3 style="margin-top:26px">The largest SOXL days</h3>
  <div class="tw"><table><thead><tr><th>Day</th><th class="n">SOXL move</th><th class="n">Best: net before</th><th class="n">Best: net after</th><th class="n">Worst: net before</th><th class="n">Worst: net after</th></tr></thead><tbody>${bigRows}</tbody></table></div>
  <p class="note">Before the ${fd(R.bigBest[R.bigBest.length - 1].day)} drop (${R.bigBest[R.bigBest.length - 1].move}%), the best were net short ${fmtK(-R.bigBest[R.bigBest.length - 1].netBefore)} and added to ${fmtK(-R.bigBest[R.bigBest.length - 1].netAfter)} after it. “—” means no wallet in the group had known history on that day.</p>
</section>

<section>
  <h2>Where they stand now</h2>
  <div class="cols">
    <div class="col"><h3 style="color:var(--best)">Top 20</h3><div class="big">${PB.shorts} short · ${PB.longs} long</div><p class="dim" style="margin:6px 0 0">Short ${fmtK(PB.shortUsd)} against long ${fmtK(PB.longUsd)}: net ${fmtK(PB.net)}. Average short entry $${PB.avgEntryS}, median leverage ${PB.medLev}×.</p></div>
    <div class="col"><h3 style="color:var(--worst)">Worst 20</h3><div class="big">${PW.shorts} short · ${PW.longs} long</div><p class="dim" style="margin:6px 0 0">Short ${fmtK(PW.shortUsd)} against long ${fmtK(PW.longUsd)}: net ${fmtK(PW.net)}. Their longs entered near $${PW.avgEntryL} on average.</p></div>
    <div class="col"><h3>All ${PA.holders} holders</h3><div class="big">${PA.longs} long · ${PA.shorts} short</div><p class="dim" style="margin:6px 0 0">More accounts are long, but the dollars are close: long ${fmtK(PA.longUsd)}, short ${fmtK(PA.shortUsd)}. Median leverage ${PA.medLev}×.</p></div>
  </div>
  <div class="cols">
    <div class="col"><h3>Liquidation prices of the top-20 shorts</h3><ul>${liqList(PB.liqS, "short")}</ul></div>
    <div class="col"><h3>Liquidation prices of the top-20 longs</h3><ul>${liqList(PB.liqL, "long")}</ul></div>
    <div class="col"><h3>Largest long liquidations below</h3><ul>${liqList(PA.liqL.filter(x => x[1] >= 50000), "long")}</ul></div>
  </div>
  <p class="note">A ${fmtK(bigLong[1])} long at 10× leverage liquidates at $${bigLong[0]}, about ${Math.round((1 - bigLong[0] / R.last) * 100)}% below the price at the time of the study ($${R.last}). The largest loser on SOXL (${fmtK(R.worst[0].pnl)}) holds a ${fmtK(R.worst[0].now ? R.worst[0].now.usd : 0)} long at 10× with liquidation at $${R.worst[0].now ? R.worst[0].now.lq : "—"}. The first short liquidations of the top 20 start near $${PB.liqS[0] ? PB.liqS[0][0] : "—"}.</p>
</section>

<section>
  <h2>The 20 worst SOXL traders</h2>
  <p>The same ranking from the bottom. Most of the losses come from a few large leveraged longs held through the October fall.</p>
  ${tbl(R.worst)}
</section>

<section>
  <h2>The playbook, in seven rules</h2>
  <ol class="rules">
    <li><b>Trade in the direction of the trend.</b>In a falling market, the best were short and added to shorts after each large drop. They did not buy the dips.</li>
    <li><b>Join strong moves, do not fade them.</b>Entries after an 8% or larger move in the trade's direction won ${B.byR24[4].winRate}%. Entries against such a move won ${B.byR24[0].winRate}%.</li>
    <li><b>Close a losing trade fast.</b>The median losing trade of the best lasted ${B.holdLoss} h and went ${B.maeLoss}% against them at worst. Do not hold a loser for days.</li>
    <li><b>Let a winning trend trade run.</b>Most of the best profit came from a few multi-day trades in the trend direction.</li>
    <li><b>Do not average down without a limit.</b>The worst added ${W.addsPerTrip} times per position on average and had liquidations in ${Math.round(W.liqTrips / (W.trips + W.open) * 100)}% of positions.</li>
    <li><b>Be careful when US stocks are closed.</b>The SOXL perpetual trades 24/7, but the worst lost most on trades opened in the pre-market and overnight.</li>
    <li><b>Watch the liquidation levels.</b>Large 10× longs liquidate at $${bigLong[0]} and lower. A fall to those levels can force sales and speed up the move.</li>
  </ol>
</section>

<section>
  <h2>Method and limits</h2>
  <p class="note" style="margin-top:0">Wallets: every wallet that changed its SOXL position by 40 or more units in the 7 days to ${fd(R.t.slice(0, 10))}, plus the 30 largest and the 30 most and least profitable current holders on Hyperdash (${R.walletsStudied} wallets with SOXL activity). Profit and trade counts: Hyperdash per-market stats (full history). Trade behavior: Hyperliquid fills, rebuilt into round trips with the hourly SOXL price for context. Hyperliquid keeps only the last 10,000 fills of a wallet, so the behavior numbers for very active wallets cover only their recent trades. SOXL on Hyperliquid has traded only since ${fd(R.listing)}, mostly in one large fall, so these patterns may not hold in a rising market. Market makers (40 or more trips with a median hold under 30 minutes) are left out of the rankings. This is not investment advice.</p>
</section>
<footer>Data: Hyperliquid info API and Hyperdash, collected ${R.t.slice(0, 16).replace("T", " ")} UTC. Wallet links open the wallet on Hyperdash.</footer>
</div>`;
fs.writeFileSync(OUT, html);
console.log("written", OUT, html.length);
