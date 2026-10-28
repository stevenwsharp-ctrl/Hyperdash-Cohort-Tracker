// Deep study of SOXL traders: merge Hyperdash full-history SOXL stats with fill-level behaviour.
// node deep.mjs study.json all.json hd.json report.json
import fs from "node:fs";
const [, , SF, AF, HF, OF] = process.argv;
const S = JSON.parse(fs.readFileSync(SF, "utf8")), A = JSON.parse(fs.readFileSync(AF, "utf8")), HD = JSON.parse(fs.readFileSync(HF, "utf8"));
const H = 36e5;
const med = a => { const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const mean = a => { const s = a.filter(x => x != null && isFinite(x)); return s.length ? s.reduce((p, q) => p + q, 0) / s.length : null; };
const sum = a => a.reduce((p, q) => p + (q || 0), 0);
const r1 = x => x == null || !isFinite(x) ? null : Math.round(x * 10) / 10, r0 = x => x == null || !isFinite(x) ? null : Math.round(x);
const h1 = S.h1.sort((a, b) => a[0] - b[0]), d1 = S.d1.sort((a, b) => a[0] - b[0]);
const last = h1[h1.length - 1][4];
const hIdx = t => { let lo = 0, hi = h1.length - 1, ans = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (h1[m][0] <= t) { ans = m; lo = m + 1; } else hi = m - 1; } return ans; };
const pxAt = t => { const i = hIdx(t); return i >= 0 ? h1[i][4] : null; };

const T = A.all.map(t => {
  const h = HD[t.a] || {}, s = h.s;
  return { ...t, hd: s ? { pnl: s[0], trades: s[1], wins: s[2], losses: s[3], vol: s[4], wr: s[1] ? s[2] / s[1] * 100 : null } : null, hdTot: h.tot };
});
const pnlOf = t => t.hd ? t.hd.pnl : t.realized;            // full-history SOXL PnL (Hyperdash), else from fills
const tradesOf = t => t.hd ? t.hd.trades : t.trips;
const elig = T.filter(t => !t.mm && tradesOf(t) >= 3);
const best = elig.slice().sort((a, b) => pnlOf(b) - pnlOf(a)).slice(0, 20);
const worst = elig.slice().sort((a, b) => pnlOf(a) - pnlOf(b)).slice(0, 20);
const mms = T.filter(t => t.mm).sort((a, b) => pnlOf(b) - pnlOf(a));
const openWin = T.filter(t => t.state && t.unreal > 0).sort((a, b) => b.unreal - a.unreal).slice(0, 10);

