// Sentiment-turn and price-move study on the hourly backtest panel (panel.json.gz).
// Finds the signs ("linchpins") that come before a major turn, and the signs that come before a large move.
//   Turn   = a zigzag pivot (a swing of at least SW% that ends and reverses by at least SW%) in the next 24 h,
//            against the trend of the last 72 h.
//   Move   = |next 24 h return| at least 2.5× the coin's typical 24 h move (direction tested separately).
// Each sign is computed with data up to the hour only. Lift = rate with the sign / base rate.
// Fit on the first 60% of hours, check on the last 40%. One sample every 4 hours per coin.
// Usage: node scripts/study/turns.mjs panel.json.gz out.json
import fs from "node:fs";
import zlib from "node:zlib";
const [, , IN, OUT] = process.argv;
const P = JSON.parse(zlib.gunzipSync(fs.readFileSync(IN)).toString());
const NH = P.nh, SPLIT = Math.floor(NH * 0.6), STEP = 4;
const med = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const r2 = x => Number.isFinite(x) ? Math.round(x * 100) / 100 : null;

// ---------- per-coin series ----------
function prep(k, m) {
  const px = m.px.map(v => v ?? NaN), hi = m.hi.map((v, i) => v ?? px[i]), lo = m.lo.map((v, i) => v ?? px[i]), vol = m.v.map(v => v ?? 0), fr = m.fr.map(v => v ?? NaN);
  const N = px.length; if (px.filter(Number.isFinite).length < N * 0.7) return null;
  for (let i = 1; i < N; i++) if (!Number.isFinite(px[i])) px[i] = px[i - 1];
  const [Sg, Fg, Ng] = m.g;
  const net = (g, i) => g.L[i] - g.S[i], gross = (g, i) => g.L[i] + g.S[i];
  const bias = (g, i) => { const n = gross(g, i), c = g.lc[i] + g.sc[i]; if (n < 20000 || c < 2) return NaN; return 0.6 * net(g, i) / n + 0.4 * (g.lc[i] - g.sc[i]) / c; };
  const sb = Sg.L.map((_, i) => bias(Sg, i)), fb = Fg.L.map((_, i) => bias(Fg, i));
  const allL = i => Sg.L[i] + Fg.L[i] + Ng.L[i], allS = i => Sg.S[i] + Fg.S[i] + Ng.S[i];
  const lr = px.map((p, i) => i ? Math.log(p / px[i - 1]) : 0);
  // typical 24h move: median |24h return| over the window
  const r24 = px.map((p, i) => i >= 24 ? p / px[i - 24] - 1 : NaN), typ = med(r24.map(Math.abs));
  if (!(typ > 0)) return null;
  // zigzag pivots (threshold = max(6%, 3 x typical 24h move))
  const SW = Math.max(0.06, 3 * typ), piv = new Int8Array(N);
  let dir = 0, ext = px[0], exI = 0;
  for (let i = 1; i < N; i++) {
    const p = px[i];
    if (dir >= 0) { if (p > ext) { ext = p; exI = i; } else if (p < ext * (1 - SW)) { if (dir === 1) piv[exI] = 1; dir = -1; ext = p; exI = i; } if (dir === 0 && p > px[0] * (1 + SW)) dir = 1; }
    else { if (p < ext) { ext = p; exI = i; } else if (p > ext * (1 + SW)) { piv[exI] = -1; dir = 1; ext = p; exI = i; } }
  }
  return { k, N, px, hi, lo, vol, fr, sb, fb, Sg, Fg, Ng, net, gross, allL, allS, lr, r24, typ, SW, piv };
}

