// Froth and bloodbath: markets that move fast and are set up for a big move.
// FROTH (fast rise, crowded longs): big up-move for its normal volatility, longs pay high funding, open interest
//   building, shorts being liquidated, RSI high, price stretched above its 20-day average, volume spike.
// BLOODBATH (fast drop, forced selling): big down-move for its volatility, longs being liquidated, open interest
//   flushed out, RSI low, price stretched below its 20-day average, volume spike, shorts crowded (negative funding).
// Scores 0-100. Alerts (ntfy / Discord) when a liquid market reaches ALERT_HEAT_MIN (default 60),
// again only if it climbs 15+ points or after 6 hours; plus market-wide alerts.
// Exit 0 = updated, 3 = nothing new. Usage: node scripts/heat.mjs <outDir>
import { http, makeIO, fidelityOK } from "./lib.mjs";

const OUT = process.argv[2] || "out";
const io = makeIO(OUT);
const MIN_VOL = 1e6;                       // 24h Hyperliquid volume needed to score / alert
const ALERT_MIN = +process.env.ALERT_HEAT_MIN || 60;
const ALERT_TYPES = new Set((process.env.ALERT_TYPES || "setup,exit,flip,news,froth,bloodbath").split(/[\s,]+/).filter(Boolean));
const c01 = x => Math.max(0, Math.min(1, x));
const r1 = x => x == null || !isFinite(x) ? null : Math.round(x * 10) / 10;
const keyOf = n => { const k = n.includes(":") ? n.split(":")[0].toUpperCase() + ":" + n.split(":").slice(1).join(":") : n; return k.toUpperCase() === k ? k : k.toUpperCase(); };

const hd = (query, variables) => http("https://api.hyperdash.com/graphql", {
  method: "POST", tries: 2, timeoutMs: 20000,
  headers: { "content-type": "application/json", origin: "https://hyperdash.com", referer: "https://hyperdash.com/" },
  body: JSON.stringify({ query, variables })
}).then(j => { if (j.errors) throw new Error(j.errors[0].message); return j.data; });

// Price change over h hours from our own snapshots
function retOver(snaps, coin, h, pxNow) {
  if (!snaps.length || !pxNow) return null;
  const tEnd = Date.parse(snaps[snaps.length - 1].t), target = tEnd - h * 36e5;
  let best = null, bd = Infinity;
  for (const s of snaps) { const d = Math.abs(Date.parse(s.t) - target); if (d < bd && s.d[coin] && s.d[coin][2]) { bd = d; best = s.d[coin][2]; } }
  return best && bd <= Math.max(20 * 6e4, h * 36e5 * 0.25) ? (pxNow / best - 1) * 100 : null;
}
function oiChange(series, h) {
  if (!series || series.length < 2) return null;
  const now = series[series.length - 1], target = now[0] - h * 36e5;
  let best = null, bd = Infinity;
  for (const p of series) { const d = Math.abs(p[0] - target); if (d < bd) { bd = d; best = p; } }
  return best && bd <= Math.max(45 * 6e4, h * 36e5 * 0.3) && best[1] > 0 ? (now[1] / best[1] - 1) * 100 : null;
}

