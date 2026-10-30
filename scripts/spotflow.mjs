// Spot flow: every trade on Hyperliquid's biggest spot pairs, live, through the websocket (trades include both wallets).
// Runs next to the data loop for the length of the run and writes out/spotflow.json every 20 seconds:
//   tokens: taker buy / sell $ and big-trade ($25K+) buy / sell $ over 5m, 15m, 1h, 4h, 24h
//   whales: the wallets with the most spot volume in 24h, their net buying per time frame, and a market-maker flag
//           (huge two-sided volume, small net) so that real direction is separated from market making
//   big:    the newest big trades
// State (5-minute buckets for 24 hours) is kept in the file, so each run continues where the last one stopped.
// Usage: node scripts/spotflow.mjs <outDir> <seconds>      Needs Node 22+ (global WebSocket).
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || "out", SECS = Math.max(60, +process.argv[3] || 3000), FILE = path.join(OUT, "spotflow.json");
const B5 = 5 * 6e4, DAY = 864e5, BIG = 25000, WHALE_MIN = 1000, PAIRS = 16;
const WIN = { "5m": 5 * 6e4, "15m": 15 * 6e4, "1h": 36e5, "4h": 4 * 36e5, "24h": DAY };
const post = b => fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => r.json());

let S = { v: 1, tok: {}, wal: {}, big: [], from: Date.now() };
try { const o = JSON.parse(fs.readFileSync(FILE, "utf8")); if (o && o.state && o.state.v === 1) S = o.state; } catch { }
let META = {};   // pair -> { base, px, ch, vol }

async function meta() {
  const [m, c] = await post({ type: "spotMetaAndAssetCtxs" }); const tok = {}; m.tokens.forEach(t => tok[t.index] = t.name); const by = {}; c.forEach(x => by[x.coin] = x);
  const o = {}; m.universe.forEach(u => { const x = by[u.name] || {}, px = +x.markPx || +x.midPx || 0, pv = +x.prevDayPx || 0, q = tok[u.tokens[1]];
    if (/^USD/.test(q || "")) o[u.name] = { base: tok[u.tokens[0]], px, ch: pv ? (px / pv - 1) * 100 : null, vol: +x.dayNtlVlm || 0 }; });
  META = o; return Object.entries(o).sort((a, b) => b[1].vol - a[1].vol).slice(0, PAIRS).map(x => x[0]);
}

function add(t) {
  const m = META[t.coin]; if (!m) return; const px = +t.px, usd = px * +t.sz; if (!(usd > 0)) return;
  const bk = Math.floor(t.time / B5) * B5, tb = t.side === "B";      // side = taker side: B = the taker bought
  const T = S.tok[m.base] = S.tok[m.base] || {}, b = T[bk] = T[bk] || [0, 0, 0, 0, 0];  // [takerBuy, takerSell, bigBuy, bigSell, trades]
  b[tb ? 0 : 1] += usd; if (usd >= BIG) b[tb ? 2 : 3] += usd; b[4]++;
  const [buyer, seller] = t.users || [];
  if (usd >= WHALE_MIN) for (const [a, sgn] of [[buyer, 1], [seller, -1]]) { if (!a) continue;
    const W = S.wal[a] = S.wal[a] || {}, x = W[bk] = W[bk] || [0, 0, {}]; x[0] += usd; x[1] += sgn * usd; x[2][m.base] = (x[2][m.base] || 0) + sgn * usd; }
  if (usd >= BIG) S.big.push([t.time, m.base, px, Math.round(usd), tb ? 1 : -1, buyer || "", seller || ""]);
}