// ---------- signs at hour i (direction d = sign of the last-72h trend; a "turn" sign points against it) ----------
const SIGNS = [
  ["smart_against", "Smart money trades against the trend (24 h net flow ≥ 10% of its book, opposite to the 72 h move)"],
  ["smart_flip", "Smart money's bias swings ≥ 0.4 in 24 h against the trend"],
  ["fool_crowded", "Fools crowded with the trend (bias ≥ 0.6 in the trend direction)"],
  ["fool_chase", "Fools add with the trend (24 h net flow ≥ 15% of their book)"],
  ["fool_flush", "Fools' gross position falls ≥ 30% in 24 h (forced exits / liquidations)"],
  ["gap_open", "Smart and fools on opposite sides, with smart against the trend (gap ≥ 0.3)"],
  ["fund_extreme", "Funding stretched in the trend direction (z ≥ 2 vs the coin's 60-day funding)"],
  ["fund_flip", "Funding flips sign against the trend in the last 24 h"],
  ["vol_climax", "Volume climax: hour volume ≥ 4× its 7-day median at a 72 h extreme"],
  ["wick", "Rejection wick: wick ≥ 60% of the hour's range at a 72 h extreme"],
  ["rsi_div", "RSI divergence: new 72 h extreme with RSI(14 h) lower than at the last extreme"],
  ["stretch", "Stretched: price ≥ 3 typical 24 h moves away from its 72 h mean"],
  ["oi_div", "Positions shrink while price extends (sample gross $ down ≥ 10% in 24 h)"],
  ["crowd_div", "Crowd skew: ≥ 70% of trader accounts on the trend side while $ is balanced (< 55%)"],
  ["squeeze", "Volatility squeeze: 24 h range ≤ 50% of its 7-day average range"],
];
function signsAt(c, i) {
  const { px, hi, lo, vol, fr, sb, fb, Sg, Fg, net, gross, allL, allS, typ } = c;
  if (i < 168) return null;
  const tr72 = px[i] / px[i - 72] - 1, d = tr72 >= 0 ? 1 : -1;
  const s = {};
  const book = g => Math.max(gross(g, i), gross(g, i - 24), 1);
  const sflow = (net(Sg, i) - net(Sg, i - 24)) / book(Sg), fflow = (net(Fg, i) - net(Fg, i - 24)) / book(Fg);
  s.smart_against = book(Sg) >= 50000 && sflow * d <= -0.1;
  s.smart_flip = Number.isFinite(sb[i]) && Number.isFinite(sb[i - 24]) && (sb[i] - sb[i - 24]) * d <= -0.4;
  s.fool_crowded = Number.isFinite(fb[i]) && fb[i] * d >= 0.6;
  s.fool_chase = book(Fg) >= 50000 && fflow * d >= 0.15;
  s.fool_flush = gross(Fg, i - 24) >= 50000 && gross(Fg, i) <= gross(Fg, i - 24) * 0.7;
  s.gap_open = Number.isFinite(sb[i]) && Number.isFinite(fb[i]) && (sb[i] - fb[i]) / 2 * d <= -0.3;
  const fh = fr.slice(0, i + 1).filter(Number.isFinite);
  if (fh.length > 72) { const m = fh.reduce((a, b) => a + b, 0) / fh.length, sd = Math.sqrt(fh.reduce((a, b) => a + (b - m) ** 2, 0) / fh.length) || 1e-9;
    let f8 = 0, n8 = 0; for (let h = 0; h < 8; h++) if (Number.isFinite(fr[i - h])) { f8 += fr[i - h]; n8++; }
    s.fund_extreme = n8 > 0 && ((f8 / n8 - m) / sd) * d >= 2;
    let fo = 0, no = 0; for (let h = 24; h < 32; h++) if (Number.isFinite(fr[i - h])) { fo += fr[i - h]; no++; }
    s.fund_flip = n8 > 0 && no > 0 && Math.sign(fo) === d && Math.sign(f8) === -d && Math.abs(f8 / n8) > 1e-6; }
  let H72 = -Infinity, L72 = Infinity; for (let h = 0; h < 72; h++) { H72 = Math.max(H72, hi[i - h]); L72 = Math.min(L72, lo[i - h]); }
  const atExt = d > 0 ? hi[i] >= H72 * 0.995 : lo[i] <= L72 * 1.005;
  const v7 = med(vol.slice(i - 168, i)); s.vol_climax = atExt && v7 > 0 && vol[i] >= 4 * v7;
  const rg = hi[i] - lo[i]; s.wick = atExt && rg > 0 && (d > 0 ? (hi[i] - Math.max(px[i], px[i - 1])) : (Math.min(px[i], px[i - 1]) - lo[i])) / rg >= 0.6;
  // RSI 14h
  const rsi = j => { let u = 0, dn = 0; for (let h = j - 13; h <= j; h++) { const x = px[h] - px[h - 1]; if (x > 0) u += x; else dn -= x; } return u + dn ? 100 * u / (u + dn) : 50; };
  if (atExt) { let jPrev = -1; for (let h = 12; h < 72; h++) { const j = i - h; if (d > 0 ? hi[j] >= H72 * 0.98 : lo[j] <= L72 * 1.02) { jPrev = j; break; } }
    s.rsi_div = jPrev > 0 && (rsi(i) - rsi(jPrev)) * d <= -8; } else s.rsi_div = false;
  let m72 = 0; for (let h = 0; h < 72; h++) m72 += px[i - h]; m72 /= 72; s.stretch = Math.abs(px[i] / m72 - 1) >= 3 * typ && Math.sign(px[i] - m72) === d;
  const gAll = j => allL(j) + allS(j); s.oi_div = gAll(i - 24) >= 100000 && gAll(i) <= gAll(i - 24) * 0.9 && (px[i] / px[i - 24] - 1) * d > typ * 0.5;
  const cnt = j => { const L = Sg.lc[j] + Fg.lc[j] + c.Ng.lc[j], S = Sg.sc[j] + Fg.sc[j] + c.Ng.sc[j]; return L + S ? L / (L + S) : 0.5; };
  const dl = allL(i) + allS(i) ? allL(i) / (allL(i) + allS(i)) : 0.5;
  s.crowd_div = (d > 0 ? cnt(i) >= 0.7 : cnt(i) <= 0.3) && Math.abs(dl - 0.5) < 0.05;
  const rangeAt = j => { let a = -Infinity, b = Infinity; for (let h = 0; h < 24; h++) { a = Math.max(a, hi[j - h]); b = Math.min(b, lo[j - h]); } return a - b; };
  const rng24 = rangeAt(i); let avg = 0; for (let k2 = 1; k2 <= 6; k2++) avg += rangeAt(i - 24 * k2); avg /= 6;
  s.squeeze = avg > 0 && rng24 <= avg * 0.5;
  const v = { sb: sb[i], fb: fb[i], sflow: book(Sg) >= 50000 ? sflow : NaN, fflow: book(Fg) >= 50000 ? fflow : NaN, mom: (px[i] / px[i - 24] - 1) / typ,
    brk: px[i] >= H72 * 0.999 ? 1 : px[i] <= L72 * 1.001 ? -1 : 0, fz: NaN, sq: s.squeeze };
  if (fh.length > 72) { const m = fh.reduce((a2, b2) => a2 + b2, 0) / fh.length, sd = Math.sqrt(fh.reduce((a2, b2) => a2 + (b2 - m) ** 2, 0) / fh.length) || 1e-9; let f8 = 0, n8 = 0; for (let h = 0; h < 8; h++) if (Number.isFinite(fr[i - h])) { f8 += fr[i - h]; n8++; } if (n8) v.fz = (f8 / n8 - m) / sd; }
  return { d, tr72, s, v };
}

