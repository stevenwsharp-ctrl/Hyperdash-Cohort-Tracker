// Cohort Sniper data job. The GitHub Action calls it about every minute.
// It does work only when Hyperdash has a new snapshot (Hyperdash updates every 5 minutes).
// Exit code 0 = new data written. Exit code 3 = no new data (nothing to push).
// Writes into <outDir>:
//   latest.json      cohort positioning for every Hyperliquid perp + funding/price/OI + time-frame trends
//   history.json     per market: smart bias, fool bias, price, smart net $ (2h at 5 min, 24h at 15 min, 7 days hourly)
//   events.json      expert exits, flips, fades, adds, new setups (7 days)
//   instruments.json leveraged ETFs, proxies, options availability (rebuilt every 12 hours)
//   options.json     option chain stats for the top setups (Cboe, 15-min delay)
//   alerts.json      what the setup alert already sent
//   status.json      result of the last run
// Usage: node scripts/fetch.mjs <outDir> [savedGraphqlResponse.json]
import fs from "node:fs";
import { http, makeIO, agg, score, normCoin, SMART, FOOLS, fidelityOK } from "./lib.mjs";
import { buildInstruments } from "./instruments.mjs";
import { optionStats } from "./options.mjs";
import { computeTrends, detectEvents } from "./trends.mjs";
import { getVix, getEarnings } from "./context.mjs";

const OUT = process.argv[2] || "out";
const INPUT = process.argv[3];
const io = makeIO(OUT);
const status = { ok: true, startedAt: new Date().toISOString(), notes: [] };
const note = (part, e) => { status.notes.push(`${part}: ${String(e && e.message || e).slice(0, 200)}`); console.error(part, String(e && e.message || e)); };
const ALERT_TYPES = new Set((process.env.ALERT_TYPES || "setup,exit,flip,news").split(/[\s,]+/).filter(Boolean));

const QUERY = `query{analytics{perpsMarketParticipation{timestamp
 pnlCohorts{cohortId cohortLabel cohortRange markets{coin longTraderCount shortTraderCount totalLongNotional totalShortNotional}}
 sizeCohorts{cohortId cohortLabel cohortRange markets{coin longTraderCount shortTraderCount totalLongNotional totalShortNotional}}}}}`;

async function getCohorts() {
  if (INPUT) return JSON.parse(fs.readFileSync(INPUT, "utf8"));
  const j = await http("https://api.hyperdash.com/graphql", {
    method: "POST", body: JSON.stringify({ query: QUERY }), tries: 2,
    headers: { "content-type": "application/json", origin: "https://hyperdash.com", referer: "https://hyperdash.com/" }
  });
  if (j.errors) throw new Error("GraphQL: " + JSON.stringify(j.errors).slice(0, 300));
  return j;
}

