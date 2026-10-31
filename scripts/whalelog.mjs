// SOXL whale move log: the 20 best and 20 worst SOXL traders tracked by SOXX Sniper (xyz:SOXL perp on Hyperliquid).
// Reads their SOXL fills (first run: back up to 120 days, as far as Hyperliquid serves; later runs: only new fills),
// groups fills into moves (same action and side within 30 minutes) and keeps a growing log in whalelog.json:
//   moves: [t, wallet index, entry 1 / exit 0, side +1 long / -1 short, avg price, $ size]
// SOXX Sniper's "Why they trade" study reads it, so its tables grow every day instead of starting from scratch.
// Runs at most every 10 minutes. Exit 0 = updated, 3 = nothing to do.  Usage: node scripts/whalelog.mjs <outDir>
import { http, makeIO } from "./lib.mjs";
const OUT = process.argv[2] || "out", io = makeIO(OUT), COIN = "xyz:SOXL", KEEP = 200 * 864e5, GAP = 30 * 6e4;
const LIST = [["0x024294c53a69c1e6b39810b3fac87385752fffa1","B",816922,295,42,"Extremely Profitable"],["0xbb475febf78b528f4f0d4ae1a12541406565199c","B",327741,60,51.7,"Extremely Profitable"],["0xbd697846b0911baeba002a56bdc16f1f332d45fb","B",257584,96,41.7,"Rekt"],["0x9dead8fffcbf130e7658f672d2c081d91178d617","B",228553,6,100,"Extremely Profitable"],["0xda3768e9299e1fd81708ec030dac5ea37125f7b5","B",211500,36,47.2,"Rekt"],["0x8bd30fc805e672e1d978138ecbedcb48479ce275","B",202636,5,60,"Very Profitable"],["0xfc27136e42af1732ddc9ce2605ea9bff1b959d9d","B",110328,80,38.8,"Extremely Profitable"],["0x3b2e0b95acd47d987c1abdf42967fd82d469bdbb","B",98782,43,60.5,"Very Profitable"],["0x90e56dc997fea87c8463d661e621b1e7fd5181af","B",90533,60,55,"Very Profitable"],["0xec85bc052ec5b6d6cb2b40f5caa45e39b61a77fe","B",67178,10,30,"Very Unprofitable"],["0x177019594ba3913d416ab1a8f3e5527d4c2b2837","B",54572,2415,50.4,"Profitable"],["0xa38f19c4ccbcfd64cff676d72c436f7e6239dccf","B",49333,55,67.3,"Very Profitable"],["0xd33c704c68518e527bdcb36f7966c80edcffbdf2","B",40319,75,62.7,"Very Profitable"],["0x37f7ff1864f5d5cba2b63592656049f2d7d06fb4","B",40027,6,50,"Profitable"],["0x421183f04d68d0c2c68e27f07ccf84cd8746b9ef","B",37272,3,33.3,"Very Profitable"],["0x6d9d3438d8ad0506c74d0b91c68fa6b8f58154e6","B",37005,5,100,"Profitable"],["0x0b1ace05eb9ef1c3a1951b763700ecad24f27741","B",35729,6229,57.2,"Extremely Profitable"],["0x7717a7a245d9f950e586822b8c9b46863ed7bd7e","B",33448,71,63.4,"Extremely Profitable"],["0xb45bacc19c5f71ca8ba4134b0bbe6f4a1e9a5b11","B",26524,42,61.9,"Very Profitable"],["0x1886d6d9b05f11e9db19ba6f84811bb80d4c6582","B",22491,4,100,"Unprofitable"],["0xda411866ef8da115945db1c4987f44cb02c5d3f1","W",-1679857,5,20,"Rekt"],["0x4bcc092a156905788bf2a1a59e5968623957210d","W",-547814,482,57.3,"Very Profitable"],["0xd52936fa285cfa500440e31355c0b28f4b740729","W",-522826,11025,40.4,"Rekt"],["0xfd4224606069dd88fec92093a27591008263fda5","W",-90051,72,44.4,"Very Unprofitable"],["0xe724acd020fbd65ddb42a0f05dcfb65489480320","W",-80456,10,50,"Unprofitable"],["0x7f5653978d3f1b9716140bb7304c7e4650ae50f6","W",-62676,24,33.3,"Unprofitable"],["0xfc667adba8d4837586078f4fdcdc29804337ca06","W",-59080,16,56.3,"Extremely Profitable"],["0x25773676902085225ae5751075e4161369334897","W",-58715,1811,45.6,"Extremely Profitable"],["0xe9ffe7698f46f96f980f2877e18c43f5b4165903","W",-52483,34,44.1,"Rekt"],["0x7cee351d68e21f2bf1adf8161bd1598a80d6fc93","W",-44249,20,35,"Rekt"],["0xf1e79e5cf063073deec9a0d86c178f7cde84d479","W",-221468,11,0,"Found Oct 30"],["0xb28bdcb4c7db9370b73f6dbd57671416a0a57dd6","W",-110173,9,100,"Found Oct 30"],["0xc473eeadb5c500b010f6f882f922a394af09302a","W",-55359,264,55.1,"Found Oct 30"],["0xa4dedda59f2908b92ae192cfd494839373bcb3c4","W",-23872,67,68.8,"Found Oct 30"],["0x6ba2ad09aa6629a423b59b71f3564d84ce66c001","W",-22030,137,0,"Found Oct 30"],["0xbeccae9ffcb69e9d42a1d4e744abf8056149562d","W",-18168,19,0,"Found Oct 30"],["0xc3b27ac6b2e45b2b50e67fc805f7b2aac263daee","W",-6828,602,50.8,"Found Oct 30"],["0x2dbc53fe4683a9308feb5cd88ab10d73ad220b3d","W",-6199,169,0,"Found Oct 30"],["0xc06dd151c27dbe535ae95797e8aab1bb8b8cc7c0","W",-3148,70,16.4,"Found Oct 30"],["0xb1bfb0476bcdfc7989250e606312e6d716c11706","W",-1515,187,51.8,"Found Oct 30"]];
const hl = body => http("https://api.hyperliquid.xyz/info", { method: "POST", tries: 2, timeoutMs: 25000, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const S = io.read("whalelog.json", null) || { v: 1, at: 0, wallets: LIST.map(x => [x[0], x[1]]), cur: {}, open: {}, moves: [] };
if (Date.now() - S.at < 10 * 6e4 && !process.env.FORCE_RUN) process.exit(3);
const idx = Object.fromEntries(LIST.map((x, i) => [x[0], i])); S.wallets = LIST.map(x => [x[0], x[1]]);
let added = 0, ovChanged = false;
// overall record across ALL markets (not just SOXL): closed orders won / lost, from the fills (up to 120 days back, then kept up to date),
// plus Hyperdash's own overall win rate and trade count when the wallet is a top holder somewhere (specialists.json)
S.ov = S.ov || {};
const HD = {}; try { const SP = io.read("specialists.json", { m: {} }); Object.values(SP.m || {}).forEach(X => (X.holders || []).forEach(h => { if (h.wr != null) HD[h.a] = { wr: h.wr, tt: h.tt, coh: h.coh }; })); } catch (e) { }
for (const [a] of LIST) {
  const i = idx[a], ov = S.ov[a] = S.ov[a] || { w: 0, l: 0, pnl: 0, from: Date.now() - 120 * 864e5, cur: 0, coins: {} };
  if (HD[a] && JSON.stringify(ov.hd) !== JSON.stringify(HD[a])) { ov.hd = HD[a]; ovChanged = true; }
  let from = Math.min(S.cur[a] ? S.cur[a] + 1 : Date.now() - 120 * 864e5, ov.cur ? ov.cur + 1 : Date.now() - 120 * 864e5), fills = [], all = [];
  for (let page = 0; page < 6; page++) {      // userFillsByTime returns up to 2,000 fills from 'from', oldest first
    let f; try { f = await hl({ type: "userFillsByTime", user: a, startTime: from, aggregateByTime: true }); } catch (e) { console.log("whalelog", a.slice(0, 8), e.message); break; }
    if (!Array.isArray(f) || !f.length) break;
    all.push(...f); fills.push(...f.filter(x => x.coin === COIN && x.time > (S.cur[a] || 0))); from = f[f.length - 1].time + 1;
    await sleep(700); if (f.length < 2000) break;
  }
  if (fills.length) S.cur[a] = Math.max(S.cur[a] || 0, ...fills.map(x => x.time));
  // overall tally: one closed order = one trade (its fills summed); won if its closed P&L after fees is above zero
  { const by = {}; all.filter(x => x.time > ov.cur && x.closedPnl != null && /Close|>/.test(x.dir || "")).forEach(x => { const k = x.oid; const o = by[k] = by[k] || { p: 0, c: x.coin }; o.p += (+x.closedPnl || 0) - (+x.fee || 0); });
    Object.values(by).forEach(o => { if (Math.abs(o.p) < 1) return; if (o.p > 0) ov.w++; else ov.l++; ov.pnl += o.p; const c = ov.coins[o.c] = ov.coins[o.c] || [0, 0]; c[o.p > 0 ? 0 : 1]++; });
    if (all.length) { ov.cur = Math.max(ov.cur, ...all.map(x => x.time)); if (Object.keys(by).length) ovChanged = true; }
    ov.pnl = Math.round(ov.pnl); ov.n = ov.w + ov.l; ov.wr = ov.n ? Math.round(ov.w / ov.n * 1000) / 10 : null; ov.mk = Object.keys(ov.coins).length; }
  fills.sort((p, q) => p.time - q.time);
  for (const x of fills) {
    const d = x.dir || "", entry = /Open|>/.test(d) ? 1 : 0;
    const side = /Long > Short/.test(d) ? -1 : /Short > Long/.test(d) ? 1 : /Long/.test(d) ? 1 : -1;
    const v = +x.sz * +x.px, o = S.open[a];
    if (o && o[2] === entry && o[3] === side && x.time - o[6] <= GAP) { o[5] += v; o[7] += +x.sz; o[4] = o[5] / o[7]; o[6] = x.time; }
    else { if (o) { S.moves.push(o.slice(0, 6)); added++; } S.open[a] = [x.time, i, entry, side, +x.px, v, x.time, +x.sz]; }
  }
  // a move is done when nothing was added for 30 minutes
  const o = S.open[a]; if (o && Date.now() - o[6] > GAP) { S.moves.push(o.slice(0, 6)); delete S.open[a]; added++; }
  await sleep(300);
}
// Hyperdash records per market (all-time, every market incl. SOXL) and the overall win rate: the "Win (all)" numbers.
// Reuse the specialists cache (spcache.json) when fresh; else ask Hyperdash for up to 4 wallets per run (it limits these calls).
const gql = (query, variables) => http("https://api.hyperdash.com/graphql", { method: "POST", tries: 2, timeoutMs: 20000,
  headers: { "content-type": "application/json", origin: "https://hyperdash.com", referer: "https://hyperdash.com/" }, body: JSON.stringify({ query, variables }) })
  .then(j => { if (j.errors) throw new Error(j.errors[0].message); return j.data; });
S.st = S.st || {};
try { const SPC = io.read("spcache.json", {}); let calls = 0;
  for (const [a] of LIST) { const c = SPC[a], mine = S.st[a];
    if (c && c.s && Date.now() - c.t < 24 * 36e5 && (!mine || c.t > mine.t)) { S.st[a] = { t: c.t, s: c.s }; ovChanged = true; continue; }
    if (mine && Date.now() - mine.t < 24 * 36e5) continue; if (calls >= 4) continue; calls++;
    try { const st = (await gql(`query($a:String!){getTraderStatsPerAsset(address:$a){coin netPnl numberOfTrades winningTrades losingTrades volume}}`, { a })).getTraderStatsPerAsset || [];
      const o = {}; for (const x of st) o[x.coin] = [x.winningTrades || 0, x.losingTrades || 0, Math.round(+x.netPnl || 0), Math.round(+x.volume || 0)];
      S.st[a] = { t: Date.now(), s: o }; ovChanged = true; } catch (e) { console.log("whalelog stats", a.slice(0, 8), e.message); if (/too many/i.test(e.message)) break; }
    await sleep(500); }
  const tr = (await gql(`query($a:[String!]!){getTraders(addresses:$a){address pnl pnlCohort winrate totalTrades}}`, { a: LIST.map(x => x[0]) })).getTraders || [];
  tr.forEach(t => { const ov = S.ov[t.address]; if (ov && t.winrate != null) { const hd = { wr: Math.round(+t.winrate * 10) / 10, tt: +t.totalTrades || 0, coh: t.pnlCohort || "" }; if (JSON.stringify(ov.hd) !== JSON.stringify(hd)) { ov.hd = hd; ovChanged = true; } } });
} catch (e) { console.log("whalelog hyperdash", e.message); }
// the all-markets record from the per-market stats (SOXL included)
for (const [a] of LIST) { const x = S.st[a], ov = S.ov[a]; if (!x || !ov) continue; let w = 0, l = 0, p = 0; Object.values(x.s).forEach(v => { w += v[0]; l += v[1]; p += v[2]; });
  const soxl = x.s[COIN] || [0, 0, 0]; ov.all = { w, l, n: w + l, wr: w + l ? Math.round(w / (w + l) * 1000) / 10 : null, pnl: p, mk: Object.keys(x.s).length, soxl: [soxl[0], soxl[1]], t: x.t }; }
S.moves = S.moves.filter(m => Date.now() - m[0] < KEEP).sort((p, q) => p[0] - q[0]).map(m => [m[0], m[1], m[2], m[3], +(+m[4]).toPrecision(6), Math.round(m[5])]);
if (S.moves.length > 40000) S.moves = S.moves.slice(-40000);
S.at = Date.now(); io.write("whalelog.json", S);
console.log("whalelog: +" + added + " moves, " + S.moves.length + " kept");
process.exit(added || ovChanged ? 0 : 3);
