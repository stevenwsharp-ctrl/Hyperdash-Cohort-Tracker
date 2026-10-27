// Order flow, liquidation map and volume profile for the markets in focus
// (the top setups by score, plus markets with froth / bloodbath 40+).
//   Liquidation map: resting liquidation $ of ALL positions on Hyperliquid (Hyperdash), in price windows
//     0-2%, 2-5%, 5-10%, 10-20%, 20-30% below (longs) and above (shorts) the price, plus the biggest single levels.
//     "Max pain" = the price on each side where liquidations pile up the most per % of price move.
//   Taker flow (CVD): hourly aggressive buy minus sell $ (Hyperdash), summed over 1h / 4h / 24h.
//   Volume profile: 30-day and 7-day volume by price from hourly candles (Hyperliquid): point of control (POC),
//     value area (70% of volume) high / low, and thin-volume gaps near the price.
// Liquidation map + flow every ~10 min per market (4 markets per run), volume profile every 2 hours.
// Exit 0 = updated, 3 = nothing to do.  Usage: node scripts/flow.mjs <outDir>
import { http, makeIO, score } from "./lib.mjs";

const OUT = process.argv[2] || "out";
const io = makeIO(OUT);
const PER_RUN = 4, MAP_MIN = 10, VP_H = 2, FOCUS = 45;
const WIN = [[-0.02, 0], [-0.05, -0.02], [-0.1, -0.05], [-0.2, -0.1], [-0.3, -0.2], [0, 0.02], [0.02, 0.05], [0.05, 0.1], [0.1, 0.2], [0.2, 0.3]];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r4 = x => x == null || !isFinite(x) ? null : +x.toPrecision(5);

