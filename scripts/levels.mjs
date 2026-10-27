// How good and bad traders hold each coin: leverage, entry, liquidation price, stops and targets.
// Uses the public Hyperliquid info API for the top holders found by specialists.mjs.
// "Good" = Extremely/Very Profitable cohort or a coin specialist. "Bad" = Unprofitable/Very Unprofitable/Rekt or loses on this coin.
// One market per run (about every 45 s), each refreshed about every 20 minutes.
// Exit code 0 = updated. Exit code 3 = nothing to do.
// Usage: node scripts/levels.mjs <outDir>
import { http, makeIO, score } from "./lib.mjs";

const OUT = process.argv[2] || "out";
const io = makeIO(OUT);
const REFRESH_MIN = 20;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const post = body => http("https://api.hyperliquid.xyz/info", { method: "POST", tries: 2, timeoutMs: 15000, body: JSON.stringify(body), headers: { "content-type": "application/json" } });

export function groupOf(h) {
  if (h.q >= 0.25) return "good";
  if (h.q <= -0.25) return "bad";
  if (h.coh === "EP" || h.coh === "VP") return "good";
  if (h.coh === "U" || h.coh === "VU" || h.coh === "R") return "bad";
  return "mid";
}
const r2 = x => x == null || !isFinite(x) ? null : Math.round(x * 100) / 100;
const wmed = (arr) => { // weighted median of [value, weight]
  const a = arr.filter(x => x[0] != null && isFinite(x[0])).sort((p, q) => p[0] - q[0]);
  const tot = a.reduce((s, x) => s + x[1], 0); let c = 0;
  for (const x of a) { c += x[1]; if (c >= tot / 2) return x[0]; }
  return null;
};

// Distances are in % of price, signed toward a LOSS for that position (positive = how far price must move against them).
export function summarize(holders, L, px, dir) {
  const G = {};
  for (const h of holders) {
    const l = L[h.a]; if (!l || !l.sz) continue;
    const g = groupOf(h), side = l.sz > 0 ? "long" : "short", key = g + "_" + side;
    const n = Math.abs(l.sz) * px;
    const s = G[key] = G[key] || { n: 0, cnt: 0, lev: 0, eff: 0, ent: 0, under: 0, stopN: 0, stopD: [], liqD: [], tpD: [], liq: [], stops: [], ents: [], tps: [], ids: new Set() };
    const ent = h.k ? "k" + h.k : h.a;
    if (!s.ids.has(ent)) { s.ids.add(ent); s.cnt++; }
    s.n += n; s.lev += (l.lev || 0) * n; s.eff += (l.eff || 0) * n; s.ent += (l.ep || 0) * n;
    if ((l.u || 0) < 0) s.under += n;
    const sgn = side === "long" ? 1 : -1; // loss direction: long loses when price falls
    const toLoss = p => p ? sgn * (px - p) / px * 100 : null;
    if (l.lq) { s.liqD.push([toLoss(l.lq), n]); s.liq.push([l.lq, Math.round(n)]); }
    if (l.st && l.st.length) { s.stopN += n; s.stopD.push([toLoss(sgn > 0 ? Math.max(...l.st) : Math.min(...l.st)), n]); l.st.forEach(p => s.stops.push([p, Math.round(n)])); }
    (l.tp || []).forEach(p => { s.tps.push([p, Math.round(n)]); s.tpD.push([-toLoss(p), n]); });
    s.ents.push([l.ep, Math.round(n)]);
  }
  const out = {};
  for (const [k, s] of Object.entries(G)) {
    out[k] = {
      cnt: s.cnt, n: Math.round(s.n), lev: r2(s.lev / s.n), eff: r2(s.eff / s.n), ep: +(s.ent / s.n).toPrecision(6),
      under: Math.round(s.under / s.n * 100), stopCov: Math.round(s.stopN / s.n * 100), stopD: r2(wmed(s.stopD)), liqD: r2(wmed(s.liqD)), tpD: r2(wmed(s.tpD)),
      liq: s.liq, stops: s.stops, ents: s.ents, tps: s.tps
    };
  }
  // Liquidation fuel: positions of the bad (and middle) traders on the fools' side that get liquidated or stopped
  // if price moves 10% the smart way. Their forced closes push price further in the smart direction.
  const foolSide = dir > 0 ? "short" : "long";
  let fuel = 0, tot = 0, risk = 0;
  for (const h of holders) {
    const l = L[h.a]; if (!l || !l.sz) continue;
    const n = Math.abs(l.sz) * px; tot += n;
    const side = l.sz > 0 ? "long" : "short", sgn = side === "long" ? 1 : -1;
    const g = groupOf(h);
    const near = p => p && sgn * (px - p) / px * 100 <= 10 && sgn * (px - p) / px * 100 >= 0;
    if (side === foolSide && g !== "good" && (near(l.lq) || (l.st || []).some(near))) fuel += n;
    const nearRisk = p => p && sgn * (px - p) / px * 100 <= 7 && sgn * (px - p) / px * 100 >= 0;
    if (side !== foolSide && g === "good" && nearRisk(l.lq)) risk += n;
  }
  return { px, dir, groups: out, fuelUsd: Math.round(fuel), fuelPct: tot ? Math.round(fuel / tot * 100) : 0, riskUsd: Math.round(risk), riskPct: tot ? Math.round(risk / tot * 100) : 0 };
}

