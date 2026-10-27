// Cohort Sniper backtest.
// Rebuilds, hour by hour, the positions of a large sample of Hyperliquid traders (the best and the worst by
// all-time PnL, plus samples in between) from their fills, puts each trader in the PnL cohort they were in AT THAT
// HOUR (current PnL minus the PnL they realized later), and recomputes the smart-vs-fools gap for every market.
// Then it tests which score variants and extra conditions predict the next 4h / 24h / 72h price move.
// Fit on the first 60% of the window ("train"), check on the last 40% ("test").
// Output: <outDir>/backtest.json
// Usage: node scripts/backtest.mjs <outDir> [latest.json]
// Env: BT_DAYS (default 40), BT_MAX_MIN (fills phase time budget, default 110)
import fs from "node:fs";
import path from "node:path";
import { http } from "./lib.mjs";

const OUT = process.argv[2] || "bt";
const LATEST = process.argv[3];
fs.mkdirSync(OUT, { recursive: true });
const DAYS = +process.env.BT_DAYS || 40;
const MAX_MIN = +process.env.BT_MAX_MIN || 110;
const H = 36e5, NOW = Math.floor(Date.now() / H) * H, T0 = NOW - DAYS * 24 * H;
const NH = DAYS * 24;                         // hours on the grid: hour i = T0 + i*H
const MIN_SIDE = 25000;                       // $ needed on each side (sample is smaller than Hyperdash's full cohorts)
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const r3 = x => x == null || !isFinite(x) ? null : Math.round(x * 1000) / 1000;

