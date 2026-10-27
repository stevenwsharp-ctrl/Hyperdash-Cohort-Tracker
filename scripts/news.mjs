// News feed for Cohort Sniper. The Action runs it about every 45 seconds.
// Sources: Hyperdash news stream (Bloomberg, WSJ, CNBC, squawk accounts, with sentiment)
//          and Yahoo Finance headlines per ticker for the top setups.
// Each headline is matched to Hyperliquid markets and marked "big" when it is likely to move price.
// Exit code 0 = new items written. Exit code 3 = nothing new.
// Usage: node scripts/news.mjs <outDir>
import { http, makeIO, score, splitCoin, fidelityOK } from "./lib.mjs";
import { ALIAS, CRYPTO, GENERIC } from "./instruments.mjs";

const OUT = process.argv[2] || "out";
const io = makeIO(OUT);
const KEEP_H = 36, MAX_ITEMS = 1200;
const ALERT_TYPES = new Set((process.env.ALERT_TYPES || "setup,exit,flip,news").split(/[\s,]+/).filter(Boolean));

const TERMS = {
  SP500: ["S&P 500", "S&P", "SPX", "Wall Street", "US stocks", "U.S. stocks"], US500: ["S&P 500", "S&P", "SPX"],
  XYZ100: ["Nasdaq 100", "Nasdaq", "NDX", "tech stocks"], USTECH: ["Nasdaq 100", "Nasdaq", "tech stocks"],
  SMALL2000: ["Russell 2000", "small caps", "small-cap"], JP225: ["Nikkei", "Japanese stocks"], KR200: ["Kospi", "KOSPI", "Korean stocks"],
  GOLD: ["gold", "Gold", "bullion"], SILVER: ["silver", "Silver"], CL: ["oil", "Oil", "crude", "Crude", "WTI", "OPEC"],
  BRENTOIL: ["Brent", "oil", "Oil", "crude", "OPEC"], NATGAS: ["natural gas", "Natural gas", "LNG"], COPPER: ["copper", "Copper"],
  PLATINUM: ["platinum", "Platinum"], PALLADIUM: ["palladium", "Palladium"], ALUMINIUM: ["aluminum", "aluminium"],
  EUR: ["euro", "Euro", "ECB", "EUR/USD", "Lagarde"], JPY: ["yen", "Yen", "BOJ", "Bank of Japan", "USD/JPY", "Ueda"],
  GBP: ["pound", "sterling", "Bank of England", "BOE", "GBP/USD"],
  "10Y": ["Treasury", "Treasuries", "10-year", "yields"], "30Y": ["Treasury", "Treasuries", "30-year", "long bond"],
  "2Y": ["2-year", "Treasury", "Treasuries"], USBOND: ["Treasury", "Treasuries", "bond market"], TLT: ["Treasury", "Treasuries", "bond market"],
  SOXL: ["semiconductor", "chip stocks", "chipmakers"], SMH: ["semiconductor", "chip stocks", "chipmakers"],
  DRAM: ["DRAM", "memory chip", "memory prices"], BVIV: ["bitcoin volatility"], ARM: ["Arm Holdings", "Arm"]
};
const STOP = new Set("A AI IT ON BE GO ALL ARE NOW CAN NET BIG OPEN KEY ANY ONE TWO HAS LOW HIGH FOR NEW CEO CFO IPO USA GDP CPI PPI PCE FED ECB EU UK US OR AND THE TO OF IN AT BY UP SO NO OK HE WE ME MY AS IS ARM CASH EAT FUN HOT LIFE MAN TRUE REAL GOOD BEST PLAY SAFE FAST BOX CAR GAS OIL ETF SEC DOJ FTC FDA ATH TV".split(" "));
const BIG_SRC = /bloomberg|wsj|reuters|cnbc|firstsquawk|financialjuice|deitaone|marketwatch|businessinsider|unusual_whales|walterbloomberg|ft\b|financial times|barron|coindesk|the block|yahoo/i;
const KEY = /\b(earnings|results|revenue|guidance|outlook|forecast|beats?|miss(es|ed)?|downgrade[sd]?|upgrade[sd]?|price target|acquir\w*|merger|buyout|takeover|stake|SEC|DOJ|FTC|antitrust|lawsuit|sues?|sued|probe|investigation|subpoena|FDA|approv\w*|recall|bankrupt\w*|default\w*|halt\w*|delist\w*|hack\w*|exploit\w*|breach|outage|layoffs?|resign\w*|steps down|IPO|stock split|buyback|dividend|tariffs?|sanctions?|ban(s|ned)?|short seller|fraud|plunge\w*|soar\w*|surge\w*|tumble\w*|crash\w*|slump\w*|record high|all-time high|liquidat\w*|delay\w*|cancel\w*|contract|partnership|deal with|order[s]? for)\b/i;
const MACRO = /\b(Fed|FOMC|Powell|rate cut|rate hike|rates? decision|CPI|PCE|inflation|payrolls|jobs report|nonfarm|unemployment|GDP|recession|tariffs?|Treasury yields?|ECB|BOJ|PBOC|PBoC|Lagarde|Ueda|White House|Trump|Xi|sanctions?|OPEC|shutdown|debt ceiling|stimulus)\b/;
const MACRO_BIG = /\b(Fed (cuts|raises|holds|decision)|FOMC|rate (cut|hike)|CPI|PCE|payrolls|jobs report|nonfarm|GDP|tariffs?|recession|shutdown|emergency|Powell)\b/i;

