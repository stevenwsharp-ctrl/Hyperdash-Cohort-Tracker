// EV governor · one scorecard for SOXX Sniper, Cohort Sniper and LETF Sniper. Runs after the US close (GitHub Actions).
// For every decision, prediction and result that can be scored, it writes: trades, expected value (EV) per trade, the
// z-score, the recent half vs the older half, and a ruling:
//   mute    EV < 0 with z ≤ −2 (a proven loser): the pages stop using it (factor 0)
//   cut     EV < 0 with z ≤ −1, or the recent half lost while the whole won (decay): half weight (factor 0.5)
//   back    EV > 0 with z ≥ 2 and the recent half also > 0: more weight (factor 1.25)
//   watch   not proven either way (factor 1)
// The pages read ev.json (evrules.js) and apply the factors at once: this is the mechanical redirect. The four agents
// (scheduled Claude sessions) read the same file every day and change the code when a ruling asks for more than a weight.
// Sources: SOXX Sniper's paper bots (bots branch), Cohort Sniper's Outlook backtest, signal backtest and bet lab
// (backtest and lab branches), LETF Sniper's hard-reversal and fast-move rules (tested here on 7 days of 1-minute bars).
// Output: the "ev" branch: ev.json (the agents' notes in agents/ are kept).
import fs from "fs";
const OUT = process.argv[2] || "ev", sleep = ms => new Promise(r => setTimeout(r, ms));
const rd = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { return null; } };
async function getJ(url) { try { const r = await fetch(url, { headers: { "user-agent": "ev-governor" } }); return r.ok ? await r.json() : null; } catch (e) { return null; } }
function rule(x) { const { n, ev, z, recent, older } = x; if (!(n >= 12) || !isFinite(ev) || !isFinite(z)) return { ...x, status: "watch", factor: 1, why: "too few results" };
  if (ev < 0 && z <= -2) return { ...x, status: "mute", factor: 0, why: "proven negative EV" };
  if (ev < 0 && z <= -1) return { ...x, status: "cut", factor: 0.5, why: "negative EV, not yet proven" };
  if (ev > 0 && isFinite(recent) && recent < 0 && isFinite(older) && older > 0) return { ...x, status: "cut", factor: 0.5, why: "decay: the recent half lost" };
  if (ev > 0 && z >= 2 && !(isFinite(recent) && recent < 0)) return { ...x, status: "back", factor: 1.25, why: "proven positive EV" };
  return { ...x, status: "watch", factor: 1, why: ev < 0 ? "negative, weak evidence" : "positive, not proven" }; }
