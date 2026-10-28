// SVG chart helpers for the SOXL trader report. Colors come from CSS classes (theme tokens).
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtK = v => { const a = Math.abs(v); return (v < 0 ? "−" : "") + "$" + (a >= 1e6 ? (a / 1e6).toFixed(1) + "M" : a >= 1e3 ? Math.round(a / 1e3) + "K" : Math.round(a)); };
export { fmtK, esc };

// Price line (top) + net $ position of best 10 and worst 10 (bottom), shared time axis.
export function timelineSvg(tl) {
  const W = 960, H = 420, L = 64, R = 16, T = 16, mid = 200, B = 30;
  const n = tl.length, x = i => L + i / (n - 1) * (W - L - R);
  const px = tl.map(r => r[1]), pmin = Math.min(...px), pmax = Math.max(...px);
  const yP = v => T + (pmax - v) / (pmax - pmin) * (mid - T - 20);
  const pos = tl.flatMap(r => [r[2], r[3]]), m = Math.max(...pos.map(Math.abs)) || 1;
  const y0 = mid + 20 + (H - B - mid - 20) / 2, sc = (H - B - mid - 20) / 2 / m, yQ = v => y0 - v * sc;
  const path = (f, yy) => tl.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yy(f(r)).toFixed(1)}`).join("");
  const ticksP = [pmin, (pmin + pmax) / 2, pmax].map(v => `<text class="ax" x="${L - 8}" y="${yP(v) + 4}" text-anchor="end">$${v.toFixed(0)}</text><line class="grid" x1="${L}" x2="${W - R}" y1="${yP(v)}" y2="${yP(v)}"/>`).join("");
  const ticksQ = [m, 0, -m].map(v => `<text class="ax" x="${L - 8}" y="${yQ(v) + 4}" text-anchor="end">${fmtK(v)}</text><line class="${v ? "grid" : "zero"}" x1="${L}" x2="${W - R}" y1="${yQ(v)}" y2="${yQ(v)}"/>`).join("");
  const days = []; for (let i = 0; i < n; i += 28) days.push([i, tl[i][0].slice(5, 10)]);   // one label per 7 days (6-hour points)
  const xt = days.map(([i, d]) => `<text class="ax" x="${x(i)}" y="${H - 8}" text-anchor="middle">${d.replace("-", "/")}</text>`).join("");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="SOXL price and net position of the best and worst traders">
  ${ticksP}${ticksQ}
  <text class="lab" x="${L}" y="${T - 2}">SOXL price</text>
  <text class="lab" x="${L}" y="${mid + 14}">Net position, US$ (above 0 = net long)</text>
  <path class="ln price" d="${path(r => r[1], yP)}"/>
  <path class="ln best" d="${path(r => r[2], yQ)}"/>
  <path class="ln worst" d="${path(r => r[3], yQ)}"/>
  ${xt}
</svg>`;
}

// Horizontal bars: win rate per bucket for best vs worst, with trade counts.
export function bucketSvg(bb, bw, title) {
  const rows = bb.map((b, i) => ({ l: b.l, b, w: bw[i] }));
  const W = 960, rowH = 46, L = 330, R = 70, H = rows.length * rowH + 34;
  const x = v => L + v / 100 * (W - L - R);
  const bar = (r, k, y, cls) => r && r.n ? `<rect class="${cls}" x="${L}" y="${y}" width="${Math.max(1, x(r.winRate) - L)}" height="14" rx="2"/><text class="val" x="${x(r.winRate) + 6}" y="${y + 11}">${r.winRate}% · ${r.n}</text>` : `<text class="val dim" x="${L + 4}" y="${y + 11}">no trades</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
  <line class="mid50" x1="${x(50)}" x2="${x(50)}" y1="4" y2="${H - 26}"/><text class="ax" x="${x(50)}" y="${H - 8}" text-anchor="middle">50%</text>
  ${rows.map((r, i) => { const y = 8 + i * rowH; return `<text class="rl" x="${L - 12}" y="${y + 18}" text-anchor="end">${esc(r.l)}</text>${bar(r.b, "b", y, "bb")}${bar(r.w, "w", y + 17, "bw")}`; }).join("")}
</svg>`;
}
