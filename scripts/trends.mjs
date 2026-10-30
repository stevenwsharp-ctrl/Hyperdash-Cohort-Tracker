// Alignment trends over time frames, and events such as "experts exiting".
// History entry per market: [smartBias, foolBias, price, epNetK, vpNetK, smartGrossK, foolNetK]
//   bias in -100..100, $ values in thousands. Older entries may have only the first 3 fields.

export const WINDOWS = { "30m": 0.5, "1h": 1, "4h": 4, "24h": 24, "7d": 168 };
// How far from the exact window start a snapshot may be. 30m needs a close match (snapshots every 5 min);
// 7d needs a full 7 days of history (a 5-day-old snapshot must not count as "7d").
const tolOf = h => h < 1 ? 8 * 6e4 : h >= 168 ? 3 * 36e5 : Math.max(20 * 6e4, h * 36e5 * 0.2);

const gapOf = v => (v[0] - v[1]) / 200;                 // -1..1
const netOf = v => v.length > 4 ? (v[3] || 0) + (v[4] || 0) : null; // smart net $K (+ = long)

// Snapshot closest to time t, within tolerance.
export function snapAt(snaps, T, t, tol) {
  let best = -1, bd = Infinity;
  for (let i = 0; i < snaps.length; i++) { const d = Math.abs(T[i] - t); if (d < bd) { bd = d; best = i; } }
  return best >= 0 && bd <= tol ? best : -1;
}

// Per market, per window: [dGap, dSmartBias, dFoolBias, smartNetChangePct (on setup side), smartNetChangeK, smartSidePriceMovePct]
const sameKind = snaps => { const v = snaps.length ? snaps[snaps.length - 1].v : undefined; return snaps.filter(s => s.v === v); };

export function computeTrends(snaps) {
  snaps = sameKind(snaps);
  if (!snaps.length) return {};
  const T = snaps.map(s => Date.parse(s.t));
  const iNow = snaps.length - 1, now = snaps[iNow].d, tNow = T[iNow];
  const out = {};
  const idx = {};
  for (const [k, h] of Object.entries(WINDOWS)) idx[k] = snapAt(snaps, T, tNow - h * 36e5, tolOf(h));
  for (const coin in now) {
    const v = now[coin], g = gapOf(v), dir = g >= 0 ? 1 : -1;
    const tr = {};
    for (const k in WINDOWS) {
      const i = idx[k]; if (i < 0 || i === iNow) continue;
      const w = snaps[i].d[coin]; if (!w) continue;
      const n1 = netOf(v), n0 = netOf(w);
      let pct = null, dk = null;
      if (n1 != null && n0 != null) {
        dk = Math.round(dir * (n1 - n0));
        const base = dir * n0;
        pct = base > 0 ? Math.round((dir * n1 / base - 1) * 100) : null;
      }
      const pm = v[2] && w[2] ? Math.round(dir * (v[2] / w[2] - 1) * 10000) / 100 : null;
      // 6,7: % change of all traders' long $ and short $; 8: funding change (hourly rate x1e7)
      const chg = (a, b) => a != null && b != null && b > 0 ? Math.round((a / b - 1) * 1000) / 10 : null;
      tr[k] = [Math.round((g - gapOf(w)) * 100), v[0] - w[0], v[1] - w[1], pct, dk, pm,
        v.length > 9 && w.length > 9 ? chg(v[8], w[8]) : null, v.length > 9 && w.length > 9 ? chg(v[9], w[9]) : null,
        v.length > 7 && w.length > 7 && v[7] != null && w[7] != null ? v[7] - w[7] : null];
    }
    if (Object.keys(tr).length) out[coin] = tr;
  }
  return out;
}

const COOLDOWN_H = { exit: 4, flip: 8, fade: 6, add: 8, new: 12 };

