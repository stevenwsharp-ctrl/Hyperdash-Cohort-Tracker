// How good and bad traders hold each coin: leverage, entry, liquidation price, stops and targets.
// Uses the public Hyperliquid info API for the top holders found by specialists.mjs.
// "Good" = Extremely/Very Profitable cohort or a coin specialist. "Bad" = Unprofitable/Very Unprofitable/Rekt or loses on this coin.
// One market per run (about every 45 s), each refreshed about every 20 minutes.
// History per trader (cached 24 hours): from the last 100 closed trades (Hyperdash), how far price usually goes
// against them before they close a loser ("loss cut"), what they take on winners, and how often they were
// liquidated in the last 60 days (Hyperliquid fills). The loss cut gives an implied stop for each open position.
// Exit code 0 = updated. Exit code 3 = nothing to do.
// Usage: node scripts/levels.mjs <outDir>
import { http, makeIO, score } from "./lib.mjs";

const OUT = process.argv[2] || "out";
const io = makeIO(OUT);
const REFRESH_MIN = 20, HIST_PER_RUN = 4, HIST_TTL_H = 24, LIQ_DAYS = 60;
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
const med = a => { const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const hd = (query, variables) => http("https://api.hyperdash.com/graphql", {
  method: "POST", tries: 1, timeoutMs: 20000,
  headers: { "content-type": "application/json", origin: "https://hyperdash.com", referer: "https://hyperdash.com/" },
  body: JSON.stringify({ query, variables })
}).then(j => { if (j.errors) throw new Error(j.errors[0].message); return j.data; });

// Typical loss cut / win take (in % of price) from completed trades.
export function behaviour(trades, coin) {
  const mv = t => {
    const e = +t.avgEntryPx, x = +t.avgExitPx; if (!(e > 0 && x > 0)) return null;
    const m = (x / e - 1) * (/short/i.test(t.direction) ? -1 : 1) * 100;
    return Math.abs(m) < 95 ? m : null;
  };
  const all = trades.map(t => ({ m: mv(t), p: +t.netPnl || 0, c: t.coin, d: +t.durationMins || 0 })).filter(t => t.m != null);
  const lose = all.filter(t => t.p < 0), win = all.filter(t => t.p > 0), own = lose.filter(t => t.c === coin);
  const sorted = lose.map(t => -t.m).sort((a, b) => a - b);
  return {
    lc: r2(med(lose.map(t => -t.m))), lc90: sorted.length >= 5 ? r2(sorted[Math.floor(sorted.length * 0.9)]) : null,
    wt: r2(med(win.map(t => t.m))), hold: med(all.map(t => t.d)), nT: all.length, nL: lose.length,
    lcC: own.length >= 3 ? r2(med(own.map(t => -t.m))) : null
  };
}
// Liquidation events where this user was the one liquidated (other fills with a liquidation tag are liquidators).
export function liqStats(fills, user) {
  const u = user.toLowerCase(), ev = new Map();
  for (const f of fills) {
    if (!f.liquidation || String(f.liquidation.liquidatedUser || "").toLowerCase() !== u) continue;
    const k = f.coin + "|" + Math.floor(f.time / 6e4);
    const e = ev.get(k) || { coin: f.coin, t: f.time, usd: 0 }; e.usd += Math.abs(+f.closedPnl || 0); ev.set(k, e);
  }
  const list = [...ev.values()];
  return { lq: list.length, lqUsd: Math.round(list.reduce((a, e) => a + e.usd, 0)), lqLast: list.length ? Math.max(...list.map(e => e.t)) : null, lqCoins: [...new Set(list.map(e => e.coin))].slice(0, 6) };
}
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
    const s = G[key] = G[key] || { n: 0, cnt: 0, lev: 0, eff: 0, ent: 0, under: 0, stopN: 0, stopD: [], liqD: [], tpD: [], liq: [], stops: [], ents: [], tps: [], ids: new Set(),
      istops: [], istopD: [], lc: [], wt: [], hold: [], histCnt: 0, liqCnt: 0, liqEv: 0 };
    const ent = h.k ? "k" + h.k : h.a;
    if (!s.ids.has(ent)) {
      s.ids.add(ent); s.cnt++;
      if (l.lc != null || l.lq60 != null) s.histCnt++;
      if (l.lc != null) { s.lc.push(l.lcC != null ? l.lcC : l.lc); if (l.wt != null) s.wt.push(l.wt); if (l.hold != null) s.hold.push(l.hold); }
      if (l.lq60) { s.liqCnt++; s.liqEv += l.lq60; }
    }
    s.n += n; s.lev += (l.lev || 0) * n; s.eff += (l.eff || 0) * n; s.ent += (l.ep || 0) * n;
    if ((l.u || 0) < 0) s.under += n;
    const sgn = side === "long" ? 1 : -1; // loss direction: long loses when price falls
    const toLoss = p => p ? sgn * (px - p) / px * 100 : null;
    if (l.lq) { s.liqD.push([toLoss(l.lq), n]); s.liq.push([l.lq, Math.round(n)]); }
    if (l.st && l.st.length) { s.stopN += n; s.stopD.push([toLoss(sgn > 0 ? Math.max(...l.st) : Math.min(...l.st)), n]); l.st.forEach(p => s.stops.push([p, Math.round(n)])); }
    (l.tp || []).forEach(p => { s.tps.push([p, Math.round(n)]); s.tpD.push([-toLoss(p), n]); });
    if (l.is) { s.istops.push([l.is, Math.round(n)]); s.istopD.push([toLoss(l.is), n]); }
    s.ents.push([l.ep, Math.round(n)]);
  }
  const out = {};
  for (const [k, s] of Object.entries(G)) {
    out[k] = {
      cnt: s.cnt, n: Math.round(s.n), lev: r2(s.lev / s.n), eff: r2(s.eff / s.n), ep: +(s.ent / s.n).toPrecision(6),
      under: Math.round(s.under / s.n * 100), stopCov: Math.round(s.stopN / s.n * 100), stopD: r2(wmed(s.stopD)), liqD: r2(wmed(s.liqD)), tpD: r2(wmed(s.tpD)),
      liq: s.liq, stops: s.stops, ents: s.ents, tps: s.tps,
      istops: s.istops, istopD: r2(wmed(s.istopD)), lc: r2(med(s.lc)), wt: r2(med(s.wt)), hold: med(s.hold),
      hist: s.histCnt, liqTr: s.histCnt ? Math.round(s.liqCnt / s.histCnt * 100) : null, liqAvg: s.histCnt ? r2(s.liqEv / s.histCnt) : null
    };
  }
  // Liquidation fuel: positions of the bad (and middle) traders on the fools' side that get liquidated or stopped
  // if price moves 10% the smart way. Their forced closes push price further in the smart direction.
  const foolSide = dir > 0 ? "short" : "long";
  let fuel = 0, tot = 0, risk = 0, fuelI = 0;
  for (const h of holders) {
    const l = L[h.a]; if (!l || !l.sz) continue;
    const n = Math.abs(l.sz) * px; tot += n;
    const side = l.sz > 0 ? "long" : "short", sgn = side === "long" ? 1 : -1;
    const g = groupOf(h);
    const near = p => p && sgn * (px - p) / px * 100 <= 10 && sgn * (px - p) / px * 100 >= 0;
    if (side === foolSide && g !== "good" && (near(l.lq) || (l.st || []).some(near))) fuel += n;
    else if (side === foolSide && g !== "good" && near(l.is)) fuelI += n; // usual loss-cut level (no order on the book)
    const nearRisk = p => p && sgn * (px - p) / px * 100 <= 7 && sgn * (px - p) / px * 100 >= 0;
    if (side !== foolSide && g === "good" && nearRisk(l.lq)) risk += n;
  }
  return { px, dir, groups: out, fuelUsd: Math.round(fuel), fuelPct: tot ? Math.round(fuel / tot * 100) : 0, fuelIUsd: Math.round(fuelI), fuelIPct: tot ? Math.round(fuelI / tot * 100) : 0,
    riskUsd: Math.round(risk), riskPct: tot ? Math.round(risk / tot * 100) : 0 };
}

