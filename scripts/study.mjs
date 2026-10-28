// Trader study for one market: find the wallets that trade it, rebuild every SOXL (or other) trade from fills,
// and save per-trader trades + market candles for analysis.
// Candidates: wallets with a position change in the last 7 days (Hyperdash perpDeltas) + the biggest / most profitable /
// least profitable current holders. Fills come from Hyperliquid (userFillsByTime, paged, only this coin kept).
// Output: <outDir>/study-<COIN>.json
// Usage: node scripts/study.mjs <outDir> xyz:SOXL
import fs from "node:fs";
import path from "node:path";
import { http } from "./lib.mjs";

const OUT = process.argv[2] || "study";
const COIN = process.argv[3] || "xyz:SOXL";
const DEX = COIN.includes(":") ? COIN.split(":")[0] : "";
const MIN_UNITS = +process.env.STUDY_MIN_UNITS || 40;    // skip wallets whose 7-day change and position are both tiny
const MAX_MIN = +process.env.STUDY_MAX_MIN || 100;
fs.mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

let wUsed = 0, wStart = Date.now();
async function pace(w) { const el = (Date.now() - wStart) / 6e4; if (el >= 1) { wStart = Date.now(); wUsed = 0; } wUsed += w; if (wUsed > 950) { await sleep((1 - el) * 6e4 + 500); wStart = Date.now(); wUsed = w; } }
async function hl(body, per = 0, base = 20) {
  await pace(base);
  for (let i = 0; i < 4; i++) {
    try { const r = await http("https://api.hyperliquid.xyz/info", { method: "POST", tries: 1, timeoutMs: 30000, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (per && Array.isArray(r)) wUsed += Math.ceil(r.length / per); return r; }
    catch (e) { if (/429/.test(e.message)) { log("429"); await sleep(30000); wStart = Date.now(); wUsed = 0; } else if (i === 3) throw e; else await sleep(2000); }
  }
}
const hd = (query, variables) => http("https://api.hyperdash.com/graphql", { method: "POST", tries: 3, timeoutMs: 30000,
  headers: { "content-type": "application/json", origin: "https://hyperdash.com", referer: "https://hyperdash.com/" }, body: JSON.stringify({ query, variables }) })
  .then(j => { if (j.errors) throw new Error(j.errors[0].message); return j.data; });

async function main() {
  const t0 = Date.now();
  // Candidates
  const cand = new Map();
  const d = await hd(`query($m:String!){perpDeltas(market:$m,timeframe:SEVEN_DAYS){deltas{address current delta}}}`, { m: COIN });
  for (const x of d.perpDeltas.deltas) if (Math.max(Math.abs(+x.current), Math.abs(+x.delta)) >= MIN_UNITS) cand.set(x.address, { a: x.address, cur: +x.current, d7: +x.delta, src: "7d" });
  for (const sort of ["{field:notional,order:desc}", "{field:unrealizedPnl,order:desc}", "{field:unrealizedPnl,order:asc}"]) {
    const p = await hd(`query($coin:String!){analytics{p:perpsTickerPositions(coin:$coin,limit:30,offset:0,sortBy:${sort}){totalCount positions{address label size notionalSize unrealizedPnl}}}}`, { coin: COIN });
    for (const x of p.analytics.p.positions) { const o = cand.get(x.address) || { a: x.address, src: "holder" }; o.label = x.label || o.label; o.cur = +x.size; cand.set(x.address, o); }
    await sleep(300);
  }
  log(`Candidates: ${cand.size} (all 7-day movers with ${MIN_UNITS}+ units, plus top holders)`);
  // Cohort info (Hyperdash, batched)
  const addrs = [...cand.keys()];
  for (let i = 0; i < addrs.length; i += 50) {
    try { const t = await hd(`query($a:[String!]!){getTraders(addresses:$a){address label pnl pnlCohort sizeCohort winrate totalTrades}}`, { a: addrs.slice(i, i + 50) });
      for (const x of t.getTraders || []) Object.assign(cand.get(x.address), { label: x.label || cand.get(x.address).label, pnl: +x.pnl || 0, coh: x.pnlCohort, size: x.sizeCohort, wr: +x.winrate || 0, tt: +x.totalTrades || 0 }); }
    catch (e) { log("getTraders", e.message); }
    await sleep(300);
  }
  // Fills for this coin (paged from the listing; Hyperliquid keeps the last 10,000 fills per wallet)
  const START = Date.parse(process.env.STUDY_FROM || "2025-01-01");
  const out = [];
  let n = 0;
  for (const c of cand.values()) {
    if ((Date.now() - t0) / 6e4 > MAX_MIN) { log("time budget reached"); break; }
    let start = START, fills = [], all = 0, first = null, trunc = false;
    for (let page = 0; page < 6; page++) {
      const f = await hl({ type: "userFillsByTime", user: c.a, startTime: start, aggregateByTime: true }, 20);
      if (!Array.isArray(f) || !f.length) break;
      all += f.length; if (first == null) first = f[0].time;
      for (const x of f) if (x.coin === COIN) fills.push([x.time, x.side === "B" ? 1 : -1, +x.px, +x.sz, +x.startPosition, +x.closedPnl || 0, +x.fee || 0, x.dir, x.crossed ? 1 : 0, x.liquidation ? 1 : 0]);
      if (f.length < 2000) break;
      start = f[f.length - 1].time + 1;
      if (page === 5) trunc = true;
    }
    if (all >= 2000 && first > START + 5 * 864e5) trunc = true;   // only recent fills exist (very active wallet)
    let state = null;
    try { const cs = await hl({ type: "clearinghouseState", user: c.a, ...(DEX ? { dex: DEX } : {}) }, 0, 2); const p = (cs.assetPositions || []).map(x => x.position).find(x => x.coin === COIN);
      if (p) state = { szi: +p.szi, ep: +p.entryPx, lev: p.leverage ? +p.leverage.value : null, lt: p.leverage ? p.leverage.type : null, lq: p.liquidationPx ? +p.liquidationPx : null, u: +p.unrealizedPnl || 0, av: +((cs.marginSummary || {}).accountValue || 0) }; } catch { }
    let orders = [];
    if (state) try { const oo = await hl({ type: "frontendOpenOrders", user: c.a, ...(DEX ? { dex: DEX } : {}) }, 0, 20);
      orders = (oo || []).filter(o => o.coin === COIN).map(o => [o.orderType, o.side, +(o.triggerPx || o.limitPx), +o.sz, o.reduceOnly ? 1 : 0, o.isTrigger ? 1 : 0]); } catch { }
    if (fills.length || state) out.push({ ...c, fills, state, orders, trunc: trunc || undefined, otherFills: all - fills.length });
    if (++n % 100 === 0) log(`wallets: ${n}/${cand.size}, with ${COIN} history: ${out.length}`);
  }
  // Market candles
  const name = COIN;
  const h1 = await hl({ type: "candleSnapshot", req: { coin: name, interval: "1h", startTime: Date.now() - 200 * 864e5, endTime: Date.now() } }, 60);
  const d1 = await hl({ type: "candleSnapshot", req: { coin: name, interval: "1d", startTime: Date.now() - 400 * 864e5, endTime: Date.now() } }, 60);
  const fund = [];
  for (let s = Date.now() - 90 * 864e5, i = 0; i < 6; i++) { const f = await hl({ type: "fundingHistory", coin: name, startTime: s }, 20); if (!Array.isArray(f) || !f.length) break; f.forEach(x => fund.push([x.time, +x.fundingRate])); if (f.length < 500) break; s = f[f.length - 1].time + 1; }
  const res = { t: new Date().toISOString(), coin: COIN, candidates: cand.size, traders: out, h1: (h1 || []).map(k => [k.t, +k.o, +k.h, +k.l, +k.c, +k.v]), d1: (d1 || []).map(k => [k.t, +k.o, +k.h, +k.l, +k.c, +k.v]), fund, minutes: Math.round((Date.now() - t0) / 6e4) };
  const file = path.join(OUT, `study-${COIN.replace(/[:/]/g, "_")}.json`);
  fs.writeFileSync(file, JSON.stringify(res));
  log(`Done: ${out.length} wallets with history, ${(fs.statSync(file).size / 1e6).toFixed(1)} MB, ${res.minutes} min`);
}
main().catch(e => { console.error(e); process.exit(1); });
