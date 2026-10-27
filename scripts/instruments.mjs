// Finds US-listed ways to trade each Hyperliquid market:
// the stock itself, proxy ETFs, leveraged / inverse ETFs, and whether each has options.
// Sources: Nasdaq Trader symbol lists (all US listings) and Cboe options symbol lists.
import { http, splitCoin } from "./lib.mjs";

// Index, commodity, FX, rates and ETF markets: proxies and leveraged funds.
// Every ticker here is checked against the live listing, so a delisted fund drops out.
const CURATED = {
  SP500: ["SPY VOO IVV", "SPXL UPRO SSO SPXS SPXU SDS SH"],
  US500: ["SPY VOO IVV", "SPXL UPRO SSO SPXS SPXU SDS SH"],
  XYZ100: ["QQQ QQQM", "TQQQ QLD SQQQ QID PSQ"],
  USTECH: ["QQQ QQQM", "TQQQ QLD SQQQ QID PSQ"],
  SMALL2000: ["IWM", "TNA URTY UWM TZA SRTY TWM RWM"],
  JP225: ["EWJ DXJ", "EZJ EWV JPNU"],
  KR200: ["EWY", "KORU KRWX"],
  GOLD: ["GLD IAU GLDM", "UGL UGLD GLL"],
  SILVER: ["SLV SIVR", "AGQ ZSL"],
  CL: ["USO", "UCO SCO"],
  BRENTOIL: ["BNO USO", "UCO SCO"],
  NATGAS: ["UNG", "BOIL KOLD"],
  COPPER: ["CPER COPX", ""],
  PLATINUM: ["PPLT", ""],
  PALLADIUM: ["PALL", ""],
  EUR: ["FXE", "ULE EUO"],
  JPY: ["FXY", "YCL YCS"],
  GBP: ["FXB", ""],
  "10Y": ["IEF", "UST TYD PST TYO"],
  "30Y": ["TLT", "TMF UBT TBT TMV TTT TBF"],
  USBOND: ["TLT", "TMF UBT TBT TMV TTT TBF"],
  "2Y": ["SHY", ""],
  TLT: ["TLT", "TMF UBT TBT TMV TTT TBF"],
  SOXL: ["SOXX SMH", "SOXL USD SOXS SSG"],
  SMH: ["SMH SOXX", "SOXL USD SOXS SSG"],
  XLE: ["XLE", "ERX ERY"],
  XBI: ["XBI", "LABU LABD"],
  GDX: ["GDX", "NUGT GDXU DUST GDXD"],
  EWZ: ["EWZ", "BRZU"],
  EWJ: ["EWJ", "EZJ EWV"],
  EWY: ["EWY", "KORU KRWX"],
  EWT: ["EWT", ""],
  KORU: ["EWY", "KORU KRWX"],
  IGV: ["IGV", ""],
  MAGS: ["MAGS", "MAGX"],
  URNM: ["URNM URA", ""]
};

// Markets with no US ticker of the same name. Search ETF names with these words.
const ALIAS = {
  SKHY: ["SK Hynix", "SKHY", "SKHX"], SKHX: ["SK Hynix", "SKHY", "SKHX"],
  SMSN: ["Samsung"], HYUNDAI: ["Hyundai"], XIAOMI: ["Xiaomi"], KIOXIA: ["Kioxia"],
  CXMT: ["CXMT"], CAMBRICON: ["Cambricon"], SOFTBANK: ["SoftBank"], TCNT: ["Tencent"],
  ZHIPU: ["Zhipu"], MINIMAX: ["MiniMax"], GIGADEV: ["GigaDevice"], JIO: ["Jio"],
  SHEIN: ["Shein"], UNITREE: ["Unitree"], ANTH: ["Anthropic"], ANT: ["Ant Group"],
  OAI: ["OpenAI"], SPCX: ["SpaceX", "SPCX"], BABA: ["Alibaba"], TSM: ["TSMC", "Taiwan Semiconductor"],
  GOOGL: ["GOOG", "Alphabet", "Google"], META: ["Meta Platforms"], BRK: ["Berkshire"]
};
const NO_TICKER_LOOKUP = new Set("SKHY SKHX SMSN HYUNDAI XIAOMI KIOXIA CXMT CAMBRICON SOFTBANK TCNT ZHIPU MINIMAX GIGADEV JIO SHEIN UNITREE ANTH ANT OAI PURRDAT BTCD TOTAL2 OTHERS BVIV".split(" "));

