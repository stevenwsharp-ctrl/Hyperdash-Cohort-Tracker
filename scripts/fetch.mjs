// Cohort Sniper data job. Run by the GitHub Action every 15 minutes.
// Writes into <outDir>:
//   latest.json      cohort positioning for every Hyperliquid perp + funding/price/OI
//   history.json     smart bias, fool bias and price per market (24h at 15 min, then hourly, 7 days)
//   instruments.json leveraged ETFs, proxies, options availability (rebuilt every 12 hours)
//   options.json     option chain stats for the top setups (Cboe, 15-min delay)
//   alerts.json      what the alert step already sent
//   status.json      result of the last run
// Usage: node scripts/fetch.mjs <outDir> [savedGraphqlResponse.json]
import fs from "node:fs";
import { http, makeIO, agg, score, normCoin, SMART, FOOLS } from "./lib.mjs";
import { buildInstruments } from "./instruments.mjs";
import { optionStats } from "./options.mjs";

const OUT = process.argv[2] || "out";
const INPUT = process.argv[3];
const io = makeIO(OUT);
const status = { ok: true, startedAt: new Date().toISOString(), notes: [] };
const note = (part, e) => { status.notes.push(`${part}: ${String(e && e.message || e).slice(0, 200)}`); console.error(part, e); };

const QUERY = `query{analytics{perpsMarketParticipation{timestamp
 pnlCohorts{cohortId cohortLabel cohortRange markets{coin longTraderCount shortTraderCount totalLongNotional totalShortNotional}}
 sizeCohorts{cohortId cohortLabel cohortRange markets{coin longTraderCount shortTraderCount totalLongNotional totalShortNotional}}}}}`;

async function getCohorts() {
  if (INPUT) return JSON.parse(fs.readFileSync(INPUT, "utf8"));
  const j = await http("https://api.hyperdash.com/graphql", {
    method: "POST", body: JSON.stringify({ query: QUERY }),
    headers: { "content-type": "application/json", origin: "https://hyperdash.com", referer: "https://hyperdash.com/" }
  });
  if (j.errors) throw new Error("GraphQL: " + JSON.stringify(j.errors).slice(0, 300));
  return j;
}

// Funding, mark price, 24h change, open interest from Hyperliquid (all perp dexes).
async function getCtx() {
  const post = body => http("https://api.hyperliquid.xyz/info", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
  const dexes = await post({ type: "perpDexs" });
  const out = {};
  for (const d of dexes) {
    const name = d ? d.name : "";
    try {
      const [meta, ctxs] = await post({ type: "metaAndAssetCtxs", dex: name });
      meta.universe.forEach((u, i) => {
        const c = ctxs[i]; if (!c || u.isDelisted) return;
        const px = +c.markPx || +c.oraclePx || 0, prev = +c.prevDayPx || 0;
        out[normCoin(u.name)] = {
          px, ch: prev ? Math.round((px / prev - 1) * 10000) / 100 : null,
          f: +c.funding || 0,                      // hourly funding rate (+ = longs pay shorts)
          oi: Math.round((+c.openInterest || 0) * px),
          v: Math.round(+c.dayNtlVlm || 0)
        };
      });
    } catch (e) { note("hyperliquid " + name, e); }
  }
  return out;
}

function downsample(snaps, tNow) {
  const keep = [], seenHour = new Set();
  for (const s of snaps) {
    const t = Date.parse(s.t);
    if (tNow - t > 7 * 864e5) continue;
    if (tNow - t <= 26 * 36e5) { keep.push(s); continue; }
    const h = Math.floor(t / 36e5);
    if (!seenHour.has(h)) { seenHour.add(h); keep.push(s); }
  }
  return keep;
}

async function sendAlerts(latest, ctx) {
  const topic = process.env.NTFY_TOPIC, hook = process.env.DISCORD_WEBHOOK_URL;
  if (!topic && !hook) return;
  const minScore = +process.env.ALERT_MIN_SCORE || 65;
  const site = process.env.SITE_URL || "";
  const state = io.read("alerts.json", {});
  const now = Date.now();
  const hits = Object.keys(latest.m).map(c => score(latest, c)).filter(r => r.score >= minScore).sort((a, b) => b.score - a.score);
  const fresh = hits.filter(r => { const s = state[r.coin]; return !s || s.dir !== r.dir || now - s.t > 24 * 36e5; }).slice(0, 5);
  for (const r of fresh) {
    const side = r.dir > 0 ? "SMART LONG" : "SMART SHORT";
    const fund = ctx[r.coin] ? ctx[r.coin].f * 24 * 365 * 100 * -r.dir : null; // + = smart side is paid
    const lines = [
      `${r.coin}: ${side} · score ${r.score}`,
      `Smart ${Math.round(r.sm.b * 100)} vs fools ${Math.round(r.fo.b * 100)} (gap ${Math.round(r.gap * 100)})`,
      r.red.length ? `Red flag: ${r.red.join(", ")} on the other side` : "No red flag",
      fund != null ? `Funding: smart side ${fund >= 0 ? "earns" : "pays"} ${Math.abs(fund).toFixed(0)}% APR` : ""
    ].filter(Boolean);
    try {
      if (topic) await http(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: "POST", body: lines.join("\n"), as: "text", headers: { Title: `Cohort Sniper: ${r.coin} ${side}`, Tags: r.dir > 0 ? "green_circle" : "red_circle", ...(site ? { Click: site } : {}) } });
      if (hook) await http(hook, { method: "POST", as: "text", headers: { "content-type": "application/json" }, body: JSON.stringify({ content: "**" + lines[0] + "**\n" + lines.slice(1).join("\n") + (site ? `\n<${site}>` : "") }) });
      state[r.coin] = { dir: r.dir, t: now, score: r.score };
    } catch (e) { note("alert " + r.coin, e); }
  }
  for (const c in state) if (now - state[c].t > 7 * 864e5) delete state[c];
  io.write("alerts.json", state);
}