function cleanName(n) {
  return n.replace(/\s*(American Depositary.*|Common Stock.*|Class [A-Z].*|Ordinary Shares.*|Inc\.?|Incorporated|Corporation|Corp\.?|Holdings?|Ltd\.?|Limited|plc|PLC|Group|Co\.?|N\.V\.|S\.A\.|AG|SE)\b.*$/, "").replace(/[,.]+$/, "").trim();
}
const esc = w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function buildMatcher(latest, inst) {
  const rules = []; // { re, coin }
  const add = (coin, term, ci) => { if (!term || term.length < 2) return; rules.push({ coin, re: new RegExp(`(^|[^A-Za-z0-9$])${esc(term)}([^A-Za-z0-9]|$)`, ci ? "i" : "") }); };
  const bySym = {};
  for (const coin of Object.keys(latest.m)) {
    const { venue, sym } = splitCoin(coin);
    (bySym[sym] = bySym[sym] || []).push(coin);
    rules.push({ coin, re: new RegExp(`\\$${esc(sym)}\\b`) }); // cashtag
    if (!venue) { (CRYPTO[sym] || []).forEach(t => add(coin, t, /[a-z]/.test(t))); if (sym.length >= 3 && !STOP.has(sym)) add(coin, sym, false); continue; }
    (TERMS[sym] || []).forEach(t => add(coin, t, false));
    (ALIAS[sym] || []).forEach(t => add(coin, t, false));
    const I = inst && inst.m[coin];
    if (I && I.u) {
      const nm = cleanName(I.u.n), words = nm.split(/\s+/);
      const short = GENERIC.test(words[0]) || words[0].length < 4 ? words.slice(0, 2).join(" ") : words[0];
      if (short.length >= 4) add(coin, short, false);
      if (nm !== short && nm.length >= 5) add(coin, nm, false);
    }
    if (sym.length >= 2 && !STOP.has(sym) && !TERMS[sym]) add(coin, sym, false);
  }
  return { rules, bySym };
}

export function classify(it, matcher) {
  const text = it.h;
  const coins = new Set();
  for (const r of matcher.rules) if (r.re.test(text)) coins.add(r.coin);
  for (const t of it.tk || []) { const s = String(t).replace(/^\$/, "").replace(/-USD$/, "").toUpperCase(); (matcher.bySym[s] || []).forEach(c => coins.add(c)); }
  const list = [...coins].slice(0, 8);
  const macro = MACRO.test(text);
  const strong = KEY.test(text) || (it.s && it.s !== "neutral");
  const big = (list.length > 0 && BIG_SRC.test(it.src || "") && strong) || (macro && MACRO_BIG.test(text) && BIG_SRC.test(it.src || ""));
  return { coins: list, macro, big };
}

function parseRss(xml, coin) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const g = tag => { const x = m[1].match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)); return x ? x[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim() : ""; };
    const t = Date.parse(g("pubDate")); if (!t) continue;
    const h = g("title").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
    items.push({ id: "y:" + (g("guid") || g("link")).slice(0, 80), t, h, src: "Yahoo Finance", url: g("link"), s: "", forced: coin });
  }
  return items;
}

