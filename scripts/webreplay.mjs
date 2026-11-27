// Cohort Sniper · walk-forward test of the Signal web on the Outlook lessons (record only; Cohort agent, 2026-11-23; council task).
// The Outlook gives the "web" system weight 1.00 at every horizon, but the backtest (outlookbt.mjs) cannot test it: the web
// model lives in each browser. This script loads the SHARED web.js read-only in a sandbox (a localStorage shim and a fake
// clock), and replays outlook_lessons.json (the backtest's past moments: the Outlook lens scores per market and hour, and the
// later 1 / 4 / 24 h moves) in time order:
//   learn part  the first 60 % of the hours: Web.ingest, as the page does once per new backtest file
//   score part  the last 40 %: at each hour, the web first learns every lesson whose 24 h result is known by then (no
//               look-ahead), then forecasts each market from that hour's lens scores (Web.emit + Web.forecast(a, 24)),
//               and the page's Outlook score is web = clamp((p − 0.5) × 4) (outlook.js, 24 h, ready model)
// Scores, the same for the web and each Outlook lens in the file (fair baseline: the same entry on every market):
//   hit   share of markets where the sign of the score matches the sign of the 24 h move (|score| ≥ 0.05)
//   ls    per hour, the top 5 longs minus the top 5 shorts by score, each vs the hour's average market move (close to close;
//         the lessons have no highs and lows, so the Outlook limit-order fill rule cannot be used here)
// Limits: it tests only what the web learns from the Outlook lenses and the calendar, not the live signals of both sites.
// web.js is not changed. Usage: node scripts/webreplay.mjs <outlook_lessons.json> [out.json] [learnShare=0.6]
// Cohort agent (2026-11-27; council task): WR_DROP=cyc.season,cyc.tide,... removes those calendar features in the sandbox copy only
// (the text of web.js is patched in memory; the file is not changed). "webRel" = the page's lens since Nov 26 (outlook.js v12): the raw
// forecast minus the hour's median over all markets. "grp" = tie-robust spread: markets above the hour median minus markets below it
// (the replayed forecast has only 2 to 3 different values per hour, so the top 5 / bottom 5 order is mostly file order).
import fs from "node:fs"; import vm from "node:vm";
const [LES = "outlook_lessons.json", OUT = "", SPLIT = "0.6"] = process.argv.slice(2);
const J = JSON.parse(fs.readFileSync(LES, "utf8")), items = (J.items || []).filter(it => it && it.t && it.a && it.x && it.rh).sort((a, b) => a.t - b.t);
const H = 36e5, hours = [...new Set(items.map(it => it.t))].sort((a, b) => a - b), cut = hours[Math.floor(hours.length * +SPLIT)], STEP = hours.length > 1 ? Math.min(...hours.slice(1).map((t, i) => t - hours[i])) : H;
// sandbox: fake clock, localStorage shim, no timers
let NOW = items.length ? items[0].t : Date.now(); const store = {};
class FDate extends Date { constructor(...a) { a.length ? super(...a) : super(NOW); } static now() { return NOW; } }
const ctx = { console: { log() {}, info() {}, warn() {}, error: console.error }, Date: FDate, Math, JSON, setTimeout: () => 0, setInterval: () => 0, clearTimeout() {}, clearInterval() {},
  localStorage: { getItem: k => k in store ? store[k] : null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } } };
ctx.window = ctx; vm.createContext(ctx); const DROP = (process.env.WR_DROP || "").split(",").filter(Boolean); let SRC = fs.readFileSync(new URL("../web.js", import.meta.url), "utf8");
if (DROP.length) { const A = "    return x;\n  }\n  // ---------- physics"; if (!SRC.includes(A)) throw new Error("WR_DROP: web.js cycles() not found"); SRC = SRC.replace(A, `    for (const k of ${JSON.stringify(DROP)}) delete x[k];\n` + A); }
vm.runInContext(SRC, ctx); const Web = ctx.window.Web;
const c1 = v => Math.max(-1, Math.min(1, v)), mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1), sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const st = a => a.length ? { n: a.length, m: mean(a), t: sd(a) ? mean(a) / sd(a) * Math.sqrt(a.length) : 0 } : null;
// learn part
const learn = items.filter(it => it.t < cut); NOW = cut; const nL = Web.ingest("outlookbt", learn.map(it => ({ ...it, x: { ...it.x } })), "Outlook backtest (replay)");
// score part, hour by hour
const score = items.filter(it => it.t >= cut), byT = {}; for (const it of score) (byT[it.t] = byT[it.t] || []).push(it);
let fed = learn.length, notReady = 0; const known = items.slice(); const ROWS = [];
for (const t of Object.keys(byT).map(Number).sort((a, b) => a - b)) { NOW = t;
  const add = []; while (fed < known.length && known[fed].t + 24 * H <= t) add.push(known[fed++]);
  if (add.length) Web.ingest("outlookbt", add.map(it => ({ ...it, x: { ...it.x } })), "Outlook backtest (replay)");
  for (const it of byT[t]) { for (const k in it.x) Web.emit(k, it.a, it.x[k]); const F = Web.forecast(it.a, 24); for (const k in it.x) Web.clear(k, it.a);
    if (F && !F.ready) notReady++;
    ROWS.push({ t, a: it.a, r: it.rh[24], praw: F ? F.p : null, web: F ? c1((F.p - 0.5) * 4 * (F.ready ? 1 : 0.5)) : null, ...it.x }); } }
{ const G = {}; for (const r of ROWS) if (r.praw != null) (G[r.t] = G[r.t] || []).push(r);
  for (const g of Object.values(G)) { const ps = g.map(r => r.praw).sort((a, b) => a - b), med = ps[Math.floor(ps.length / 2)]; for (const r of g) r.webRel = g.length >= 15 ? c1((r.praw - med) * 4) : r.web; } }
