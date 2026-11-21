// Cohort Sniper · cohort book (the data for flow.html).
// Hyperdash gives each cohort's open longs and shorts (traders and $) for every market, every 5 minutes.
// This script keeps that per cohort for each market, so the page can show where each cohort
// added, cut or covered, at which price, on any time frame.
// Run it after fetch.mjs. It reads <dataDir>/latest.json (and history.json for the back-fill) and writes <cfDir>/cf/:
//   cf/<COIN>.json   one market: rows [tMin, price, then per cohort: longTraders, shortTraders, long$K, short$K]
//                    5-minute rows for 2 days, 15-minute rows to 7 days, hourly rows to 30 days.
//                    bf = back-fill from history.json for the time before the first row (smart and fools only).
//                    ob = resting order book (all traders, Hyperliquid l2Book, 3 significant figures) every 15 minutes, 24 hours:
//                    [tMin, [[price, bid $K]...], [[price, ask $K]...]]
//   cf/_index.json   every market: price, 24h change, OI, volume, and cohort flows over 1h / 4h / 24h / 7d.
// Exit code 0 = new data written. Exit code 3 = no new snapshot.
// Usage: node scripts/cohortbook.mjs <dataDir> <cfDir>
import fs from "node:fs";
import path from "node:path";
import { SMART, FOOLS, http } from "./lib.mjs";

const DATA = process.argv[2] || "out", OUT = path.join(process.argv[3] || "out-cf", "cf");
fs.mkdirSync(OUT, { recursive: true });
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
const safe = c => c.replace(/[^A-Za-z0-9_-]/g, "_");

const latest = read(path.join(DATA, "latest.json"), null);
if (!latest || !latest.m) { console.log("cohortbook: no latest.json"); process.exit(3); }
const idx = read(path.join(OUT, "_index.json"), { t: null });
if (idx.t === latest.t && !process.env.FORCE_RUN) { console.log("cohortbook: no new snapshot", latest.t); process.exit(3); }

const CO = [...latest.pnl.map(c => c.id), ...latest.size.map(c => c.id)];
const LB = [...latest.pnl.map(c => c.label), ...latest.size.map(c => c.label)];
const NP = latest.pnl.length;
const tMin = Math.round(Date.parse(latest.t) / 6e4);
const K = x => Math.round(x / 1000);

// Keep: 5-minute rows for 2 days, 15-minute rows to 7 days, hourly rows to 30 days.
function downsample(rows, now) {
  const out = [], seen = new Set();
  for (const r of rows) {
    const age = now - r[0];
    if (age > 30 * 1440) continue;
    if (age <= 2 * 1440) { out.push(r); continue; }
    const key = age <= 7 * 1440 ? "q" + Math.floor(r[0] / 15) : "h" + Math.floor(r[0] / 60);
    if (!seen.has(key)) { seen.add(key); out.push(r); }
  }
  return out;
}

// Back-fill from history.json (smart long $, smart short $, fools net $, all long $, all short $), only for a new file.
const hist = read(path.join(DATA, "history.json"), { snapshots: [] });
function backfill(coin, before) {
  const bf = [];
  for (const s of hist.snapshots || []) {
    const v = s.d && s.d[coin], t = Math.round(Date.parse(s.t) / 6e4);
    if (!v || !v[2] || t >= before) continue;
    const smNet = (v[3] || 0) + (v[4] || 0), smGross = v[5] || 0;
    bf.push([t, v[2], Math.round((smGross + smNet) / 2), Math.round((smGross - smNet) / 2), v[6] || 0, v[8] || 0, v[9] || 0]);
  }
  return bf;
}

