// Where each market is in its cycle, from Hyperliquid daily candles.
// Refreshes 30 markets per run (about every 45 s), so all markets refresh about every 15 minutes,
// with each market at most once every 3 hours. Exit 0 = updated, 3 = nothing to do.
// Usage: node scripts/cycle.mjs <outDir>
import { http, makeIO } from "./lib.mjs";

const OUT = process.argv[2] || "out";
const io = makeIO(OUT);
const PER_RUN = 30, TTL_H = 3;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const r2 = x => x == null || !isFinite(x) ? null : Math.round(x * 100) / 100;
const sma = (a, n) => a.length >= n ? a.slice(-n).reduce((s, x) => s + x, 0) / n : null;

function rsi(c, n = 14) {
  if (c.length < n + 1) return null;
  let g = 0, l = 0;
  for (let i = c.length - n; i < c.length; i++) { const d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
function vol(c, n) { // annualized from daily log returns
  if (c.length < n + 1) return null;
  const r = []; for (let i = c.length - n; i < c.length; i++) r.push(Math.log(c[i] / c[i - 1]));
  const m = r.reduce((s, x) => s + x, 0) / r.length;
  return Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / (r.length - 1)) * Math.sqrt(365) * 100;
}

export function cycleOf(candles) {
  const c = candles.map(k => +k.c), hi = candles.map(k => +k.h), lo = candles.map(k => +k.l);
  const n = c.length; if (n < 10) return { days: n, phase: "New listing", why: "Less than 10 days of history." };
  const px = c[n - 1];
  const ma20 = sma(c, 20), ma50 = sma(c, 50), ma200 = sma(c, 200);
  const ma50prev = c.length >= 60 ? c.slice(-60, -10).reduce((s, x) => s + x, 0) / 50 : null;
  const slope50 = ma50 && ma50prev ? (ma50 / ma50prev - 1) * 100 : null;          // % change of the 50-day average over 10 days
  const rng = d => { const h = Math.max(...hi.slice(-d)), l = Math.min(...lo.slice(-d)); return { h, l, pos: h > l ? (px - l) / (h - l) : 0.5 }; };
  const r30 = rng(Math.min(30, n)), r90 = rng(Math.min(90, n)), rAll = rng(n);
  const ret = d => n > d ? (px / c[n - 1 - d] - 1) * 100 : null;
  const R = rsi(c), v30 = vol(c, Math.min(30, n - 1)), v90 = vol(c, Math.min(90, n - 1));
  const dd = (px / rAll.h - 1) * 100;
  const o = {
    days: n, px, ma20: r2(ma20), ma50: r2(ma50), ma200: r2(ma200), slope50: r2(slope50),
    pos30: r2(r30.pos), pos90: r2(r90.pos), hi90: r90.h, lo90: r90.l, hi30: r30.h, lo30: r30.l,
    dd: r2(dd), r7: r2(ret(7)), r30: r2(ret(30)), r90: r2(ret(90)), rsi: r2(R), v30: r2(v30), v90: r2(v90)
  };
  const up = ma50 != null && px > ma50 && slope50 > 0, down = ma50 != null && px < ma50 && slope50 < 0;
  const ma = ma50 != null ? ma50 : ma20;
  let phase, why;
  if (n < 50) { phase = px > (ma20 || px) ? "Young · rising" : "Young · falling"; why = `Only ${n} days of history; using the 20-day average.`; }
  else if (r90.pos >= 0.85 && R >= 70) { phase = "Extended (late markup)"; why = `Near the 90-day high with RSI ${R.toFixed(0)}.`; }
  else if (up && r90.pos >= 0.6) { phase = "Markup (uptrend)"; why = `Above a rising 50-day average, upper part of the 90-day range.`; }
  else if (up) { phase = "Early recovery"; why = `Back above a rising 50-day average, still in the lower part of the 90-day range.`; }
  else if (r90.pos >= 0.65 && ma20 && px < ma20) { phase = "Distribution (topping)"; why = `High in the 90-day range but below the 20-day average: momentum is fading.`; }
  else if (down && r90.pos <= 0.15 && R <= 32) { phase = "Capitulation (oversold)"; why = `Near the 90-day low with RSI ${R.toFixed(0)}.`; }
  else if (down) { phase = "Markdown (downtrend)"; why = `Below a falling 50-day average.`; }
  else if (r90.pos <= 0.35 && v30 != null && v90 != null && v30 < v90) { phase = "Accumulation (basing)"; why = `Lower part of the range with falling volatility.`; }
  else { phase = "Range (no clear trend)"; why = `Price near a flat 50-day average.`; }
  o.phase = phase; o.why = why; o.trend = up ? 1 : down ? -1 : 0;
  o.vs50 = ma ? r2((px / ma - 1) * 100) : null;
  return o;
}

async function main() {
  const latest = io.read("latest.json", null);
  if (!latest) process.exit(3);
  const CY = io.read("cycle.json", { m: {} });
  const now = Date.now();
  const coins = Object.keys(latest.m).filter(c => latest.ctx && latest.ctx[c])
    .sort((a, b) => (CY.m[a] ? Date.parse(CY.m[a].t) : 0) - (CY.m[b] ? Date.parse(CY.m[b].t) : 0));
  const due = coins.filter(c => !CY.m[c] || now - Date.parse(CY.m[c].t) > TTL_H * 36e5).slice(0, PER_RUN);
  if (!due.length) process.exit(3);
  for (const coin of due) {
    const ctx = latest.ctx[coin];
    const name = ctx.n || (coin.includes(":") ? coin.split(":")[0].toLowerCase() + ":" + coin.split(":").slice(1).join(":") : coin);
    try {
      const k = await http("https://api.hyperliquid.xyz/info", { method: "POST", tries: 1, timeoutMs: 20000, headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "candleSnapshot", req: { coin: name, interval: "1d", startTime: now - 400 * 864e5, endTime: now } }) });
      CY.m[coin] = { t: new Date().toISOString(), ...cycleOf(Array.isArray(k) ? k : []) };
    } catch (e) { if (/429/.test(e.message)) break; }
    await sleep(250);
  }
  for (const c in CY.m) if (!latest.m[c]) delete CY.m[c];
  CY.t = new Date().toISOString();
  io.write("cycle.json", CY);
  console.log(`Cycle: ${due.length} markets`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch(e => { console.error(e); process.exit(1); });