// ---- trip-level behaviour by group ----
const tripsOf = L => L.flatMap(t => (t.tripsList || []).filter(x => !x.partial).map(x => ({ ...x, a: t.a })));
function bucket(L, f, edges, labels) {
  const out = labels.map(l => ({ l, n: 0, win: 0, net: 0, ret: [] }));
  for (const x of L) { const v = f(x); if (v == null || !isFinite(v)) continue; let k = edges.findIndex(e => v < e); if (k < 0) k = edges.length; const b = out[k]; b.n++; if (x.net > 0) b.win++; b.net += x.net; if (x.ret != null) b.ret.push(x.ret); }
  return out.map(b => ({ l: b.l, n: b.n, winRate: b.n ? r1(b.win / b.n * 100) : null, net: r0(b.net), medRet: r1(med(b.ret)) }));
}
function behaviour(L) {
  const all = tripsOf(L), C = all.filter(x => !x.open);
  const longs = C.filter(x => x.dir > 0), shorts = C.filter(x => x.dir < 0);
  return {
    traders: L.length, trips: C.length, open: all.filter(x => x.open).length,
    winRate: r1(C.filter(x => x.net > 0).length / (C.length || 1) * 100),
    longWin: r1(longs.filter(x => x.net > 0).length / (longs.length || 1) * 100), shortWin: r1(shorts.filter(x => x.net > 0).length / (shorts.length || 1) * 100),
    longNet: r0(sum(longs.map(x => x.net))), shortNet: r0(sum(shorts.map(x => x.net))), longN: longs.length, shortN: shorts.length,
    medHold: r1(med(C.map(x => x.holdH))), holdWin: r1(med(C.filter(x => x.net > 0).map(x => x.holdH))), holdLoss: r1(med(C.filter(x => x.net < 0).map(x => x.holdH))),
    medRetWin: r1(med(C.filter(x => x.net > 0).map(x => x.ret))), medRetLoss: r1(med(C.filter(x => x.net < 0).map(x => x.ret))),
    maeWin: r1(med(C.filter(x => x.net > 0).map(x => x.mae))), maeLoss: r1(med(C.filter(x => x.net < 0).map(x => x.mae))), mfeLoss: r1(med(C.filter(x => x.net < 0).map(x => x.mfe))),
    giveBack: r1(med(C.filter(x => x.mfe > 1).map(x => x.mfe - x.ret))),   // % they leave on the table after the best point
    after24: r1(med(C.map(x => x.after24))), contAfterWin: r1(med(C.filter(x => x.net > 0).map(x => x.after24))),
    addsPerTrip: r1(mean(all.map(x => x.adds))), avgDownTrips: r1(all.filter(x => x.avgDown > 0).length / (all.length || 1) * 100), pyramidTrips: r1(all.filter(x => x.pyramid > 0).length / (all.length || 1) * 100),
    liqTrips: all.filter(x => x.liq > 0).length, medSize: r0(med(all.map(x => x.maxNtl))),
    byR24: bucket(C, x => x.ctx && x.ctx.r24 != null ? x.ctx.r24 * x.dir : null, [-8, -3, 3, 8], ["after a big move against (≤−8%)", "after a dip against (−8 to −3%)", "flat 24h (±3%)", "after a move its way (3 to 8%)", "after a big move its way (≥8%)"]),
    byPos5d: bucket(C, x => x.ctx && x.ctx.pos5d != null ? (x.dir > 0 ? x.ctx.pos5d : 1 - x.ctx.pos5d) : null, [0.25, 0.5, 0.75], ["bottom quarter of 5-day range (for its side)", "lower middle", "upper middle", "top quarter (chasing)"]),
    byRsi: bucket(C, x => x.ctx && x.ctx.rsi != null ? (x.dir > 0 ? x.ctx.rsi : 100 - x.ctx.rsi) : null, [35, 50, 65], ["RSI against side < 35 (oversold for longs)", "35–50", "50–65", "> 65 (stretched its way)"]),
    bySess: (() => { const o = {}; for (const x of C) { const k = x.sess; o[k] = o[k] || { n: 0, win: 0, net: 0 }; o[k].n++; if (x.net > 0) o[k].win++; o[k].net += x.net; } return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { n: v.n, winRate: r1(v.win / v.n * 100), net: r0(v.net) }])); })(),
    byHold: bucket(C, x => x.holdH, [1, 6, 24, 72], ["< 1 h", "1–6 h", "6–24 h", "1–3 days", "> 3 days"]),
  };
}
// ---- current positioning ----
function positioning(L) {
  const P = L.filter(t => t.state && t.state.szi);
  const ntl = t => t.state.szi * last;
  const longs = P.filter(t => t.state.szi > 0), shorts = P.filter(t => t.state.szi < 0);
  return { holders: P.length, longs: longs.length, shorts: shorts.length, longUsd: r0(sum(longs.map(ntl))), shortUsd: r0(-sum(shorts.map(ntl))), net: r0(sum(P.map(ntl))),
    medLev: med(P.map(t => t.state.lev)), avgEntryL: r1(sum(longs.map(t => t.state.ep * t.state.szi)) / (sum(longs.map(t => t.state.szi)) || 1)), avgEntryS: r1(sum(shorts.map(t => t.state.ep * t.state.szi)) / (sum(shorts.map(t => t.state.szi)) || 1)),
    liqL: longs.filter(t => t.state.lq).map(t => [r1(t.state.lq), r0(ntl(t))]).sort((a, b) => b[0] - a[0]).slice(0, 8), liqS: shorts.filter(t => t.state.lq).map(t => [r1(t.state.lq), r0(-ntl(t))]).sort((a, b) => a[0] - b[0]).slice(0, 8),
    stops: P.map(t => ({ a: t.a.slice(0, 8), side: t.state.szi > 0 ? "L" : "S", tp: (t.orders || []).filter(o => o[4] && ((t.state.szi > 0 && o[2] > last) || (t.state.szi < 0 && o[2] < last))).map(o => r1(o[2])), sl: (t.orders || []).filter(o => o[4] && ((t.state.szi > 0 && o[2] < last) || (t.state.szi < 0 && o[2] > last))).map(o => r1(o[2])) })).filter(x => x.tp.length || x.sl.length) };
}
// ---- what the best did around the largest days ----
function bigDays(L) {
  const moves = d1.slice(1).map((k, i) => ({ t: k[0], r: (k[4] / d1[i][4] - 1) * 100 })).sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 8).sort((a, b) => a.t - b.t);
  const posAt = (w, t) => { let pos = null; for (const f of w.fills) { if (f[0] > t) { if (pos == null) pos = f[4]; break; } pos = f[4] + f[1] * f[3]; } return pos == null ? (w.state ? w.state.szi : 0) : pos; };
  return moves.map(m => {
    let before = 0, after = 0, bL = 0, bS = 0;
    for (const t of L) { const w = S.traders.find(x => x.a === t.a); if (!w || !w.fills.length || w.fills[0][0] > m.t - 24 * H) continue; const p0 = posAt(w, m.t), p1 = posAt(w, m.t + 24 * H); before += p0 * pxAt(m.t); after += p1 * pxAt(m.t + 24 * H); if (p0 > 0) bL++; if (p0 < 0) bS++; }
    return { day: new Date(m.t).toISOString().slice(0, 10), move: r1(m.r), netBefore: r0(before), netAfter: r0(after), longs: bL, shorts: bS };
  });
}
// ---- do the best lead price? position change vs next 24h return ----
function leadLag(L) {
  const hrs = []; const from = h1.length - 24 * 45;
  const ws = L.map(t => S.traders.find(x => x.a === t.a)).filter(Boolean);
  const pos = (w, t) => { if (!w.fills.length) return w.state ? w.state.szi : 0; if (t < w.fills[0][0]) return w.fills[0][4] !== 0 ? null : 0; let p = 0; for (const f of w.fills) { if (f[0] > t) break; p = f[4] + f[1] * f[3]; } return p; };
  for (let i = Math.max(1, from); i < h1.length - 24; i += 4) {
    const t = h1[i][0], W = ws.filter(w => pos(w, t - 4 * H) != null), net = sum(W.map(w => pos(w, t) * h1[i][4])), netPrev = sum(W.map(w => pos(w, t - 4 * H) * h1[Math.max(0, i - 4)][4]));
    hrs.push({ d: net - netPrev, fwd: (h1[i + 24][4] / h1[i][4] - 1) * 100, back: (h1[i][4] / h1[Math.max(0, i - 24)][4] - 1) * 100 });
  }
  const corr = (a, b) => { const ma = mean(a), mb = mean(b); let s = 0, sa = 0, sb = 0; for (let i = 0; i < a.length; i++) { s += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; } return sa && sb ? s / Math.sqrt(sa * sb) : null; };
  const big = hrs.filter(x => Math.abs(x.d) > 0), q = med(big.map(x => Math.abs(x.d)));
  const buys = big.filter(x => x.d > q), sells = big.filter(x => x.d < -q);
  return { n: hrs.length, corrFwd: r1(corr(hrs.map(x => x.d), hrs.map(x => x.fwd)) * 100) / 100, corrBack: r1(corr(hrs.map(x => x.d), hrs.map(x => x.back)) * 100) / 100,
    afterBigBuys: r1(med(buys.map(x => x.fwd))), afterBigSells: r1(med(sells.map(x => x.fwd))), buysAfter24: r1(med(buys.map(x => x.back))), sellsAfter24: r1(med(sells.map(x => x.back))) };
}
const brief = t => ({ a: t.a, label: t.label || null, coh: t.coh, pnl: r0(pnlOf(t)), trades: tradesOf(t), wr: r1(t.hd ? t.hd.wr : t.winRate), vol: r0(t.hd ? t.hd.vol : t.volume), allPnl: r0(t.hdTot ?? t.pnlAll), unreal: r0(t.unreal),
  style: t.style, bias: t.bias, entryType: t.entryType, medHold: r1(t.medHold), avgWin: r1(t.avgWin), avgLoss: r1(t.avgLoss), avgDown: r1(t.avgDownShare), maker: r1(t.makerShare), liqs: t.liqs, maeL: r1(t.maeL), pf: t.pf === Infinity ? "∞" : r1(t.pf),
  now: t.state ? { side: t.state.szi > 0 ? "long" : "short", usd: r0(Math.abs(t.state.szi) * last), ep: r1(t.state.ep), lev: t.state.lev, lq: r1(t.state.lq), u: r0(t.state.u), lt: t.state.lt } : null, partial: t.partialStart, fillsFrom: t.first ? new Date(t.first).toISOString().slice(0, 10) : null,
  recent: (t.tripsList || []).slice(-6).map(x => ({ dir: x.dir > 0 ? "L" : "S", t0: new Date(x.t0).toISOString().slice(5, 16), hold: x.holdH, entry: x.entry, exit: x.exit, ret: x.ret, net: x.net, usd: x.maxNtl, open: !!x.open })) });