// scoring per system
const SYS = ["web", "webRel", ...new Set(score.flatMap(it => Object.keys(it.x)))], res = {};
for (const s of SYS) { const R = ROWS.filter(r => r[s] != null && isFinite(r.r)), hit = R.filter(r => Math.abs(r[s]) >= 0.05);
  const ls = [], T = {}; for (const r of R) (T[r.t] = T[r.t] || []).push(r);
  for (const g of Object.values(T)) { if (g.length < 10) continue; const avg = mean(g.map(r => r.r)), o = g.slice().sort((a, b) => b[s] - a[s]), L = o.slice(0, 5).filter(r => r[s] > 0), S = o.slice(-5).filter(r => r[s] < 0);
    if (!L.length && !S.length) continue; ls.push(mean(L.map(r => r.r - avg).concat(S.map(r => avg - r.r)))); }
  const half = Math.floor(ls.length / 2);
  // the hours are STEP apart and the move is 24 h, so neighbouring hours share most of the move: tAdj = t / sqrt(24 h / STEP)
  const ov = Math.sqrt(Math.max(1, 24 * H / STEP)), adj = x => x ? { ...x, tAdj: x.t / ov } : x;
  const grp = []; for (const g of Object.values(T)) { if (g.length < 15) continue; const v = g.map(r => r[s]).sort((a, b) => a - b), med = v[Math.floor(v.length / 2)], avg = mean(g.map(r => r.r));
    const A = g.filter(r => r[s] > med + 1e-9), B = g.filter(r => r[s] < med - 1e-9), q = []; if (A.length) q.push(mean(A.map(r => r.r - avg))); if (B.length) q.push(mean(B.map(r => avg - r.r))); if (q.length) grp.push(q.length > 1 ? mean(q) : q[0]); }
  const hg = Math.floor(grp.length / 2);
  res[s] = { grp: adj(st(grp)), grpFirst: adj(st(grp.slice(0, hg))), grpSecond: adj(st(grp.slice(hg))), n: R.length, hit: hit.length ? hit.filter(r => Math.sign(r[s]) === Math.sign(r.r)).length / hit.length : null, nHit: hit.length,
    ls: adj(st(ls)), first: adj(st(ls.slice(0, half))), second: adj(st(ls.slice(half))) }; }
const out = { t: new Date().toISOString(), drop: DROP, stepH: STEP / H, src: { file: LES, t: J.t || null, items: items.length, hours: hours.length }, split: new Date(cut).toISOString(), learn: nL, scored: ROWS.length, notReady,
  note: "record only; web.js replayed read-only on the Outlook lessons; ls = top 5 long minus top 5 short per hour vs the hour's average market, 24 h close to close, no costs", res };
for (const [s, x] of Object.entries(res)) console.log(s.padEnd(9), `n ${x.n} hit ${x.hit != null ? (x.hit * 100).toFixed(1) + "%" : "-"} | ls ${x.ls ? (x.ls.m * 100).toFixed(2) + "% t " + x.ls.t.toFixed(1) + " (overlap-adj " + x.ls.tAdj.toFixed(1) + ") hours " + x.ls.n : "-"} | halves ${x.first ? (x.first.m * 100).toFixed(2) : "-"}% / ${x.second ? (x.second.m * 100).toFixed(2) : "-"}% | grp ${x.grp ? (x.grp.m * 100).toFixed(2) + "% (" + (x.grpFirst ? (x.grpFirst.m * 100).toFixed(2) : "-") + " / " + (x.grpSecond ? (x.grpSecond.m * 100).toFixed(2) : "-") + ")" : "-"}`);
console.log("learn", nL, "scored", ROWS.length, "not ready", notReady, "split", out.split);
if (OUT) fs.writeFileSync(OUT, JSON.stringify(out));
