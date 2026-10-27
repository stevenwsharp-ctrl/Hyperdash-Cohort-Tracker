// Shared helpers for the data scripts.
import fs from "node:fs";
import path from "node:path";

export const SMART = ["extremely_profitable", "very_profitable"];
export const FOOLS = ["unprofitable", "very_unprofitable", "rekt"];

export function makeIO(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return {
    read: (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { return d; } },
    write: (f, o) => fs.writeFileSync(path.join(dir, f), JSON.stringify(o))
  };
}

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36 cohort-sniper";

export async function http(url, { method = "GET", body, headers = {}, tries = 3, as = "json", timeoutMs = 45000 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const r = await fetch(url, { method, body, headers: { "user-agent": UA, accept: "*/*", ...headers }, signal: ac.signal });
      const txt = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status} ${url}: ${txt.slice(0, 160)}`);
      return as === "json" ? JSON.parse(txt) : txt;
    } catch (e) {
      last = e;
      if (i < tries - 1) await new Promise(r => setTimeout(r, 3000 * (i + 1)));
    } finally { clearTimeout(timer); }
  }
  throw last;
}

// Weight of $ bias vs trader-count bias (the page default is the same).
export const W_DOLLAR = 0.6;
export function agg(rows, w = W_DOLLAR) {
  let L = 0, S = 0, lt = 0, st = 0;
  for (const r of rows) if (r) { L += r[2]; S += r[3]; lt += r[0]; st += r[1]; }
  const n = L + S, tc = lt + st;
  const bd = n ? (L - S) / n : 0, bc = tc ? (lt - st) / tc : 0;
  return { L, S, n, bd, bc, b: tc ? w * bd + (1 - w) * bc : bd, traders: tc };
}

// Same formula as the page with default settings.
export function score(latest, coin, minN = 50000) {
  const P = latest.pnl, m = latest.m[coin];
  const sI = SMART.map(id => P.findIndex(c => c.id === id)).filter(i => i >= 0);
  const fI = FOOLS.map(id => P.findIndex(c => c.id === id)).filter(i => i >= 0);
  const sm = agg(sI.map(i => m.p[i])), fo = agg(fI.map(i => m.p[i]));
  const gap = (sm.b - fo.b) / 2, dir = gap >= 0 ? 1 : -1;
  let agree = 1; const red = [];
  for (const i of sI) {
    const c = agg([m.p[i]]);
    if (c.n < minN / 2) continue;
    if (Math.sign(c.b) === -dir && Math.abs(c.b) >= 0.1) { agree *= 1 - 0.5 * Math.min(1, Math.abs(c.b)); red.push(P[i].label); }
  }
  const minSide = Math.min(sm.n, fo.n);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const depth = minSide <= 0 ? 0 : clamp(0.4 + 0.3 * Math.log10(minSide / minN), 0.4, 1);
  const tdepth = clamp(Math.sqrt(sm.traders / 10), 0.5, 1);
  return { coin, sm, fo, gap, dir, red, minSide, score: minSide >= minN ? Math.round(100 * Math.abs(gap) * agree * depth * tdepth) : 0 };
}

// Markets that are not single stocks (indices, commodities, FX, rates, ETFs). Same lists as the page.
export const NONSTOCK = new Set(("SP500 XYZ100 JP225 KR200 US500 USTECH SMALL2000 BTCD TOTAL2 OTHERS BVIV " +
  "BRENTOIL CL COPPER GOLD SILVER HO NATGAS PALLADIUM PLATINUM URANIUM WHEAT CORN ALUMINIUM " +
  "EUR GBP JPY CHF AUD CAD DXY 10Y 2Y 30Y USBOND " +
  "EWJ EWT EWY EWZ GDX IGV KORU MAGS SMH SOXL SOXX TLT URNM XBI XLE DRV SPY QQQ IWM ARKK").split(" "));
// A stock market is tradable at Fidelity when its share is listed on a US exchange (NYSE, Nasdaq, NYSE American, NYSE Arca, Cboe, IEX).
// Crypto and non-stock markets always pass. Every market here is also tradable on Hyperdash.
export function fidelityOK(coin, inst) {
  if (!coin.includes(":")) return true;
  const sym = coin.split(":").slice(1).join(":");
  if (NONSTOCK.has(sym)) return true;
  if (!inst || !inst.m) return true;              // no listing data yet: do not hide
  const I = inst.m[coin];
  return !!(I && I.u);
}

// "xyz:AAOI" -> "XYZ:AAOI"; "BTC" -> "BTC"
export const normCoin = c => c.includes(":") ? c.split(":")[0].toUpperCase() + ":" + c.split(":").slice(1).join(":") : c;
export const splitCoin = c => { const i = c.indexOf(":"); return i < 0 ? { venue: "", sym: c } : { venue: c.slice(0, i), sym: c.slice(i + 1) }; };