function prune(now) {
  for (const T of Object.values(S.tok)) for (const k of Object.keys(T)) if (now - k > DAY) delete T[k];
  for (const [a, W] of Object.entries(S.wal)) { for (const k of Object.keys(W)) if (now - k > DAY) delete W[k]; if (!Object.keys(W).length) delete S.wal[a]; }
  S.big = S.big.filter(x => now - x[0] <= DAY).slice(-400);
  // keep only wallets with $25K+ in 24h, at most 600
  const g = Object.entries(S.wal).map(([a, W]) => [a, Object.values(W).reduce((s, x) => s + x[0], 0)]).sort((p, q) => q[1] - p[1]);
  g.slice(600).forEach(([a]) => delete S.wal[a]); g.filter(x => x[1] < 25000).forEach(([a]) => delete S.wal[a]);
}

function write() {
  const now = Date.now(); prune(now);
  const tokens = {};
  for (const [tk, T] of Object.entries(S.tok)) { const m = Object.values(META).find(x => x.base === tk) || {}; const W = {};
    for (const [w, ms] of Object.entries(WIN)) { const s = [0, 0, 0, 0, 0]; for (const [k, b] of Object.entries(T)) if (now - k < ms) for (let i = 0; i < 5; i++) s[i] += b[i]; W[w] = s.map(Math.round); }
    if (W["24h"][0] + W["24h"][1] >= 5000) tokens[tk] = { px: m.px, ch: m.ch == null ? null : Math.round(m.ch * 100) / 100, vol: Math.round(m.vol || 0), W }; }
  const whales = Object.entries(S.wal).map(([a, Wb]) => { const net = {}, toks = {}; let g = 0;
      for (const [w, ms] of Object.entries(WIN)) net[w] = Math.round(Object.entries(Wb).reduce((s, [k, x]) => s + (now - k < ms ? x[1] : 0), 0));
      for (const x of Object.values(Wb)) { g += x[0]; for (const [t, v] of Object.entries(x[2])) toks[t] = (toks[t] || 0) + v; }
      const mm = g >= 500000 && Math.abs(net["24h"]) / g < 0.08;   // big two-sided volume, little net: a market maker
      return { a, g: Math.round(g), net, mm, top: Object.entries(toks).sort((p, q) => Math.abs(q[1]) - Math.abs(p[1])).slice(0, 3).map(([t, v]) => [t, Math.round(v)]) }; })
    .sort((p, q) => q.g - p.g).slice(0, 60);
  const out = { t: new Date(now).toISOString(), from: new Date(S.from).toISOString(), pairs: Object.keys(META).length, tokens, whales, big: S.big.slice(-80).reverse(), state: S };
  fs.writeFileSync(FILE + ".tmp", JSON.stringify(out)); fs.renameSync(FILE + ".tmp", FILE);
}

async function run() {
  const end = Date.now() + SECS * 1000; let pairs = await meta();
  if (typeof WebSocket === "undefined") { console.log("spotflow: no WebSocket in this Node"); return; }
  while (Date.now() < end) {
    await new Promise(res => {
      const ws = new WebSocket("wss://api.hyperliquid.xyz/ws"); let ping;
      ws.onopen = () => { pairs.forEach(c => ws.send(JSON.stringify({ method: "subscribe", subscription: { type: "trades", coin: c } }))); ping = setInterval(() => { try { ws.send(JSON.stringify({ method: "ping" })); } catch { } }, 30000); };
      ws.onmessage = ev => { try { const j = JSON.parse(ev.data); if (j.channel === "trades") j.data.forEach(add); } catch { } };
      ws.onclose = ws.onerror = () => { clearInterval(ping); res(); };
      const tw = setInterval(async () => { try { write(); } catch (e) { console.log("spotflow write", e.message); } if (Date.now() >= end) { clearInterval(tw); try { ws.close(); } catch { } res(); } }, 20000);
      const tm = setInterval(async () => { try { pairs = await meta(); } catch { } }, 10 * 6e4); ws.addEventListener("close", () => { clearInterval(tw); clearInterval(tm); });
    });
    if (Date.now() < end) await new Promise(r => setTimeout(r, 3000));   // reconnect
  }
  write();
}
run().catch(e => { console.log("spotflow", e.message); process.exit(0); });