// ---------- targets ----------
function targets(c, i) {
  const { px, piv, typ, N } = c; if (i + 24 >= N) return null;
  const tr72 = px[i] / px[i - 72] - 1, d = tr72 >= 0 ? 1 : -1;
  let turn = false; for (let h = 0; h <= 24; h++) if (piv[i + h] === d) { turn = true; break; }   // top after an up-trend (piv +1) or bottom after a down-trend (-1)
  const f24 = px[i + 24] / px[i] - 1, f72 = i + 72 < N ? px[i + 72] / px[i] - 1 : NaN;
  return { turn, big: Math.abs(f24) >= 2.5 * typ, f24, f72, against: -d * f24 };
}

// ---------- collect samples ----------
const coins = Object.entries(P.m).map(([k, m]) => prep(k, m)).filter(Boolean);
const S = [];
for (const c of coins) for (let i = 168; i < c.N - 24; i += STEP) { const g = signsAt(c, i), t = targets(c, i); if (!g || !t) continue; S.push({ k: c.k, i, part: i < SPLIT ? "fit" : "check", ...g, ...t }); }
const base = p => { const L = S.filter(x => x.part === p); return { n: L.length, turn: L.filter(x => x.turn).length / L.length, big: L.filter(x => x.big).length / L.length }; };
const B = { fit: base("fit"), check: base("check") };
function evalSign(fn, label, id) {
  const o = { id, label };
  for (const p of ["fit", "check"]) {
    const L = S.filter(x => x.part === p && fn(x)), n = L.length;
    o[p] = { n, turnRate: n ? L.filter(x => x.turn).length / n : null, turnLift: n ? r2(L.filter(x => x.turn).length / n / B[p].turn) : null,
      bigRate: n ? L.filter(x => x.big).length / n : null, bigLift: n ? r2(L.filter(x => x.big).length / n / B[p].big) : null,
      against24: n ? r2(med(L.map(x => x.against)) * 100) : null, hitAgainst: n ? r2(L.filter(x => x.against > 0).length / n * 100) : null };
  }
  o.robustTurn = o.fit.n >= 30 && o.check.n >= 20 && o.fit.turnLift >= 1.25 && o.check.turnLift >= 1.25;
  o.robustBig = o.fit.n >= 30 && o.check.n >= 20 && o.fit.bigLift >= 1.25 && o.check.bigLift >= 1.25;
  o.robustDir = o.fit.n >= 30 && o.check.n >= 20 && o.fit.hitAgainst >= 55 && o.check.hitAgainst >= 55;
  return o;
}
const single = SIGNS.map(([id, label]) => evalSign(x => x.s[id], label, id));
// count of turn signs lit (using the signs that pass on the fit period only)
const fitTurn = single.filter(o => o.fit.n >= 30 && o.fit.turnLift >= 1.25).map(o => o.id);
const fitBig = single.filter(o => o.fit.n >= 30 && o.fit.bigLift >= 1.25).map(o => o.id);
const score = (x, ids) => ids.filter(id => x.s[id]).length;
const ladder = [1, 2, 3, 4].map(n => ({ n, turn: evalSign(x => score(x, fitTurn) >= n, `${n}+ turn signs`, "t" + n), big: evalSign(x => score(x, fitBig) >= n, `${n}+ move signs`, "b" + n) }));
// pairs of turn signs
const pairs = []; for (let a = 0; a < SIGNS.length; a++) for (let b = a + 1; b < SIGNS.length; b++) { const A = SIGNS[a][0], Bb = SIGNS[b][0]; const o = evalSign(x => x.s[A] && x.s[Bb], `${A} + ${Bb}`, A + "+" + Bb); if (o.fit.n >= 20 && o.check.n >= 10) pairs.push(o); }
pairs.sort((x, y) => (y.check.turnLift || 0) + (y.fit.turnLift || 0) - (x.check.turnLift || 0) - (x.fit.turnLift || 0));
// ---------- direction: which signs predict the sign of the next 24 h move ----------
const DIRS = [
  ["smart_bias", "Smart money's side (bias ≥ 0.3)", x => Math.abs(x.v.sb) >= 0.3 ? Math.sign(x.v.sb) : 0],
  ["smart_flow", "Smart money's 24 h flow (≥ 10% of book)", x => Math.abs(x.v.sflow) >= 0.1 ? Math.sign(x.v.sflow) : 0],
  ["fool_fade", "Against the fools' side (bias ≥ 0.5)", x => Math.abs(x.v.fb) >= 0.5 ? -Math.sign(x.v.fb) : 0],
  ["fool_flow_fade", "Against the fools' 24 h flow (≥ 15% of book)", x => Math.abs(x.v.fflow) >= 0.15 ? -Math.sign(x.v.fflow) : 0],
  ["gap", "Smart vs fools gap (≥ 0.3)", x => Number.isFinite(x.v.sb) && Number.isFinite(x.v.fb) && Math.abs(x.v.sb - x.v.fb) / 2 >= 0.3 ? Math.sign(x.v.sb - x.v.fb) : 0],
  ["momentum", "24 h momentum (≥ 1 typical move)", x => Math.abs(x.v.mom) >= 1 ? Math.sign(x.v.mom) : 0],
  ["reversal", "Fade a 24 h move of ≥ 2 typical moves", x => Math.abs(x.v.mom) >= 2 ? -Math.sign(x.v.mom) : 0],
  ["breakout", "72 h breakout direction", x => x.v.brk],
  ["fund_fade", "Against stretched funding (z ≥ 2)", x => Math.abs(x.v.fz) >= 2 ? -Math.sign(x.v.fz) : 0],
  ["squeeze_smart", "Volatility squeeze, smart money's side", x => x.v.sq && Math.abs(x.v.sb) >= 0.2 ? Math.sign(x.v.sb) : 0],
  ["turn2", "2+ turn signs: against the 72 h trend", x => fitTurn.filter(id => x.s[id]).length >= 2 ? -x.d : 0],
];
const direction = DIRS.map(([id, label, fn]) => { const o = { id, label };
  for (const p of ["fit", "check"]) { const L = S.filter(x => x.part === p).map(x => [fn(x), x.f24]).filter(([dd]) => dd);
    o[p] = { n: L.length, hit: L.length ? r2(L.filter(([dd, f]) => dd * f > 0).length / L.length * 100) : null, med: L.length ? r2(med(L.map(([dd, f]) => dd * f)) * 100) : null, mean: L.length ? r2(L.reduce((a, [dd, f]) => a + dd * f, 0) / L.length * 100) : null }; }
  o.robust = o.fit.n >= 50 && o.check.n >= 30 && o.fit.hit >= 53 && o.check.hit >= 53 && o.fit.mean > 0 && o.check.mean > 0; return o; });