async function main() {
  const latest = io.read("latest.json", null);
  if (!latest) { console.log("No latest.json yet"); process.exit(3); }
  const inst = io.read("instruments.json", null);
  const N = io.read("news.json", { items: [], hdSince: 0, yIdx: 0, alerted: {} });
  N.alerted = N.alerted || {};
  const seen = new Set(N.items.map(i => i.id));
  const now = Date.now();
  const fresh = [];

  // 1. Hyperdash stream
  try {
    const since = Math.max(N.hdSince || 0, now - 3 * 36e5);
    const j = await http("https://api.hyperdash.com/graphql", {
      method: "POST", tries: 2, timeoutMs: 20000,
      headers: { "content-type": "application/json", origin: "https://hyperdash.com", referer: "https://hyperdash.com/" },
      body: JSON.stringify({ query: "query N($since: Float, $limit: Int){newsItems(since:$since,limit:$limit){id headline publishedAt sourceName sourceLink providerTickers enrichment{tickers sentiment}}}", variables: { since: since - 60000, limit: 200 } })
    });
    for (const x of (j.data && j.data.newsItems) || []) {
      const id = "h:" + x.id; if (seen.has(id)) continue;
      fresh.push({ id, t: +x.publishedAt, h: String(x.headline || "").slice(0, 240), src: x.sourceName || "", url: x.sourceLink || "", s: (x.enrichment && x.enrichment.sentiment) || "", tk: [...(x.providerTickers || []), ...((x.enrichment && x.enrichment.tickers) || [])] });
      N.hdSince = Math.max(N.hdSince || 0, +x.publishedAt);
    }
  } catch (e) { console.error("hyperdash news:", e.message); }

  // 2. Yahoo headlines for the top setups (4 tickers per run, in rotation)
  try {
    const ranked = Object.keys(latest.m).map(c => score(latest, c)).filter(r => r.score >= 25).sort((a, b) => b.score - a.score).slice(0, 60);
    const syms = [];
    for (const r of ranked) {
      const { venue, sym } = splitCoin(r.coin);
      const I = inst && inst.m[r.coin];
      const y = !venue ? (CRYPTO[sym] ? `${sym}-USD` : null) : I && I.u ? I.u.s : I && I.px && I.px[0] ? I.px[0].s : null;
      if (y && !syms.some(s => s.y === y)) syms.push({ y, coin: r.coin });
    }
    for (let k = 0; k < Math.min(4, syms.length); k++) {
      const s = syms[(N.yIdx + k) % syms.length];
      try {
        const xml = await http(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(s.y)}&region=US&lang=en-US`, { as: "text", tries: 1, timeoutMs: 15000 });
        for (const it of parseRss(xml, s.coin)) if (!seen.has(it.id) && now - it.t < KEEP_H * 36e5) { fresh.push(it); seen.add(it.id); }
      } catch (e) { console.error("yahoo", s.y, e.message); }
    }
    N.yIdx = syms.length ? (N.yIdx + 4) % syms.length : 0;
  } catch (e) { console.error("yahoo:", e.message); }

  if (!fresh.length) { console.log("No new news"); process.exit(3); }

  const matcher = buildMatcher(latest, inst);
  const out = fresh.map(it => {
    const c = classify(it, matcher);
    if (it.forced && !c.coins.includes(it.forced)) c.coins.unshift(it.forced);
    const big = c.big || (it.forced && KEY.test(it.h));
    const o = { id: it.id, t: it.t, h: it.h, src: it.src, url: it.url, s: it.s ? it.s.slice(0, 4) : "", c: c.coins };
    if (c.macro) o.m = 1; if (big) o.b = 1;
    return o;
  });
  N.items = [...out, ...N.items].filter(i => now - i.t < KEEP_H * 36e5).sort((a, b) => b.t - a.t).slice(0, MAX_ITEMS);
  N.t = new Date().toISOString();

  // Alerts: big news on markets that are a setup now (score 40+), and big macro news if asked for
  if (process.env.NTFY_TOPIC || process.env.DISCORD_WEBHOOK_URL) {
    const minS = +process.env.ALERT_NEWS_MIN_SCORE || 40;
    const sc = {}; for (const c of Object.keys(latest.m)) sc[c] = score(latest, c);
    let sent = 0;
    for (const it of out.filter(i => i.b && now - i.t < 30 * 6e4).sort((a, b) => b.t - a.t)) {
      if (sent >= 4) break;
      const hot = it.c.filter(c => sc[c] && sc[c].score >= minS && fidelityOK(c, inst));
      let title = null;
      if (ALERT_TYPES.has("news") && hot.length && !hot.every(c => now - (N.alerted[c] || 0) < 30 * 6e4)) {
        const r = sc[hot[0]];
        title = `News: ${hot.join(", ")} (smart ${r.dir > 0 ? "long" : "short"}, score ${r.score})`;
        hot.forEach(c => N.alerted[c] = now);
      } else if (ALERT_TYPES.has("macro") && it.m && now - (N.alerted.__macro || 0) > 20 * 6e4) {
        title = "Macro news"; N.alerted.__macro = now;
      }
      if (!title) continue;
      const body = `${it.h}\n${it.src}${it.s ? " · " + ({ bull: "bullish", bear: "bearish", neut: "neutral" }[it.s] || it.s) : ""}`;
      try {
        const topic = process.env.NTFY_TOPIC, hook = process.env.DISCORD_WEBHOOK_URL;
        if (topic) await http(`https://ntfy.sh/${encodeURIComponent(topic)}`, { method: "POST", body, as: "text", tries: 2, headers: { Title: title, Tags: "newspaper", ...(it.url ? { Click: it.url } : {}) } });
        if (hook) await http(hook, { method: "POST", as: "text", tries: 2, headers: { "content-type": "application/json" }, body: JSON.stringify({ content: `**${title}**\n${body}${it.url ? `\n<${it.url}>` : ""}` }) });
        sent++;
      } catch (e) { console.error("news alert:", e.message); }
    }
    for (const k in N.alerted) if (now - N.alerted[k] > 864e5) delete N.alerted[k];
  }

  io.write("news.json", N);
  console.log(`News: ${out.length} new, ${out.filter(i => i.b).length} big, ${N.items.length} kept`);
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch(e => { console.error(e); process.exit(1); });