const CRYPTO = {
  BTC: ["Bitcoin"], ETH: ["Ether", "Ethereum"], SOL: ["Solana"], XRP: ["XRP"], DOGE: ["Dogecoin", "DOGE"],
  LTC: ["Litecoin"], LINK: ["Chainlink"], AVAX: ["Avalanche", "AVAX"], ADA: ["Cardano"], SUI: ["SUI"],
  HBAR: ["Hedera", "HBAR"], DOT: ["Polkadot"], HYPE: ["Hyperliquid", "HYPE"], BNB: ["BNB"], TRX: ["Tron", "TRX"],
  XLM: ["Stellar"], BCH: ["Bitcoin Cash"], TAO: ["Bittensor"], NEAR: ["NEAR"], AAVE: ["Aave"], UNI: ["Uniswap"],
  ENA: ["Ethena"], ONDO: ["Ondo"], PENGU: ["Pudgy Penguins", "PENGU"], TRUMP: ["TRUMP"], SEI: ["SEI"], APT: ["Aptos"],
  INJ: ["Injective"], ZEC: ["Zcash"], XMR: ["Monero"]
};

const EXCLUDE = /income|covered call|buffer|premium|yield|municipal|\bmuni\b|short[- ]term|short duration|ultra[- ]short|long\/short|dividend|option strategy|target income|enhanced/i;
const isLevName = n => !EXCLUDE.test(n) && (/\d+(\.\d+)?\s?x\b/i.test(n) || /\b(bull|bear|inverse|ultrashort|ultrapro|ultra)\b/i.test(n) || /^proshares short\b/i.test(n));
function levInfo(n) {
  const mx = n.match(/(\d+(?:\.\d+)?)\s?x\b/i);
  let x = mx ? +mx[1] : /ultrapro/i.test(n) ? 3 : /ultra/i.test(n) ? 2 : 1;
  const mneg = n.match(/-\s?(\d+(?:\.\d+)?)\b/); if (!mx && mneg) x = +mneg[1];
  const d = /\b(bear|short|inverse|ultrashort)\b|-\s?\d/i.test(n) ? -1 : 1;
  return { x, d };
}
const GENERIC = /^(applied|american|advanced|global|first|united|general|international|super|taiwan|china|bank|digital|strategy|micro|energy|national|power|data|cloud|core|target|select|dynamic|western|pacific|capital|financial|health|medical|royal|silver|gold|alpha|nuscale|new|the|smart|direct|rocket|sk|tempus)$/i;

