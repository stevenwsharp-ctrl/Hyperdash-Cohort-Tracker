// Coin specialists: are the people who hold this market good at THIS market?
// For the top setups, it gets the 30 largest holders of each market (Hyperdash shows 30 without login),
// then each holder's overall record and their record on this coin. It compares the coin win rate
// with the overall win rate, adds the coin PnL, and finds which side the coin specialists hold.
// The Action runs it about every 45 seconds; each run refreshes 2 markets, so the top 30 refresh in ~12 min.
// Exit code 0 = updated. Exit code 3 = nothing to do.
// Usage: node scripts/specialists.mjs <outDir>
import { http, makeIO, score } from "./lib.mjs";

const OUT = process.argv[2] || "out";
const io = makeIO(OUT);
const K = 4;                 // shrinkage: a coin record counts like K extra trades at the trader's overall win rate
const REFRESH_MIN = 15, PER_RUN = 2, MAX_STAT_CALLS = 70, CACHE_H = 3;
const COH = { "Extremely Profitable": "EP", "Very Profitable": "VP", "Profitable": "P", "Unprofitable": "U", "Very Unprofitable": "VU", "Rekt": "R" };

const gql = (query, variables) => http("https://api.hyperdash.com/graphql", {
  method: "POST", tries: 2, timeoutMs: 20000,
  headers: { "content-type": "application/json", origin: "https://hyperdash.com", referer: "https://hyperdash.com/" },
  body: JSON.stringify({ query, variables })
}).then(j => { if (j.errors) throw new Error(j.errors[0].message); return j.data; });

const hdCoin = c => c.includes(":") ? c.split(":")[0].toLowerCase() + ":" + c.split(":").slice(1).join(":") : c;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Skill on this coin, -1..1. Mostly "coin win rate vs own overall win rate", plus coin PnL.
export function coinSkill(h) {
  // overall win rate, pulled a little to 50% when the trader has few trades
  const wo = ((h.wr || 0) / 100 * h.tt + 1) / (h.tt + 2);
  const n = h.cw + h.cl;
  if (n === 0 && Math.abs(h.cp) < 1000) return { q: 0, wrs: null, dwr: null, ev: 0 };
  const wrs = (h.cw + K * wo) / (n + K);          // coin win rate, pulled to the overall rate when there are few coin trades
  const dwr = wrs - wo;
  const ev = Math.min(1, (n + Math.abs(h.cp) / 25000) / 4); // evidence: ~4 coin trades or ~$100K coin PnL = full trust
  const q = (0.55 * clamp(dwr * 5, -1, 1) + 0.45 * Math.tanh(h.cp / 50000)) * ev;
  return { q: Math.round(q * 100) / 100, wrs: Math.round(wrs * 1000) / 10, dwr: Math.round(dwr * 1000) / 10, ev: Math.round(ev * 100) / 100, raw: n ? Math.round(h.cw / n * 1000) / 10 : null };
}

// Wallets on the same side with almost the same size are most likely one trader (split accounts).
function clusters(holders) {
  let id = 0;
  const sorted = holders.slice().sort((a, b) => b.n - a.n);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].k != null) continue;
    const grp = [sorted[i]];
    for (let j = i + 1; j < sorted.length; j++) {
      const h = sorted[j];
      if (h.k == null && h.sd === sorted[i].sd && Math.abs(h.n - sorted[i].n) / sorted[i].n < 0.004) grp.push(h);
    }
    if (grp.length > 1) { id++; grp.forEach(h => h.k = id); }
  }
  return id;
}

export function aggregate(holders, oi) {
  const ent = new Map(); // one entry per trader (cluster = one trader)
  for (const h of holders) {
    const key = h.k ? "k" + h.k : h.a;
    const e = ent.get(key) || { sd: h.sd, n: 0, q: h.q, members: 0 };
    e.n += h.n; e.members++; ent.set(key, e);
  }
  let sL = 0, sS = 0, lL = 0, lS = 0, nS = 0, nL = 0;
  for (const e of ent.values()) {
    if (e.q >= 0.25) { nS++; e.sd > 0 ? sL += e.n : sS += e.n; }
    else if (e.q <= -0.25) { nL++; e.sd > 0 ? lL += e.n : lS += e.n; }
  }
  const sb = sL + sS ? (sL - sS) / (sL + sS) : null, lb = lL + lS ? (lL - lS) / (lL + lS) : null;
  const sig = sb != null && lb != null ? (sb - lb) / 2 : sb != null ? sb * 0.7 : lb != null ? -lb * 0.7 : 0;
  const tot = holders.reduce((a, h) => a + h.n, 0);
  // Smart-cohort holders: how much better (or worse) they do on this coin than overall
  const smart = holders.filter(h => (h.coh === "EP" || h.coh === "VP") && h.dwr != null);
  const sw = smart.reduce((a, h) => a + h.n, 0);
  const smartDwr = sw ? smart.reduce((a, h) => a + h.dwr * h.n, 0) / sw : null;
  return {
    sig: Math.round(sig * 100) / 100, sb: sb == null ? null : Math.round(sb * 100) / 100, lb: lb == null ? null : Math.round(lb * 100) / 100,
    nS, nL, sUsd: Math.round(sL + sS), lUsd: Math.round(lL + lS), sL: Math.round(sL), sS: Math.round(sS), lL: Math.round(lL), lS: Math.round(lS),
    ent: ent.size, nHold: holders.length, cov: oi ? Math.round(Math.min(1, tot / oi) * 100) : null,
    smartDwr: smartDwr == null ? null : Math.round(smartDwr * 10) / 10, conf: Math.round(Math.min(1, (nS + nL) / 4) * 100) / 100
  };
}