const R = {
  t: S.t, coin: S.coin, last, listing: new Date(d1[0][0]).toISOString().slice(0, 10), walletsStudied: S.traders.length, eligible: elig.length, mm: mms.length,
  totals: { hdPnlAll: r0(sum(T.map(pnlOf))), winners: T.filter(t => pnlOf(t) > 0).length, losers: T.filter(t => pnlOf(t) < 0).length },
  best: best.map(brief), worst: worst.map(brief), mms: mms.slice(0, 5).map(brief), openWin: openWin.map(brief),
  bBest: behaviour(best.slice(0, 15)), bWorst: behaviour(worst.slice(0, 15)), bAll: behaviour(elig),
  posBest: positioning(best), posWorst: positioning(worst), posAll: positioning(T),
  bigBest: bigDays(best.slice(0, 15)), bigWorst: bigDays(worst.slice(0, 15)),
  leadBest: leadLag(best.slice(0, 15)), leadWorst: leadLag(worst.slice(0, 15)),
  price: d1.map(k => [new Date(k[0]).toISOString().slice(0, 10), r1(k[4])]),
  timeline: (() => { const ws = best.slice(0, 10).map(t => S.traders.find(x => x.a === t.a)), wsW = worst.slice(0, 10).map(t => S.traders.find(x => x.a === t.a)), out = [];
    const pos = (w, t) => { if (!w.fills.length) return 0; if (t < w.fills[0][0]) return w.fills[0][4] !== 0 ? null : 0; let p = 0; for (const f of w.fills) { if (f[0] > t) break; p = f[4] + f[1] * f[3]; } return p; };
    const cov = (L, t) => L.filter(w => pos(w, t) != null).length;
    for (let i = Math.max(0, h1.length - 24 * 60); i < h1.length; i += 6) { const t = h1[i][0] + H; out.push([new Date(h1[i][0]).toISOString().slice(0, 13), r1(h1[i][4]), r0(sum(ws.map(w => pos(w, t) || 0)) * h1[i][4]), r0(sum(wsW.map(w => pos(w, t) || 0)) * h1[i][4]), cov(ws, t), cov(wsW, t)]); }
    return out; })()
};
fs.writeFileSync(OF, JSON.stringify(R));
console.log(JSON.stringify({ totals: R.totals, eligible: R.eligible, bBest: { ...R.bBest, byR24: undefined, byPos5d: undefined, byRsi: undefined, bySess: undefined, byHold: undefined }, bWorst: { ...R.bWorst, byR24: undefined, byPos5d: undefined, byRsi: undefined, bySess: undefined, byHold: undefined } }, null, 1));
