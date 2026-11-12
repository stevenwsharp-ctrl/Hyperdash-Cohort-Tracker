// Cohort Sniper · the bet lab. Hypothetical bets on every liquid Hyperliquid market (coins, stock perps, ETFs, commodities),
// tested on daily history, plus a profile of each market: what it is, where it is in its life, how it compares to its own past
// and to its peers. Runs once a day (and on demand) in GitHub Actions; writes lab.json to the "lab" branch.
// Profile per market:
//   identity  class, sector, industry (peer group), size, listing year (tax.js), days since its Hyperliquid listing
//   life      Weinstein stage from the 150-day average (1 base, 2 advance, 3 top, 4 decline), distance from its all-time high
//             and low, 52-week position, drawdown age; for stocks the company's longer history comes from Yahoo
//   own past  returns over 7 / 30 / 90 days, distance from the 50- and 150-day averages, volatility now vs its own normal,
//             the biggest 14-day pump or crash, and how far it has come back from it
//   peers     30-day return vs the median of its industry (relative strength), the industry's own 30-day move vs all
//             industries (rotation), beta and correlation to its market (Bitcoin for coins, the S&P 500 perp for the rest)
// Hypotheses (each scores every market from -1 short to +1 long using only data known that day):
//   stage, rs-peer, laggard, group-mom, new-listing, ath, pump-fade, beta-tide, vol-squeeze, young-small
// Bets: every horizon (2 or 7 days), the top 6 longs and top 6 shorts by score; entry is a LIMIT order 1/4 sigma of the horizon
// better than that day's close, alive for the first quarter of the horizon (at least 1 day); a bet counts only if it fills;
// exit at market at the end. Result = long return minus short return, each vs the average market (costs 0.1% a round trip).
// Each hypothesis: all bets, first half vs second half (the second half is the check), by class and by industry.
// Usage: node scripts/lab.mjs <outDir> <latest.json>
import fs from "node:fs"; import vm from "node:vm"; import path from "node:path";
import { http } from "./lib.mjs";
const [OUT = "lab", LATEST = "latest.json"] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => process.env.LAB_MOCK ? null : new Promise(r => setTimeout(r, ms)), D = 864e5, c1 = v => Math.max(-1, Math.min(1, v));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
// taxonomy (the browser file, run in a sandbox)
const ctxT = { window: {}, console }; vm.createContext(ctxT); vm.runInContext(fs.readFileSync(new URL("../tax.js", import.meta.url), "utf8"), ctxT); const Tax = ctxT.window.Tax;
const L = JSON.parse(fs.readFileSync(LATEST, "utf8")), CTX = L.ctx || {};
const hlName = c => { const x = CTX[c]; if (x && x.n) return x.n; const i = c.indexOf(":"); return i < 0 ? c : c.slice(0, i).toLowerCase() + ":" + c.slice(i + 1); };
// The last lab.json (lab.yml saves it as lab_prev.json; absent in mock runs or on the first run).
const PREV = (() => { try { return JSON.parse(fs.readFileSync(process.env.LAB_PREV || "lab_prev.json", "utf8")); } catch (e) { return null; } })();
// Universe (EV agent, 2026-11-12): 24 h volume >= $0.5 M, plus the markets of the last run while their volume stays >= $0.1 M.
// Before, the universe followed the day's volume only (205, 190, 172, 167, 179 markets on Nov 10-12), and the walk-forward
// picks and the rulings changed from run to run with it. Same cap (220, largest volume first).
const prevU = new Set(PREV && PREV.prof ? Object.keys(PREV.prof) : []);
const universe = Object.keys(CTX).filter(c => (CTX[c].v || 0) >= 5e5 || (prevU.has(c) && (CTX[c].v || 0) >= 1e5)).sort((a, b) => CTX[b].v - CTX[a].v).slice(0, 220);
log("universe", universe.length, "kept from the last run by the lower floor:", universe.filter(c => (CTX[c].v || 0) < 5e5).length);
const post = b => http("https://api.hyperliquid.xyz/info", { method: "POST", tries: 3, timeoutMs: 20000, body: JSON.stringify(b), headers: { "content-type": "application/json" } });
let MS = 7; const MR = () => { MS = (MS * 16807) % 2147483647; return MS / 2147483647; };
const mock = n => { let p = 50 + MR() * 100; const t0 = Math.floor(Date.now() / D) * D; return Array.from({ length: n }, (_, i) => { const o = p; p *= Math.exp((MR() - 0.5) * 0.08); return [t0 - (n - 1 - i) * D, o, Math.max(o, p) * 1.01, Math.min(o, p) * 0.99, p, 1e6]; }); };   // LAB_MOCK=1: random walks, for testing the script offline
async function hlDaily(c) { if (process.env.LAB_MOCK) return mock(100 + Math.floor(MR() * 900)); try { const k = await post({ type: "candleSnapshot", req: { coin: hlName(c), interval: "1d", startTime: Date.now() - 1200 * D, endTime: Date.now() } }); return Array.isArray(k) ? k.map(b => [b.t, +b.o, +b.h, +b.l, +b.c, +b.v]).filter(b => b[4] > 0) : []; } catch (e) { return []; } }
async function yahoo(sym) { if (process.env.LAB_MOCK) return mock(1200); try { const j = await http(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5y`, { tries: 2, timeoutMs: 15000, headers: { "user-agent": "Mozilla/5.0" } }); const r = j.chart.result[0], q = r.indicators.quote[0], ad = (r.indicators.adjclose && r.indicators.adjclose[0] && r.indicators.adjclose[0].adjclose) || q.close;
  // split- and dividend-adjusted: scale open, high and low by the same factor as the close (a reverse split is not a crash)
  return r.timestamp.map((t, i) => { const k = q.close[i] > 0 && ad[i] > 0 ? ad[i] / q.close[i] : 1; return [t * 1000, q.open[i] * k, q.high[i] * k, q.low[i] * k, ad[i], q.volume[i] || 0]; }).filter(b => b[4] > 0 && b[2] > 0 && b[3] > 0); } catch (e) { return []; } }
const M = {};
for (const c of universe) { const tg = Tax.tag(c), hl = await hlDaily(c); await sleep(220); let yh = [];
  if (["Stock", "ETF"].includes(tg.cls) && hl.length < 400) { yh = await yahoo(tg.s || c.split(":").pop()); await sleep(150); }
  const B = hl.length >= 200 ? hl : yh.length > hl.length ? yh : hl; if (B.length < 60) continue;
  M[c] = { c, s: c.split(":").pop(), tg, B, hlFirst: hl.length ? hl[0][0] : null, long: yh.length > B.length ? yh : B, src: B === hl ? "hl" : "yahoo" }; }
log("loaded", Object.keys(M).length);
// ---------- features at a day index ----------
const dayKey = t => Math.floor(t / D);
const at = (m, day) => { const B = m.B; let lo = 0, hi = B.length - 1, j = -1; while (lo <= hi) { const k = (lo + hi) >> 1; if (dayKey(B[k][0]) <= day) { j = k; lo = k + 1; } else hi = k - 1; } return j; };
const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1), sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const ret = (B, j, n) => j - n >= 0 ? Math.log(B[j][4] / B[j - n][4]) : null;
function feat(m, day) {
  const B = m.B, j = at(m, day); if (j < 60 || dayKey(B[j][0]) < day - 4) return null; const px = B[j][4], c = B.slice(0, j + 1).map(b => b[4]);
  const ma = n => j + 1 >= n ? mean(c.slice(-n)) : null, m150 = ma(150) || ma(100) || ma(60), m150p = j >= 170 ? mean(c.slice(-170, -20)) : null, m50 = ma(50);
  const slope = m150 && m150p ? m150 / m150p - 1 : null; let stage = 0;
  if (slope != null) stage = px > m150 && slope > 0.02 ? 2 : px < m150 && slope < -0.02 ? 4 : slope >= -0.02 && slope <= 0.02 ? (ret(B, j, 120) > 0.25 ? 3 : 1) : px > m150 ? 1 : 3;
  const r = []; for (let k = Math.max(1, j - 119); k <= j; k++) r.push(Math.log(B[k][4] / B[k - 1][4])); const v20 = sd(r.slice(-20)) * Math.sqrt(365), v120 = sd(r) * Math.sqrt(365);
  const LB = m.long, lj = (() => { let lo = 0, hi = LB.length - 1, k = -1; while (lo <= hi) { const q = (lo + hi) >> 1; if (dayKey(LB[q][0]) <= day) { k = q; lo = q + 1; } else hi = q - 1; } return k; })();
  const hist = LB.slice(0, lj + 1), ath = Math.max(...hist.map(b => b[2])), atl = Math.min(...hist.map(b => b[3])), w52 = hist.slice(-252), hi52 = Math.max(...w52.map(b => b[2])), lo52 = Math.min(...w52.map(b => b[3]));
  let pump = 0; for (let k = Math.max(14, j - 30); k <= j; k++) { const g = Math.log(B[k][4] / B[k - 14][4]); if (Math.abs(g) > Math.abs(pump)) pump = g; }
  const ageHL = m.hlFirst ? (day * D - m.hlFirst) / D : null;
  return { px, j, stage, slope, d150: m150 ? px / m150 - 1 : null, d50: m50 ? px / m50 - 1 : null, r7: ret(B, j, 7), r30: ret(B, j, 30), r90: ret(B, j, 90), v20, v120, vr: v120 ? v20 / v120 : null, sdD: v20 / Math.sqrt(365) || 0.03,
    ath, athD: px / ath - 1, atlU: px / atl - 1, pos52: hi52 > lo52 ? (px - lo52) / (hi52 - lo52) : 0.5, pump, fromPump: pump ? Math.log(px / B[j - Math.min(j, 14)][4]) : 0, ageHL, rets: r.slice(-90) };
}
// ---------- peers and market at a day ----------
function cross(day) {
  const F = {}; for (const c in M) { const f = feat(M[c], day); if (f) F[c] = f; }
  const G = {}; for (const c in F) { const g = M[c].tg.ind || M[c].tg.cls; (G[g] = G[g] || []).push(c); }
  const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
  const gR = {}; for (const g in G) { const a = G[g].map(c => F[c].r30).filter(v => v != null); gR[g] = a.length ? med(a) : 0; }
  const gz = (() => { const v = Object.values(gR), m = mean(v), s = sd(v) || 1; return g => (gR[g] - m) / s; })();
  const bench = c => M[c].tg.cls === "Crypto" ? "BTC" : "XYZ:SP500";
  for (const c in F) { const f = F[c], g = M[c].tg.ind || M[c].tg.cls, peers = G[g].filter(x => x !== c && F[x].r30 != null);
    f.grp = g; f.grpR30 = gR[g]; f.grpZ = gz(g); f.nPeers = peers.length;
    const pr = peers.map(x => F[x].r30), pm = pr.length ? med(pr) : null, ps = pr.length >= 3 ? sd(pr) : null; f.rel30 = f.r30 != null && pm != null ? f.r30 - pm : null; f.relZ = f.rel30 != null && ps ? f.rel30 / ps : null;
    const b = F[bench(c)]; if (b && c !== bench(c)) { const n = Math.min(f.rets.length, b.rets.length, 90), x = f.rets.slice(-n), y = b.rets.slice(-n), mx = mean(x), my = mean(y); let cv = 0, vy = 0, vx = 0; for (let i = 0; i < n; i++) { cv += (x[i] - mx) * (y[i] - my); vy += (y[i] - my) ** 2; vx += (x[i] - mx) ** 2; } f.beta = vy ? cv / vy : null; f.corr = vx && vy ? cv / Math.sqrt(vx * vy) : null; f.benchTrend = b.d50; } }
  return F;
}
// ---------- hypotheses ----------
const HYP = {
  "stage": { d: "Weinstein stage: long stage 2 (rising 150-day average, price above), short stage 4 (falling, price below)", f: f => f.stage === 2 ? c1(0.5 + (f.slope || 0) * 5) : f.stage === 4 ? -c1(0.5 - (f.slope || 0) * 5) : 0 },
  "rs-peer": { d: "Relative strength vs its industry: long the leaders of their peer group, short the laggards (30 days)", f: f => f.relZ != null && f.nPeers >= 3 ? c1(f.relZ / 2) : 0 },
  "laggard": { d: "Catch-up: long laggards of a rising industry, short leaders of a falling one (peers pull it back in line)", f: f => f.relZ == null || f.nPeers < 3 ? 0 : f.grpR30 > 0.05 && f.relZ < -1 ? c1(-f.relZ / 2) : f.grpR30 < -0.05 && f.relZ > 1 ? -c1(f.relZ / 2) : 0 },
  "group-mom": { d: "Sector rotation: long the strongest industries, short the weakest (30-day median move vs all industries)", f: f => c1(f.grpZ / 2) },
  "new-listing": { d: "Young listings: short markets listed on Hyperliquid in the last 90 days (supply unlocks, hype fading)", f: f => f.ageHL != null && f.ageHL < 90 ? -0.7 : f.ageHL != null && f.ageHL > 365 ? 0.1 : 0 },
  "ath": { d: "Life cycle: long near all-time highs (within 10%: nothing overhead), short broken charts (over 80% below the high, still in stage 4)", f: f => f.athD > -0.1 ? 0.7 : f.athD < -0.8 && f.stage === 4 ? -0.7 : 0 },
  "pump-fade": { d: "Fade the extreme: after a 14-day move over ±50%, bet on part of it coming back", f: f => Math.abs(f.pump) > 0.4 ? -c1(f.pump / 0.8) : 0 },
  "beta-tide": { d: "Tide: when its market (Bitcoin or the S&P 500) is above its 50-day average, long the high-beta names; below, short them", f: f => f.beta == null || f.benchTrend == null ? 0 : c1(Math.sign(f.benchTrend) * (f.beta - 1)) },
  "vol-squeeze": { d: "Coiled spring: volatility at under 60% of its own normal; bet in the direction of the last 7 days", f: f => f.vr != null && f.vr < 0.6 && f.r7 ? Math.sign(f.r7) * 0.6 : 0 },
  "young-small": { d: "Life stage of the company or coin: young (listed 2021 or later) and small or mid size = long; old giants = short (risk appetite factor)", f: (f, m) => { const t = m.tg; if (!t.yr) return 0; const cap = String(t.cap || ""), young = t.yr >= 2021, small = /small|mid/i.test(cap); return young && small ? 0.6 : !young && /mega/i.test(cap) ? -0.4 : 0; } },
};
// ---------- the bets ----------
const days = []; { const all = Object.values(M).flatMap(m => [dayKey(m.B[0][0]), dayKey(m.B[m.B.length - 1][0])]); const d1 = Math.max(...Object.values(M).map(m => dayKey(m.B[m.B.length - 1][0]))); for (let d = d1 - 420; d <= d1; d++) days.push(d); }
const lastDay = days[days.length - 1], CACHE = {};
const crossAt = d => CACHE[d] || (CACHE[d] = cross(d));
// excursions with NO stop and NO target: the worst point against the bet (max drawdown, MAE) and the best point for it (max profit, MFE)
// between the fill and the exit, from daily highs and lows, as a fraction of the entry (MAE ≤ 0, MFE ≥ 0)
function excur(B, k, e, en, side) { let lo = Infinity, hi = -Infinity; for (let q = k; q <= e; q++) { lo = Math.min(lo, B[q][3]); hi = Math.max(hi, B[q][2]); }
  return side > 0 ? { mae: Math.min(0, lo / en - 1), mfe: Math.max(0, hi / en - 1) } : { mae: Math.min(0, 1 - hi / en), mfe: Math.max(0, 1 - lo / en) }; }
const qtl = (a, q) => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]; };
function exStats(X) { if (X.length < 8) return null; const r4x = v => v == null ? null : Math.round(v * 1e4) / 1e4, win = X.filter(x => x.r > 0), lose = X.filter(x => x.r <= 0);
  return { n: X.length, mae50: r4x(qtl(X.map(x => x.mae), 0.5)), mae90: r4x(qtl(X.map(x => x.mae), 0.1)), mfe50: r4x(qtl(X.map(x => x.mfe), 0.5)), mfe90: r4x(qtl(X.map(x => x.mfe), 0.9)),
    winMae80: win.length >= 5 ? r4x(qtl(win.map(x => x.mae), 0.2)) : null,      // 80% of the winners never went further against the bet than this: a stop beyond it rarely kills a winner
    loseMfe50: lose.length >= 5 ? r4x(qtl(lose.map(x => x.mfe), 0.5)) : null,   // half of the losers were up at least this much on the way: profit that a target could have kept
    capture: r4x(qtl(X.filter(x => x.mfe > 0.005).map(x => x.r / x.mfe), 0.5)) }; }   // median share of the best point kept by holding to the end
function bet(m, f, d, side, h) {   // limit entry 1/4 sigma_h better, alive max(1, h/4) days; exit at market after h days
  const B = m.B, j = f.j, sH = f.sdD * Math.sqrt(h), lp = f.px * Math.exp(-side * 0.25 * sH), w = Math.max(1, Math.floor(h / 4));
  for (let k = j + 1; k <= Math.min(B.length - 1, j + w); k++) { if (side > 0 ? B[k][3] <= lp : B[k][2] >= lp) { const e = j + h; if (e >= B.length || dayKey(B[e][0]) > d + h + 4) return { open: 1 }; const en = side > 0 ? Math.min(lp, B[k][1]) : Math.max(lp, B[k][1]); return { r: Math.log(B[e][4] / en), fill: 1, ...excur(B, k, e, en, side) }; } }
  return { r: null, fill: 0 };
}
const st = a => { if (!a.length) return null; const m = mean(a), s = sd(a); return { n: a.length, m, hit: a.filter(v => v > 0).length / a.length, t: s ? m / s * Math.sqrt(a.length) : 0 }; };
function baseAt(F, U, d, h) { const K = h + ":" + d; if (BASEC[K]) return BASEC[K]; const base = {}; for (const side of [1, -1]) { const a = U.map(c => bet(M[c], F[c], d, side, h)).filter(b => b.fill && b.r != null).map(b => side * b.r); base[side] = a.length ? mean(a) : 0; } return (BASEC[K] = base); }   // the same for every hypothesis on a day: computed once
const RES = {}, ROWS = {}, BASEC = {};
for (const h of [1, 2, 7]) for (const [name, H] of Object.entries(HYP)) {
  const steps = []; for (let d = days[0] + 150; d + h <= lastDay; d += h) steps.push(d);
  const rows = [], byC = {}, byI = {}, EX = []; let orders = 0, fills = 0;
  for (const d of steps) { const F = crossAt(d), U = Object.keys(F).filter(c => (M[c].B[F[c].j][5] * F[c].px > 0)); if (U.length < 25) continue;
    // baseline: the same limit-order bet on EVERY market, per side, so a hypothesis is judged only on what it picks
    // (a limit filled on a dip has its own bias; comparing with the plain market move would credit that to the hypothesis)
    const base = baseAt(F, U, d, h);
    const S = U.map(c => ({ c, s: H.f(F[c], M[c]) })).filter(x => Math.abs(x.s) >= 0.3);
    const Lg = S.filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6), Sh = S.filter(x => x.s < 0).sort((a, b) => a.s - b.s).slice(0, 6); if (!Lg.length && !Sh.length) continue;
    const res = (x, side) => { orders++; const b = bet(M[x.c], F[x.c], d, side, h); if (b.open || !b.fill || b.r == null) return null; fills++; EX.push({ mae: b.mae, mfe: b.mfe, r: side * b.r }); const v = side * b.r - base[side] - 0.001; const t = M[x.c].tg, k1 = t.cls, k2 = t.ind || t.cls;
      (byC[k1] = byC[k1] || []).push(v); (byI[k2] = byI[k2] || []).push(v); return v; };
    const lv = Lg.map(x => res(x, 1)).filter(v => v != null), sv = Sh.map(x => res(x, -1)).filter(v => v != null), all = lv.concat(sv); if (all.length) rows.push({ d, v: mean(all), n: all.length }); }
  (ROWS[name] = ROWS[name] || {})[h] = rows;
  const v = rows.map(r => r.v), half = Math.floor(v.length / 2), pk = o => Object.fromEntries(Object.entries(o).filter(([, a]) => a.length >= 8).map(([k, a]) => [k, st(a)]));
  (RES[name] = RES[name] || { d: H.d, h: {} }).h[h] = { all: st(v), first: st(v.slice(0, half)), second: st(v.slice(half)), bets: rows.reduce((s, r) => s + r.n, 0), fill: orders ? fills / orders : null, byClass: pk(byC), byInd: pk(byI), ex: exStats(EX) };
}
// ---------- walk-forward record of the setups (EV agent, 2026-11-10) ----------
// The live setups blend the hypotheses that held up (t > 0.5 and a positive second half), chosen on ALL past bets, so their
// own record was never tested. This replays the same rule day by day: on day d the weights use only bets that had ENDED by d
// (20+ of them per idea); the blended lean (live formula) picks the top 6 longs and top 6 shorts with |lean| >= 0.05; the same
// limit order, the same baseline (that limit on every market) and the same 0.1% costs. First half vs second half = older vs newer.
const WF = {}, WROWS = {};
// one walk-forward replay: sel(P, Prows) gives an idea's weight on day d from its bets that had ENDED by d (0 = not used)
function wfReplay(h, sel) { const rows = []; let orders = 0, fills = 0, nI = 0;
  for (let d = days[0] + 150; d + h <= lastDay; d += h) {
    const W = {}; let tw = 0;
    for (const k in HYP) { const R = ((ROWS[k] || {})[h] || []).filter(r => r.d + h <= d), P = R.map(r => r.v); if (P.length < 20) continue; const w = sel(P, R, d); if (w > 0) { W[k] = w; tw += w; } }
    if (!tw) continue;
    const F = crossAt(d), U = Object.keys(F).filter(c => (M[c].B[F[c].j][5] * F[c].px > 0)); if (U.length < 25) continue;
    const base = baseAt(F, U, d, h);
    const S = U.map(c => { let s = 0; for (const k in W) s += W[k] * HYP[k].f(F[c], M[c]); return { c, s: s / tw }; }).filter(x => Math.abs(x.s) >= 0.05);
    const Lg = S.filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6), Sh = S.filter(x => x.s < 0).sort((a, b) => a.s - b.s).slice(0, 6); if (!Lg.length && !Sh.length) continue;
    const res = (x, side) => { orders++; const b = bet(M[x.c], F[x.c], d, side, h); if (b.open || !b.fill || b.r == null) return null; fills++; return side * b.r - base[side] - 0.001; };
    const all = Lg.map(x => res(x, 1)).concat(Sh.map(x => res(x, -1))).filter(v => v != null); if (all.length) { rows.push({ d, v: mean(all), n: all.length }); nI += Object.keys(W).length; } }
  return { rows, orders, fills, nI }; }
const SEL = { cur: P => { const x = st(P), sec = P.slice(Math.floor(P.length / 2)); return x.t > 0.5 && mean(sec) > 0 ? Math.min(3, x.t) : 0; } };
for (const h of [1, 2, 7]) { const { rows, orders, fills, nI } = wfReplay(h, SEL.cur); WROWS[h] = rows;
  const v = rows.map(r => r.v), half = Math.floor(v.length / 2);
  WF[h] = { all: st(v), first: st(v.slice(0, half)), second: st(v.slice(half)), bets: rows.reduce((s, r) => s + r.n, 0), fill: orders ? fills / orders : null, ideas: rows.length ? Math.round(nI / rows.length * 10) / 10 : null, from: rows.length ? new Date(rows[0].d * D).toISOString().slice(0, 10) : null };
  log("setups walk-forward", h + "d", WF[h].all ? `n${WF[h].all.n} ${(WF[h].all.m * 100).toFixed(2)}% t${WF[h].all.t.toFixed(1)} 1st ${WF[h].first ? (WF[h].first.m * 100).toFixed(2) : "-"}% 2nd ${WF[h].second ? (WF[h].second.m * 100).toFixed(2) : "-"}% ideas ${WF[h].ideas}` : "-"); }
// ---------- other ways to choose the ideas, each replayed walk-forward (EV agent, 2026-11-11; council task) ----------
// The live rule decays at 1 d and 2 d (older half wins, newer half loses). Candidates, all from past bets only:
//   strict  the idea's own newer half of past bets wins with t >= 1 (and t > 0.5 overall)
//   recent  only the idea's bets of the last 120 days (t > 0.5 and a positive mean)
//   gate    the live rule, but no setup on a day when the live setups' own last 20 ended results average below 0
//   none    no setup (0)
// Every variant is scored per step (a step with no setup = 0) on the same grid. The rule to use is chosen on the OLDER half
// of the steps only (best mean); its NEWER half is the unseen check. Nothing on the sites uses this block yet.
SEL.strict = P => { const x = st(P), sec = st(P.slice(Math.floor(P.length / 2))); return x.t > 0.5 && sec && sec.t >= 1 ? Math.min(3, x.t) : 0; };
SEL.recent = (P, R, d) => { const Q = R.filter(r => r.d >= d - 120).map(r => r.v); if (Q.length < 10) return 0; const x = st(Q); return x.t > 0.5 && x.m > 0 ? Math.min(3, x.t) : 0; };
const WFALT = {};
for (const h of [1, 2, 7]) { const steps = []; for (let d = days[0] + 150; d + h <= lastDay; d += h) steps.push(d);
  const toMap = rows => Object.fromEntries(rows.map(r => [r.d, r.v]));
  const S = { cur: toMap(WROWS[h]), strict: toMap(wfReplay(h, SEL.strict).rows), recent: toMap(wfReplay(h, SEL.recent).rows), gate: {}, none: {} };
  for (const r of WROWS[h]) { const past = WROWS[h].filter(q => q.d + h <= r.d).slice(-20).map(q => q.v); if (past.length >= 10 && mean(past) >= 0) S.gate[r.d] = r.v; }
  const first = WROWS[h].length ? WROWS[h][0].d : null, grid = steps.filter(d => first != null && d >= first); if (grid.length < 20) { WFALT[h] = null; continue; }
  const half = Math.floor(grid.length / 2), o = { steps: grid.length, split: new Date(grid[half] * D).toISOString().slice(0, 10), v: {} };
  for (const k in S) { const a = grid.map(d => S[k][d] || 0); o.v[k] = { all: st(a), first: st(a.slice(0, half)), second: st(a.slice(half)), days: grid.filter(d => S[k][d] != null).length }; }
  o.pick = Object.keys(o.v).sort((a, b) => o.v[b].first.m - o.v[a].first.m)[0]; o.pickSecond = o.v[o.pick].second; WFALT[h] = o;
  log("idea rules", h + "d", Object.entries(o.v).map(([k, x]) => `${k} 1st ${(x.first.m * 100).toFixed(3)}% 2nd ${(x.second.m * 100).toFixed(3)}% t2 ${x.second.t.toFixed(1)} days ${x.days}`).join(" | "), "-> pick", o.pick); }
// Gate (same rule as the Outlook gates): a horizon whose walk-forward setups lost on BOTH halves (10+ days) gets no setup
// (side 0) on any site; it comes back by itself when either half turns positive. First run (2026-11-10): 7 d lost on both
// halves (−1.12% → −2.38% per bet, n 12); 1 d and 2 d won on the older half and lost on the newer half (decay, not gated).
const WFG = Object.fromEntries([1, 2, 7].map(h => { const w = WF[h]; return [h, !!(w && w.all && w.all.n >= 10 && w.first && w.second && w.first.m < 0 && w.second.m < 0)]; }));
// The rule used live (EV agent, 2026-11-11): per horizon, the idea rule that did best on the OLDER half of wfAlt (cur when there
// is no wfAlt). Gate: the horizon shows no setup when that rule's NEWER half (unseen when it was picked) is a proven loss, the
// scorecard's mute rule (t <= -2), or when the rule is "none", or when the rule is "gate" and the last 20 ended results lost.
// First run (Nov 11): 1 d picks "recent" (newer half -0.05% vs -0.25% for the live rule); 2 d picks the live rule, whose
// newer half lost -0.86% per step (t -2.2), so 2 d is gated.
const WRULE = {}, WWHY = {};
for (const h of [1, 2, 7]) { const A = WFALT[h], pick = A ? A.pick : "cur"; WRULE[h] = pick;
  if (WFG[h]) { WWHY[h] = "the setups lost on both halves"; continue; }
  if (pick === "none") { WFG[h] = true; WWHY[h] = "no idea rule beat 0 on the older half"; continue; }
  if (A && A.pickSecond && A.pickSecond.t <= -2) { WFG[h] = true; WWHY[h] = `the chosen rule (${pick}) lost on the newer half, ${(A.pickSecond.m * 100).toFixed(2)}% per step, t ${A.pickSecond.t.toFixed(1)}`; continue; }
  // Council task (2026-11-11): the chosen rule's newer half below 0 on two runs in a row (this run and the last lab.json) gates
  // the horizon: "none" (no setup, 0) beat it on unseen steps twice. It comes back when the newer half is >= 0 again.
  // First use (Nov 12): 1 d "recent" newer half -0.14% (Nov 11) and -0.29% (Nov 12, t -1.7).
  const pm = PREV && PREV.wfAlt && PREV.wfAlt[h] && PREV.wfAlt[h].pickSecond ? PREV.wfAlt[h].pickSecond.m : null;
  if (A && A.pickSecond && A.pickSecond.n >= 20 && A.pickSecond.m < 0 && pm != null && pm < 0) { WFG[h] = true; WWHY[h] = `the chosen rule lost on the newer half on two runs in a row (${(pm * 100).toFixed(2)}%, then ${pick} ${(A.pickSecond.m * 100).toFixed(2)}% per step); no setup beats it`; continue; }
  if (pick === "gate") { const past = WROWS[h].slice(-20).map(q => q.v); if (past.length >= 10 && mean(past) < 0) { WFG[h] = true; WWHY[h] = "the setups' last 20 results lost"; } } }
// ---------- today: profiles and the current bets ----------
const F0 = crossAt(lastDay), prof = {}, picks = {};
for (const c in F0) { const f = F0[c], t = M[c].tg; prof[c] = { s: M[c].s, cls: t.cls, sec: t.sec, ind: t.ind, cap: t.cap, yr: t.yr, ageHL: f.ageHL != null ? Math.round(f.ageHL) : null, src: M[c].src, px: f.px, stage: f.stage, slope: r4(f.slope), d150: r4(f.d150), d50: r4(f.d50),
  r7: r4(f.r7), r30: r4(f.r30), r90: r4(f.r90), vr: r4(f.vr), v20: r4(f.v20), athD: r4(f.athD), atlU: r4(f.atlU), pos52: r4(f.pos52), pump: r4(f.pump), rel30: r4(f.rel30), relZ: r4(f.relZ), grp: f.grp, grpR30: r4(f.grpR30), grpZ: r4(f.grpZ), beta: r4(f.beta), corr: r4(f.corr), sdD: r4(f.sdD),
  sc: Object.fromEntries(Object.entries(HYP).map(([k, H]) => [k, r4(H.f(f, M[c]))])) }; }
function r4(v) { return v == null || !isFinite(v) ? null : Math.round(v * 1e4) / 1e4; }
// each market's own excursions: a long and a short entered at every close of the last 250 days, held h days, no stop and no target
for (const c in F0) { const B = M[c].B, n = B.length, P = prof[c]; P.ex = {};
  for (const h of [1, 2, 7]) { const o = {}; for (const side of [1, -1]) { const X = []; for (let k = Math.max(1, n - 250 - h); k + h < n; k++) { const en = B[k][4], x = excur(B, k + 1, k + h, en, side); X.push({ ...x, r: side * Math.log(B[k + h][4] / en) }); } o[side > 0 ? "L" : "S"] = exStats(X); } P.ex[h] = o; } }
// setups for every market and every horizon: the hypotheses that held up there (positive overall and on the second half),
// each weighted by its t-stat, blended into one lean, with a limit entry, a limit target and a "wrong if" price
const WH = Object.fromEntries([1, 2, 7].map(h => [h, Object.fromEntries(Object.entries(RES).map(([k, R]) => { const x = R.h[h]; return [k, x && x.all && x.second && x.all.t > 0.5 && x.second.m > 0 ? Math.min(3, x.all.t) : 0]; }))]));
// the live weights follow the chosen rule (cur and gate: the old weights above, unchanged)
for (const h of [1, 2, 7]) if (WRULE[h] === "recent" || WRULE[h] === "strict") for (const k in HYP) { const R = (ROWS[k] || {})[h] || []; WH[h][k] = R.length >= 20 ? SEL[WRULE[h]](R.map(r => r.v), R, lastDay) : 0; }
for (const c in F0) { const f = F0[c], P = prof[c]; P.setups = {};
  for (const h of [1, 2, 7]) { if (WFG[h]) { P.setups[h] = { side: 0, gated: 1 }; continue; } const W = WH[h]; let s = 0, w = 0; const why = []; for (const k in HYP) { const v = P.sc[k]; if (!W[k] || v == null) continue; w += W[k]; s += v * W[k]; if (Math.abs(v) >= 0.3) why.push([k, r4(v)]); }
    const lean = w ? s / Object.values(W).reduce((a, b) => a + b, 0) : 0, side = Math.sign(lean), sH = f.sdD * Math.sqrt(h); if (!side || Math.abs(lean) < 0.05) { P.setups[h] = { side: 0 }; continue; }
    const EXh = P.ex && P.ex[h] && P.ex[h][side > 0 ? "L" : "S"], exP = v => v == null ? null : r4(f.px * (1 + v * side));   // excursion prices for this side (drawdown below a long, above a short)
    P.setups[h] = { dd50: EXh ? exP(EXh.mae50) : null, dd90: EXh ? exP(EXh.mae90) : null, up50: EXh ? exP(EXh.mfe50) : null, up90: EXh ? exP(EXh.mfe90) : null, winStop: EXh && EXh.winMae80 != null ? exP(EXh.winMae80) : null, side, lean: r4(lean), lim: r4(f.px * Math.exp(-side * 0.25 * sH)), tgt: r4(f.px * Math.exp(side * (0.5 + Math.min(1, Math.abs(lean) * 2)) * sH)), wrong: r4(f.px * Math.exp(-side * 0.75 * sH)), why: why.filter(([k, v]) => Math.sign(v) === side && W[k]).sort((a, b) => Math.abs(b[1]) * WH[h][b[0]] - Math.abs(a[1]) * WH[h][a[0]]).map(x => x[0]).slice(0, 3) }; } }
for (const [name, H] of Object.entries(HYP)) { const S = Object.keys(F0).map(c => ({ c, s: H.f(F0[c], M[c]) })).filter(x => Math.abs(x.s) >= 0.3); picks[name] = { L: S.filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 6).map(x => x.c), S: S.filter(x => x.s < 0).sort((a, b) => a.s - b.s).slice(0, 6).map(x => x.c) }; }
const out = { weights: WH, wf: WF, wfGate: WFG, wfAlt: WFALT, wfRule: WRULE, wfWhy: WWHY, t: new Date().toISOString(), asOf: new Date(lastDay * D).toISOString().slice(0, 10), markets: Object.keys(M).length, entry: "limit 1/4 sigma of the horizon better than the close, alive the first quarter of the horizon (1 day min); exit at market at the end; vs the average market; 0.1% costs", hyp: RES, prof, picks };
fs.writeFileSync(path.join(OUT, "lab.json"), JSON.stringify(out));
for (const [k, R] of Object.entries(RES)) log(k.padEnd(12), [1, 2, 7].map(h => { const a = R.h[h] && R.h[h].all, s = R.h[h] && R.h[h].second; return a ? `${h}d n${a.n} ${(a.m * 100).toFixed(2)}% t${a.t.toFixed(1)} 2nd ${s ? (s.m * 100).toFixed(2) : "-"}% fill ${(R.h[h].fill * 100).toFixed(0)}%` : h + "d -"; }).join(" | "));
log("done", Object.keys(prof).length, "profiles");