const out = { t: new Date().toISOString(), direction, window: { from: new Date(P.t0).toISOString(), hours: NH, split: new Date(P.t0 + SPLIT * P.h).toISOString() }, coins: coins.length, samples: S.length, base: B, fitTurn, fitBig, single, ladder, pairs: pairs.slice(0, 15),
  swing: { median: r2(med(coins.map(c => c.SW)) * 100), typ24: r2(med(coins.map(c => c.typ)) * 100) } };
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`coins ${coins.length} samples ${S.length} base fit turn ${(B.fit.turn * 100).toFixed(1)}% big ${(B.fit.big * 100).toFixed(1)}% · check turn ${(B.check.turn * 100).toFixed(1)}% big ${(B.check.big * 100).toFixed(1)}%`);
for (const o of single) console.log(o.id.padEnd(14), "fit n", String(o.fit.n).padStart(5), "turn×", o.fit.turnLift, "big×", o.fit.bigLift, "agst%", o.fit.hitAgainst, "| check n", String(o.check.n).padStart(5), "turn×", o.check.turnLift, "big×", o.check.bigLift, "agst%", o.check.hitAgainst, o.robustTurn ? "TURN" : "", o.robustBig ? "BIG" : "", o.robustDir ? "DIR" : "");
for (const l of ladder) console.log(l.turn.label, "fit", l.turn.fit.n, l.turn.fit.turnLift, "check", l.turn.check.n, l.turn.check.turnLift, "|", l.big.label, "fit", l.big.fit.n, l.big.fit.bigLift, "check", l.big.check.n, l.big.check.bigLift);
for (const p of pairs.slice(0, 8)) console.log("pair", p.id, "fit", p.fit.n, p.fit.turnLift, "check", p.check.n, p.check.turnLift);
for (const o of direction) console.log("dir", o.id.padEnd(15), "fit", o.fit.n, o.fit.hit + "%", o.fit.mean, "| check", o.check.n, o.check.hit + "%", o.check.mean, o.robust ? "ROBUST" : "");