export function scoreMarket(x) {
  // x: { r1, r4, r24, sd (daily sigma %), f (funding APR %, + = longs pay), oi4, oi24, lqL24, lqS24, lqL4, lqS4, oi, vr, rsi, vs20, pos90 }
  const sd = x.sd || 4;
  const z1 = x.r1 != null ? x.r1 / (sd * Math.sqrt(1 / 24)) : 0, z4 = x.r4 != null ? x.r4 / (sd * Math.sqrt(4 / 24)) : 0, z24 = x.r24 != null ? x.r24 / sd : 0;
  const oi = x.oi || 1;
  const comp = (up) => {
    const s = up ? 1 : -1;
    const c = {
      move24: c01((s * z24 - 1) / 2.5),                         // 1 sigma = 0, 3.5 sigma = full
      move4: c01((s * z4 - 1) / 2.5),
      move1: c01((s * z1 - 1.5) / 2.5),
      funding: up ? c01((x.f || 0) / 80) : c01(-(x.f || 0) / 40),   // longs pay 80%/yr = full; shorts pay 40%/yr = full
      oi: up ? c01((x.oi24 != null ? x.oi24 : (x.oi4 || 0) * 2) / 30) : c01(-(x.oi24 != null ? x.oi24 : (x.oi4 || 0) * 2) / 25),
      liq: c01(((up ? x.lqS24 : x.lqL24) || 0) / oi / 0.03 + ((up ? x.lqS4 : x.lqL4) || 0) / oi / 0.015),
      rsi: x.rsi == null ? 0 : up ? c01((x.rsi - 65) / 20) : c01((35 - x.rsi) / 20),
      stretch: x.vs20 == null ? 0 : c01(s * x.vs20 / 25),
      volume: x.vr == null ? 0 : c01((x.vr - 1.3) / 2.5)
    };
    const W = { move24: 22, move4: 14, move1: 6, funding: 13, oi: 12, liq: 13, rsi: 8, stretch: 7, volume: 5 };
    let sc = 0; for (const k in W) sc += W[k] * c[k];
    // A real froth or bloodbath needs a move: without one, the score is capped low
    const moved = Math.max(c.move24, c.move4, c.move1);
    if (moved < 0.15) sc = Math.min(sc, 30);
    return { sc: Math.round(sc), c };
  };
  const F = comp(true), B = comp(false);
  return { fr: F.sc, bb: B.sc, cf: F.c, cb: B.c, z1: r1(z1), z4: r1(z4), z24: r1(z24) };
}
export const level = (s, kind) => s >= 75 ? (kind === "fr" ? "Blow-off risk" : "Capitulation") : s >= 55 ? (kind === "fr" ? "Frothy" : "Bloodbath") : s >= 40 ? (kind === "fr" ? "Warm" : "Heavy selling") : "";

async function notify(title, body, tags, click) {
  const topic = process.env.NTFY_TOPIC, hook = process.env.DISCORD_WEBHOOK_URL;
  if (topic) await http(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: "POST", body, as: "text", tries: 2, headers: { Title: title, Tags: tags, ...(click ? { Click: click } : {}) } });
  if (hook) await http(hook, { method: "POST", as: "text", tries: 2, headers: { "content-type": "application/json" }, body: JSON.stringify({ content: `**${title}**\n${body}${click ? `\n<${click}>` : ""}` }) });
}