async function main() {
  const latest = io.read("latest.json", null);
  if (!latest) process.exit(3);
  const SP = io.read("specialists.json", { m: {} });
  const C = io.read("spcache.json", {});
  const now = Date.now();

  const ranked = Object.keys(latest.m).map(c => score(latest, c)).filter(r => r.score >= 30).sort((a, b) => b.score - a.score).slice(0, 30);
  const due = ranked.filter(r => !SP.m[r.coin] || now - Date.parse(SP.m[r.coin].t) > REFRESH_MIN * 6e4)
    .sort((a, b) => (SP.m[a.coin] ? Date.parse(SP.m[a.coin].t) : 0) - (SP.m[b.coin] ? Date.parse(SP.m[b.coin].t) : 0)).slice(0, PER_RUN);
  if (!due.length) { console.log("Specialists: nothing due"); process.exit(3); }

  let statCalls = 0;
  for (const r of due) {
    const coin = r.coin, hc = (latest.ctx && latest.ctx[coin] && latest.ctx[coin].n) || hdCoin(coin);
    try {
      const d = await gql(`query($coin:String!){analytics{p:perpsTickerPositions(coin:$coin,limit:30,offset:0,sortBy:{field:notional,order:desc}){totalCount positions{address label size notionalSize unrealizedPnl}}}}`, { coin: hc });
      const pos = (d.analytics.p.positions || []).filter(p => p.size && p.notionalSize > 0);
      if (!pos.length) { SP.m[coin] = { t: new Date().toISOString(), none: true }; continue; }
      const addrs = pos.map(p => p.address);
      const tr = (await gql(`query($a:[String!]!){getTraders(addresses:$a){address pnl pnlCohort winrate totalTrades}}`, { a: addrs })).getTraders || [];
      const T = Object.fromEntries(tr.map(t => [t.address, t]));
      for (const a of addrs) {
        const c = C[a];
        if (c && now - c.t < CACHE_H * 36e5 && c.s[hc] !== undefined) continue;
        if (statCalls >= MAX_STAT_CALLS) break;
        statCalls++;
        try {
          const st = (await gql(`query($a:String!){getTraderStatsPerAsset(address:$a){coin netPnl numberOfTrades winningTrades losingTrades volume}}`, { a })).getTraderStatsPerAsset || [];
          const s = {};
          for (const x of st) s[x.coin] = [x.winningTrades || 0, x.losingTrades || 0, Math.round(+x.netPnl || 0), Math.round(+x.volume || 0)];
          if (!s[hc]) s[hc] = [0, 0, 0, 0];
          C[a] = { t: now, s };
        } catch (e) { console.error("stats", a.slice(0, 8), e.message); }
        await sleep(60);
      }
      const holders = pos.map(p => {
        const t = T[p.address] || {}, s = (C[p.address] && C[p.address].s[hc]) || null;
        const h = {
          a: p.address, lb: p.label || undefined, sd: p.size > 0 ? 1 : -1, n: Math.round(p.notionalSize), u: Math.round(+p.unrealizedPnl || 0),
          coh: COH[t.pnlCohort] || "", wr: t.winrate != null ? Math.round(+t.winrate * 10) / 10 : null, tt: +t.totalTrades || 0, op: Math.round(+t.pnl || 0),
          cw: s ? s[0] : 0, cl: s ? s[1] : 0, cp: s ? s[2] : 0, cv: s ? s[3] : 0, miss: !s || undefined
        };
        Object.assign(h, coinSkill(h));
        return h;
      });
      clusters(holders);
      const oi = latest.ctx && latest.ctx[coin] ? latest.ctx[coin].oi : null;
      SP.m[coin] = { t: new Date().toISOString(), total: d.analytics.p.totalCount, holders, agg: aggregate(holders, oi) };
    } catch (e) { console.error("specialists", coin, e.message); SP.m[coin] = { ...(SP.m[coin] || {}), t: new Date().toISOString(), err: e.message }; }
  }
  // Drop old entries and old cache
  for (const c in SP.m) if (now - Date.parse(SP.m[c].t) > 6 * 36e5) delete SP.m[c];
  for (const a in C) if (now - C[a].t > 12 * 36e5) delete C[a];
  SP.t = new Date().toISOString();
  io.write("specialists.json", SP);
  io.write("spcache.json", C);
  console.log(`Specialists: ${due.map(r => r.coin).join(", ")} (${statCalls} stat calls)`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch(e => { console.error(e); process.exit(1); });