async function main() {
  let raw;
  try { raw = await getCohorts(); }
  catch (e) {
    const old = io.read("status.json", {});
    io.write("status.json", { ...old, ok: false, startedAt: status.startedAt, error: String(e.message || e) });
    console.error("Hyperdash fetch failed:", e); return;
  }
  const p = raw.data.analytics.perpsMarketParticipation;
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
  const latest = { t: p.timestamp, fetchedAt: status.startedAt, pnl, size, m, ctx };
  io.write("latest.json", latest);

  // History: [smartBias, foolBias, price]
  const sI = SMART.map(id => pnl.findIndex(c => c.id === id)).filter(i => i >= 0);
  const fI = FOOLS.map(id => pnl.findIndex(c => c.id === id)).filter(i => i >= 0);
  const d = {};
  for (const c in m) {
    const sm = agg(sI.map(i => m[c].p[i])), fo = agg(fI.map(i => m[c].p[i]));
    if (sm.n >= 20000 && fo.n >= 20000) d[c] = [Math.round(sm.b * 100), Math.round(fo.b * 100), ctx[c] ? +ctx[c].px.toPrecision(6) : null];
  }
  const hist = io.read("history.json", { snapshots: [] });
  const tNow = Date.parse(p.timestamp) || Date.now();
  let snaps = (hist.snapshots || []).filter(s => Date.parse(s.t) < tNow);
  const last = snaps[snaps.length - 1];
  if (last && tNow - Date.parse(last.t) < 10 * 6e4) snaps.pop();
  snaps.push({ t: p.timestamp, d });
  snaps = downsample(snaps, tNow);
  io.write("history.json", { smart: SMART, fools: FOOLS, fields: ["smartBias", "foolBias", "price"], snapshots: snaps });

  // Instruments (every 12 hours)
  let inst = io.read("instruments.json", null);
  if (!INPUT && (!inst || Date.now() - Date.parse(inst.t) > 12 * 36e5 || process.env.FORCE_INSTRUMENTS)) {
    try { inst = await buildInstruments(Object.keys(m)); io.write("instruments.json", inst); }
    catch (e) { note("instruments", e); }
  }

  // Option stats for the top setups (refresh each symbol after 50 min)
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
      if (n++ >= 12) break;
      try { opts.m[sym] = await optionStats(sym); } catch (e) { note("options " + sym, e); }
    }
    for (const s in opts.m) if (Date.now() - Date.parse(opts.m[s].t) > 3 * 864e5) delete opts.m[s];
    io.write("options.json", { t: new Date().toISOString(), m: opts.m });
  }

  try { await sendAlerts(latest, ctx); } catch (e) { note("alerts", e); }

  Object.assign(status, { dataTime: p.timestamp, markets: Object.keys(m).length, snapshots: snaps.length, ctx: Object.keys(ctx).length });
  io.write("status.json", status);
  console.log(JSON.stringify(status));
}

main().catch(e => { console.error(e); process.exit(1); });
