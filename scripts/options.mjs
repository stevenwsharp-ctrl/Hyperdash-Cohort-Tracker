// Option chain stats from Cboe delayed quotes (15-minute delay).
import { http } from "./lib.mjs";

const RE = /^(.+?)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;

export async function optionStats(sym) {
  const j = await http(`https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(sym)}.json`, { tries: 2, timeoutMs: 60000 });
  const d = j.data || {};
  const price = +d.current_price || +d.close || 0;
  const now = Date.now();
  const byExp = new Map();
  let cOI = 0, pOI = 0, cV = 0, pV = 0;
  for (const o of d.options || []) {
    const m = String(o.option || "").match(RE); if (!m) continue;
    const exp = Date.UTC(2000 + +m[2], +m[3] - 1, +m[4], 20);
    const dte = (exp - now) / 864e5; if (dte < 0) continue;
    const type = m[5], strike = +m[6] / 1000;
    const oi = +o.open_interest || 0, vol = +o.volume || 0;
    if (type === "C") { cOI += oi; cV += vol; } else { pOI += oi; pV += vol; }
    if (!byExp.has(exp)) byExp.set(exp, { exp, dte, rows: [] });
    byExp.get(exp).rows.push({ type, strike, iv: +o.iv || 0 });
  }
  const exps = [...byExp.values()].sort((a, b) => a.exp - b.exp);
  if (!exps.length || !price) return { s: sym, t: new Date().toISOString(), none: true };
  // expiry closest to 30 days (at least 5 days out)
  const target = exps.filter(e => e.dte >= 5).sort((a, b) => Math.abs(a.dte - 30) - Math.abs(b.dte - 30))[0] || exps[exps.length - 1];
  const strikes = [...new Set(target.rows.map(r => r.strike))].sort((a, b) => Math.abs(a - price) - Math.abs(b - price));
  const atm = strikes[0];
  const ivs = target.rows.filter(r => r.strike === atm && r.iv > 0).map(r => r.iv);
  const ivAtm = ivs.length ? ivs.reduce((a, b) => a + b, 0) / ivs.length : null;
  const weeklyCount = exps.filter(e => e.dte <= 35).length;
  return {
    s: sym, t: new Date().toISOString(), price,
    ivAtm: ivAtm != null ? Math.round(ivAtm * 1000) / 10 : null, ivDte: Math.round(target.dte),
    pcOi: cOI ? Math.round(pOI / cOI * 100) / 100 : null,
    pcVol: cV ? Math.round(pV / cV * 100) / 100 : null,
    oi: cOI + pOI, vol: cV + pV,
    nExp: exps.length, near35: weeklyCount,
    nextExp: new Date(exps[0].exp).toISOString().slice(0, 10)
  };
}
