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
  // Council, Nov 8 2026: each signal is traded by all versions of its idea (3 entry depths × 5 exits), so the version trades
  // are strongly correlated and z over all of them is too large (up to √versions). zSig = z / √versions (the worst case: all
  // versions trade every signal). When dated.json (bots branch) has 8+ days, zDay (a block z over the daily means) is the
  // z for the ruling; until then a "back" also needs zSig ≥ 2, and a mute keeps the trade-level z (a mute only stops
  // trades with a negative estimate; a back adds weight and needs real proof).
  const V = {}; (B.arms || []).forEach(a => { const k = `${a.cl === "L" ? "funds" : "spot"}.${a.idea}`; V[k] = (V[k] || 0) + 1; });
  const DT = await getJ("https://raw.githubusercontent.com/stevenwsharp-ctrl/SOXX-Sniper/bots/dated.json?t=" + Date.now()), DY = {};
  if (DT && DT.days) for (const [d, X] of Object.entries(DT.days)) for (const [kk, v] of Object.entries(X || {})) { const m = /^([SL])\|([a-z0-9]+)@/.exec(kk); if (!m || !Array.isArray(v) || !(v[0] > 0)) continue;
    const k = `${m[1] === "L" ? "funds" : "spot"}.${m[2]}`, a = (DY[k] || (DY[k] = {})), x = a[d] || (a[d] = [0, 0]); x[0] += v[0]; x[1] += v[1]; }
  for (const [k, g] of Object.entries(G)) { const z = g.tz / Math.sqrt(g.n), zSig = z / Math.sqrt(V[k] || 1), dm = Object.keys(DY[k] || {}).sort().map(d => DY[k][d][1] / DY[k][d][0]), D = dm.length, h = Math.floor(D / 2);
    const zDay = D >= 3 ? mean(dm) / ((sd(dm) || 1e-9) / Math.sqrt(D)) : NaN, useDay = D >= 8;
    // Council, Nov 9 2026: at 8+ days the day z (8 points, low power) would have lifted the mutes of ideas that lose at every
    // trade-level test (spot pull: z −22 over trades, −5.7 per signal; day z −2.5 → only cut). A mute only stops trades with a
    // negative estimate, so a negative idea keeps the trade-level z. A "back" adds weight and needs proof in BOTH ways:
    // z per signal ≥ 2, and (with 3+ days) day z ≥ 2. Example Nov 9: spot sqz trade z 9.8, per signal 2.5, day z 0.1 → watch.
    const ev0 = g.s / g.n;
    let x = rule({ id: `idea.${k}`, desc: `${B.ideas && B.ideas[k.split(".")[1]] || k} (${k.split(".")[0]}, all 15 versions)`, unit: "ret", n: g.n, ev: ev0, z: useDay && ev0 > 0 ? zDay : z, zTrades: z, zSig, versions: V[k] || 1, days: D, zDay, ...(useDay ? { older: mean(dm.slice(0, h)), recent: mean(dm.slice(h)) } : {}) });
    if (x.status === "back" && !(zSig >= 2 && (D < 3 || zDay >= 2))) x = { ...x, status: "watch", factor: 1, why: `positive, not proven per signal and per day (z per signal ${zSig.toFixed(1)}, day z ${isFinite(zDay) ? zDay.toFixed(1) : "–"})` };
    items.push(x); }
  // Council, Nov 9 2026 (SOXX agent request): the bots' time gate reads the dated record per class × idea × half hour. Score
  // each half hour of every idea that is not muted and has EV > 0 (the ideas the bots trade): per-day means, z over the days (each day counts one time), older half of
  // the days vs the newer half. Only half hours with 30+ trades on 4+ days. Same keys as bots.mjs timeRec().
  const HH = b => { const m = 570 + 30 * b; return `${Math.floor(m / 60) > 12 ? Math.floor(m / 60) - 12 : Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`; };
  if (DT && DT.days) for (const it of items.filter(i => /^idea\./.test(i.id) && i.status !== "mute" && i.ev > 0)) { const [, cn, idea] = it.id.split("."), cl = cn === "funds" ? "L" : "S";
    for (let b = 0; b < 13; b++) { const ds = Object.keys(DT.days).sort().map(d => DT.days[d][`${cl}|${idea}@${b}`]).filter(v => Array.isArray(v) && v[0] > 0); const n = ds.reduce((p, v) => p + v[0], 0); if (ds.length < 4 || n < 30) continue;
      const dm = ds.map(v => v[1] / v[0]), h = Math.floor(dm.length / 2);
      items.push(rule({ id: `half.${cn}.${idea}.${b}`, desc: `${cn} ${idea}: trades started ${HH(b)}–${HH(b + 1)} ET (dated record, all versions, z over ${dm.length} days)`, unit: "ret", n, ev: ds.reduce((p, v) => p + v[1], 0) / n, z: mean(dm) / ((sd(dm) || 1e-9) / Math.sqrt(dm.length)), days: dm.length, older: mean(dm.slice(0, h)), recent: mean(dm.slice(h)) })); } }
  // Council, Nov 11 2026 (SOXX agent request): the same half-hour record for the MUTED ideas (the bots do not trade them),
  // as WATCH only (shadow: true, factor 1), and only pockets with EV > 0: a pocket of a muted idea is never backed here. The agent unmutes a pocket only after
  // its own walk-forward test on days after the pocket was found (first candidate: half.funds.pull.1, found Nov 11).
  if (DT && DT.days) for (const it of items.filter(i => /^idea\./.test(i.id) && !(i.status !== "mute" && i.ev > 0))) { const [, cn, idea] = it.id.split("."), cl = cn === "funds" ? "L" : "S";
    for (let b = 0; b < 13; b++) { const dd = Object.keys(DT.days).sort().filter(d => Array.isArray(DT.days[d][`${cl}|${idea}@${b}`]) && DT.days[d][`${cl}|${idea}@${b}`][0] > 0), ds = dd.map(d => DT.days[d][`${cl}|${idea}@${b}`]); const n = ds.reduce((p, v) => p + v[0], 0); if (ds.length < 4 || n < 30) continue;
      const dm = ds.map(v => v[1] / v[0]), h = Math.floor(dm.length / 2), r = rule({ id: `half.${cn}.${idea}.${b}`, desc: `${cn} ${idea} (idea muted): trades started ${HH(b)}–${HH(b + 1)} ET (dated record, all versions, z over ${dm.length} days) — shadow, watch only`, unit: "ret", n, ev: ds.reduce((p, v) => p + v[1], 0) / n, z: mean(dm) / ((sd(dm) || 1e-9) / Math.sqrt(dm.length)), days: dm.length, older: mean(dm.slice(0, h)), recent: mean(dm.slice(h)), shadow: true, ...(cn === "funds" && idea === "pull" && b === 1 ? { newDays: Object.fromEntries(dd.map((d, i) => [d, i]).filter(([d]) => d >= "2026-11-12").map(([d, i]) => [d, { n: ds[i][0], m: +(ds[i][1] / ds[i][0]).toFixed(5) }])) } : {}) });
      if (r.ev > 0) items.push({ ...r, ruling: r.status, status: "watch", factor: 1, why: `shadow of a muted idea (would be ${r.status}): watch only` }); } }
  // Council, Nov 10 2026 (SOXX agent request): the LIVE bot trades per half hour of the signal (ET), so the page and the agents
  // can see if the live loss after 11:30 stops. Per half hour: all live trades in bots.json (the file keeps the last 60 trades
  // per bot, so this record rolls). live.<bot>.late / .early: the 11:30 ET split was found on the trades up to Nov 10, so these
  // two items count ONLY live trades from Nov 11 on (out of sample for the split and for the Nov 10 day-rule gate).
  const etF = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const etP = t => { const o = Object.fromEntries(etF.formatToParts(new Date(t)).map(x => [x.type, x.value])); return { d: `${o.year}-${o.month}-${o.day}`, m: +o.hour * 60 + +o.minute }; };
  // Council, Nov 11 2026 (SOXX agent request): bots.mjs now writes every LIVE trade to dated.json ("live|<bot>@<half hour>"
  // → [n, sum r, sum r², wins] per signal day, from all live trades in state.json, so it does not roll). When these keys are
  // there, live.<bot>.<b> and live.<bot>.early / .late read them: n and EV over all trades, z over the days (each day counts
  // one time) with 3+ days, else the trade-level z from the sums; older / newer half of the days. early = before 11:30 ET
  // (half hours 0–3), late = 11:30 on; early / late still count only days from Nov 11 2026 (out of sample for the split).
  const LV = {}; if (DT && DT.days) for (const [d, X] of Object.entries(DT.days)) for (const [kk, v] of Object.entries(X || {})) { const m = /^live\|([a-z]+)@(\d+)$/.exec(kk); if (!m || !Array.isArray(v) || !(v[0] > 0)) continue;
    ((LV[m[1]] || (LV[m[1]] = {}))[d] || (LV[m[1]][d] = {}))[+m[2]] = v; }
  const fromDays = (id, desc, rows, ex, min = 3) => { const n = rows.reduce((p, v) => p + v[0], 0); if (n < min) return; const S1 = rows.reduce((p, v) => p + v[1], 0), S2 = rows.reduce((p, v) => p + v[2], 0), m = S1 / n;
    const sdT = Math.sqrt(Math.max(0, (S2 - n * m * m) / Math.max(1, n - 1))) || 1e-9, dm = rows.map(v => v[1] / v[0]), D = dm.length, h = Math.floor(D / 2);
    const z = D >= 3 ? mean(dm) / ((sd(dm) || 1e-9) / Math.sqrt(D)) : n >= 2 ? m / (sdT / Math.sqrt(n)) : NaN;   // one trade: no z
    items.push(rule({ id, desc, unit: "ret", n, ev: m, z, zTrades: m / (sdT / Math.sqrt(n)), hit: rows.reduce((p, v) => p + v[3], 0) / n, days: D, ...(D >= 2 ? { older: mean(dm.slice(0, h)), recent: mean(dm.slice(h)) } : {}), src: "dated.json", ...(ex || {}) })); };
  for (const [k, b] of Object.entries(B.bots || {})) { if (!LV[k]) continue; const ds = Object.keys(LV[k]).sort(), sum = (d, f) => { const o = [0, 0, 0, 0]; for (const [bb, v] of Object.entries(LV[k][d])) if (f(+bb)) v.forEach((x, i) => o[i] += x); return o; };
    for (let bb = 0; bb < 13; bb++) fromDays(`live.${k}.${bb}`, `${b.name}: LIVE trades started ${HH(bb)}–${HH(bb + 1)} ET (all live trades, dated record, by day)`, ds.map(d => LV[k][d][bb]).filter(v => v && v[0] > 0));
    for (const [nm, f, tx] of [["early", bb => bb < 4, "before 11:30"], ["late", bb => bb >= 4, "11:30 and later"]]) fromDays(`live.${k}.${nm}`, `${b.name}: LIVE trades started ${tx} ET, from Nov 11 2026 only (split fixed before these trades; dated record, by day)`, ds.filter(d => d >= "2026-11-11").map(d => sum(d, f)).filter(v => v[0] > 0), { from: "2026-11-11" }, 1);
    // Council, Nov 13 2026 (SOXX agent request): the bots pick the best-scored version from Nov 16 2026 (b09fdad, no random
    // draw). live.<bot>.pick = all live trades from Nov 16; live.<bot>.draw = the last random-draw days (Nov 11–13), same form.
    fromDays(`live.${k}.pick`, `${b.name}: LIVE trades from Nov 16 2026 (best-score version pick; dated record, by day)`, ds.filter(d => d >= "2026-11-16").map(d => sum(d, () => true)).filter(v => v[0] > 0), { from: "2026-11-16" }, 1);
    fromDays(`live.${k}.draw`, `${b.name}: LIVE trades Nov 11–13 2026 (random-draw version pick; dated record, by day)`, ds.filter(d => d >= "2026-11-11" && d < "2026-11-16").map(d => sum(d, () => true)).filter(v => v[0] > 0), { from: "2026-11-11", to: "2026-11-13" }, 1); }
  for (const [k, b] of Object.entries(B.bots || {})) { if (LV[k]) continue; const lv = (b.trades || []).filter(x => !x.bt && isFinite(x.r) && x.t0).map(x => ({ ...etP(x.t0), r: x.r, t: x.t0 })).sort((x, y) => x.t - y.t);
    for (let bb = 0; bb < 13; bb++) { const a = lv.filter(x => Math.floor((x.m - 570) / 30) === bb); if (a.length < 3) continue;
      items.push({ ...fromList(`live.${k}.${bb}`, `${b.name}: LIVE trades started ${HH(bb)}–${HH(bb + 1)} ET (last 60 trades in the file)`, "ret", a.map(x => x.r)), days: new Set(a.map(x => x.d)).size }); }
    for (const [nm, f, ds] of [["early", x => x.m < 690, "before 11:30"], ["late", x => x.m >= 690, "11:30 and later"]]) { const a = lv.filter(x => x.d >= "2026-11-11" && f(x));
      if (a.length) items.push({ ...fromList(`live.${k}.${nm}`, `${b.name}: LIVE trades started ${ds} ET, from Nov 11 2026 only (split fixed before these trades)`, "ret", a.map(x => x.r)), days: new Set(a.map(x => x.d)).size, from: "2026-11-11" }); } }
  (B.arms || []).filter(a => a.n >= 30).sort((a, b) => b.t - a.t).slice(0, 5).forEach(a => items.push(rule({ id: `arm.${a.cl}.${a.idea}.${a.k}.${a.plan}`, desc: `best version: ${a.cl === "L" ? "funds" : "spot"} ${a.idea}, limit ${a.k} ATR, ${a.plan}`, unit: "ret", n: a.n, ev: a.m, z: a.t })));
  for (const cl of ["S", "L"]) (B.times && B.times[cl] || []).filter(x => x.n >= 50).forEach(x => items.push(rule({ id: `time.${cl}.${x.b}`, desc: `${cl === "L" ? "funds" : "spot"} trades started ${x.name} ET`, unit: "ret", n: x.n, ev: x.m, z: NaN })));
  // swings of the last market day (swingDay): caught = a LIVE bot trade won in the swing; bt = only the replay caught it
  const sw = B.swings || []; return { at: B.at, items, extra: { swingDay: B.swingDay || null, swingsToday: sw.length, caught: sw.filter(x => x.caught).length, caughtBt: sw.filter(x => !x.caught && x.bt).length } }; }