async function main() {
  const latest = io.read("latest.json", null), SP = io.read("specialists.json", null);
  if (!latest || !SP) process.exit(3);
  const LV = io.read("levels.json", { m: {} });
  const now = Date.now();
  const cands = Object.keys(SP.m).filter(c => SP.m[c].holders && SP.m[c].holders.length);
  const due = cands.filter(c => !LV.m[c] || now - Date.parse(LV.m[c].t) > REFRESH_MIN * 6e4)
    .sort((a, b) => (LV.m[a] ? Date.parse(LV.m[a].t) : 0) - (LV.m[b] ? Date.parse(LV.m[b].t) : 0));
  if (!due.length) { console.log("Levels: nothing due"); process.exit(3); }
  const coin = due[0];
  const ctx = latest.ctx && latest.ctx[coin];
  const hlCoin = ctx && ctx.n ? ctx.n : coin.includes(":") ? coin.split(":")[0].toLowerCase() + ":" + coin.split(":")[1] : coin;
  const dex = hlCoin.includes(":") ? hlCoin.split(":")[0] : "";
  const px = ctx ? ctx.px : null;
  if (!px) { LV.m[coin] = { t: new Date().toISOString(), none: true }; io.write("levels.json", LV); process.exit(0); }
  const holders = SP.m[coin].holders;
  const L = {};
  for (const h of holders) {
    try {
      const cs = await post({ type: "clearinghouseState", user: h.a, dex });
      const p = (cs.assetPositions || []).map(x => x.position).find(x => x.coin === hlCoin);
      if (!p) { await sleep(40); continue; }
      const sz = +p.szi, side = sz > 0 ? 1 : -1;
      const av = +((cs.marginSummary || {}).accountValue || 0);
      const l = {
        sz, ep: +p.entryPx, lev: p.leverage ? +p.leverage.value : null, lt: p.leverage && p.leverage.type === "isolated" ? "i" : "c",
        lq: p.liquidationPx ? +(+p.liquidationPx).toPrecision(6) : null, mu: Math.round(+p.marginUsed || 0), u: Math.round(+p.unrealizedPnl || 0),
        av: Math.round(av), eff: av > 0 ? r2(Math.abs(+p.positionValue) / av) : null, st: [], tp: [], add: []
      };
      try {
        const oo = await post({ type: "frontendOpenOrders", user: h.a, dex });
        for (const o of oo || []) {
          if (o.coin !== hlCoin) continue;
          const oside = o.side === "B" ? 1 : -1, closing = oside === -side || o.reduceOnly;
          const pxo = +(o.isTrigger ? o.triggerPx : o.limitPx);
          if (!pxo) continue;
          if (!closing) l.add.push(pxo);
          else if (/stop/i.test(o.orderType || "")) l.st.push(pxo);
          else if (/take profit/i.test(o.orderType || "")) l.tp.push(pxo);
          else if (side > 0 ? pxo > px : pxo < px) l.tp.push(pxo);  // closing limit in profit = target
          else l.st.push(pxo);                                       // closing limit in loss = stop-like
        }
      } catch (e) { console.error("orders", h.a.slice(0, 8), e.message); }
      for (const k of ["st", "tp", "add"]) { l[k] = [...new Set(l[k].map(x => +x.toPrecision(6)))].slice(0, 6); if (!l[k].length) delete l[k]; }
      L[h.a] = l;
    } catch (e) { console.error("state", h.a.slice(0, 8), e.message); }
    await sleep(80);
  }
  const sc = score(latest, coin);
  LV.m[coin] = { t: new Date().toISOString(), h: L, ...summarize(holders, L, px, sc.dir) };
  for (const c in LV.m) if (now - Date.parse(LV.m[c].t) > 6 * 36e5) delete LV.m[c];
  LV.t = new Date().toISOString();
  io.write("levels.json", LV);
  console.log(`Levels: ${coin} (${Object.keys(L).length} positions)`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch(e => { console.error(e); process.exit(1); });
