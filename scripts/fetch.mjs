// Cohort Sniper data fetcher.
// Gets Hyperdash cohort positioning (all perps markets) and writes:
//   latest.json  - the current snapshot, compact
//   history.json - smart-vs-fool bias per market, last 7 days
//   status.json  - result of the last run
// Usage: node scripts/fetch.mjs <outDir> [inputFile]
//   inputFile is optional: a saved GraphQL response (for tests).

import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || "out";
const INPUT = process.argv[3];
const API = "https://api.hyperdash.com/graphql";
const HISTORY_DAYS = 7;
const MIN_GAP_MIN = 10;     // merge snapshots closer than this
const HIST_MIN_NOTIONAL = 20000; // keep a market in history only if both sides have this much

// Default groups. The page lets the user change them; history uses these.
const SMART = ["extremely_profitable", "very_profitable"];
const FOOLS = ["unprofitable", "very_unprofitable", "rekt"];

const QUERY = `query{analytics{perpsMarketParticipation{timestamp
 pnlCohorts{cohortId cohortLabel cohortRange markets{coin longTraderCount shortTraderCount totalLongNotional totalShortNotional}}
 sizeCohorts{cohortId cohortLabel cohortRange markets{coin longTraderCount shortTraderCount totalLongNotional totalShortNotional}}}}}`;

fs.mkdirSync(OUT, { recursive: true });
const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8")); } catch { return d; } };
const writeJson = (f, o) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(o));

async function getData() {
  if (INPUT) return JSON.parse(fs.readFileSync(INPUT, "utf8"));
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(API, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "accept": "application/json",
          "origin": "https://hyperdash.com",
          "referer": "https://hyperdash.com/",
          "user-agent": "Mozilla/5.0 (cohort-sniper; GitHub Actions)"
        },
        body: JSON.stringify({ query: QUERY })
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 200)}`);
      const j = JSON.parse(txt);
      if (j.errors) throw new Error("GraphQL: " + JSON.stringify(j.errors).slice(0, 300));
      return j;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 4000 * (i + 1)));
    }
  }
  throw lastErr;
}

function bias(rows) {
  let L = 0, S = 0;
  for (const r of rows) { if (r) { L += r[2]; S += r[3]; } }
  return { L, S, n: L + S, b: L + S > 0 ? (L - S) / (L + S) : 0 };
}

async function main() {
  const startedAt = new Date().toISOString();
  let raw;
  try {
    raw = await getData();
  } catch (e) {
    // Keep old latest.json and history.json. Only update status.
    writeJson("status.json", { ok: false, startedAt, error: String(e && e.message || e) });
    console.error("Fetch failed:", e);
    return;
  }

  const p = raw.data.analytics.perpsMarketParticipation;
  const pnl = p.pnlCohorts.map(c => ({ id: c.cohortId, label: c.cohortLabel, range: c.cohortRange }));
  const size = p.sizeCohorts.map(c => ({ id: c.cohortId, label: c.cohortLabel, range: c.cohortRange }));

  // m[coin] = { p: [row per pnl cohort], s: [row per size cohort] }, row = [longTraders, shortTraders, longUsd, shortUsd]
  const m = {};
  const put = (kind, idx, len, mk) => {
    const c = mk.coin;
    if (!m[c]) m[c] = { p: Array(pnl.length).fill(null), s: Array(size.length).fill(null) };
    m[c][kind][idx] = [mk.longTraderCount, mk.shortTraderCount, Math.round(mk.totalLongNotional), Math.round(mk.totalShortNotional)];
  };
  p.pnlCohorts.forEach((c, i) => c.markets.forEach(mk => put("p", i, pnl.length, mk)));
  p.sizeCohorts.forEach((c, i) => c.markets.forEach(mk => put("s", i, size.length, mk)));
  for (const c in m) { m[c].p = m[c].p.map(r => r || [0, 0, 0, 0]); m[c].s = m[c].s.map(r => r || [0, 0, 0, 0]); }

  const latest = { t: p.timestamp, fetchedAt: startedAt, pnl, size, m };
  writeJson("latest.json", latest);

  // History
  const smartIdx = SMART.map(id => pnl.findIndex(c => c.id === id)).filter(i => i >= 0);
  const foolIdx = FOOLS.map(id => pnl.findIndex(c => c.id === id)).filter(i => i >= 0);
  const d = {};
  for (const c in m) {
    const sm = bias(smartIdx.map(i => m[c].p[i]));
    const fo = bias(foolIdx.map(i => m[c].p[i]));
    if (sm.n >= HIST_MIN_NOTIONAL && fo.n >= HIST_MIN_NOTIONAL) d[c] = [Math.round(sm.b * 100), Math.round(fo.b * 100)];
  }
  const hist = readJson("history.json", { snapshots: [] });
  const tNow = Date.parse(p.timestamp) || Date.now();
  let snaps = (hist.snapshots || []).filter(s => tNow - Date.parse(s.t) < HISTORY_DAYS * 864e5 && Date.parse(s.t) < tNow);
  const last = snaps[snaps.length - 1];
  if (last && tNow - Date.parse(last.t) < MIN_GAP_MIN * 6e4) snaps.pop();
  snaps.push({ t: p.timestamp, d });
  writeJson("history.json", { smart: SMART, fools: FOOLS, snapshots: snaps });

  writeJson("status.json", { ok: true, startedAt, dataTime: p.timestamp, markets: Object.keys(m).length, snapshots: snaps.length });
  console.log(`OK ${p.timestamp}: ${Object.keys(m).length} markets, ${snaps.length} history snapshots`);
}

main().catch(e => { console.error(e); process.exit(1); });