function parseListings(txtA, txtB) {
  const map = {};
  const add = (sym, name, etf, test) => { if (!sym || test === "Y" || /File Creation/.test(sym)) return; map[sym] = { s: sym, n: name, etf: etf === "Y" }; };
  // otherlisted: ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol
  txtA.split("\n").slice(1).forEach(l => { const c = l.trim().split("|"); if (c.length > 6) add(c[0], c[1], c[4], c[6]); });
  // nasdaqlisted: Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares
  txtB.split("\n").slice(1).forEach(l => { const c = l.trim().split("|"); if (c.length > 6) add(c[0], c[1], c[6], c[3]); });
  return map;
}
function parseCboe(csv) {
  const set = new Set();
  csv.split("\n").forEach(l => { const m = l.match(/^"(?:[^"]|"")*","([A-Z0-9.\/]{1,8})"/); if (m) set.add(m[1]); });
  return set;
}
function parseWeekly(csv) {
  const set = new Set();
  csv.split("\n").forEach(l => { const m = l.match(/^"([A-Z0-9.\/]{1,8})","[^"]*[A-Za-z][^"]*"\s*$/); if (m) set.add(m[1]); });
  return set;
}
const wordRe = w => new RegExp(`(^|[^A-Za-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z0-9]|$)`, /[a-z]/.test(w) ? "i" : "");

export async function buildInstruments(coins) {
  const base = "https://www.nasdaqtrader.com/dynamic/SymDir/";
  const [a, b, cboeCsv, wkCsv] = await Promise.all([
    http(base + "otherlisted.txt", { as: "text" }),
    http(base + "nasdaqlisted.txt", { as: "text" }),
    http("https://www.cboe.com/us/options/symboldir/equity_index_options/?download=csv", { as: "text" }),
    http("https://www.cboe.com/available_weeklys/get_csv_download/", { as: "text" }).catch(() => "")
  ]);
  const L = parseListings(a, b), OPT = parseCboe(cboeCsv), WK = parseWeekly(wkCsv);
  if (Object.keys(L).length < 5000 || OPT.size < 1000) throw new Error(`Listing data looks wrong: ${Object.keys(L).length} listings, ${OPT.size} optionable`);
  const etfs = Object.values(L).filter(x => x.etf);
  const levEtfs = etfs.filter(x => isLevName(x.n));
  const item = (s, kind) => {
    const e = L[s]; if (!e) return null;
    const o = { s, n: e.n.replace(/\s+-\s+.*$/, "").slice(0, 80), opt: OPT.has(s), wk: WK.has(s) };
    if (kind === "lev") Object.assign(o, levInfo(e.n));
    return o;
  };
  const byName = (terms, pool) => {
    const res = terms.map(wordRe);
    return pool.filter(e => res.some(re => re.test(e.n))).map(e => e.s);
  };

  const out = {};
  for (const coin of coins) {
    const { venue, sym } = splitCoin(coin);
    let u = null, proxies = [], lev = [];
    if (!venue) {
      const terms = CRYPTO[sym]; if (!terms) continue;
      let hits = byName(terms, etfs.filter(e => !/miner|mining|blockchain|equit|compan|treasur|income|covered|buffer|premium|yield|option/i.test(e.n)));
      if (sym === "BTC") hits = hits.filter(s => !/Bitcoin Cash/i.test(L[s].n));
      hits.forEach(s => (isLevName(L[s].n) ? lev : proxies).push(s));
      // Many crypto funds are structured or income products. Keep the optionable ones (the big spot ETFs).
      const optProx = proxies.filter(s => OPT.has(s));
      proxies = (optProx.length ? optProx : proxies).filter(s => !/protect|structured|buffer|barrier|floor|hedg|ladder|income/i.test(L[s].n)).slice(0, 10);
    } else if (CURATED[sym]) {
      proxies = CURATED[sym][0].split(" ").filter(Boolean);
      lev = CURATED[sym][1].split(" ").filter(Boolean);
      // add any other fund that names the ticker
      byName([sym], levEtfs).forEach(s => { if (!lev.includes(s) && !proxies.includes(s)) lev.push(s); });
    } else {
      const terms = [sym, ...(ALIAS[sym] || [])];
      if (!NO_TICKER_LOOKUP.has(sym) && L[sym] && !L[sym].etf) {
        u = item(sym);
        const first = L[sym].n.split(/[\s,.]+/)[0];
        if (first && first.length >= 5 && !GENERIC.test(first)) terms.push(first);
      }
      lev = byName(terms, levEtfs).filter(s => s !== sym);
    }
    const P = [...new Set(proxies)].map(s => item(s)).filter(Boolean);
    const V = [...new Set(lev)].map(s => item(s, "lev")).filter(Boolean).sort((x, y) => y.d - x.d || y.x - x.x || x.s.localeCompare(y.s));
    if (u || P.length || V.length) out[coin] = { u, px: P, lev: V };
  }
  return { t: new Date().toISOString(), counts: { listings: Object.keys(L).length, optionable: OPT.size, weekly: WK.size, levEtfs: levEtfs.length }, m: out };
}
