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

export function agg(rows) {
  let L = 0, S = 0, t = 0;
  for (const r of rows) if (r) { L += r[2]; S += r[3]; t += r[0] + r[1]; }
  const n = L + S;
  return { L, S, n, b: n ? (L - S) / n : 0, traders: t };
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

// "xyz:AAOI" -> "XYZ:AAOI"; "BTC" -> "BTC"
export const normCoin = c => c.includes(":") ? c.split(":")[0].toUpperCase() + ":" + c.split(":").slice(1).join(":") : c;
export const splitCoin = c => { const i = c.indexOf(":"); return i < 0 ? { venue: "", sym: c } : { venue: c.slice(0, i), sym: c.slice(i + 1) }; };