async function main() {
  const latest = io.read("latest.json", null), SP = io.read("specialists.json", null);
  if (!latest || !SP) process.exit(3);
  const LV = io.read("levels.json", { m: {} }), TC = io.read("tcache.json", {});
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
  // History lookups: biggest stale holders first, a few per run
  let hist = 0;
  const backoff = TC.__bo && now < TC.__bo;
  for (const h of holders.slice().sort((a, b) => b.n - a.n)) {
    if (hist >= HIST_PER_RUN || backoff) break;
    const c = TC[h.a]; if (c && now - c.t < HIST_TTL_H * 36e5) continue;
    hist++;
    try {
      const d = await hd(`query($a:String!,$p:Int,$s:Int){getTraderCompletedTrades(address:$a,page:$p,pageSize:$s){trades{coin direction durationMins avgEntryPx avgExitPx netPnl}}}`, { a: h.a, p: 1, s: 100 });
      const trades = (d.getTraderCompletedTrades && d.getTraderCompletedTrades.trades) || [];
      await sleep(250);
      const fills = await post({ type: "userFillsByTime", user: h.a, startTime: now - LIQ_DAYS * 864e5, aggregateByTime: true });
      TC[h.a] = { t: now, b: trades, ...liqStats(Array.isArray(fills) ? fills : [], h.a), cap: Array.isArray(fills) && fills.length >= 2000 ? 1 : undefined };
      await sleep(300);
    } catch (e) {
      console.error("history", h.a.slice(0, 8), e.message);
      if (/429|too many|rate/i.test(e.message)) { TC.__bo = now + 3 * 6e4; break; }
    }
  }
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
          else if (Math.abs(pxo - px) / px < 0.005) continue;       // quotes at the price (market making), not a target or stop
          else if (side > 0 ? pxo > px : pxo < px) l.tp.push(pxo);  // closing limit in profit = target
          else l.st.push(pxo);                                       // closing limit in loss = stop-like
        }
      } catch (e) { console.error("orders", h.a.slice(0, 8), e.message); }
      for (const k of ["st", "tp", "add"]) { l[k] = [...new Set(l[k].map(x => +x.toPrecision(6)))].slice(0, 6); if (!l[k].length) delete l[k]; }
      const c = TC[h.a];
      if (c) {
        const b = behaviour(c.b || [], hlCoin);
        Object.assign(l, { lc: b.lc, lc90: b.lc90, wt: b.wt, hold: b.hold, nT: b.nT, lq60: c.lq, lqUsd: c.lqUsd, lqLast: c.lqLast, lqCoins: c.lqCoins, lqCap: c.cap });
        if (b.lcC != null) l.lcC = b.lcC;
        const cut = b.lcC != null ? b.lcC : b.lc;
        // Implied stop: entry moved by the usual loss cut. Only when it is still ahead (not already passed).
        const scalper = b.lc != null && b.lc < 0.5 && b.hold != null && b.hold < 120; // market maker / scalper: no stop level
        if (!scalper && cut != null && cut >= 0.3 && l.ep) {
          const is = l.ep * (1 - side * cut / 100);
          if (side > 0 ? is < px : is > px) l.is = +is.toPrecision(6);
        }
      }
      L[h.a] = l;
    } catch (e) { console.error("state", h.a.slice(0, 8), e.message); }
    await sleep(80);
  }
  const sc = score(latest, coin);
  LV.m[coin] = { t: new Date().toISOString(), h: L, ...summarize(holders, L, px, sc.dir) };
  for (const c in LV.m) if (now - Date.parse(LV.m[c].t) > 6 * 36e5) delete LV.m[c];
  for (const a in TC) if (a !== "__bo" && now - TC[a].t > 3 * 864e5) delete TC[a];
  // Keep only the trades needed (coin, side, prices, PnL, duration) to limit file size
  for (const a in TC) if (TC[a].b) TC[a].b = TC[a].b.map(t => ({ coin: t.coin, direction: t.direction, durationMins: t.durationMins, avgEntryPx: +(+t.avgEntryPx).toPrecision(6), avgExitPx: +(+t.avgExitPx).toPrecision(6), netPnl: Math.round(+t.netPnl) }));
  LV.t = new Date().toISOString();
  io.write("levels.json", LV); io.write("tcache.json", TC);
  console.log(`Levels: ${coin} (${Object.keys(L).length} positions, ${hist} histories)`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch(e => { console.error(e); process.exit(1); });
