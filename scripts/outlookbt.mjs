// Outlook backtest: tests the Outlook tab's ranking systems on the 40-day hourly panel that backtest.mjs rebuilds
// (panel.json.gz: price, high, low, $ volume, funding and the smart / fools / neutral cohort positions per market).
// Systems (the same formulas as outlook.js, using only data known at each hour):
//   smart (cohort gap), mom (move over 2x the horizon in vol units), rev (stretch from the horizon's mean),
//   pos (funding carry + fading the crowded side; trapped traders are not in the panel), flow (change of the gap).
//   The signal web is not in the panel, so it is not tested here.
// For each horizon (24 h, 48 h, 7 d), every STEP hours (6 h; t-stats corrected for the overlap): top 5 longs and top 5 shorts among markets with $1M+ daily volume;
// spread = long return - short return (each vs the universe average), rank IC (Spearman) of score vs the next move.
// Weights for the consensus come from the first 60% of days; the consensus is checked on the last 40% (unseen).
// Also writes outlook_lessons.json: every 4 h, the scores of the 40 most traded markets and their next 1 h / 4 h / 24 h
// moves, so the spider web can learn from the 40 days in one replay.
// Usage: node scripts/outlookbt.mjs <panel.json.gz> <outDir>
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const [IN, OUT = "."] = process.argv.slice(2);
const P = JSON.parse(zlib.gunzipSync(fs.readFileSync(IN)));
const H = P.h, T0 = P.t0, NH = P.nh, c1 = v => Math.max(-1, Math.min(1, v));
const coins = Object.keys(P.m).filter(k => P.m[k].px && P.m[k].px.filter(Boolean).length > NH * 0.8);
const HZ = [24, 48, 168], SYS = ["smart", "mom", "rev", "pos", "flow"];
const bias = (L, S) => L + S >= 25000 ? (L - S) / (L + S) : null;
function gapAt(m, i) { const a = m.g[0], b = m.g[1]; if (!a || !b) return null; const s = bias(a.L[i], a.S[i]), f = bias(b.L[i], b.S[i]); return s == null || f == null ? null : (s - f) / 2; }
function volAt(px, i) { const r = []; for (let j = Math.max(1, i - 167); j <= i; j++) if (px[j] > 0 && px[j - 1] > 0) r.push(Math.log(px[j] / px[j - 1])); if (r.length < 48) return null; const m = r.reduce((s, v) => s + v, 0) / r.length; return Math.sqrt(r.reduce((s, v) => s + (v - m) ** 2, 0) / (r.length - 1)) * Math.sqrt(24); }
function scores(m, i, h) {
  const px = m.px, p = px[i]; if (!(p > 0)) return null; const sd = volAt(px, i); if (!sd) return null; const o = {};
  const g = gapAt(m, i); o.smart = g == null ? null : c1(g * 1.2) * (h === 24 ? 0.85 : 1);
  const L = Math.min(2 * h, 24 * 60), p0 = px[i - L]; o.mom = p0 > 0 ? c1(Math.log(p / p0) / (sd * Math.sqrt(L / 24)) / 2) : null;
  let s = 0, n = 0; for (let j = i - h + 1; j <= i; j++) if (px[j] > 0) { s += px[j]; n++; } const mu = n >= h * 0.6 ? s / n : null, z = mu ? Math.log(p / mu) / (sd * Math.sqrt(h / 24)) : null; o.rev = z == null ? null : Math.abs(z) < 0.75 ? 0 : c1(-z / 2);
  const fr = m.fr && m.fr[i], carry = fr != null ? c1(-fr * 24 * 365 / 0.5) : null; let tL = 0, tS = 0; m.g.forEach(c => { tL += c.L[i] || 0; tS += c.S[i] || 0; }); const imb = tL + tS > 0 ? (tL - tS) / (tL + tS) : null, wc = h === 24 ? 0.15 : h === 48 ? 0.25 : 0.4;
  o.pos = carry == null && imb == null ? null : c1(((carry || 0) * wc + (imb != null ? -imb : 0) * 0.2) / (wc + 0.2));
  const k = h >= 168 ? 168 : 24, g0 = gapAt(m, i - k); o.flow = g != null && g0 != null ? c1((g - g0) * 100 / (k === 168 ? 40 : 25)) : null;
  return { o, sd };
}
const vol24 = (m, i) => { let s = 0; for (let j = Math.max(0, i - 23); j <= i; j++) s += m.v[j] || 0; return s; };
const fwd = (m, i, h) => i + h <= NH && m.px[i + h] > 0 && m.px[i] > 0 ? Math.log(m.px[i + h] / m.px[i]) : null;
function cons(o, W) { let s = 0, w = 0; SYS.forEach(k => { if (o[k] == null || !W[k]) return; s += o[k] * W[k]; w += W[k]; }); const raw = w ? s / w : 0; let ag = 0; SYS.forEach(k => { if (o[k] != null && W[k] && Math.sign(o[k]) === Math.sign(raw) && Math.abs(o[k]) >= 0.1) ag += W[k]; }); return raw * (0.4 + 0.6 * (w ? ag / w : 0)); }   // agreement counted by weight
const rank = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length); idx.forEach(([, i], k) => r[i] = k); return r; };
const spear = (x, y) => { if (x.length < 8) return null; const rx = rank(x), ry = rank(y), n = x.length, mx = (n - 1) / 2; let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { a += (rx[i] - mx) * (ry[i] - mx); b += (rx[i] - mx) ** 2; c += (ry[i] - mx) ** 2; } return a / Math.sqrt(b * c); };
const STEP = +process.env.OL_STEP || 6;   // hours between evaluations (was 24 until 2026-11-09); t uses n × min(1, STEP / h) for the overlap
const START = 24 * 15, FILL = { o: 0, f: 0 }; let XS = [];   // 15 days of warm-up (7-day momentum looks back 14 days)
const stat = a => { const n = a.length; if (!n) return null; const m = a.reduce((s, v) => s + v, 0) / n, sd = n > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1)) : 0; return { n, m, sd, hit: a.filter(v => v > 0).length / n }; };
const out = { entry: "limit order 1/4 sigma of the horizon better than the signal price, alive for the first quarter of the horizon; a pick counts only if it fills; exit at market at the horizon end", t: new Date().toISOString(), from: new Date(T0).toISOString(), days: Math.round(NH / 24), markets: coins.length, hz: {} };
for (const h of HZ) {
  const steps = []; for (let i = START; i + h <= NH; i += STEP) steps.push(i);
  const rows = steps.map(i => { const U = coins.map(k => { const m = P.m[k]; if (vol24(m, i) < 1e6) return null; const S = scores(m, i, h), r = fwd(m, i, h); return S && r != null ? { k, o: S.o, r, m, i, sd: S.sd } : null; }).filter(Boolean); return { i, U }; }).filter(x => x.U.length >= 15);
  const evalK = (row, get) => { const v = row.U.map(u => ({ s: get(u), r: u.r, u })).filter(x => x.s != null), avg = row.U.reduce((s, u) => s + u.r, 0) / row.U.length;
    const Lg = v.filter(x => x.s > 0.1).sort((a, b) => b.s - a.s).slice(0, 5), Sh = v.filter(x => x.s < -0.1).sort((a, b) => a.s - b.s).slice(0, 5), mean = a => a.reduce((s, x) => s + x, 0) / a.length;
    // limit entry: 1/4 sigma of the horizon better than the price at the signal, alive for the first quarter of the horizon; exit at market at the end
    const fill = (u, d, rec) => { const m = u.m, i = u.i, lp = m.px[i] * Math.exp(-d * 0.25 * u.sd * Math.sqrt(h / 24)), w = Math.max(2, Math.ceil(h / 4)); for (let q = i + 1; q <= Math.min(NH, i + w); q++) { const lo = m.lo[q] ?? m.px[q], hi = m.hi[q] ?? m.px[q]; if (d > 0 ? lo <= lp : hi >= lp) { if (!(m.px[i + h] > 0)) return null; let a = 0, b = 0; for (let k = q; k <= Math.min(NH, i + h); k++) { const L2 = m.lo[k] ?? m.px[k], H2 = m.hi[k] ?? m.px[k]; a = Math.min(a, d > 0 ? L2 / lp - 1 : 1 - H2 / lp); b = Math.max(b, d > 0 ? H2 / lp - 1 : 1 - L2 / lp); } if (rec) XS.push([a, b]); return Math.log(m.px[i + h] / lp); } } return null; };   // XS: excursions with no stop and no target
    const lr = Lg.map(x => fill(x.u, 1, true)).filter(v => v != null), sr = Sh.map(x => fill(x.u, -1, true)).filter(v => v != null); FILL.o += Lg.length + Sh.length; FILL.f += lr.length + sr.length;
    // baseline: the same limit order on every market (per side), so the limit's own fill bias is not credited to the system
    const bL = row.U.map(u => fill(u, 1)).filter(v => v != null), bS = row.U.map(u => fill(u, -1)).filter(v => v != null), aL = bL.length ? mean(bL) : avg, aS = bS.length ? mean(bS) : avg;
    const sp = (lr.length ? mean(lr) - aL : 0) + (sr.length ? aS - mean(sr) : 0); return { sp: lr.length || sr.length ? sp : null, ic: spear(v.map(x => x.s), v.map(x => x.r)) }; };
  const cut = Math.floor(rows.length * 0.6), res = {}, W = {};
  for (const k of SYS) { XS = []; const E = rows.map(row => evalK(row, u => u.o[k])), sp = E.map(e => e.sp).filter(v => v != null), ic = E.map(e => e.ic).filter(v => v != null), tr = E.slice(0, cut).map(e => e.sp).filter(v => v != null), te = E.slice(cut).map(e => e.sp).filter(v => v != null);
    const S = stat(sp), I = stat(ic), Tr = stat(tr), Te = stat(te), neff = S ? S.n * Math.min(1, STEP / h) : 0;
    const xs = XS.filter(x => true); XS = []; res[k] = S ? { ex: (() => { if (xs.length < 8) return null; const q = (a, p) => { const z = a.slice().sort((x, y) => x - y); return z[Math.floor(p * (z.length - 1))]; }; return { n: xs.length, mae50: q(xs.map(x => x[0]), 0.5), mae90: q(xs.map(x => x[0]), 0.1), mfe50: q(xs.map(x => x[1]), 0.5), mfe90: q(xs.map(x => x[1]), 0.9) }; })(), n: S.n, m: S.m, hit: S.hit, t: S.sd ? S.m / S.sd * Math.sqrt(Math.max(1, neff)) : 0, ic: I ? I.m : null, icT: I && I.sd ? I.m / I.sd * Math.sqrt(Math.max(1, I.n * Math.min(1, STEP / h))) : 0, learnM: Tr ? Tr.m : null, unseenM: Te ? Te.m : null } : null;
    const tL = Tr && Tr.n >= 5 && Tr.sd ? Tr.m / Tr.sd * Math.sqrt(Math.max(1, Tr.n * Math.min(1, STEP / h))) : 0; res[k].learnT = tL; W[k] = Math.max(0, Math.min(3, tL));   // weight = t-stat on the learning part; a system that lost there gets 0
  }
  if (!SYS.some(k => W[k] > 0)) SYS.forEach(k => W[k] = 1);
  {
  } const EQ = Object.fromEntries(SYS.map(k => [k, 1]));
  const E0 = rows.slice(cut).map(row => evalK(row, u => cons(u.o, W)));
  for (const [name, w] of [["cons", W], ["consEq", EQ]]) { const E = rows.slice(cut).map(row => evalK(row, u => cons(u.o, w))), sp = E.map(e => e.sp).filter(v => v != null), S = stat(sp), I = stat(E.map(e => e.ic).filter(v => v != null));
    res[name] = S ? { n: S.n, m: S.m, hit: S.hit, t: S.sd ? S.m / S.sd * Math.sqrt(Math.max(1, S.n * Math.min(1, STEP / h))) : 0, ic: I ? I.m : null, unseenOnly: true } : null; }
  // the blend WITHOUT each system (and without the 24 h reversion + momentum group), weights from the learning part, scored on the
  // unseen part: d = blend without it minus the full blend, per pick (d > 0: the blend does better without it). For the scorecard.
  const without = {}, cU = res.cons && res.cons.m;
  for (const drop of [...SYS.map(k => [k]), ["rev", "mom"]]) { if (!drop.some(k => W[k] > 0)) continue; const w2 = { ...W }; drop.forEach(k => w2[k] = 0); if (!SYS.some(k => w2[k] > 0)) continue;
    const E = rows.slice(cut).map(row => evalK(row, u => cons(u.o, w2))), S = stat(E.map(e => e.sp).filter(v => v != null)), D = stat(E.map((e, j) => e.sp != null && E0[j].sp != null ? e.sp - E0[j].sp : null).filter(v => v != null));
    without[drop.join("+")] = S ? { n: S.n, m: S.m, hit: S.hit, d: cU != null ? S.m - cU : null, dT: D && D.sd ? D.m / D.sd * Math.sqrt(Math.max(1, D.n * Math.min(1, STEP / h))) : 0, dHit: D ? D.hit : null } : null; }
  out.hz[h] = { steps: rows.length, step: STEP, res, w: W, without };
}
fs.mkdirSync(OUT, { recursive: true });
out.fillRate = FILL.o ? FILL.f / FILL.o : null; fs.writeFileSync(path.join(OUT, "outlook_bt.json"), JSON.stringify(out));
// lessons for the spider web: the 40 most traded markets, every 4 hours, 24 h scores + equal-weight consensus
const top = coins.map(k => [k, P.m[k].v.reduce((s, v) => s + (v || 0), 0)]).sort((a, b) => b[1] - a[1]).slice(0, 40).map(x => x[0]), items = [];
for (let i = START; i < NH; i += 4) for (const k of top) { const m = P.m[k], S = scores(m, i, 24); if (!S) continue; const x = {}; for (const s of SYS) if (S.o[s] != null && Math.abs(S.o[s]) >= 0.1) x["ol." + s] = Math.round(S.o[s] * 100) / 100;
  const cc = cons(S.o, Object.fromEntries(SYS.map(s => [s, 1]))); if (Math.abs(cc) >= 0.06) x["ol.cons"] = Math.round(cc * 100) / 100; if (!Object.keys(x).length) continue;
  const rh = {}; for (const h of [1, 4, 24]) { const r = fwd(m, i, h); if (r != null) rh[h] = Math.round((Math.exp(r) - 1) * 1e5) / 1e5; } if (Object.keys(rh).length) items.push({ t: T0 + i * H, a: k.split(":").pop(), x, rh }); }
fs.writeFileSync(path.join(OUT, "outlook_lessons.json"), JSON.stringify({ t: out.t, n: items.length, items }));
console.log(JSON.stringify(Object.fromEntries(HZ.map(h => [h, Object.fromEntries(Object.entries(out.hz[h].res).map(([k, v]) => [k, v && { n: v.n, m: +(v.m * 100).toFixed(2), hit: +(v.hit * 100).toFixed(0), t: +v.t.toFixed(1), ic: v.ic != null ? +v.ic.toFixed(3) : null, learn: v.learnM != null ? +(v.learnM * 100).toFixed(2) : null, unseen: v.unseenM != null ? +(v.unseenM * 100).toFixed(2) : null }]))])), null, 1));
console.log("weights", JSON.stringify(Object.fromEntries(HZ.map(h => [h, out.hz[h].w]))), "lessons", items.length);