// ---------- APIs (paced for the Hyperliquid limit of 1200 weight per minute) ----------
let wUsed = 0, wStart = Date.now();
async function pace(weight) {
  wUsed += weight;
  const el = (Date.now() - wStart) / 6e4;
  if (el >= 1) { wStart = Date.now(); wUsed = weight; return; }
  if (wUsed > 950) { await sleep((1 - el) * 6e4 + 500); wStart = Date.now(); wUsed = weight; }
}
// per = items per extra weight unit (Hyperliquid: fills/funding 20, candles 60); the real cost is charged after the reply
async function hl(body, per = 0, base = 20) {
  await pace(base);
  for (let i = 0; i < 4; i++) {
    try {
      const r = await http("https://api.hyperliquid.xyz/info", { method: "POST", tries: 1, timeoutMs: 30000, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (per && Array.isArray(r)) wUsed += Math.ceil(r.length / per);
      return r;
    }
    catch (e) { if (/429/.test(e.message)) { log("429, waiting"); await sleep(30000); wStart = Date.now(); wUsed = 0; } else if (i === 3) throw e; else await sleep(2000); }
  }
}
const hd = (query, variables) => http("https://api.hyperdash.com/graphql", {
  method: "POST", tries: 3, timeoutMs: 30000,
  headers: { "content-type": "application/json", origin: "https://hyperdash.com", referer: "https://hyperdash.com/" },
  body: JSON.stringify({ query, variables })
}).then(j => { if (j.errors) throw new Error(j.errors[0].message); return j.data; });

const keyOf = name => { const k = name.includes(":") ? name.split(":")[0].toUpperCase() + ":" + name.split(":").slice(1).join(":") : name; return k.toUpperCase() === k ? k : k.toUpperCase(); };
const COH = p => p >= 1e6 ? "EP" : p >= 1e5 ? "VP" : p >= 0 ? "P" : p > -1e5 ? "U" : p > -1e6 ? "VU" : "R";
const GRP = { EP: 0, VP: 0, P: 2, U: 1, VU: 1, R: 1 };   // 0 = smart, 1 = fools, 2 = neutral (placebo)

// ---------- 1. Universe ----------
async function universe() {
  const q = order => `query E($page:Int,$pageSize:Int){exploreTraders(page:$page,pageSize:$pageSize,timeframe:all,sortBy:{field:pnl,order:${order}}){data{address pnl pnlCohort totalTrades}}}`;
  const plan = [["desc", [1, 2, 3, 4, 5, 6]], ["desc", [20, 21, 60, 61, 150, 151]], ["asc", [1, 2, 3, 4]], ["asc", [20, 21, 60, 61, 120, 121, 190, 191]]];
  const seen = new Map();
  for (const [order, pages] of plan) for (const page of pages) {
    try {
      const d = await hd(q(order), { page, pageSize: 100 });
      for (const t of d.exploreTraders.data || []) if (!seen.has(t.address)) seen.set(t.address, { a: t.address, pnl: +t.pnl || 0, coh: COH(+t.pnl || 0) });
    } catch (e) { log("explore", order, page, e.message); }
    await sleep(400);
  }
  return [...seen.values()];
}

// ---------- 2. Fills -> position paths ----------
async function traderHistory(t) {
  const all = [];
  let start = T0, truncated = false;
  for (let page = 0; page < 5; page++) {
    const f = await hl({ type: "userFillsByTime", user: t.a, startTime: start, aggregateByTime: true }, 20);
    if (!Array.isArray(f) || !f.length) break;
    if (page === 0 && f.length >= 2000 && f[0].time > T0 + 2 * 24 * H) { truncated = true; break; }  // only recent fills exist: HFT / market maker
    for (const x of f) {
      if (!x.coin || x.coin.startsWith("@") || x.coin.includes("/")) continue;          // spot
      all.push([x.time, x.coin, +x.startPosition, (x.side === "B" ? 1 : -1) * +x.sz, +x.closedPnl || 0]);
    }
    if (f.length < 2000) break;
    start = f[f.length - 1].time + 1;
    if (page === 4) truncated = true;
  }
  if (truncated) return { truncated: true };
  // Current positions for coins with no fills in the window (held the whole time)
  const cur = {};
  for (const dex of ["", "xyz"]) {
    try {
      const cs = await hl({ type: "clearinghouseState", user: t.a, ...(dex ? { dex } : {}) }, 0, 2);
      for (const p of (cs.assetPositions || []).map(x => x.position)) cur[p.coin] = +p.szi;
    } catch { }
  }
  all.sort((a, b) => a[0] - b[0]);
  return { fills: all, cur };
}

// ---------- 3. Market data ----------
async function hourly(name) {
  const c = await hl({ type: "candleSnapshot", req: { coin: name, interval: "1h", startTime: T0 - 8 * 24 * H, endTime: NOW + H } }, 60);
  const px = new Float64Array(NH + 73).fill(NaN);   // px[i] = close at time T0 + i*H (i may go to NH+72 for forward returns; future stays NaN)
  const pre = [];                                    // closes before T0 (for momentum at the start)
  for (const k of Array.isArray(c) ? c : []) {
    const iEnd = Math.round((k.T + 1 - T0) / H);     // candle closes at T0 + iEnd*H
    if (iEnd >= 0 && iEnd < px.length) px[iEnd] = +k.c; else if (iEnd < 0) pre.push([iEnd, +k.c]);
  }
  for (let i = 1; i < px.length; i++) if (isNaN(px[i]) && !isNaN(px[i - 1]) && T0 + i * H <= NOW) px[i] = px[i - 1];
  return { px, pre: new Map(pre) };
}
async function daily(name) {
  const c = await hl({ type: "candleSnapshot", req: { coin: name, interval: "1d", startTime: T0 - 400 * 24 * H, endTime: NOW + H } }, 60);
  return (Array.isArray(c) ? c : []).map(k => [k.t, +k.c]);
}
async function funding(name) {
  const out = [];
  let start = T0 - 24 * H;
  for (let i = 0; i < 4; i++) {
    const f = await hl({ type: "fundingHistory", coin: name, startTime: start }, 20);
    if (!Array.isArray(f) || !f.length) break;
    for (const x of f) out.push([x.time, +x.fundingRate]);
    if (f.length < 500) break;
    start = f[f.length - 1].time + 1;
  }
  const fr = new Float64Array(NH + 1).fill(NaN);
  for (const [t, r] of out) { const i = Math.floor((t - T0) / H); if (i >= 0 && i <= NH) fr[i] = r; }
  return fr;
}

// ---------- 4. Stats helpers ----------
function rank(a) { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const rr = (i + j) / 2; for (let k = i; k <= j; k++) r[idx[k][1]] = rr; i = j + 1; } return r; }
function spearman(x, y) { const n = x.length; if (n < 8) return null; const rx = rank(x), ry = rank(y); let mx = 0, my = 0; for (let i = 0; i < n; i++) { mx += rx[i]; my += ry[i]; } mx /= n; my /= n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { const a = rx[i] - mx, b = ry[i] - my; sxy += a * b; sxx += a * a; syy += b * b; } return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null; }
function meanSd(a) { const n = a.length; if (!n) return { m: null, sd: null, n: 0 }; const m = a.reduce((s, x) => s + x, 0) / n; const sd = n > 1 ? Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1)) : 0; return { m, sd, n }; }
function evStats(list) { // list of direction-adjusted returns (fractions)
  const v = list.filter(x => x != null && isFinite(x));
  const { m, sd, n } = meanSd(v);
  return { n, avg: r3(m != null ? m * 100 : null), hit: n ? Math.round(v.filter(x => x > 0).length / n * 1000) / 10 : null, t: n > 1 && sd ? r3(m / (sd / Math.sqrt(n))) : null, med: n ? r3(v.slice().sort((a, b) => a - b)[Math.floor(n / 2)] * 100) : null };
}