// Groups for the index (same as the page)
const ix = id => CO.indexOf(id);
const G = { sm: SMART.map(ix).filter(i => i >= 0), fo: FOOLS.map(ix).filter(i => i >= 0), all: CO.map((_, i) => i).filter(i => i >= NP) };
// Flow between two rows for a set of cohorts. Price-adjusted: a change in contracts, at the mean price,
// so a price move alone is not counted as buying or selling.
function flow(a, b, cs) {
  let La = 0, Sa = 0, Lb = 0, Sb = 0, nLa = 0, nSa = 0, nLb = 0, nSb = 0;
  for (const i of cs) { const o = 2 + i * 4; nLa += a[o]; nSa += a[o + 1]; La += a[o + 2]; Sa += a[o + 3]; nLb += b[o]; nSb += b[o + 1]; Lb += b[o + 2]; Sb += b[o + 3]; }
  const pm = (a[1] + b[1]) / 2, fL = (Lb / b[1] - La / a[1]) * pm * 1000, fS = (Sb / b[1] - Sa / a[1]) * pm * 1000;
  return { fL, fS, dnL: nLb - nLa, dnS: nSb - nSa };
}
function windowFlow(rows, mins) {
  const now = rows[rows.length - 1][0], o = {};
  for (const g in G) o[g] = [0, 0, 0, 0, 0, 0];   // long add, long cut, short add, short cover, Δlong traders, Δshort traders
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i]; if (now - b[0] >= mins || !(a[1] > 0 && b[1] > 0)) continue;
    for (const g in G) { const f = flow(a, b, G[g]), x = o[g]; if (f.fL > 0) x[0] += f.fL; else x[1] -= f.fL; if (f.fS > 0) x[2] += f.fS; else x[3] -= f.fS; x[4] += f.dnL; x[5] += f.dnS; }
  }
  for (const g in G) o[g] = o[g].map(Math.round);
  // covered minutes (the window can be shorter while the book is new)
  const first = rows.find(r => now - r[0] <= mins); o.span = first ? now - first[0] : 0;
  return o;
}

// Resting order book snapshots (every 15 minutes): all markets, a few at a time.
const books = {};
async function getBooks(coins) {
  if (tMin % 15 >= 5 && !process.env.FORCE_BOOKS) return;
  const q = coins.slice(); let fails = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (q.length && fails < 20) {
      const c = q.shift();
      try {
        const j = await http("https://api.hyperliquid.xyz/info", { method: "POST", tries: 1, timeoutMs: 10000, headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "l2Book", coin: hlName(c), nSigFigs: 3 }) });
        const side = a => (a || []).map(x => [+(+x.px).toPrecision(6), Math.round(+x.sz * +x.px / 1000)]).filter(x => x[1] > 0);
        if (j && j.levels) books[c] = [tMin, side(j.levels[0]), side(j.levels[1])];
      } catch (e) { fails++; }
    }
  }));
  console.log(`cohortbook: ${Object.keys(books).length} order books`);
}

const hlName = c => { const x = latest.ctx && latest.ctx[c]; if (x && x.n) return x.n; const i = c.indexOf(":"); return i < 0 ? c : c.slice(0, i).toLowerCase() + ":" + c.slice(i + 1); };
const index = { t: latest.t, co: CO, lb: LB, np: NP, m: {} };
let n = 0;
await getBooks(Object.keys(latest.m).filter(c => latest.ctx && latest.ctx[c] && latest.ctx[c].px > 0));
for (const coin in latest.m) {
  const m = latest.m[coin], ctx = latest.ctx && latest.ctx[coin];
  if (!ctx || !(ctx.px > 0)) continue;
  const row = [tMin, +ctx.px.toPrecision(7)];
  for (const r of [...m.p, ...m.s]) row.push(r[0], r[1], K(r[2]), K(r[3]));
  if (row.length !== 2 + CO.length * 4) continue;
  const f = path.join(OUT, safe(coin) + ".json");
  let book = read(f, null);
  if (!book || !Array.isArray(book.r) || (book.co || []).join() !== CO.join()) book = { v: 1, c: coin, co: CO, lb: LB, np: NP, r: [], bf: backfill(coin, tMin) };
  const rows = book.r.filter(r => r[0] < tMin); rows.push(row);
  book.r = downsample(rows, tMin);
  book.bf = (book.bf || []).filter(r => r[0] < book.r[0][0] && tMin - r[0] <= 30 * 1440);
  book.ob = (book.ob || []).filter(r => r[0] < tMin && tMin - r[0] <= 1440); if (books[coin]) book.ob.push(books[coin]);
  book.c = coin; book.n = hlName(coin); book.t = latest.t;
  fs.writeFileSync(f, JSON.stringify(book));
  n++;
  index.m[coin] = { n: book.n, f: safe(coin), px: ctx.px, ch: ctx.ch, oi: ctx.oi, v: ctx.v, w: { "1h": windowFlow(book.r, 60), "4h": windowFlow(book.r, 240), "24h": windowFlow(book.r, 1440), "7d": windowFlow(book.r, 7 * 1440) } };
}
// Remove books of markets that are gone (no row for 3 days)
for (const f of fs.readdirSync(OUT)) {
  if (!f.endsWith(".json") || f === "_index.json") continue;
  const b = read(path.join(OUT, f), null);
  if (!b || !b.r || !b.r.length || tMin - b.r[b.r.length - 1][0] > 3 * 1440) fs.rmSync(path.join(OUT, f));
}
fs.writeFileSync(path.join(OUT, "_index.json"), JSON.stringify(index));
console.log(`cohortbook: ${n} markets at ${latest.t}`);