const hd = (query, variables) => http("https://api.hyperdash.com/graphql", {
  method: "POST", tries: 2, timeoutMs: 20000,
  headers: { "content-type": "application/json", origin: "https://hyperdash.com", referer: "https://hyperdash.com/" },
  body: JSON.stringify({ query, variables })
}).then(j => { if (j.errors) throw new Error(j.errors[0].message); return j.data; });
const hl = body => http("https://api.hyperliquid.xyz/info", { method: "POST", tries: 2, timeoutMs: 25000, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// ---- Liquidation map ----
async function liqMap(name, px) {
  const w = [];
  for (const [a, b] of WIN) {
    const d = await hd(`query($coin:String!,$minPrice:Float!,$maxPrice:Float!){analytics{c:currentTopLiquidations(coin:$coin,minPrice:$minPrice,maxPrice:$maxPrice,limit:3){longTotals{size count} shortTotals{size count} longs{price size} shorts{price size}}}}`,
      { coin: name, minPrice: px * (1 + a), maxPrice: px * (1 + b) });
    const c = d.analytics.c;
    const below = b <= 0;
    const tot = below ? c.longTotals : c.shortTotals, top = (below ? c.longs : c.shorts) || [];
    w.push({ a, b, usd: Math.round((+tot.size || 0) * px), n: tot.count || 0, top: top.slice(0, 3).map(t => [r4(+t.price), Math.round(+t.size * +t.price)]) });
    await sleep(120);
  }
  return w;
}
// Max pain on each side: the price zone with the densest liquidations ($ per 1% of price), mildly favouring closer zones.
// The level is the biggest single liquidation inside that zone (or the zone middle). cum = all liquidations from price up to that zone.
export function painLevels(w, px) {
  const side = (below) => {
    const ws = w.filter(x => below ? x.b <= 0 : x.a >= 0).sort((p, q) => below ? q.b - p.b : p.a - q.a);
    let cum = 0, best = null;
    for (const x of ws) {
      cum += x.usd;
      const near = below ? -x.b : x.a, far = below ? -x.a : x.b, width = (far - near) * 100;
      const dens = x.usd / width * (1 - Math.min(0.5, (near + far) / 2 / 0.6));
      if (x.usd > 0 && (!best || dens > best.dens)) {
        const top = (x.top || [])[0];
        const lvl = top ? top[0] : px * (1 + (below ? -1 : 1) * (near + far) / 2);
        best = { dens, cum, dist: Math.abs(lvl / px - 1), edge: lvl };
      }
    }
    // biggest single position level on that side within the map
    const tops = ws.flatMap(x => x.top).sort((p, q) => q[1] - p[1]);
    return { within2: ws.filter(x => (below ? -x.a : x.b) <= 0.02).reduce((s, x) => s + x.usd, 0), within5: ws.filter(x => (below ? -x.a : x.b) <= 0.05).reduce((s, x) => s + x.usd, 0),
      within10: ws.filter(x => (below ? -x.a : x.b) <= 0.1).reduce((s, x) => s + x.usd, 0), within30: ws.reduce((s, x) => s + x.usd, 0),
      pain: best ? { px: r4(best.edge), dist: Math.round(best.dist * 1000) / 10, cum: Math.round(best.cum) } : null, big: tops[0] ? { px: tops[0][0], usd: tops[0][1] } : null };
  };
  const L = side(true), S = side(false);
  const t10 = L.within10 + S.within10;
  return { long: L, short: S, asym10: t10 ? Math.round((S.within10 - L.within10) / t10 * 100) / 100 : 0 };  // + = more shorts to liquidate above (squeeze fuel up)
}

// ---- Taker flow ----
async function cvd(name) {
  const d = await hd(`query W($request: WidgetRequest!){widget(request:$request){error data{... on CvdWidgetData{granularity points{bucket cvd delta}}}}}`, { request: { id: "cvd", type: "CVD", params: { cvd: { market: name } } } });
  const p = (d.widget && d.widget.data && d.widget.data.points) || [];
  const sum = n => Math.round(p.slice(-n).reduce((s, x) => s + (+x.delta || 0), 0));
  return { d1: sum(1), d4: sum(4), d24: sum(24), d168: sum(168), h: p.slice(-48).map(x => Math.round(+x.delta || 0)) };
}

// ---- Volume profile ----
export function profile(candles, bins = 48) {
  if (!candles.length) return null;
  const lo = Math.min(...candles.map(k => +k.l)), hi = Math.max(...candles.map(k => +k.h));
  if (!(hi > lo)) return null;
  const step = (hi - lo) / bins, vol = new Array(bins).fill(0);
  for (const k of candles) {   // spread each candle's $ volume evenly over its high-low range
    const l = +k.l, h = +k.h, v = (+k.v || 0) * (+k.c || 0);
    const i0 = Math.max(0, Math.min(bins - 1, Math.floor((l - lo) / step))), i1 = Math.max(0, Math.min(bins - 1, Math.floor((h - lo) / step)));
    for (let i = i0; i <= i1; i++) vol[i] += v / (i1 - i0 + 1);
  }
  const tot = vol.reduce((a, b) => a + b, 0); if (!tot) return null;
  let poc = 0; vol.forEach((v, i) => { if (v > vol[poc]) poc = i; });
  // value area: grow from the POC toward the bigger neighbour until 70% of volume
  let a = poc, b = poc, inVA = vol[poc];
  while (inVA < tot * 0.7 && (a > 0 || b < bins - 1)) {
    const up = b < bins - 1 ? vol[b + 1] : -1, dn = a > 0 ? vol[a - 1] : -1;
    if (up >= dn) { b++; inVA += vol[b]; } else { a--; inVA += vol[a]; }
  }
  const mid = i => lo + (i + 0.5) * step, avg = tot / bins;
  return { lo: r4(lo), hi: r4(hi), step: r4(step), poc: r4(mid(poc)), vah: r4(lo + (b + 1) * step), val: r4(lo + a * step),
    v: vol.map(x => Math.round(x / tot * 1000)),            // per-mille of volume per bin (for the chart)
    hvn: vol.map((x, i) => [i, x]).filter(([, x]) => x >= avg * 1.6).map(([i]) => r4(mid(i))),
    lvn: vol.map((x, i) => [i, x]).filter(([i, x]) => x <= avg * 0.35 && i > 0 && i < bins - 1).map(([i]) => r4(mid(i))) };
}

async function main() {
  const latest = io.read("latest.json", null);
  if (!latest || !latest.ctx) process.exit(3);
  const FL = io.read("flow.json", { m: {} }), HT = io.read("heat.json", { m: {} });
  const now = Date.now();
  const ranked = Object.keys(latest.m).map(c => score(latest, c)).filter(r => r.score >= 25).sort((a, b) => b.score - a.score).map(r => r.coin);
  const heat = Object.entries(HT.m || {}).filter(([, h]) => Math.max(h.fr, h.bb) >= 40).map(([c]) => c);
  const focus = [...new Set([...ranked.slice(0, FOCUS), ...heat])].filter(c => latest.ctx[c] && latest.ctx[c].px);
  const age = c => FL.m[c] && FL.m[c].tMap ? now - Date.parse(FL.m[c].tMap) : Infinity;
  const due = focus.filter(c => age(c) > MAP_MIN * 6e4).sort((a, b) => age(b) - age(a)).slice(0, PER_RUN);
  if (!due.length) process.exit(3);
  for (const coin of due) {
    const x = latest.ctx[coin], px = x.px;
    const name = x.n || (coin.includes(":") ? coin.split(":")[0].toLowerCase() + ":" + coin.split(":").slice(1).join(":") : coin);
    const o = FL.m[coin] = FL.m[coin] || {};
    try { const w = await liqMap(name, px); o.liq = { px, w, ...painLevels(w, px) }; o.tMap = new Date().toISOString(); }
    catch (e) { console.error("liq map", coin, e.message); o.tMap = new Date().toISOString(); }
    try { o.cvd = await cvd(name); o.cvd.vol24 = x.v; } catch (e) { console.error("cvd", coin, e.message); }
    if (!o.tVp || now - Date.parse(o.tVp) > VP_H * 36e5) {
      try {
        const k = await hl({ type: "candleSnapshot", req: { coin: name, interval: "1h", startTime: now - 30 * 864e5, endTime: now } });
        if (Array.isArray(k) && k.length > 48) { o.vp30 = profile(k); o.vp7 = profile(k.slice(-168)); }
        o.tVp = new Date().toISOString();
      } catch (e) { console.error("vp", coin, e.message); }
    }
  }
  for (const c in FL.m) if (!latest.ctx[c] || (FL.m[c].tMap && now - Date.parse(FL.m[c].tMap) > 6 * 36e5)) delete FL.m[c];
  FL.t = new Date().toISOString();
  io.write("flow.json", FL);
  console.log(`Flow: ${due.join(", ")}`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch(e => { console.error(e); process.exit(1); });