// ---------- main ----------
async function main() {
  const t0 = Date.now();
  const latest = LATEST && fs.existsSync(LATEST) ? JSON.parse(fs.readFileSync(LATEST, "utf8")) : null;
  log(`Window ${new Date(T0).toISOString()} -> ${new Date(NOW).toISOString()} (${DAYS} days)`);

  // 1. Universe
  const U = await universe();
  log(`Universe: ${U.length} traders`);
  // interleave cohorts so a time-out leaves a balanced sample
  const byC = {}; U.forEach(t => (byC[t.coh] = byC[t.coh] || []).push(t));
  const order = []; for (let i = 0; Object.values(byC).some(l => i < l.length); i++) for (const l of Object.values(byC)) if (i < l.length) order.push(l[i]);

  // 2. Fills
  const T = [];
  let trunc = 0, fail = 0, inactive = 0;
  for (const t of order) {
    if ((Date.now() - t0) / 6e4 > MAX_MIN) { log("Fills time budget reached"); break; }
    try {
      const h = await traderHistory(t);
      if (h.truncated) { trunc++; continue; }
      if (!h.fills.length && !Object.values(h.cur).some(x => x)) { inactive++; continue; }
      T.push({ ...t, ...h });
    } catch (e) { fail++; }
    if ((T.length + trunc + inactive) % 200 === 0) log(`traders: ${T.length} active, ${trunc} HFT skipped, ${inactive} inactive, ${fail} failed`);
  }
  log(`Fills done: ${T.length} active traders`);

  // 3. Coins: every perp coin traded or held by the sample (and listed in Hyperdash data when available)
  const names = new Map(); // key -> HL name
  for (const t of T) { for (const f of t.fills) names.set(keyOf(f[1]), f[1]); for (const c of Object.keys(t.cur)) names.set(keyOf(c), c); }
  if (latest) for (const k of [...names.keys()]) if (!latest.m[k]) names.delete(k);
  log(`Coins: ${names.size}`);
  const M = {};
  for (const [k, name] of names) {
    try {
      const hr = await hourly(name);
      if (hr.px.slice(0, NH).filter(x => !isNaN(x)).length < NH * 0.5) continue;
      M[k] = { name, ...hr, fr: await funding(name), d: await daily(name) };
    } catch (e) { log("market", name, e.message); }
  }
  const coins = Object.keys(M);
  log(`Market data for ${coins.length} coins`);

  // Daily-cycle features per coin per day: price vs 50-day average, position in 90-day range
  for (const k of coins) {
    const d = M[k].d, dayIdx = new Map(); d.forEach(([t], i) => dayIdx.set(t, i));
    const cyc = new Float64Array(NH + 1).fill(NaN), pos = new Float64Array(NH + 1).fill(NaN);
    for (let i = 0; i <= NH; i++) {
      const day = Math.floor((T0 + i * H) / (24 * H)) * 24 * H - 24 * H;  // last fully closed day
      const j = dayIdx.get(day); if (j == null || j < 20) continue;
      const w50 = d.slice(Math.max(0, j - 49), j + 1).map(x => x[1]), ma = w50.reduce((a, b) => a + b, 0) / w50.length;
      cyc[i] = d[j][1] / ma - 1;
      const w90 = d.slice(Math.max(0, j - 89), j + 1).map(x => x[1]), lo = Math.min(...w90), hi = Math.max(...w90);
      pos[i] = hi > lo ? (d[j][1] - lo) / (hi - lo) : 0.5;
    }
    M[k].cyc = cyc; M[k].pos = pos;
  }

  // 4. Cohort at each hour for each trader, and positions per coin -> group aggregates
  // A[k][g] = { L, S, lc, sc } arrays over hours; g: 0 smart, 1 fools, 2 neutral
  const A = {};
  for (const k of coins) A[k] = [0, 1, 2].map(() => ({ L: new Float64Array(NH + 1), S: new Float64Array(NH + 1), lc: new Float64Array(NH + 1), sc: new Float64Array(NH + 1) }));
  const cohStart = {};
  for (const t of T) {
    // realized PnL after each hour -> PnL at that hour
    // after[i] = PnL realized after grid time T0 + i*H  ->  PnL at hour i = current PnL - after[i]
    const after = new Float64Array(NH + 2);
    for (const f of t.fills) { const b = Math.floor((f[0] - T0) / H); if (b >= 0 && b <= NH) after[b] += f[4]; }
    for (let i = NH - 1; i >= 0; i--) after[i] += after[i + 1];
    const grp = new Int8Array(NH + 1);
    for (let i = 0; i <= NH; i++) grp[i] = GRP[COH(t.pnl - after[i])];
    const c0 = COH(t.pnl - after[0]); cohStart[c0] = (cohStart[c0] || 0) + 1;
    // per coin position path
    const byCoin = new Map();
    for (const f of t.fills) { const k = keyOf(f[1]); if (!M[k]) continue; (byCoin.get(k) || byCoin.set(k, []).get(k)).push(f); }
    for (const [c, sz] of Object.entries(t.cur)) { const k = keyOf(c); if (M[k] && !byCoin.has(k) && sz) byCoin.set(k, [["const", sz]]); }
    for (const [k, fl] of byCoin) {
      const px = M[k].px, ag = A[k];
      let j = 0, pos;
      const constant = fl[0][0] === "const";
      if (constant) pos = fl[0][1]; else pos = fl[0][2];
      for (let i = 0; i <= NH; i++) {
        const tEnd = T0 + i * H;
        if (!constant) while (j < fl.length && fl[j][0] <= tEnd) { pos = fl[j][2] + fl[j][3]; j++; }
        if (!pos || isNaN(px[i])) continue;
        const g = grp[i], n = Math.abs(pos) * px[i];
        if (pos > 0) { ag[g].L[i] += n; ag[g].lc[i]++; } else { ag[g].S[i] += n; ag[g].sc[i]++; }
      }
    }
  }

  // 5. Features per coin-hour
  const bias = (a, i, w) => { const n = a.L[i] + a.S[i], c = a.lc[i] + a.sc[i]; if (!n || !c) return null; return w * (a.L[i] - a.S[i]) / n + (1 - w) * (a.lc[i] - a.sc[i]) / c; };
  const W = [1, 0.8, 0.6, 0.4, 0.2, 0];
  const ROWS = []; // one per valid coin-hour
  for (const k of coins) {
    const m = M[k], [Sg, Fg, Ng] = A[k];
    for (let i = 24; i <= NH; i++) {
      const sN = Sg.L[i] + Sg.S[i], fN = Fg.L[i] + Fg.S[i];
      if (sN < MIN_SIDE || fN < MIN_SIDE || Sg.lc[i] + Sg.sc[i] < 3 || isNaN(m.px[i])) continue;
      const fwd = h => !isNaN(m.px[i + h]) && T0 + (i + h) * H <= NOW ? m.px[i + h] / m.px[i] - 1 : null;
      const gw = {}; for (const w of W) gw[w] = (bias(Sg, i, w) - bias(Fg, i, w)) / 2;
      const g = gw[0.6], dir = g >= 0 ? 1 : -1;
      const gPrev = (h) => { const ii = i - h; const s = bias(Sg, ii, 0.6), f = bias(Fg, ii, 0.6); return s == null || f == null ? null : (s - f) / 2; };
      const net = (a, ii) => a.L[ii] - a.S[ii], gross = (a, ii) => a.L[ii] + a.S[ii];
      const sflow24 = Math.max(gross(Sg, i), gross(Sg, i - 24)) ? (net(Sg, i) - net(Sg, i - 24)) / Math.max(gross(Sg, i), gross(Sg, i - 24)) : null;
      const ffl24 = Math.max(gross(Fg, i), gross(Fg, i - 24)) ? (net(Fg, i) - net(Fg, i - 24)) / Math.max(gross(Fg, i), gross(Fg, i - 24)) : null;
      let f8 = 0, fn = 0; for (let h = 0; h < 8; h++) if (!isNaN(m.fr[i - h])) { f8 += m.fr[i - h]; fn++; }
      const minSide = Math.min(sN, fN), depth = Math.max(0.4, Math.min(1, 0.4 + 0.3 * Math.log10(minSide / MIN_SIDE)));
      const tcnt = Sg.lc[i] + Sg.sc[i], tdepth = Math.max(0.5, Math.min(1, Math.sqrt(tcnt / 10)));
      const sbD = sN ? (Sg.L[i] - Sg.S[i]) / sN : 0, sbC = (Sg.lc[i] - Sg.sc[i]) / tcnt;
      const pb = bias(Ng, i, 0.6);
      ROWS.push({
        k, i, gw, g, dir, score: Math.abs(g) * depth * tdepth * 100,
        dg4: gPrev(4) != null ? (g - gPrev(4)) * dir : null, dg24: gPrev(24) != null ? (g - gPrev(24)) * dir : null,
        sflow: sflow24 != null ? sflow24 * dir : null, fflow: ffl24 != null ? -ffl24 * dir : null,      // + = smart adds to its side / fools add to the other side
        mom24: !isNaN(m.px[i - 24]) ? (m.px[i] / m.px[i - 24] - 1) * dir : null,
        mom168: !isNaN(m.px[i - 168]) ? (m.px[i] / m.px[i - 168] - 1) * dir : null,
        earn: fn ? -f8 / fn * dir * 24 * 365 : null,                                                   // smart side earns (+) or pays (-) funding, per year
        cyc: !isNaN(m.cyc[i]) ? m.cyc[i] * dir : null, pos90: !isNaN(m.pos[i]) ? m.pos[i] : null,
        whale: Math.abs(sbD - sbC) >= 0.5 && Math.sign(sbD) !== Math.sign(sbC),
        placebo: pb != null ? (pb - bias(Fg, i, 0.6)) / 2 : null, smartOnly: bias(Sg, i, 0.6), foolsOnly: -bias(Fg, i, 0.6),
        r4: fwd(4), r24: fwd(24), r72: fwd(72), raw4: fwd(4), raw24: fwd(24)
      });
    }
  }
  log(`Coin-hours with a valid gap: ${ROWS.length}`);
  const split = Math.floor(NH * 0.6);
  const part = r => r.i < split ? "train" : "test";

  // 6a. Rank IC per hour across coins (feature vs raw forward 24h return)
  const byHour = new Map(); for (const r of ROWS) if (r.raw24 != null) (byHour.get(r.i) || byHour.set(r.i, []).get(r.i)).push(r);
  function ic(fn, label, desc) {
    const res = { train: [], test: [] };
    for (const [i, rs] of byHour) { const v = rs.map(r => [fn(r), r.raw24]).filter(x => x[0] != null && isFinite(x[0])); if (v.length < 8) continue; const c = spearman(v.map(x => x[0]), v.map(x => x[1])); if (c != null) res[i < split ? "train" : "test"].push(c); }
    const s = p => { const { m, sd, n } = meanSd(res[p]); return { ic: r3(m), t: n > 24 && sd ? r3(m / (sd / Math.sqrt(n / 24))) : null, hours: n }; };
    return { name: label, desc, train: s("train"), test: s("test") };
  }
  const ICS = [
    ...W.map(w => ic(r => r.gw[w], `Gap · ${Math.round(w * 100)}% $ / ${Math.round((1 - w) * 100)}% count`, w === 0.6 ? "The live default weighting." : "")),
    ic(r => r.g * r.score / Math.max(1e-9, Math.abs(r.g) * 100), "Live score (signed)", "Gap × money depth × trader depth, as on the site."),
    ic(r => r.smartOnly, "Smart cohorts only", "Smart bias alone, no fools side."),
    ic(r => r.foolsOnly, "Fools only (fade)", "The opposite of the fools' bias alone."),
    ic(r => r.placebo, "Placebo: neutral cohort vs fools", "Profitable ($0–$100K) cohort used as 'smart'. If this also works, part of the edge is just fading the fools."),
    ic(r => r.dg24 != null ? r.dg24 * r.dir : null, "Gap change 24h", "Is the disparity widening?"),
    ic(r => r.sflow != null ? r.sflow * r.dir : null, "Smart flow 24h", "Smart net $ added in 24h."),
  ];

  // 6b. Event study: one sample per coin per 24h (non-overlapping), direction = smart side
  const daily24 = ROWS.filter(r => r.i % 24 === 0);
  const adj = (r, h) => r[h] != null ? r[h] * r.dir : null;
  const ev = (rs) => ({ r4: evStats(rs.map(r => adj(r, "r4"))), r24: evStats(rs.map(r => adj(r, "r24"))), r72: evStats(rs.map(r => adj(r, "r72"))) });
  const TH = [20, 30, 40, 50, 60, 70];
  const thresholds = TH.map(th => ({ th, train: ev(daily24.filter(r => part(r) === "train" && r.score >= th)), test: ev(daily24.filter(r => part(r) === "test" && r.score >= th)) }));
  const BUCK = [[0, 20], [20, 30], [30, 40], [40, 50], [50, 60], [60, 101]];
  const calib = BUCK.map(([a, b]) => ({ lo: a, hi: b, train: ev(daily24.filter(r => part(r) === "train" && r.score >= a && r.score < b)), test: ev(daily24.filter(r => part(r) === "test" && r.score >= a && r.score < b)), all: ev(daily24.filter(r => r.score >= a && r.score < b)) }));

  // 6c. Conditions that separate good from bad setups (among score >= 30)
  const base = daily24.filter(r => r.score >= 30);
  const COND = [
    ["trend_up", "Gap widened in the last 24h", r => r.dg24 != null && r.dg24 >= 0.05, r => r.dg24 != null && r.dg24 <= -0.05],
    ["smart_adding", "Smart cohorts added to their side in 24h", r => r.sflow != null && r.sflow >= 0.05, r => r.sflow != null && r.sflow <= -0.05],
    ["fools_adding", "Fools added to the other side in 24h", r => r.fflow != null && r.fflow >= 0.05, r => r.fflow != null && r.fflow <= -0.05],
    ["mom_with", "Price moved with the smart side in 24h (>2%)", r => r.mom24 != null && r.mom24 >= 0.02, r => r.mom24 != null && r.mom24 <= -0.02],
    ["mom7_with", "Price moved with the smart side in 7d (>5%)", r => r.mom168 != null && r.mom168 >= 0.05, r => r.mom168 != null && r.mom168 <= -0.05],
    ["earns", "Smart side earns funding (>5%/yr)", r => r.earn != null && r.earn >= 0.05, r => r.earn != null && r.earn <= -0.05],
    ["cycle_with", "Cycle agrees (price on the smart side of its 50-day average)", r => r.cyc != null && r.cyc > 0.02, r => r.cyc != null && r.cyc < -0.02],
    ["range_extreme", "Price at a 90-day range extreme in the smart direction's favour (smart long near lows / smart short near highs)", r => r.pos90 != null && (r.dir > 0 ? r.pos90 <= 0.25 : r.pos90 >= 0.75), r => r.pos90 != null && (r.dir > 0 ? r.pos90 >= 0.75 : r.pos90 <= 0.25)],
    ["whale", "Whale-driven ($ and trader count disagree)", r => r.whale, r => !r.whale],
  ];
  const conditions = COND.map(([id, label, yes, no]) => {
    const o = { id, label };
    for (const p of ["train", "test"]) { const rs = base.filter(r => part(r) === p); o[p] = { yes: evStats(rs.filter(yes).map(r => adj(r, "r24"))), no: evStats(rs.filter(no).map(r => adj(r, "r24"))), all: evStats(rs.map(r => adj(r, "r24"))) }; }
    return o;
  });

  // 7. Tuned factor sizes: only when train and test agree in sign and each side has 25+ samples.
  const factors = {};
  for (const c of conditions) {
    const d = p => c[p].yes.n >= 25 && c[p].no.n >= 25 ? (c[p].yes.hit - c[p].no.hit) : null;
    const dTr = d("train"), dTe = d("test");
    if (dTr == null || dTe == null || Math.sign(dTr) !== Math.sign(dTe) || Math.abs(dTe) < 3) { c.verdict = "no stable effect"; continue; }
    const eff = Math.sign(dTe) * Math.min(Math.abs(dTr), Math.abs(dTe));   // the smaller of the two
    factors[c.id] = { yes: r3(1 + Math.max(-0.15, Math.min(0.15, eff / 200))), no: r3(1 - Math.max(-0.15, Math.min(0.15, eff / 200))), hitDiff: r3(eff) };
    c.verdict = `${eff > 0 ? "helps" : "hurts"}: ${Math.abs(eff).toFixed(1)} pts hit rate`;
  }
  // best $ weight chosen on train IC
  const wIC = W.map((w, j) => ({ w, tr: ICS[j].train.ic, te: ICS[j].test.ic }));
  const best = wIC.filter(x => x.tr != null).sort((a, b) => b.tr - a.tr)[0];

  const out = {
    t: new Date().toISOString(), window: { from: new Date(T0).toISOString(), to: new Date(NOW).toISOString(), days: DAYS, split: new Date(T0 + split * H).toISOString() },
    universe: { sampled: U.length, active: T.length, hftSkipped: trunc, inactive, failed: fail, cohortAtStart: cohStart, cohortNow: T.reduce((o, t) => (o[t.coh] = (o[t.coh] || 0) + 1, o), {}) },
    coins: coins.length, coinHours: ROWS.length, samples24: daily24.length, minSide: MIN_SIDE,
    ic: ICS, bestWeight: best ? { w: best.w, trainIC: best.tr, testIC: best.te } : null,
    thresholds, calib, conditions, factors,
    runMinutes: Math.round((Date.now() - t0) / 6e4)
  };
  fs.writeFileSync(path.join(OUT, "backtest.json"), JSON.stringify(out));
  log(`Done in ${out.runMinutes} min. ${ROWS.length} coin-hours, ${daily24.length} daily samples.`);
}

main().catch(e => { console.error(e); process.exit(1); });
