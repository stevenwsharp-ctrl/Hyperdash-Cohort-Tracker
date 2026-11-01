// Crowd memory: one row per hour describing how the whole Hyperliquid crowd is acting, kept for 3 years (crowd.json).
// The sites use it to see the crowd's mood at any point in the past and to find past moments that "rhyme" with now.
// Row: [t, lev, smart, fools, gap, fund, breadth, move, vix, px[8], pos[8][3]]
//   lev     all traders' long $ share − 0.5 (the whole crowd's tilt)        smart  smart cohorts' bias (−1..1, $-weighted)
//   fools   losing cohorts' bias                                             gap    smart − fools
//   fund    open-interest-weighted funding (per hour, in 1e-7)               breadth share of markets up over 24 h − 0.5
//   move    median 24 h move of all markets (%)                              vix    the VIX
//   px      prices of BTC, ETH, SOL, S&P 500, Nasdaq 100, SOXL, NVDA, gold   pos    their smart bias, fools bias, funding
// First run: fills in from history.json (up to 7 days, hourly). Exit 0 = a row was added, 3 = nothing to do.
// Usage: node scripts/crowd.mjs <outDir>
import { makeIO } from "./lib.mjs";
const OUT = process.argv[2] || "out", io = makeIO(OUT), KEEP = 3 * 365 * 864e5;
const KEYS = ["BTC", "ETH", "SOL", "XYZ:SP500", "XYZ:XYZ100", "XYZ:SOXL", "XYZ:NVDA", "XYZ:GOLD"];
const H = io.read("history.json", { snapshots: [] }), S = H.snapshots || [];
if (!S.length) process.exit(3);
const C = io.read("crowd.json", null) || { v: 1, keys: KEYS, fields: ["t", "lev", "smart", "fools", "gap", "fund", "breadth", "move", "vix", "px", "pos"], rows: [] };
const ctx = io.read("context.json", {}), vixNow = ctx && ctx.vix && ctx.vix.px ? +ctx.vix.px : null;
const T = S.map(s => Date.parse(s.t));
const at = t => { let lo = 0, hi = T.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T[m] <= t) lo = m; else hi = m - 1; } return Math.abs(T[lo] - t) <= 75 * 6e4 ? S[lo] : null; };
const r2 = x => x == null || !isFinite(x) ? null : Math.round(x * 1000) / 1000;
function row(s, vix) {
  const d = s.d || {}, t = Date.parse(s.t), prev = at(t - 864e5);
  let L = 0, Sh = 0, sw = 0, sm = 0, fw = 0, fo = 0, fu = 0, fuw = 0, up = 0, n = 0; const mv = [];
  for (const [c, v] of Object.entries(d)) { const [smB, foB, px, , , smG, , f7, aL, aS] = v; const tot = (aL || 0) + (aS || 0);
    L += aL || 0; Sh += aS || 0; if (smG > 0) { sm += smB / 100 * smG; sw += smG; } if (tot > 0) { fo += foB / 100 * tot; fw += tot; if (f7 != null) { fu += f7 * tot; fuw += tot; } }
    const p0 = prev && prev.d && prev.d[c] ? prev.d[c][2] : null; if (px > 0 && p0 > 0) { const ch = px / p0 - 1; mv.push(ch); n++; if (ch > 0) up++; } }
  mv.sort((a, b) => a - b);
  const smart = sw ? sm / sw : null, fools = fw ? fo / fw : null;
  return [t, r2(L + Sh ? L / (L + Sh) - 0.5 : null), r2(smart), r2(fools), r2(smart != null && fools != null ? smart - fools : null), r2(fuw ? fu / fuw : null),
    r2(n >= 20 ? up / n - 0.5 : null), r2(mv.length ? mv[mv.length >> 1] * 100 : null), vix != null ? Math.round(vix * 100) / 100 : null,
    KEYS.map(k => d[k] && d[k][2] > 0 ? d[k][2] : null), KEYS.map(k => d[k] ? [d[k][0], d[k][1], d[k][7]] : null)];
}
let added = 0;
const last = C.rows.length ? C.rows[C.rows.length - 1][0] : 0;
// fill in the past hours we do not have yet (one row per hour), then the newest snapshot
for (let i = 0; i < S.length; i++) { const t = T[i]; if (t <= last + 55 * 6e4) continue; const prevRow = C.rows.length ? C.rows[C.rows.length - 1][0] : 0; if (t - prevRow < 55 * 6e4) continue;
  const R = row(S[i], i === S.length - 1 ? vixNow : null); if (R[1] == null && R[2] == null) continue; C.rows.push(R); added++; }
C.rows = C.rows.filter(r => Date.now() - r[0] < KEEP);
if (added) { C.at = Date.now(); io.write("crowd.json", C); }
console.log("crowd: +" + added + " rows, " + C.rows.length + " kept");
process.exit(added ? 0 : 3);