// ---------- Cohort Sniper: Outlook, signal backtest, bet lab ----------
function cohort() { const items = [], O = rd("outlook_bt.json"), K = rd("backtest.json"), L = rd("lab.json");
  if (O && O.hz) for (const [h, X] of Object.entries(O.hz)) for (const [sys, r] of Object.entries(X.res || {})) { if (!r || !r.n) continue; items.push(rule({ id: `outlook.${sys}.${h}h`, desc: `Outlook system "${sys}", ${h} h (limit entries, vs the same order on every market)`, unit: "ret", n: r.n, ev: r.m, z: r.t, hit: r.hit, older: r.learnM, recent: r.unseenM })); }
  // Council, Nov 9 2026 (Cohort agent request): the blend WITHOUT each system (outlookbt.mjs hz.<h>.without, weights from the
  // learning part, scored on the unseen part). ev = d (blend without it minus the full blend, % per pick), z = dT (overlap-corrected).
  // A "back" here means: the blend is proven better WITHOUT this system (drop it); a mute means the system is proven to help.
  if (O && O.hz) for (const [h, X] of Object.entries(O.hz)) for (const [sys, r] of Object.entries(X.without || {})) { if (!r || !r.n || !isFinite(r.d)) continue;
    items.push(rule({ id: `outlook.without.${sys}.${h}h`, desc: `Outlook ${h} h: the blend without "${sys}" minus the full blend (unseen part, % per pick; > 0 = better without it)`, unit: "pct", n: r.n, ev: r.d, z: isFinite(r.dT) ? r.dT : NaN, hit: r.dHit })); }
  // a condition earns its place by beating the same setups without it: z of (with − without), from each side's mean and t
  const sdOf = x => x && x.t ? Math.abs(x.avg * Math.sqrt(x.n) / x.t) : NaN, diff = (y, o) => { if (!y || !o || !y.n || !o.n) return null; const se = Math.sqrt(sdOf(y) ** 2 / y.n + sdOf(o) ** 2 / o.n); return { d: y.avg - o.avg, z: se > 0 ? (y.avg - o.avg) / se : NaN }; };
  if (K && K.conditions) K.conditions.forEach(c => { const y = c.test && c.test.yes, o = c.test && c.test.no, D = diff(y, o), Dt = diff(c.train && c.train.yes, c.train && c.train.no); if (!D) return;
    items.push(rule({ id: `cond.${c.id}`, desc: `Signal condition: ${c.label} (unseen part, 24 h: with it minus without it, % move)`, unit: "pct", n: y.n, ev: D.d, z: D.z, hit: y.hit / 100, older: Dt ? Dt.d : NaN, recent: D.d, verdict: c.verdict })); });
  if (K && K.thresholds) K.thresholds.forEach(t => { const r = t.test && t.test.r24; if (r) items.push(rule({ id: `score.${t.th}`, desc: `Gap score ≥ ${t.th}, next 24 h (unseen part, %)`, unit: "pct", n: r.n, ev: r.avg, z: r.t, hit: r.hit / 100, older: t.train && t.train.r24 ? t.train.r24.avg : NaN, recent: r.avg })); });
  if (L && L.hyp) for (const [id, H] of Object.entries(L.hyp)) for (const [h, R] of Object.entries(H.h || {})) { const a = R.all; if (!a) continue; items.push(rule({ id: `lab.${id}.${h}d`, desc: `Bet lab: ${H.d.slice(0, 90)} · ${h} d`, unit: "ret", n: a.n, ev: a.m, z: a.t, hit: a.hit, older: R.first && R.first.m, recent: R.second && R.second.m })); }
  // Council, Nov 10 2026 (Cohort agent request): the walk-forward record of the BLENDED setups that the sites show (lab.json wf:
  // idea weights from bets that ended before each day; first = older half of the days, second = newer half). wfGate in lab.json
  // already sets side 0 for a horizon that lost on both halves; this item puts the same record on the scorecard.
  if (L && L.wf) for (const [h, W] of Object.entries(L.wf)) { const a = W && W.all; if (!a || !a.n) continue;
    items.push(rule({ id: `lab.setup.${h}d`, desc: `Bet lab: the blended setups shown on the sites (top 6 long + 6 short, limit entry, vs the same order on every market), walk-forward, ${h} d`, unit: "ret", n: a.n, ev: a.m, z: a.t, hit: a.hit, older: W.first && W.first.m, recent: W.second && W.second.m, fill: W.fill, gated: !!(L.wfGate && L.wfGate[h]) })); }
  // Council, Nov 11 2026 (Cohort agent request): lab.json wfAlt replays 5 idea rules walk-forward (past bets only, one grid per
  // horizon). lab.rule.<h>d.<rule>: each rule's record (older half = first, newer = second). lab.setup.<h>d.chosen: ONLY the
  // newer half of the rule that the lab picked on the older half (wfRule) — the out-of-sample record of what the sites show.
  if (L && L.wfAlt) for (const [h, A] of Object.entries(L.wfAlt)) { if (!A || !A.v) continue;
    for (const [r, W] of Object.entries(A.v)) { const a = W && W.all; if (r === "none" || !a || !a.n) continue;
      items.push(rule({ id: `lab.rule.${h}d.${r}`, desc: `Bet lab idea rule "${r}" (walk-forward, past bets only), ${h} d, per step`, unit: "ret", n: a.n, ev: a.m, z: a.t, hit: a.hit, older: W.first && W.first.m, recent: W.second && W.second.m, live: L.wfRule && L.wfRule[h] === r })); }
    const P = A.pickSecond, pk = A.pick || (L.wfRule && L.wfRule[h]); if (P && P.n) items.push(rule({ id: `lab.setup.${h}d.chosen`, desc: `Bet lab: the setups with the rule picked on the older half ("${pk}"), ${h} d, scored on the newer half only (from ${A.split})`, unit: "ret", n: P.n, ev: P.m, z: P.t, hit: P.hit, rule: pk, gated: !!(L.wfGate && L.wfGate[h]) })); }
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
  // ---------- the test universe (council, Nov 8 2026) ----------
// One reading per underlying: LETF Sniper's rev.js reads the underlying for every fund, so the turn and fast-move tests run
// on the underlyings, and each underlying counts one time (before: SOXL+SOXS, TQQQ+SQQQ, NVDL+NVDA … counted one move
// two times with the same sign, so z was too large). The 🚀 rule (index.html) reads the FUND's own 15-minute move, so its
// test runs on one long fund per underlying (no inverse funds).
const LETF_U = ["SOXX", "QQQ", "SPY", "IWM", "XBI", "NVDA", "TSLA", "MSTR", "COIN", "PLTR", "AMD", "SMCI", "AXTI", "BE", "HOOD", "OKLO", "IONQ", "RGTI", "APLD", "IREN", "CRWV", "NBIS", "MU", "AVGO"];
const LETF_F = { SOXL: 0.02, TQQQ: 0.02, SPXL: 0.02, TNA: 0.02, LABU: 0.02, NVDL: 0.04, TSLL: 0.04, MSTU: 0.04, CONL: 0.04 };   // 🚀: 2% index funds, 4% single-stock funds
const COST_U = 0.0002, COST_F = 0.0005;   // a round trip: 0.05% on a fund (spread on thin funds) ≈ 0.02% of the underlying on a 2–3× fund
const etMin = t => { const d = new Date(t - 5 * 36e5); return d.getUTCHours() * 60 + d.getUTCMinutes(); };   // ET (winter) minute of the day
const tod = t => { const m = etMin(t); return m < 630 ? "open" : m < 900 ? "mid" : "close"; };   // 09:30–10:30, 10:30–15:00, 15:00–16:00
const splits = a => { const o = {}; for (const p of ["open", "mid", "close"]) { const v = a.filter(x => x.p === p).map(x => x.v); o[p] = v.length ? { n: v.length, m: +mean(v).toFixed(5) } : null; } return o; };
// a LIMIT order (Steven's rule): it counts only when price touches it; exit at market 15 minutes after the fill
function limitTrade(D, S, i, d, k, alive, cost = COST_U) { const L = S.c[i] * Math.exp(-d * k);
  for (let j = i + 1; j <= Math.min(i + alive, D.length - 16); j++) if (d > 0 ? S.l[j] <= L : S.h[j] >= L) return { t: D[i][0], v: d * Math.log(S.c[j + 15] / L) - cost, p: tod(D[i][0]) };
  return null; }
// Council, Nov 10 2026 (LETF agent request, data quality): for the FAST-MOVE tests only (fast.1m/5m and their limit fades),
// a single-bar spike is flattened: a 1-minute bar whose close is more than 10σ (robust σ of that day's 1-minute returns) away
// from BOTH neighbour closes, on the same side, gets the close of the bar before it (the bar stays, so the 3- and 5-minute
// sampling of the tests is not shifted). On Nov 10 the follow tests moved by −3 to −4.5% per event while the limit fades of
// the same events got ≈ 0: the size came from prints that came back inside one bar. The turn tests (rev.*, fade.rev) and the
// 🚀 tests read the raw bars, as before: a first run with the filter on all tests moved rev.all.15m from mute (z −2.4) to cut
// (z −2.0), and a data change must not lift a mute that nobody asked to review. The count of flattened bars is extra.spikes.
function despike(D) { if (D.length < 10) return { D, n: 0 }; const r = []; for (let i = 1; i < D.length; i++) r.push(Math.log(D[i][4] / D[i - 1][4]));
  const v = r.map(Math.abs).filter(x => x > 0).sort((a, b) => a - b), sg = v.length >= 8 ? Math.max(0.0004, v[Math.floor(v.length / 2)] * 1.4826) : 0; if (!sg) return { D, n: 0 };
  const out = D.slice(); let n = 0; for (let i = 1; i < D.length - 1; i++) { const a = Math.log(D[i][4] / D[i - 1][4]), b = Math.log(D[i][4] / D[i + 1][4]);
    if (Math.abs(a) > 10 * sg && Math.abs(b) > 10 * sg && Math.sign(a) === Math.sign(b)) { n++; const c = out[i - 1][4]; out[i] = [D[i][0], c, c, c, c, D[i][5]]; } } return { D: out, n }; }
async function letf() { const R = { rev: [], hard: [], f5: [], f1: [], frev: [], ff5: [], ff1: [], f15: [], f15a: [], ff15: [], ff1q: [], tf1: [] }, tried = { frev: 0, ff5: 0, ff1: 0, ff15: 0 }; let got = 0, gotF = 0, spikes = 0;
  const byDay = B => { const days = new Map(); B.forEach(b => { const d = new Date(b[0] - 5 * 36e5).toISOString().slice(0, 10); if (!days.has(d)) days.set(d, []); days.get(d).push(b); }); return days; };
  for (let k = 0; k < LETF_U.length; k += 3) { await Promise.all(LETF_U.slice(k, k + 3).map(async s => { const B = await bars(s); if (!B || B.length < 200) return; got++;
    for (const D of byDay(B).values()) { if (D.length < 60) continue; const S = { c: D.map(b => b[4]), h: D.map(b => b[2]), l: D.map(b => b[3]), v: D.map(b => b[5]) }; let skip = -1;
      const X = despike(D), D2 = X.D, S2 = { c: D2.map(b => b[4]), h: D2.map(b => b[2]), l: D2.map(b => b[3]) }; spikes += X.n;
      const r1 = [0], r2 = [0]; for (let i = 1; i < D.length; i++) { r1.push(Math.log(S.c[i] / S.c[i - 1])); r2.push(Math.log(S2.c[i] / S2.c[i - 1])); }
      for (let i = 20; i < D.length - 16; i++) { const f15 = Math.log(S.c[i + 15] / S.c[i]);
        const sg = Math.max(0.0004, rsd(r1.slice(Math.max(1, i - 119), i + 1)) || 0);   // the last 120 minutes only (before: the whole day, a look-ahead)
        if (i >= skip) { const x = detect(S, i); if (x && x.score >= 0.6) { skip = i + 15; R.rev.push({ t: D[i][0], v: x.side * f15 }); if (x.score >= 1) R.hard.push({ t: D[i][0], v: x.side * f15 });
          tried.frev++; const y = limitTrade(D, S, i, -x.side, 0.5 * x.sg * Math.sqrt(5), 10); if (y) R.frev.push(y); } }
        // fast moves: on the bars with single-bar spikes flattened (S2, r2)
        const sg2 = Math.max(0.0004, rsd(r2.slice(Math.max(1, i - 119), i + 1)) || 0), g15 = Math.log(S2.c[i + 15] / S2.c[i]);
        const m5 = Math.log(S2.c[i] / S2.c[i - 5]), m1 = Math.log(S2.c[i] / S2.c[i - 1]);
        if (Math.abs(m5) >= 4 * sg2 * Math.sqrt(5) && i % 5 === 0) { R.f5.push({ t: D[i][0], v: Math.sign(m5) * g15, s, m: m5 }); tried.ff5++; const y = limitTrade(D2, S2, i, -Math.sign(m5), 0.5 * sg2 * Math.sqrt(5), 5); if (y) R.ff5.push(y); }
        if (Math.abs(m1) >= 4 * sg2 && i % 3 === 0) { R.f1.push({ t: D[i][0], v: Math.sign(m1) * g15, s, m: m1 }); tried.ff1++; R.tf1.push(D[i][0]); const y = limitTrade(D2, S2, i, -Math.sign(m1), 0.5 * sg2 * Math.sqrt(5), 5); if (y) R.ff1.push(y);
          const y2 = limitTrade(D2, S2, i, -Math.sign(m1), 0.25 * sg2 * Math.sqrt(5), 5); if (y2) R.ff1q.push(y2); } } } })); }
  for (const [s, th] of Object.entries(LETF_F)) { const B = await bars(s); if (!B || B.length < 200) continue; gotF++;
    for (const D of byDay(B).values()) { if (D.length < 60) continue; const c = D.map(b => b[4]), SF = { c, h: D.map(b => b[2]), l: D.map(b => b[3]) }; let skip = -1, skipA = -1, dv = 0;
      const r1 = [0]; for (let i = 1; i < D.length; i++) r1.push(Math.log(c[i] / c[i - 1]));
      for (let i = 0; i < D.length - 15; i++) { dv += D[i][4] * D[i][5]; if (i < 15 || i % 5) continue; const m15 = c[i] / c[i - 15] - 1;
        // the 🚀 ALERT level (index.html): 5% single-stock / 2.5% index fund, and $1M+ traded so far today (council, Nov 9 2026)
        if (i >= skipA && Math.abs(m15) >= th * 1.25 && dv >= 1e6) { skipA = i + 15; R.f15a.push({ t: D[i][0], v: Math.sign(m15) * Math.log(c[i + 15] / c[i]) - COST_F, p: tod(D[i][0]) }); }
        if (i < skip || Math.abs(m15) < th) continue; skip = i + 15;
        R.f15.push({ t: D[i][0], v: Math.sign(m15) * Math.log(c[i + 15] / c[i]) - COST_F, p: tod(D[i][0]), m: etMin(D[i][0]) });
        // Council, Nov 10 2026 (LETF agent request): fade the 🚀 move with a LIMIT entry against it, 0.5 × the fund's 5-min σ
        // (σ from the last 120 minutes only) past the signal close, alive 5 min, counts only when touched, exit 15 min after the fill, cost 0.05%
        const sgF = Math.max(0.0004, rsd(r1.slice(Math.max(1, i - 119), i + 1)) || 0); tried.ff15++; const y = limitTrade(D, SF, i, -Math.sign(m15), 0.5 * sgF * Math.sqrt(5), 5, COST_F); if (y) R.ff15.push(y); } } }
  // trim: the mean without the top and bottom 5% (council, Nov 10 2026: a check of the size of fast.* items; the ruling uses ev)
  const trim = v => { const a = v.slice().sort((x, y) => x - y), k = Math.floor(a.length * 0.05); return a.length >= 20 ? +mean(a.slice(k, a.length - k)).toFixed(5) : null; };
  const L = a => a.sort((x, y) => x.t - y.t).map(x => x.v), items = [], add = (id, desc, a, ex) => { if (a.length) { const v = L(a.slice()); items.push({ ...fromList(id, desc, "ret", v), ...(/^fast\./.test(id) ? { trim: trim(v) } : {}), ...(ex || {}) }); } };
  for (const [id, a] of [["fast.1m.15m", R.f1], ["fast.5m.15m", R.f5]]) console.log(id, "largest |15-min result|:", a.slice().sort((x, y) => Math.abs(y.v) - Math.abs(x.v)).slice(0, 5).map(x => `${x.s} ${new Date(x.t - 5 * 36e5).toISOString().slice(5, 16)} ET move ${(x.m * 100).toFixed(2)}% next15 ${(x.v * 100).toFixed(2)}%`).join(" | "));
  add("rev.all.15m", "Hard reversal detector, all turns (score ≥ 0.6), on the underlying: trade the new direction, next 15 min", R.rev);
  add("rev.hard.15m", "Hard reversal detector, HARD turns (score ≥ 1), on the underlying, next 15 min", R.hard);
  add("fast.5m.15m", "Fast 5-minute move (4σ+) of the underlying: follow it, next 15 min (negative EV = fade it)", R.f5);
  add("fast.1m.15m", "Fast 1-minute move (4σ+) of the underlying: follow it, next 15 min (negative EV = fade it)", R.f1);
  add("fade.rev.15m", "Fade a turn (score ≥ 0.6): LIMIT entry in the old direction 0.5 × 5-min σ better than the signal close, alive 10 min, counts only when touched; exit 15 min after the fill; cost 0.02% of the underlying", R.frev, { fill: tried.frev ? +(R.frev.length / tried.frev).toFixed(3) : null, tod: splits(R.frev) });
  add("fade.fast5m.15m", "Fade a fast 5-minute move (4σ+): LIMIT entry against the move 0.5 × 5-min σ past the close, alive 5 min, counts only when touched; exit 15 min after the fill; cost 0.02% of the underlying", R.ff5, { fill: tried.ff5 ? +(R.ff5.length / tried.ff5).toFixed(3) : null, tod: splits(R.ff5) });
  add("fade.fast1m.15m", "Fade a fast 1-minute move (4σ+): LIMIT entry against the move 0.5 × 5-min σ past the close, alive 5 min, counts only when touched; exit 15 min after the fill; cost 0.02% of the underlying", R.ff1, { fill: tried.ff1 ? +(R.ff1.length / tried.ff1).toFixed(3) : null, tod: splits(R.ff1) });
  // Council, Nov 11 2026 (LETF agent request): the same fade of a fast 1-minute move with a limit only 0.25 × 5-min σ past the
  // close (a fixed comparison, not a fit: it shows what a closer limit gains in fills and loses in price). fade.fast1m.15m is unchanged.
  // fade.fast1m.15m.k25 (limit 0.25σ) was dropped on Nov 12 2026 (LETF agent): it answered its question (more fills, no edge: Nov 12 −0.63% at 100% fill).
  // Council, Nov 9 2026 (LETF agent requests). (1) fade.rev.15m per market day (ET), for the "3 new market days" rule.
  // (2) A walk-forward time-of-day gate: keep the windows (open / mid / close) whose mean was > 0 on the OLDER half of the
  // trades (8+ trades), and report ONLY the newer half, in the kept windows. No window is picked on the reported trades.
  // Council, Nov 10 2026: the same per-day record for fade.fast1m.15m and fade.fast5m.15m (LETF agent request), and the same
  // walk-forward time gate for the 🚀 follow rule and its alert level (fast.15m.15m.tgate, fast.15m.alert.tgate).
  const perDay = (id, list) => { const byD = {}; list.forEach(x => { const d = new Date(x.t - 5 * 36e5).toISOString().slice(0, 10); (byD[d] || (byD[d] = [])).push(x.v); });
    const it = items.find(i => i.id === id); if (it) it.days = Object.fromEntries(Object.entries(byD).sort().map(([d, v]) => [d, { n: v.length, m: +mean(v).toFixed(5) }])); };
  const tgate = (id, list, desc) => { const a = list.slice().sort((x, y) => x.t - y.t), h = Math.floor(a.length / 2), old = a.slice(0, h), keep = ["open", "mid", "close"].filter(p => { const v = old.filter(x => x.p === p).map(x => x.v); return v.length >= 8 && mean(v) > 0; });
    const nw = a.slice(h).filter(x => keep.includes(x.p)); if (nw.length) items.push({ ...fromList(`${id}.tgate`, `${desc}, only in the times of day that won on the older half (${keep.join(", ")}); scored on the newer half only`, "ret", nw.map(x => x.v)), keep, of: a.length - h, days: dayRec(nw) }); };
  // Council, Nov 13 2026 (LETF agent request): .tgate items keep n and mean per ET market day of the scored (newer-half) trades,
  // so "3 positive new days" can be read for the 🚀 open-hour gate. Record only; the ruling is unchanged.
  function dayRec(list) { const byD = {}; list.forEach(x => { const d = new Date(x.t - 5 * 36e5).toISOString().slice(0, 10); (byD[d] || (byD[d] = [])).push(x.v); });
    return Object.fromEntries(Object.entries(byD).sort().map(([d, v]) => [d, { n: v.length, m: +mean(v).toFixed(5) }])); }
  perDay("fade.rev.15m", R.frev); perDay("fade.fast1m.15m", R.ff1); perDay("fade.fast5m.15m", R.ff5);
  // fill rate per market day of the fast 1-minute fades (council, Nov 11 2026): tried signals per day from R.tf1
  { const tD = {}; R.tf1.forEach(t => { const d = new Date(t - 5 * 36e5).toISOString().slice(0, 10); tD[d] = (tD[d] || 0) + 1; });
    for (const id of ["fade.fast1m.15m"]) { const it = items.find(i => i.id === id); if (it && it.days) for (const [d, x] of Object.entries(it.days)) x.fill = tD[d] ? +(x.n / tD[d]).toFixed(3) : null; it && (it.tried = tD); } }
  tgate("fade.rev.15m", R.frev, "Fade a turn (as fade.rev.15m)");
  // Council, Nov 12 2026 (LETF agent request): the 🚀 events of the open hour by 10-minute ET bucket (09:30, 09:40 … 10:20),
  // n and mean per bucket: a record only (no ruling), for the SOXX lesson that big swings cluster at 10:20–10:40 ET.
  const open10 = a => { const o = {}; a.filter(x => x.m >= 570 && x.m < 630).forEach(x => { const b = Math.floor((x.m - 570) / 10) * 10 + 570, k = `${Math.floor(b / 60)}:${String(b % 60).padStart(2, "0")}`; (o[k] || (o[k] = [])).push(x.v); });
    return Object.fromEntries(Object.entries(o).sort().map(([k, w]) => [k, { n: w.length, m: +mean(w).toFixed(5) }])); };
  add("fast.15m.15m", "🚀 rule: the fund moved 4%+ (single-stock fund) or 2%+ (index fund) in 15 min: follow it, next 15 min, cost 0.05% (one long fund per underlying)", R.f15, { tod: splits(R.f15), open10: open10(R.f15) });
  add("fast.15m.alert", "🚀 ALERT level: the fund moved 5%+ (single-stock fund) or 2.5%+ (index fund) in 15 min with $1M+ traded today: follow it, next 15 min, cost 0.05%", R.f15a, { tod: splits(R.f15a) });
  add("fade.15m.15m", "Fade the 🚀 move: LIMIT entry against the move 0.5 × the fund's 5-min σ past the close, alive 5 min, counts only when touched; exit 15 min after the fill; cost 0.05%", R.ff15, { fill: tried.ff15 ? +(R.ff15.length / tried.ff15).toFixed(3) : null, tod: splits(R.ff15) });
  perDay("fade.15m.15m", R.ff15);
  tgate("fast.15m.15m", R.f15, "🚀 rule (as fast.15m.15m)"); tgate("fast.15m.alert", R.f15a, "🚀 alert level (as fast.15m.alert)");
  const PL = await letfPlan(); items.push(...PL.items);
  return { at: new Date().toISOString(), items, extra: { markets: got, of: LETF_U.length, funds: gotF, fundsOf: Object.keys(LETF_F).length, spikes, planMarkets: PL.got } }; }

// ---------- LETF Sniper: the setupOf trade plan (council, Nov 12 2026; LETF agent request of Nov 11) ----------
// The fund page's main plan (index.html setupCore on the UNDERLYING's 5-minute bars) had no score. The page code is read
// from LETF-Sniper main at run time (resample … setupCore, and the helpers they use), so the test runs the SAME code as the
// page; no copy can drift. Rule (no fit, no parameter chosen here): one signal per underlying per hour, at the close of
// the 10:25, 11:25, 12:25, 13:25 and 14:25 ET bars, with the last 390 five-minute bars (5 days, as the page's 5d chart) and
// the daily bars of the past days plus today so far. When side ≠ 0 (LONG / SHORT SETUP, or LEAN), the plan's LIMIT entry
// (0.5 × 5-min ATR better than the close, never past the stop) is alive 60 min and counts ONLY when touched (Steven's rule).
// After the fill: exit at the plan's stop or target, or at market 60 min after the fill (or at the last bar of the day).
// A bar that touches both the stop and the target counts as the stop (the worse case); a stop on the fill bar counts too.
// No new signal while a plan is alive or open. Result in the underlying (log return × side), cost 0.02% of the underlying.
async function pageSetup() { try { const r = await fetch("https://raw.githubusercontent.com/stevenwsharp-ctrl/LETF-Sniper/main/index.html?t=" + Date.now()); if (!r.ok) return null; const H = await r.text();
    const a = H.indexOf("function resample("), b0 = H.indexOf("function setupCore("), b = b0 < 0 ? -1 : H.indexOf("\n}\n", b0); if (a < 0 || b0 < a || b < 0) return null;
    const helper = n => { const m = new RegExp(`^const ${n}=.*$`, "m").exec(H); return m ? m[0] : ""; };
    const src = ["fmtPx", "clamp", "isNum", "mean"].map(helper).join("\n") + "\nconst UMAP={},UNI=[],QT={};\n" + H.slice(a, b + 2) + "\nthis.setupCore=setupCore;";
    const vm = await import("vm"), ctx = { console, Math, Date, Infinity, NaN, isFinite }; vm.createContext(ctx); vm.runInContext(src, ctx); return ctx.setupCore; } catch (e) { console.log("setupOf code not read:", e.message); return null; } }
async function barsY(sym, interval, range) { const Y = await ysess(); for (let i = 0; i < 3; i++) { try { const r = await fetch(`https://query${i % 2 ? 2 : 1}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${interval}&range=${range}&includePrePost=false${Y.crumb ? "&crumb=" + encodeURIComponent(Y.crumb) : ""}`, { headers: { "user-agent": UA, ...(Y.ck ? { cookie: Y.ck } : {}) } }); if (!r.ok) throw new Error(r.status); const j = await r.json(), x = j.chart.result[0], q = x.indicators.quote[0]; const B = []; x.timestamp.forEach((t, k) => { if ([q.open[k], q.high[k], q.low[k], q.close[k]].every(v => v > 0)) B.push([t * 1000, q.open[k], q.high[k], q.low[k], q.close[k], q.volume[k] || 0]); }); return B; } catch (e) { await sleep(1500 * (i + 1)); } } return null; }
const etDay = t => new Date(t - 5 * 36e5).toISOString().slice(0, 10);
function planTrades(setupCore, B5, BD, cost = COST_U) { const out = [], tried = { n: 0 }, ex = { tgt: 0, stop: 0, time: 0 }; let busy = -1;
  const B = B5.filter(b => { const m = etMin(b[0]); return m >= 570 && m < 960; });
  for (let i = 400; i < B.length; i++) { const m = etMin(B[i][0]); if (![625, 685, 745, 805, 865].includes(m) || i <= busy) continue; const day = etDay(B[i][0]);
    const today = B.filter((b, k) => k <= i && etDay(b[0]) === day), bd = BD.filter(b => etDay(b[0]) < day).slice(-60);
    if (today.length) bd.push([today[0][0], today[0][1], Math.max(...today.map(b => b[2])), Math.min(...today.map(b => b[3])), today[today.length - 1][4], today.reduce((p, b) => p + b[5], 0)]);
    let S; try { S = setupCore({ b5: B.slice(i - 389, i + 1), bd }, B[i][4], null); } catch (e) { continue; } if (!S || !S.side || !S.plan) continue;
    const P = S.plan, d = P.side, end = (() => { let k = i; while (k + 1 < B.length && etDay(B[k + 1][0]) === day) k++; return k; })(); tried.n++;
    let f = -1; for (let j = i + 1; j <= Math.min(i + 12, end); j++) if (d > 0 ? B[j][3] <= P.limit : B[j][2] >= P.limit) { f = j; break; }
    if (f < 0) { busy = Math.min(i + 12, end); continue; }
    let px = null, why = "time", k = f; const stopHit = b => d > 0 ? b[3] <= P.stop : b[2] >= P.stop, tgtHit = b => d > 0 ? b[2] >= P.tgt : b[3] <= P.tgt;
    if (stopHit(B[f])) { px = P.stop; why = "stop"; }
    else for (k = f + 1; k <= Math.min(f + 12, end); k++) { const b = B[k];
      if (stopHit(b)) { px = d > 0 ? Math.min(b[1], P.stop) : Math.max(b[1], P.stop); why = "stop"; break; }
      if (tgtHit(b)) { px = P.tgt; why = "tgt"; break; } }
    if (px == null) { k = Math.min(f + 12, end); px = B[k][4]; }
    ex[why]++; busy = k; out.push({ t: B[i][0], v: d * Math.log(px / P.limit) - cost, p: tod(B[i][0]), full: /SETUP/.test(S.verdict), why }); }
  return { out, tried: tried.n, ex }; }
async function letfPlan() { const setupCore = await pageSetup(); if (!setupCore) return { items: [], got: 0 };
  const all = [], ex = { tgt: 0, stop: 0, time: 0 }; let tried = 0, got = 0;
  for (let k = 0; k < LETF_U.length; k += 3) await Promise.all(LETF_U.slice(k, k + 3).map(async s => { const [B5, BD] = await Promise.all([barsY(s, "5m", "1mo"), barsY(s, "1d", "6mo")]); if (!B5 || B5.length < 500 || !BD) return; got++;
    const R = planTrades(setupCore, B5, BD); tried += R.tried; for (const w in ex) ex[w] += R.ex[w]; R.out.forEach(x => all.push({ ...x, s })); }));
  const items = [], v = a => a.slice().sort((x, y) => x.t - y.t).map(x => x.v);
  const perD = a => { const o = {}; a.forEach(x => { const d = etDay(x.t); (o[d] || (o[d] = [])).push(x.v); }); return Object.fromEntries(Object.entries(o).sort().map(([d, w]) => [d, { n: w.length, m: +mean(w).toFixed(5) }])); };
  // Council, Nov 13 2026 (LETF agent request): n and mean per exit kind (tgt, stop, time) on each plan item. Record only.
  const byExit = a => Object.fromEntries(["tgt", "stop", "time"].map(w => { const x = a.filter(y => y.why === w).map(y => y.v); return [w, { n: x.length, m: x.length ? +mean(x).toFixed(5) : null }]; }));
  const add = (id, desc, a, extra) => { if (a.length) items.push({ ...fromList(id, desc, "ret", v(a)), tod: splits(a), days: perD(a), byExit: byExit(a), ...(extra || {}) }); };
  add("plan.setup.60m", "Fund page trade plan (setupOf on the underlying's 5-min bars, LONG/SHORT SETUP and LEAN): LIMIT entry 0.5 × 5-min ATR, alive 60 min, counts only when touched; exit at the plan's stop or target or 60 min after the fill; cost 0.02% of the underlying; one per underlying per hour", all, { fill: tried ? +(all.length / tried).toFixed(3) : null, tried, exits: ex, markets: got });
  add("plan.setup.full.60m", "Fund page trade plan, only LONG / SHORT SETUP (all three filters agree): as plan.setup.60m", all.filter(x => x.full));
  add("plan.setup.lean.60m", "Fund page trade plan, only LEAN LONG / LEAN SHORT (2 of 3 filters): as plan.setup.60m", all.filter(x => !x.full));
  console.log("plan.setup.60m: markets", got, "plans", tried, "filled", all.length, "exits", JSON.stringify(ex));
  return { items, got }; }

async function main() {
  fs.mkdirSync(OUT, { recursive: true }); const prev = rd(`${OUT}/ev.json`);
  const T = { soxx: await soxx(), cohort: cohort(), letf: await letf() };
  // a source that failed today (no file, or Yahoo gave fewer than half of the markets) must not lift its mutes:
  // keep the last good block, marked stale (council, Nov 8 2026)
  const bad = { soxx: x => !x.items || !x.items.length, cohort: x => !x.items || !x.items.length, letf: x => !x.items || !x.items.length || !(x.extra && x.extra.markets >= LETF_U.length / 2) };
  for (const k of Object.keys(T)) { const p = prev && prev.trackers && prev.trackers[k]; if (bad[k](T[k]) && p && p.items && p.items.length) { console.log(k, "source failed: keep the last good block", JSON.stringify(T[k].err || T[k].extra || "")); T[k] = { ...p, stale: true, staleSince: p.staleSince || p.at || prev.t, items: p.items.map(i => ({ ...i, changed: false })) }; } else if (T[k]) delete T[k].stale; }
  for (const [k, x] of Object.entries(T)) { const p = prev && prev.trackers && prev.trackers[k]; if (!x.items || x.stale) continue;
    x.items.forEach(it => { const o = p && p.items && p.items.find(y => y.id === it.id); if (o) { it.prev = o.status; it.changed = o.status !== it.status; if (it.rule != null && o.rule != null) { it.rulePrev = o.rule; it.ruleChanged = o.rule !== it.rule; } } });
    x.summary = { n: x.items.length, mute: x.items.filter(i => i.status === "mute").length, cut: x.items.filter(i => i.status === "cut").length, back: x.items.filter(i => i.status === "back").length, changed: x.items.filter(i => i.changed).length };
    x.rules = Object.fromEntries(x.items.filter(i => i.factor !== 1).map(i => [i.id, i.factor])); }
  const ev = { t: new Date().toISOString(), note: "factor 0 = mute, 0.5 = cut, 1.25 = back; agents read this file every market day", trackers: T };
  fs.writeFileSync(`${OUT}/ev.json`, JSON.stringify(ev, null, 1));
  for (const [k, x] of Object.entries(T)) console.log(k, JSON.stringify(x.summary || x.err), x.extra ? JSON.stringify(x.extra) : "");
}
main().catch(e => { console.error(e); process.exit(1); });