async function getCtx() {
  const post = body => http("https://api.hyperliquid.xyz/info", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const dexes = await post({ type: "perpDexs" });
  const out = {};
  await Promise.all(dexes.map(async d => {
    const name = d ? d.name : "";
    try {
      const [meta, ctxs] = await post({ type: "metaAndAssetCtxs", dex: name });
      meta.universe.forEach((u, i) => {
        const c = ctxs[i]; if (!c || u.isDelisted) return;
        const px = +c.markPx || +c.oraclePx || 0, prev = +c.prevDayPx || 0;
        const key = normCoin(u.name), o = { px, ch: prev ? Math.round((px / prev - 1) * 10000) / 100 : null, f: +c.funding || 0, oi: Math.round((+c.openInterest || 0) * px), v: Math.round(+c.dayNtlVlm || 0) };
        out[key] = o;
        if (key.toUpperCase() !== key) out[key.toUpperCase()] = { ...o, n: u.name }; // Hyperdash uses KBONK, Hyperliquid uses kBONK
      });
    } catch (e) { note("hyperliquid " + name, e); }
  }));
  // Predicted next funding on Hyperliquid (main venue) and on Binance / Bybit for the same coin
  try {
    const pf = await post({ type: "predictedFundings" });
    for (const [coin, venues] of pf || []) {
      const key = normCoin(coin), o = out[key] || out[key.toUpperCase()]; if (!o) continue;
      const v = Object.fromEntries((venues || []).filter(x => x && x[1]).map(([name, x]) => [name, x]));
      const pick = n => v[n] ? [+v[n].fundingRate, +v[n].fundingIntervalHours || 8, +v[n].nextFundingTime || null] : null;
      o.pf = { hl: pick("HlPerp"), bin: pick("BinPerp"), byb: pick("BybitPerp") };
    }
  } catch (e) { note("predictedFundings", e); }
  return out;
}

// Keep: last 2h every snapshot, then 15-min to 26h, then hourly to 7 days.
function downsample(snaps, tNow) {
  const keep = [], seen = new Set();
  for (const s of snaps) {
    const t = Date.parse(s.t), age = tNow - t;
    if (age > 7 * 864e5 + 2 * 36e5) continue;   // 7 days plus 2 h, so the "7d" window always finds a snapshot
    if (age <= 2 * 36e5) { keep.push(s); continue; }
    const key = age <= 26 * 36e5 ? "q" + Math.floor(t / 9e5) : "h" + Math.floor(t / 36e5);
    if (!seen.has(key)) { seen.add(key); keep.push(s); }
  }
  return keep;
}

async function notify(title, body, tags) {
  const topic = process.env.NTFY_TOPIC, hook = process.env.DISCORD_WEBHOOK_URL, site = process.env.SITE_URL || "";
  if (topic) await http(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: "POST", body, as: "text", tries: 2, headers: { Title: title, Tags: tags, ...(site ? { Click: site } : {}) } });
  if (hook) await http(hook, { method: "POST", as: "text", tries: 2, headers: { "content-type": "application/json" }, body: JSON.stringify({ content: `**${title}**\n${body}` + (site ? `\n<${site}>` : "") }) });
}

async function setupAlerts(latest, ctx) {
  if (!ALERT_TYPES.has("setup") || (!process.env.NTFY_TOPIC && !process.env.DISCORD_WEBHOOK_URL)) return;
  const minScore = +process.env.ALERT_MIN_SCORE || 65;
  const state = io.read("alerts.json", {});
  const now = Date.now();
  const inst = io.read("instruments.json", null);
  const hits = Object.keys(latest.m).filter(c => fidelityOK(c, inst)).map(c => score(latest, c)).filter(r => r.score >= minScore).sort((a, b) => b.score - a.score);
  const fresh = hits.filter(r => { const s = state[r.coin]; return !s || s.dir !== r.dir || now - s.t > 24 * 36e5; }).slice(0, 5);
  for (const r of fresh) {
    const side = r.dir > 0 ? "SMART LONG" : "SMART SHORT";
    const fund = ctx[r.coin] ? ctx[r.coin].f * 24 * 365 * 100 * -r.dir : null;
    const body = [
      `Score ${r.score}. Smart ${Math.round(r.sm.b * 100)} vs fools ${Math.round(r.fo.b * 100)} (gap ${Math.round(r.gap * 100)}).`,
      r.red.length ? `Red flag: ${r.red.join(", ")} on the other side.` : "No red flag.",
      fund != null ? `Funding: smart side ${fund >= 0 ? "earns" : "pays"} ${Math.abs(fund).toFixed(0)}%/yr.` : ""
    ].filter(Boolean).join("\n");
    try { await notify(`${r.coin}: ${side} (score ${r.score})`, body, r.dir > 0 ? "green_circle" : "red_circle"); state[r.coin] = { dir: r.dir, t: now, score: r.score }; }
    catch (e) { note("alert " + r.coin, e); }
  }
  for (const c in state) if (now - state[c].t > 7 * 864e5) delete state[c];
  io.write("alerts.json", state);
}

const EVENT_TAG = { exit: "warning", flip: "rotating_light", fade: "chart_with_downwards_trend", add: "heavy_plus_sign", new: "new" };
const EVENT_TITLE = { exit: "Experts exiting", flip: "Experts flipped", fade: "Setup fading", add: "Experts adding", new: "New setup" };

