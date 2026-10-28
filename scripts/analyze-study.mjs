// Analyse a trader study (from study.mjs): round trips, style, timing, context, best vs worst.
// Usage: node scripts/analyze-study.mjs study-xyz_SOXL.json out.json
import fs from "node:fs";

const [, , IN, OUTF] = process.argv;
const S = JSON.parse(fs.readFileSync(IN, "utf8"));
const H = 36e5, D = 864e5;
const med = a => { const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const mean = a => { const s = a.filter(x => x != null && isFinite(x)); return s.length ? s.reduce((p, q) => p + q, 0) / s.length : null; };
const r2 = x => x == null || !isFinite(x) ? null : Math.round(x * 100) / 100;
const r1 = x => x == null || !isFinite(x) ? null : Math.round(x * 10) / 10;

// ---- Market context from candles ----
const h1 = S.h1.sort((a, b) => a[0] - b[0]), d1 = S.d1.sort((a, b) => a[0] - b[0]);
const hIdx = t => { let lo = 0, hi = h1.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (h1[m][0] <= t) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; };
const dIdx = t => { let ans = -1; for (let i = 0; i < d1.length; i++) if (d1[i][0] + D <= t) ans = i; else break; return ans; };   // last closed day
const pxAt = t => { const i = hIdx(t); return i >= 0 ? h1[i][4] : null; };
function ctxAt(t, dir) {
  const i = hIdx(t); if (i < 0) return {};
  const p = h1[i][4];
  const back = h => i - h >= 0 ? (p / h1[i - h][4] - 1) * 100 : null;
  const w = h1.slice(Math.max(0, i - 120), i + 1), lo = Math.min(...w.map(k => k[3])), hi = Math.max(...w.map(k => k[2]));
  const j = dIdx(t); let ma20 = null, rsi = null;
  if (j >= 19) { const c = d1.slice(j - 19, j + 1).map(k => k[4]); ma20 = c.reduce((a, b) => a + b, 0) / 20; }
  if (j >= 14) { let g = 0, l = 0; for (let k = j - 13; k <= j; k++) { const dd = d1[k][4] - d1[k - 1][4]; if (dd > 0) g += dd; else l -= dd; } rsi = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
  const f = S.fund.filter(x => x[0] <= t && x[0] > t - 8 * H).map(x => x[1]);
  const fh = f.length ? f.reduce((a, b) => a + b, 0) / f.length : null;
  return { r4: back(4), r24: back(24), r72: back(72), pos5d: hi > lo ? (p - lo) / (hi - lo) : null, vs20: ma20 ? (p / ma20 - 1) * 100 : null, rsi,
    fApr: fh != null ? fh * 24 * 365 * 100 : null };
}
// Best / worst price reached during a trip (from hourly highs / lows), as % in the trade direction
function excursion(t0, t1, entry, dir) {
  const a = hIdx(t0), b = hIdx(t1); if (a < 0 || b < a) return { mfe: null, mae: null };
  let hi = -Infinity, lo = Infinity; for (let i = a; i <= b; i++) { hi = Math.max(hi, h1[i][2]); lo = Math.min(lo, h1[i][3]); }
  const up = (hi / entry - 1) * 100, dn = (lo / entry - 1) * 100;
  return dir > 0 ? { mfe: up, mae: dn } : { mfe: -dn, mae: -up };
}
// US session for a UTC time (US Eastern; daylight time until 1 Nov 2026, standard after)
function session(t) {
  const d = new Date(t), off = t < Date.UTC(2026, 10, 1, 6) && t >= Date.UTC(2026, 2, 8, 7) ? 4 : 5;
  const et = new Date(t - off * H), wd = et.getUTCDay(), m = et.getUTCHours() * 60 + et.getUTCMinutes();
  if (wd === 0 || wd === 6) return "weekend";
  if (m >= 570 && m < 960) return "US regular hours";
  if (m >= 240 && m < 570) return "US pre-market";
  if (m >= 960 && m < 1200) return "US after-hours";
  return "overnight";
}

// ---- Round trips ----
function trips(fills) {
  const T = []; let cur = null;
  const open = (f, pos0) => ({ dir: Math.sign(f[1]), t0: f[0], fills: 0, adds: 0, exits: 0, inQty: 0, inNtl: 0, outQty: 0, outNtl: 0, pnl: 0, fee: 0, maxQ: Math.abs(pos0), liq: 0, avgDown: 0, pyramid: 0, maker: 0, partial: pos0 !== 0, entries: [] });
  for (const f of fills) {
    const [t, side, px, sz, start, cpnl, fee, , crossed, liq] = f;
    const end = start + side * sz;
    if (!cur) { if (end === 0) continue; cur = open(f, start); if (start !== 0) { cur.dir = Math.sign(start); cur.inQty = Math.abs(start); cur.inNtl = Math.abs(start) * px; } }
    // flip through zero: close the trip with the closing part, open a new one with the rest
    if (start !== 0 && Math.sign(end) === -Math.sign(start) && end !== 0) {
      const closeSz = Math.abs(start), openSz = Math.abs(end);
      cur.outQty += closeSz; cur.outNtl += closeSz * px; cur.pnl += cpnl; cur.fee += fee * closeSz / sz; cur.exits++; cur.t1 = t; cur.liq += liq;
      T.push(cur); cur = open(f, 0); cur.dir = Math.sign(end); cur.inQty = openSz; cur.inNtl = openSz * px; cur.fee += fee * openSz / sz; cur.maxQ = openSz; cur.entries.push([t, px, openSz]); continue;
    }
    cur.fills++; cur.fee += fee; if (!crossed) cur.maker++;
    const increasing = Math.abs(end) > Math.abs(start);
    if (increasing) {
      const vwap = cur.inQty ? cur.inNtl / cur.inQty : px;
      if (cur.inQty) { if ((px - vwap) * cur.dir < 0) cur.avgDown++; else cur.pyramid++; cur.adds++; }
      cur.inQty += sz; cur.inNtl += sz * px; cur.entries.push([t, px, sz]);
    } else { cur.outQty += sz; cur.outNtl += sz * px; cur.exits++; cur.liq += liq; }
    cur.pnl += cpnl; cur.maxQ = Math.max(cur.maxQ, Math.abs(end));
    if (end === 0) { cur.t1 = t; T.push(cur); cur = null; }
  }
  if (cur) { cur.open = true; T.push(cur); }
  for (const x of T) {
    x.entry = x.inQty ? x.inNtl / x.inQty : null; x.exit = x.outQty ? x.outNtl / x.outQty : null;
    x.ret = x.entry && x.exit ? (x.exit / x.entry - 1) * 100 * x.dir : null;
    x.holdH = x.t1 ? (x.t1 - x.t0) / H : (Date.now() - x.t0) / H;
    x.net = x.pnl - x.fee; x.maxNtl = x.maxQ * (x.entry || 0);
    x.ctx = ctxAt(x.t0, x.dir);
    if (x.entry && !x.open) Object.assign(x, excursion(x.t0, x.t1, x.entry, x.dir));
    if (x.t1 && !x.open) { const p1 = pxAt(x.t1), p2 = pxAt(x.t1 + 24 * H); x.after24 = p1 && p2 && hIdx(x.t1 + 24 * H) > hIdx(x.t1) ? (p2 / p1 - 1) * 100 * x.dir : null; }
    x.sess = session(x.t0);
  }
  return T;
}

// ---- Per trader ----
const traders = [];
for (const w of S.traders) {
  const f = w.fills.sort((a, b) => a[0] - b[0]);
  const T = trips(f), C = T.filter(x => !x.open && !x.partial);
  const wins = C.filter(x => x.net > 0), losses = C.filter(x => x.net < 0);
  const realized = T.reduce((a, x) => a + (x.open ? x.pnl - x.fee : x.net), 0);
  const unreal = w.state ? w.state.u : 0;
  const longNtl = T.filter(x => x.dir > 0).reduce((a, x) => a + x.maxNtl, 0), allNtl = T.reduce((a, x) => a + x.maxNtl, 0);
  const sess = {}; for (const x of T) sess[x.sess] = (sess[x.sess] || 0) + 1;
  const vol = f.reduce((a, x) => a + x[2] * x[3], 0);
  const o = {
    a: w.a, label: w.label, coh: w.coh, size: w.size, pnlAll: w.pnl, wrAll: w.wr, trunc: !!w.trunc,
    trips: C.length, open: T.some(x => x.open), wins: wins.length, losses: losses.length, winRate: C.length ? wins.length / C.length * 100 : null,
    realized, unreal, total: realized + unreal, fees: T.reduce((a, x) => a + x.fee, 0), volume: vol,
    pf: losses.length ? wins.reduce((a, x) => a + x.net, 0) / -losses.reduce((a, x) => a + x.net, 0) : (wins.length ? Infinity : null),
    avgWin: mean(wins.map(x => x.ret)), avgLoss: mean(losses.map(x => x.ret)), medHold: med(C.map(x => x.holdH)), holdW: med(wins.map(x => x.holdH)), holdL: med(losses.map(x => x.holdH)),
    longShare: allNtl ? longNtl / allNtl * 100 : null, maxNtl: Math.max(0, ...T.map(x => x.maxNtl)), medNtl: med(T.map(x => x.maxNtl)),
    adds: mean(T.map(x => x.adds)), avgDownShare: (() => { const a = T.reduce((s, x) => s + x.avgDown, 0), p = T.reduce((s, x) => s + x.pyramid, 0); return a + p ? a / (a + p) * 100 : null; })(),
    makerShare: f.length ? f.filter(x => !x[8]).length / f.length * 100 : null, liqs: T.reduce((a, x) => a + x.liq, 0),
    mfe: med(C.map(x => x.mfe)), mae: med(C.map(x => x.mae)), maeW: med(wins.map(x => x.mae)), maeL: med(losses.map(x => x.mae)),
    captured: med(C.filter(x => x.mfe > 0).map(x => x.ret / x.mfe * 100)), after24: med(C.map(x => x.after24)),
    entR24: med(T.map(x => x.ctx.r24 != null ? x.ctx.r24 * x.dir : null)), entPos5d: med(T.map(x => x.ctx.pos5d != null ? (x.dir > 0 ? x.ctx.pos5d : 1 - x.ctx.pos5d) : null)),
    entVs20: med(T.map(x => x.ctx.vs20 != null ? x.ctx.vs20 * x.dir : null)), entRsi: med(T.map(x => x.ctx.rsi)), entF: med(T.map(x => x.ctx.fApr != null ? -x.ctx.fApr * x.dir : null)),
    sess, first: f.length ? f[0][0] : null, last: f.length ? f[f.length - 1][0] : null, state: w.state, orders: w.orders,
    tripsList: T.map(x => ({ dir: x.dir, t0: x.t0, t1: x.t1 || null, entry: r2(x.entry), exit: r2(x.exit), ret: r2(x.ret), net: Math.round(x.net), holdH: r1(x.holdH), maxNtl: Math.round(x.maxNtl), adds: x.adds, avgDown: x.avgDown, pyramid: x.pyramid, mfe: r1(x.mfe), mae: r1(x.mae), after24: r1(x.after24), liq: x.liq, open: x.open || undefined, partial: x.partial || undefined, sess: x.sess, ctx: Object.fromEntries(Object.entries(x.ctx).map(([k, v]) => [k, r1(v)])) }))
  };
  o.style = o.medHold == null ? "—" : o.medHold < 2 ? "Scalper (holds < 2h)" : o.medHold < 24 ? "Intraday / short swing" : o.medHold < 120 ? "Swing (1–5 days)" : "Position (5+ days)";
  o.bias = o.longShare == null ? "—" : o.longShare >= 80 ? "Long-only" : o.longShare <= 20 ? "Short-only" : "Two-way";
  o.entryType = o.entR24 == null ? "—" : o.entR24 <= -3 ? "Buys dips / sells rips (fades the last 24h)" : o.entR24 >= 3 ? "Chases momentum (enters after a 24h move its way)" : "Neutral timing";
  traders.push(o);
}
// MM / high-frequency detection: many trips with tiny holds and returns
for (const t of traders) t.mm = t.trips >= 40 && t.medHold != null && t.medHold < 0.5;

// ---- Rank ----
const eligible = traders.filter(t => !t.mm && (t.trips >= 3 || Math.abs(t.unreal) >= 25000));
const best = eligible.slice().sort((a, b) => b.total - a.total).slice(0, 15);
const worst = eligible.slice().sort((a, b) => a.total - b.total).slice(0, 15);
const grp = L => ({
  n: L.length, total: L.reduce((a, t) => a + t.total, 0), winRate: med(L.map(t => t.winRate)), avgWin: med(L.map(t => t.avgWin)), avgLoss: med(L.map(t => t.avgLoss)),
  medHold: med(L.map(t => t.medHold)), holdW: med(L.map(t => t.holdW)), holdL: med(L.map(t => t.holdL)), longShare: med(L.map(t => t.longShare)), avgDownShare: med(L.map(t => t.avgDownShare)),
  makerShare: med(L.map(t => t.makerShare)), liqs: L.reduce((a, t) => a + t.liqs, 0), maeL: med(L.map(t => t.maeL)), mfe: med(L.map(t => t.mfe)), captured: med(L.map(t => t.captured)), after24: med(L.map(t => t.after24)),
  entR24: med(L.map(t => t.entR24)), entPos5d: med(L.map(t => t.entPos5d)), entVs20: med(L.map(t => t.entVs20)), entRsi: med(L.map(t => t.entRsi)), entF: med(L.map(t => t.entF)),
  lev: med(L.filter(t => t.state).map(t => t.state.lev)), trips: med(L.map(t => t.trips)),
  sess: (() => { const s = {}; let n = 0; for (const t of L) for (const [k, v] of Object.entries(t.sess)) { s[k] = (s[k] || 0) + v; n += v; } for (const k in s) s[k] = Math.round(s[k] / n * 100); return s; })()
});
// Combined net position of the best 10 (units) vs price, hourly
const top10 = best.slice(0, 10);
const tl = [];
if (h1.length) {
  const from = h1[Math.max(0, h1.length - 24 * 60)][0];
  for (let i = hIdx(from); i < h1.length; i++) {
    const t = h1[i][0] + H; let net = 0;
    for (const tr of top10) { const w = S.traders.find(x => x.a === tr.a); let pos = null; for (const f of w.fills) { if (f[0] > t) { if (pos == null) pos = f[4]; break; } pos = f[4] + f[1] * f[3]; } if (pos == null) pos = w.state ? w.state.szi : 0; net += pos; }
    tl.push([h1[i][0], r2(h1[i][4]), Math.round(net)]);
  }
}
const out = {
  t: S.t, coin: S.coin, candidates: S.candidates, withHistory: S.traders.length, analysed: traders.length, eligible: eligible.length, mm: traders.filter(t => t.mm).length,
  price: { last: h1.length ? h1[h1.length - 1][4] : null, d1: d1.slice(-120).map(k => [k[0], k[4]]) },
  groups: { best: grp(best.slice(0, 10)), worst: grp(worst.slice(0, 10)), all: grp(eligible) },
  best: best.map(t => ({ ...t, tripsList: t.tripsList.slice(-60) })), worst: worst.map(t => ({ ...t, tripsList: t.tripsList.slice(-20) })),
  timeline: tl, totals: { realized: traders.reduce((a, t) => a + t.realized, 0), unreal: traders.reduce((a, t) => a + t.unreal, 0) }
};
fs.writeFileSync(OUTF, JSON.stringify(out));
console.log(`analysed ${traders.length} wallets, eligible ${eligible.length}, MM ${out.mm}`);
for (const t of best.slice(0, 12)) console.log(`${t.a.slice(0, 10)} ${t.label || ""} | ${t.coh || "?"} | total ${Math.round(t.total)} (real ${Math.round(t.realized)}, open ${Math.round(t.unreal)}) | trips ${t.trips} win ${r1(t.winRate)}% | ${t.style} | ${t.bias} | ${t.entryType} | hold ${r1(t.medHold)}h | avgDown ${r1(t.avgDownShare)}% | maker ${r1(t.makerShare)}% | now ${t.state ? (t.state.szi > 0 ? "LONG " : "SHORT ") + Math.round(Math.abs(t.state.szi) * (out.price.last || 0)) + " lev " + t.state.lev : "flat"}`);