async function main() {
  const latest = io.read("latest.json", null);
  if (!latest || !latest.ctx) process.exit(3);
  const HT = io.read("heat.json", { m: {}, ev: [] });                       // what the page reads
  const ST = io.read("heatstate.json", { oi: {}, oiBack: {}, last: {} });  // working state (not read by the page)
  HT.ev = HT.ev || [];
  if (HT.dataT === latest.t && Date.now() - Date.parse(HT.t || 0) < 4 * 6e4) process.exit(3);
  const hist = io.read("history.json", { snapshots: [] }), CY = io.read("cycle.json", { m: {} });
  const snaps = hist.snapshots || [];
  const now = Date.now();

  ST.oi = ST.oi || {}; ST.oiBack = ST.oiBack || {}; ST.last = ST.last || {};
  // Own OI series (5-minute samples, 26 hours)
  for (const [c, x] of Object.entries(latest.ctx)) {
    if (!x.oi) continue;
    const s = ST.oi[c] = ST.oi[c] || [];
    if (!s.length || now - s[s.length - 1][0] > 4 * 6e4) s.push([now, x.oi]);
    while (s.length && now - s[0][0] > 26 * 36e5) s.shift();
  }
  // Backfill OI history from Hyperdash for liquid markets with less than 24h of our own data (40 per run)
  const need = Object.entries(latest.ctx).filter(([c, x]) => x.v >= MIN_VOL && latest.m[c] && (!ST.oi[c] || ST.oi[c].length < 2 || now - ST.oi[c][0][0] < 23 * 36e5) && !(ST.oiBack && ST.oiBack[c] && now - ST.oiBack[c] < 3 * 36e5)).slice(0, 40);
  if (need.length) {
    const names = need.map(([c, x]) => x.n || (c.includes(":") ? c.split(":")[0].toLowerCase() + ":" + c.split(":").slice(1).join(":") : c));
    try {
      const d = await hd(`query($t:[String!]!,$tf:String){analytics{historicalOpenInterest(tokens:$t,timeframe:$tf)}}`, { t: names, tf: "7d" });
      const rows = d.analytics.historicalOpenInterest || [];
      need.forEach(([c], i) => {
        const nm = names[i], pts = rows.filter(r => r[nm] != null && now - r.timestamp <= 26 * 36e5).map(r => [r.timestamp, +r[nm]]).sort((a, b) => a[0] - b[0]);
        const own = ST.oi[c] || [], first = own.length ? own[0][0] : Infinity;
        ST.oi[c] = [...pts.filter(p => p[0] < first - 30 * 6e4), ...own];
        ST.oiBack[c] = now;
      });
    } catch (e) { console.error("oi history:", e.message); }
  }

  // Liquidations by market
  const LQ = {};
  for (const w of [1, 4, 24]) {
    try {
      const d = await hd(`query($w:Int,$l:Int){liquidationTotals(windowHours:$w,limit:$l){market longNotional shortNotional totalNotional events}}`, { w, l: 400 });
      for (const r of d.liquidationTotals || []) { const k = keyOf(r.market); (LQ[k] = LQ[k] || {})["L" + w] = Math.round(+r.longNotional || 0); LQ[k]["S" + w] = Math.round(+r.shortNotional || 0); }
    } catch (e) { console.error("liquidations:", e.message); }
  }

  // Score every liquid market
  const M = {};
  for (const [c, x] of Object.entries(latest.ctx)) {
    if (!latest.m[c] || !(x.v >= MIN_VOL) || !x.px) continue;
    const y = CY.m[c] || {};
    const sd = y.v30 != null ? y.v30 / Math.sqrt(365) : c.includes(":") ? 2.2 : 4.5;
    const lq = LQ[c] || {};
    const vr = y.vAvg30 ? x.v / y.vAvg30 : null;
    const ma20 = y.ma20, vs20 = ma20 ? (x.px / ma20 - 1) * 100 : null;
    const inp = {
      r1: retOver(snaps, c, 1, x.px), r4: retOver(snaps, c, 4, x.px), r24: x.ch, sd, f: x.f * 24 * 365 * 100,
      oi4: oiChange(ST.oi[c], 4), oi24: oiChange(ST.oi[c], 24), oi: x.oi,
      lqL24: lq.L24, lqS24: lq.S24, lqL4: lq.L4, lqS4: lq.S4, lqL1: lq.L1, lqS1: lq.S1, vr, rsi: y.rsi, vs20, pos90: y.pos90
    };
    const s = scoreMarket(inp);
    M[c] = { fr: s.fr, bb: s.bb, z1: s.z1, z4: s.z4, z24: s.z24, r1: r1(inp.r1), r4: r1(inp.r4), r24: r1(inp.r24), sd: r1(sd), f: r1(inp.f),
      oi4: r1(inp.oi4), oi24: r1(inp.oi24), oiUsd: x.oi, lqL1: lq.L1 || 0, lqS1: lq.S1 || 0, lqL4: lq.L4 || 0, lqS4: lq.S4 || 0, lqL24: lq.L24 || 0, lqS24: lq.S24 || 0,
      vr: r1(vr), rsi: r1(y.rsi), vs20: r1(vs20), pos90: y.pos90, vol: x.v,
      cf: Object.fromEntries(Object.entries(s.cf).map(([k, v]) => [k, Math.round(v * 100) / 100])), cb: Object.fromEntries(Object.entries(s.cb).map(([k, v]) => [k, Math.round(v * 100) / 100])) };
  }

  // Market-wide
  const list = Object.entries(M), big = list.filter(([, v]) => v.vol >= 10e6);
  const share = (k, th) => big.length ? Math.round(big.filter(([, v]) => v[k] >= th).length / big.length * 100) : 0;
  const mkt = { n: big.length, frothy: big.filter(([, v]) => v.fr >= 55).length, bloody: big.filter(([, v]) => v.bb >= 55).length, frPct: share("fr", 40), bbPct: share("bb", 40),
    lqL24: list.reduce((a, [, v]) => a + v.lqL24, 0), lqS24: list.reduce((a, [, v]) => a + v.lqS24, 0), lqL1: list.reduce((a, [, v]) => a + v.lqL1, 0), lqS1: list.reduce((a, [, v]) => a + v.lqS1, 0),
    btcFr: M.BTC ? M.BTC.fr : null, btcBb: M.BTC ? M.BTC.bb : null };
  mkt.state = mkt.bbPct >= 30 || (mkt.btcBb != null && mkt.btcBb >= 60) ? "Market-wide bloodbath" : mkt.frPct >= 30 || (mkt.btcFr != null && mkt.btcFr >= 60) ? "Market-wide froth" : mkt.bbPct >= 15 ? "Selling pressure" : mkt.frPct >= 15 ? "Heating up" : "Normal";

  // Events and alerts
  const evs = [];
  const site = process.env.SITE_URL || "";
  const instH = io.read("instruments.json", null);
  for (const [c, v] of list) for (const kind of ["fr", "bb"]) {
    if (!fidelityOK(c, instH)) continue;
    const sc = v[kind], key = c + "|" + kind, prev = ST.last[key];
    if (sc < ALERT_MIN) { if (prev && sc < ALERT_MIN - 15) delete ST.last[key]; continue; }
    if (prev && now - prev.t < 6 * 36e5 && sc < prev.s + 15) continue;
    ST.last[key] = { t: now, s: sc };
    const up = kind === "fr";
    const parts = [`${up ? "+" : ""}${v.r24 != null ? v.r24 : "?"}% 24h${v.r4 != null ? `, ${v.r4 > 0 ? "+" : ""}${v.r4}% 4h` : ""} (${Math.abs(up ? v.z24 : v.z24).toFixed(1)}× its normal daily move)`];
    if (Math.abs(v.f) >= 20) parts.push(`funding ${v.f > 0 ? "+" : ""}${Math.round(v.f)}%/yr (${v.f > 0 ? "longs" : "shorts"} pay)`);
    if (v.oi24 != null && Math.abs(v.oi24) >= 8) parts.push(`open interest ${v.oi24 > 0 ? "+" : ""}${Math.round(v.oi24)}% in 24h`);
    const lq = up ? v.lqS24 : v.lqL24; if (lq >= 50000) parts.push(`$${(lq / 1e6).toFixed(2)}M of ${up ? "shorts" : "longs"} liquidated in 24h`);
    if (v.rsi != null) parts.push(`RSI ${Math.round(v.rsi)}`);
    if (v.vr != null && v.vr >= 2) parts.push(`volume ${v.vr.toFixed(1)}× normal`);
    const e = { t: new Date().toISOString(), coin: c, type: up ? "froth" : "bloodbath", score: sc, lvl: level(sc, kind), text: parts.join(", ") + "." };
    evs.push(e);
  }
  const prevState = HT.mkt && HT.mkt.state;
  if (mkt.state !== prevState && /Market-wide/.test(mkt.state) && !(ST.lastMkt && now - ST.lastMkt < 4 * 36e5 && ST.lastMktState === mkt.state)) {
    evs.push({ t: new Date().toISOString(), coin: "MARKET", type: /blood/.test(mkt.state) ? "bloodbath" : "froth", score: /blood/.test(mkt.state) ? mkt.bbPct : mkt.frPct, lvl: mkt.state,
      text: `${/blood/.test(mkt.state) ? mkt.bbPct : mkt.frPct}% of liquid markets are ${/blood/.test(mkt.state) ? "selling off hard" : "frothy"}. Liquidated in 24h: $${(mkt.lqL24 / 1e6).toFixed(1)}M longs, $${(mkt.lqS24 / 1e6).toFixed(1)}M shorts.` });
    ST.lastMkt = now; ST.lastMktState = mkt.state;
  }
  if ((process.env.NTFY_TOPIC || process.env.DISCORD_WEBHOOK_URL) && evs.length) {
    for (const e of evs.sort((a, b) => b.score - a.score).slice(0, 5)) {
      if (!ALERT_TYPES.has(e.type)) continue;
      try { await notify(`${e.type === "froth" ? "Froth" : "Bloodbath"}: ${e.coin === "MARKET" ? e.lvl : `${e.coin} · ${e.lvl} ${e.score}`}`, e.text, e.type === "froth" ? "fire" : "drop_of_blood", site); }
      catch (err) { console.error("heat alert:", err.message); }
    }
  }
  HT.ev = [...evs, ...HT.ev].filter(e => now - Date.parse(e.t) < 3 * 864e5).slice(0, 400);
  for (const k in ST.last) if (now - ST.last[k].t > 2 * 864e5) delete ST.last[k];
  for (const c in ST.oi) if (!latest.ctx[c]) delete ST.oi[c];
  Object.assign(HT, { t: new Date().toISOString(), dataT: latest.t, m: M, mkt });
  io.write("heat.json", HT); io.write("heatstate.json", ST);
  console.log(`Heat: ${list.length} markets, ${mkt.frothy} frothy, ${mkt.bloody} bloodbath, state ${mkt.state}, ${evs.length} events`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch(e => { console.error(e); process.exit(1); });