async function main() {
  const prevLatest = io.read("latest.json", null);
  let raw;
  try { raw = await getCohorts(); }
  catch (e) {
    const old = io.read("status.json", {});
    io.write("status.json", { ...old, ok: false, failedAt: status.startedAt, error: String(e.message || e) });
    console.error("Hyperdash fetch failed:", e.message || e); process.exit(0); // push the status so the page can show it
  }
  const p = raw.data.analytics.perpsMarketParticipation;
  if (!INPUT && prevLatest && prevLatest.t === p.timestamp && !process.env.FORCE_RUN) { console.log("No new Hyperdash snapshot:", p.timestamp); process.exit(3); }

  const pnl = p.pnlCohorts.map(c => ({ id: c.cohortId, label: c.cohortLabel, range: c.cohortRange }));
  const size = p.sizeCohorts.map(c => ({ id: c.cohortId, label: c.cohortLabel, range: c.cohortRange }));
  const m = {};
  const put = (kind, i, mk) => {
    const c = mk.coin;
    if (!m[c]) m[c] = { p: Array(pnl.length).fill(null), s: Array(size.length).fill(null) };
    m[c][kind][i] = [mk.longTraderCount, mk.shortTraderCount, Math.round(mk.totalLongNotional), Math.round(mk.totalShortNotional)];
  };
  p.pnlCohorts.forEach((c, i) => c.markets.forEach(mk => put("p", i, mk)));
  p.sizeCohorts.forEach((c, i) => c.markets.forEach(mk => put("s", i, mk)));
  for (const c in m) { m[c].p = m[c].p.map(r => r || [0, 0, 0, 0]); m[c].s = m[c].s.map(r => r || [0, 0, 0, 0]); }

  let ctx = {};
  if (!INPUT) { try { ctx = await getCtx(); } catch (e) { note("hyperliquid", e); } }

  // History
  const ix = id => pnl.findIndex(c => c.id === id);
  const sI = SMART.map(ix).filter(i => i >= 0), fI = FOOLS.map(ix).filter(i => i >= 0);
  const epI = ix("extremely_profitable"), vpI = ix("very_profitable");
  const K = x => Math.round(x / 1000);
  const d = {};
  for (const c in m) {
    const sm = agg(sI.map(i => m[c].p[i])), fo = agg(fI.map(i => m[c].p[i]));
    if (sm.n < 20000 || fo.n < 20000) continue;
    const ep = epI >= 0 ? m[c].p[epI] : [0, 0, 0, 0], vp = vpI >= 0 ? m[c].p[vpI] : [0, 0, 0, 0];
    // all traders' long and short money (size cohorts cover everyone)
    let tL = 0, tS = 0; for (const r of m[c].s) { tL += r[2]; tS += r[3]; }
    d[c] = [Math.round(sm.b * 100), Math.round(fo.b * 100), ctx[c] ? +ctx[c].px.toPrecision(6) : null, K(ep[2] - ep[3]), K(vp[2] - vp[3]), K(sm.n), K(fo.L - fo.S),
      ctx[c] ? Math.round(ctx[c].f * 1e7) : null, K(tL), K(tS)];
  }
  const hist = io.read("history.json", { snapshots: [] });
  const tNow = Date.parse(p.timestamp) || Date.now();
  let snaps = (hist.snapshots || []).filter(s => Date.parse(s.t) < tNow);
  snaps.push({ t: p.timestamp, v: 2, d }); // v2 = bias blends $ and trader count
  snaps = downsample(snaps, tNow);
  io.write("history.json", { smart: SMART, fools: FOOLS, fields: ["smartBias", "foolBias", "price", "epNetK", "vpNetK", "smartGrossK", "foolNetK", "funding1e7", "allLongK", "allShortK"], snapshots: snaps });

  // Trends and events
  const tr = computeTrends(snaps);
  const evFile = io.read("events.json", { last: {}, log: [] });
  evFile.last = evFile.last || {};
  // Drop fade/flip events that compared v2 (blended) biases with older $-only snapshots.
  const firstV2 = snaps.find(s => s.v === 2);
  if (firstV2) {
    const cut = Date.parse(firstV2.t) + 5 * 6e4;
    const bad = (evFile.log || []).filter(e => (e.type === "fade" || e.type === "flip") && Date.parse(e.t) <= cut && !e.v);
    if (bad.length) { evFile.log = evFile.log.filter(e => !bad.includes(e)); bad.forEach(e => delete evFile.last[e.coin + "|" + e.type]); }
  }
  const evs = detectEvents(snaps, evFile);
  evFile.log = [...evs, ...(evFile.log || [])].filter(e => tNow - Date.parse(e.t) < 7 * 864e5).slice(0, 800);
  for (const k in evFile.last) if (tNow - evFile.last[k] > 2 * 864e5) delete evFile.last[k];
  io.write("events.json", evFile);

  const latest = { t: p.timestamp, fetchedAt: status.startedAt, pnl, size, m, ctx, tr };
  io.write("latest.json", latest);

  // Event alerts (only for markets that are a real setup now or were 1-4h ago)
  if (process.env.NTFY_TOPIC || process.env.DISCORD_WEBHOOK_URL) {
    const instA = io.read("instruments.json", null);
    const send = evs.filter(e => ALERT_TYPES.has(e.type) && fidelityOK(e.coin, instA)).slice(0, 6);
    for (const e of send) {
      const c = ctx[e.coin];
      try { await notify(`${EVENT_TITLE[e.type]}: ${e.coin}`, e.text + (c ? `\nPrice ${c.px} (${c.ch >= 0 ? "+" : ""}${c.ch}% 24h).` : ""), EVENT_TAG[e.type]); }
      catch (err) { note("event alert " + e.coin, err); }
    }
  }

  // Instruments (every 12 hours)
  let inst = io.read("instruments.json", null);
  if (!INPUT && (!inst || Date.now() - Date.parse(inst.t) > 12 * 36e5 || process.env.FORCE_INSTRUMENTS)) {
    try { inst = await buildInstruments(Object.keys(m)); io.write("instruments.json", inst); }
    catch (e) { note("instruments", e); }
  }

  // Option stats for the top setups (refresh each symbol after 50 min, max 6 per run)
  if (!INPUT && inst) {
    const opts = io.read("options.json", { m: {} });
    const ranked = Object.keys(m).map(c => score(latest, c)).filter(r => r.score >= 30).sort((a, b) => b.score - a.score);
    const want = [];
    for (const r of ranked) {
      const I = inst.m[r.coin]; if (!I) continue;
      const sym = I.u && I.u.opt ? I.u.s : (I.px.find(x => x.opt) || {}).s;
      if (sym && !want.includes(sym)) want.push(sym);
      if (want.length >= 20) break;
    }
    let n = 0;
    for (const sym of want) {
      const old = opts.m[sym];
      if (old && Date.now() - Date.parse(old.t) < 50 * 6e4) continue;
      if (old && old.err && Date.now() - Date.parse(old.t) < 24 * 36e5) continue;
      if (n++ >= 6) break;
      try { opts.m[sym] = await optionStats(sym); } catch (e) { opts.m[sym] = { s: sym, t: new Date().toISOString(), none: true, err: true }; }
    }
    for (const s in opts.m) if (Date.now() - Date.parse(opts.m[s].t) > 3 * 864e5) delete opts.m[s];
    io.write("options.json", { t: new Date().toISOString(), m: opts.m });
  }

  // Context: VIX every snapshot, earnings calendar every 12 hours
  if (!INPUT) {
    const cx = io.read("context.json", { earnings: {}, earningsT: null });
    try { cx.vix = await getVix(); } catch (e) { note("vix", e); }
    if (inst && (!cx.earningsT || Date.now() - Date.parse(cx.earningsT) > 12 * 36e5)) {
      const syms = new Set();
      for (const c in inst.m) { const I = inst.m[c]; if (I.u) syms.add(I.u.s); }
      try { cx.earnings = await getEarnings([...syms]); cx.earningsT = new Date().toISOString(); }
      catch (e) { note("earnings", e); cx.earningsT = new Date(Date.now() - 11 * 36e5).toISOString(); } // retry in about 1 hour
    }
    cx.t = new Date().toISOString();
    io.write("context.json", cx);
  }

  try { await setupAlerts(latest, ctx); } catch (e) { note("alerts", e); }

  Object.assign(status, { dataTime: p.timestamp, markets: Object.keys(m).length, snapshots: snaps.length, ctx: Object.keys(ctx).length, events: evs.length });
  io.write("status.json", status);
  console.log(JSON.stringify(status));
}

main().catch(e => { console.error(e); process.exit(1); });