// Find events in the newest snapshot. state = { last: { "coin|type": ms } }
export function detectEvents(snaps, state) {
  snaps = sameKind(snaps);
  const evs = [];
  if (snaps.length < 2) return evs;
  const T = snaps.map(s => Date.parse(s.t));
  const iNow = snaps.length - 1, now = snaps[iNow].d, tNow = T[iNow];
  const prev = snaps[iNow - 1].d;
  const fmtK = k => Math.abs(k) >= 1000 ? `$${(k / 1000).toFixed(2)}M` : `$${Math.round(k)}K`;
  const push = (coin, type, win, text, extra) => {
    const key = coin + "|" + type, last = state.last[key] || 0;
    if (tNow - last < COOLDOWN_H[type] * 36e5) return;
    state.last[key] = tNow;
    evs.push({ t: snaps[iNow].t, v: 2, coin, type, win, text, ...extra });
  };
  for (const coin in now) {
    const v = now[coin], g = gapOf(v);
    // New strong setup: gap crosses 50
    const p = prev[coin];
    if (p && Math.abs(g) >= 0.5 && !(Math.abs(gapOf(p)) >= 0.5 && Math.sign(gapOf(p)) === Math.sign(g)))
      push(coin, "new", "5m", `New setup: smart ${g > 0 ? "long" : "short"}, gap ${Math.round(g * 100)}`, { dir: Math.sign(g), gap: Math.round(g * 100), px: v[2] });
    for (const win of ["1h", "4h"]) {
      const h = WINDOWS[win];
      const i = snapAt(snaps, T, tNow - h * 36e5, Math.max(20 * 6e4, h * 36e5 * 0.25)); if (i < 0) continue;
      const w = snaps[i].d[coin]; if (!w) continue;
      const g0 = gapOf(w), dir = g0 >= 0 ? 1 : -1;
      const active = Math.abs(g0) >= 0.4 && (w.length < 6 || w[5] >= 50);
      if (!active) continue;
      const side = dir > 0 ? "long" : "short";
      const n0 = netOf(w), n1 = netOf(v);
      const extra = { dir, win, gap0: Math.round(g0 * 100), gap: Math.round(g * 100), sb0: w[0], sb: v[0], px: v[2] };
      if (n0 != null && n1 != null) {
        const d0 = dir * n0, d1 = dir * n1;
        if (d0 > 0 && d0 - d1 >= Math.max(100, 0.3 * d0)) {
          const ep = v.length > 4 && w.length > 4 ? dir * (v[3] - w[3]) : null, vp = v.length > 4 && w.length > 4 ? dir * (v[4] - w[4]) : null;
          const who = ep != null && vp != null ? (ep < vp ? "Extremely Profitable" : "Very Profitable") : "Smart";
          push(coin, "exit", win, `Experts exiting the ${side}: smart ${side} exposure down ${Math.round((1 - d1 / d0) * 100)}% (${fmtK(d0)} → ${fmtK(d1)}) in ${win}. Most from ${who}.`, { ...extra, net0: Math.round(d0), net: Math.round(d1) });
        } else if (d0 > 0 && d1 - d0 >= Math.max(250, 0.5 * d0)) {
          push(coin, "add", win, `Experts adding to the ${side}: smart ${side} exposure up ${Math.round((d1 / d0 - 1) * 100)}% (${fmtK(d0)} → ${fmtK(d1)}) in ${win}.`, { ...extra, net0: Math.round(d0), net: Math.round(d1) });
        }
      }
      if (Math.sign(v[0]) === -dir && Math.abs(v[0]) >= 20 && Math.sign(w[0]) === dir)
        push(coin, "flip", win, `Experts flipped: smart bias went from ${w[0] > 0 ? "+" : ""}${w[0]} to ${v[0] > 0 ? "+" : ""}${v[0]} in ${win}.`, extra);
      if (dir * (g0 - g) >= 0.25)
        push(coin, "fade", win, `Setup fading: gap went from ${Math.round(g0 * 100)} to ${Math.round(g * 100)} in ${win}.`, extra);
    }
  }
  return evs;
}