const mean = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : NaN, sd = a => { const m = mean(a); return Math.sqrt(a.reduce((p, q) => p + (q - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const fromList = (id, desc, unit, v) => { const n = v.length, m = mean(v), s = sd(v) || 1e-9, h = Math.floor(n / 2); return rule({ id, desc, unit, n, ev: m, z: m / (s / Math.sqrt(n)), hit: n ? v.filter(x => x > 0).length / n : NaN, older: mean(v.slice(0, h)), recent: mean(v.slice(h)) }); };

// ---------- SOXX Sniper: the paper bots ----------
async function soxx() { const B = await getJ("https://raw.githubusercontent.com/stevenwsharp-ctrl/SOXX-Sniper/bots/bots.json?t=" + Date.now()); if (!B) return { err: "bots.json not found" };
  const items = [];
  for (const [k, b] of Object.entries(B.bots || {})) { const T = (b.trades || []).slice().reverse(); /* trades are newest first in the file */
    const live = T.filter(x => !x.bt).map(x => x.r), bt = T.filter(x => x.bt).map(x => x.r);
    if (live.length) items.push(fromList(`bot.${k}.live`, `${b.name}: live paper trades (per $1,000 bet)`, "ret", live));
    if (bt.length) items.push(fromList(`bot.${k}.bt`, `${b.name}: walk-forward backtest trades (last 60 in the file)`, "ret", bt));
    items.push(rule({ id: `bot.${k}.all`, desc: `${b.name}: all trades (live ${b.all.n}, backtest ${b.bt ? b.bt.n : 0})`, unit: "usd", n: (b.all.n || 0) + (b.bt ? b.bt.n : 0), ev: ((b.all.usd || 0) + (b.bt ? b.bt.usd : 0)) / Math.max(1, (b.all.n || 0) + (b.bt ? b.bt.n : 0)), z: NaN })); }
  // versions grouped by idea and class (shadow trades: the biggest sample)
  const G = {}; (B.arms || []).forEach(a => { const k = `${a.cl === "L" ? "funds" : "spot"}.${a.idea}`, g = G[k] || (G[k] = { n: 0, s: 0, tz: 0 }); g.n += a.n; g.s += a.m * a.n; g.tz += a.t * Math.sqrt(a.n); });
  for (const [k, g] of Object.entries(G)) items.push(rule({ id: `idea.${k}`, desc: `${B.ideas && B.ideas[k.split(".")[1]] || k} (${k.split(".")[0]}, all 15 versions)`, unit: "ret", n: g.n, ev: g.s / g.n, z: g.tz / Math.sqrt(g.n) }));
  (B.arms || []).filter(a => a.n >= 30).sort((a, b) => b.t - a.t).slice(0, 5).forEach(a => items.push(rule({ id: `arm.${a.cl}.${a.idea}.${a.k}.${a.plan}`, desc: `best version: ${a.cl === "L" ? "funds" : "spot"} ${a.idea}, limit ${a.k} ATR, ${a.plan}`, unit: "ret", n: a.n, ev: a.m, z: a.t })));
  for (const cl of ["S", "L"]) (B.times && B.times[cl] || []).filter(x => x.n >= 50).forEach(x => items.push(rule({ id: `time.${cl}.${x.b}`, desc: `${cl === "L" ? "funds" : "spot"} trades started ${x.name} ET`, unit: "ret", n: x.n, ev: x.m, z: NaN })));
  const sw = B.swings || []; return { at: B.at, items, extra: { swingsToday: sw.length, caught: sw.filter(x => x.caught).length } }; }

// ---------- Cohort Sniper: Outlook, signal backtest, bet lab ----------
function cohort() { const items = [], O = rd("outlook_bt.json"), K = rd("backtest.json"), L = rd("lab.json");
  if (O && O.hz) for (const [h, X] of Object.entries(O.hz)) for (const [sys, r] of Object.entries(X.res || {})) { if (!r || !r.n) continue; items.push(rule({ id: `outlook.${sys}.${h}h`, desc: `Outlook system "${sys}", ${h} h (limit entries, vs the same order on every market)`, unit: "ret", n: r.n, ev: r.m, z: r.t, hit: r.hit, older: r.learnM, recent: r.unseenM })); }
  // a condition earns its place by beating the same setups without it: z of (with − without), from each side's mean and t
  const sdOf = x => x && x.t ? Math.abs(x.avg * Math.sqrt(x.n) / x.t) : NaN, diff = (y, o) => { if (!y || !o || !y.n || !o.n) return null; const se = Math.sqrt(sdOf(y) ** 2 / y.n + sdOf(o) ** 2 / o.n); return { d: y.avg - o.avg, z: se > 0 ? (y.avg - o.avg) / se : NaN }; };
  if (K && K.conditions) K.conditions.forEach(c => { const y = c.test && c.test.yes, o = c.test && c.test.no, D = diff(y, o), Dt = diff(c.train && c.train.yes, c.train && c.train.no); if (!D) return;
    items.push(rule({ id: `cond.${c.id}`, desc: `Signal condition: ${c.label} (unseen part, 24 h: with it minus without it, % move)`, unit: "pct", n: y.n, ev: D.d, z: D.z, hit: y.hit / 100, older: Dt ? Dt.d : NaN, recent: D.d, verdict: c.verdict })); });
  if (K && K.thresholds) K.thresholds.forEach(t => { const r = t.test && t.test.r24; if (r) items.push(rule({ id: `score.${t.th}`, desc: `Gap score ≥ ${t.th}, next 24 h (unseen part, %)`, unit: "pct", n: r.n, ev: r.avg, z: r.t, hit: r.hit / 100, older: t.train && t.train.r24 ? t.train.r24.avg : NaN, recent: r.avg })); });
  if (L && L.hyp) for (const [id, H] of Object.entries(L.hyp)) for (const [h, R] of Object.entries(H.h || {})) { const a = R.all; if (!a) continue; items.push(rule({ id: `lab.${id}.${h}d`, desc: `Bet lab: ${H.d.slice(0, 90)} · ${h} d`, unit: "ret", n: a.n, ev: a.m, z: a.t, hit: a.hit, older: R.first && R.first.m, recent: R.second && R.second.m })); }
  return { at: (O && O.t) || (L && L.t), items }; }

// ---------- LETF Sniper: hard reversals and fast moves (7 days of 1-minute bars) ----------
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"; let YC = null;
async function ysess() { if (YC) return YC; try { const r = await fetch("https://fc.yahoo.com/", { headers: { "user-agent": UA }, redirect: "manual" }); const ck = (r.headers.getSetCookie ? r.headers.getSetCookie() : []).map(x => x.split(";")[0]).join("; "); const c = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", { headers: { "user-agent": UA, cookie: ck } }); YC = { ck, crumb: c.ok ? (await c.text()).trim() : "" }; } catch (e) { YC = { ck: "", crumb: "" }; } return YC; }
async function bars(sym) { const Y = await ysess(); for (let i = 0; i < 3; i++) { try { const r = await fetch(`https://query${i % 2 ? 2 : 1}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1m&range=7d&includePrePost=false${Y.crumb ? "&crumb=" + encodeURIComponent(Y.crumb) : ""}`, { headers: { "user-agent": UA, ...(Y.ck ? { cookie: Y.ck } : {}) } }); if (!r.ok) throw new Error(r.status); const j = await r.json(), x = j.chart.result[0], q = x.indicators.quote[0]; const B = []; x.timestamp.forEach((t, k) => { if ([q.open[k], q.high[k], q.low[k], q.close[k]].every(v => v > 0)) B.push([t * 1000, q.open[k], q.high[k], q.low[k], q.close[k], q.volume[k] || 0]); }); return B; } catch (e) { await sleep(1500 * (i + 1)); } } return null; }
// the same rule as LETF Sniper's rev.js
  const rsd = a => { const v = a.filter(x => isFinite(x) && x !== 0).map(Math.abs).sort((x, y) => x - y); return v.length >= 8 ? v[Math.floor(v.length / 2)] * 1.4826 : NaN; };
  function detect(S, end) {   // S: {c, h, l, v}; end: index of the last closed minute
    const n = end + 1; if (n < 16) return null; const r = []; for (let i = Math.max(1, n - 120); i < n; i++) r.push(Math.log(S.c[i] / S.c[i - 1]));
    const sg = Math.max(0.0004, rsd(r) || 0); const W = Math.min(30, n - 1), a = n - W, last = S.c[end]; let best = null;
    for (const side of [-1, 1]) {   // −1 = a top (turning down), +1 = a bottom (turning up)
      let e = -1; for (let i = a; i <= end - 1; i++) if (e < 0 || (side < 0 ? S.h[i] > S.h[e] : S.l[i] < S.l[e])) e = i;
      if (e < 0 || end - e > 8 || end - e < 1) continue; const ex = side < 0 ? S.h[e] : S.l[e];
      let b = a; for (let i = a; i <= e; i++) if (side < 0 ? S.l[i] < S.l[b] : S.h[i] > S.h[b]) b = i; const base = side < 0 ? S.l[b] : S.h[b];
      const leg = Math.abs(Math.log(ex / base)), back = side < 0 ? Math.log(ex / last) : Math.log(last / ex); if (leg < Math.max(8 * sg, 0.006) || back <= 0) continue;
      const ret = back / leg; if (ret < 0.5) continue;
      let vf = 1; if (S.v) { const pre = S.v.slice(Math.max(a, b), e + 1), post = S.v.slice(e + 1, end + 1), mu = z => z.length ? z.reduce((p, q) => p + q, 0) / z.length : 0; if (mu(pre) > 0 && post.length) vf = Math.max(0.7, Math.min(1.5, mu(post) / mu(pre))); }
      const score = Math.min(1.5, ret) * Math.min(2.5, back / (4 * sg)) / 1.5 * vf;
      if (!best || score > best.score) best = { side, leg, back, ret, ago: end - e, ex, last, base, legMin: e - b, score, sg, vf }; }
    return best;
  }
  // ---------- 1-minute bars from the Worker ----------
const LETF_U = ["SOXL", "SOXS", "TQQQ", "SQQQ", "NVDL", "TSLL", "MSTU", "CONL", "SPXL", "TNA", "LABU", "NVDA", "TSLA", "MSTR", "COIN", "PLTR", "AMD", "SMCI", "AXTI", "BE", "HOOD", "OKLO", "IONQ", "RGTI", "APLD", "IREN", "CRWV", "NBIS", "MU", "AVGO"];
async function letf() { const R = { rev: [], hard: [], f5: [], f1: [] }; let got = 0;
  for (let k = 0; k < LETF_U.length; k += 3) { await Promise.all(LETF_U.slice(k, k + 3).map(async s => { const B = await bars(s); if (!B || B.length < 200) return; got++;
    const days = new Map(); B.forEach(b => { const d = new Date(b[0] - 5 * 36e5).toISOString().slice(0, 10); if (!days.has(d)) days.set(d, []); days.get(d).push(b); });
    for (const D of days.values()) { if (D.length < 60) continue; const S = { c: D.map(b => b[4]), h: D.map(b => b[2]), l: D.map(b => b[3]), v: D.map(b => b[5]) }; let skip = -1;
      const r1 = []; for (let i = 1; i < D.length; i++) r1.push(Math.log(S.c[i] / S.c[i - 1])); const sg = Math.max(0.0004, rsd(r1) || 0);
      for (let i = 20; i < D.length - 16; i++) { const f15 = Math.log(S.c[i + 15] / S.c[i]);
        if (i >= skip) { const x = detect(S, i); if (x && x.score >= 0.6) { skip = i + 15; R.rev.push({ t: D[i][0], v: x.side * f15 }); if (x.score >= 1) R.hard.push({ t: D[i][0], v: x.side * f15 }); } }
        const m5 = Math.log(S.c[i] / S.c[i - 5]), m1 = Math.log(S.c[i] / S.c[i - 1]);
        if (Math.abs(m5) >= 4 * sg * Math.sqrt(5) && i % 5 === 0) R.f5.push({ t: D[i][0], v: Math.sign(m5) * f15 });
        if (Math.abs(m1) >= 4 * sg && i % 3 === 0) R.f1.push({ t: D[i][0], v: Math.sign(m1) * f15 }); } } })); }
  const L = a => a.sort((x, y) => x.t - y.t).map(x => x.v), items = [];
  if (R.rev.length) items.push(fromList("rev.all.15m", "Hard reversal detector, all turns (score ≥ 0.6): trade the new direction, next 15 min", "ret", L(R.rev)));
  if (R.hard.length) items.push(fromList("rev.hard.15m", "Hard reversal detector, HARD turns (score ≥ 1), next 15 min", "ret", L(R.hard)));
  if (R.f5.length) items.push(fromList("fast.5m.15m", "Fast 5-minute move (4σ+): follow it, next 15 min (negative EV = fade it)", "ret", L(R.f5)));
  if (R.f1.length) items.push(fromList("fast.1m.15m", "Fast 1-minute move (4σ+): follow it, next 15 min (negative EV = fade it)", "ret", L(R.f1)));
  return { at: new Date().toISOString(), items, extra: { markets: got, of: LETF_U.length } }; }

async function main() {
  fs.mkdirSync(OUT, { recursive: true }); const prev = rd(`${OUT}/ev.json`);
  const T = { soxx: await soxx(), cohort: cohort(), letf: await letf() };
  for (const [k, x] of Object.entries(T)) { const p = prev && prev.trackers && prev.trackers[k]; if (!x.items) continue;
    x.items.forEach(it => { const o = p && p.items && p.items.find(y => y.id === it.id); if (o) { it.prev = o.status; it.changed = o.status !== it.status; } });
    x.summary = { n: x.items.length, mute: x.items.filter(i => i.status === "mute").length, cut: x.items.filter(i => i.status === "cut").length, back: x.items.filter(i => i.status === "back").length, changed: x.items.filter(i => i.changed).length };
    x.rules = Object.fromEntries(x.items.filter(i => i.factor !== 1).map(i => [i.id, i.factor])); }
  const ev = { t: new Date().toISOString(), note: "factor 0 = mute, 0.5 = cut, 1.25 = back; agents read this file every market day", trackers: T };
  fs.writeFileSync(`${OUT}/ev.json`, JSON.stringify(ev, null, 1));
  for (const [k, x] of Object.entries(T)) console.log(k, JSON.stringify(x.summary || x.err), x.extra ? JSON.stringify(x.extra) : "");
}
main().catch(e => { console.error(e); process.exit(1); });
