/* First Breaths · a spider-web intelligence factor (same file on LETF Sniper, SOXX Sniper, Cohort Sniper and Mastermind Investor;
   they share this browser's storage, so all four learn into one memory).
   Job: find the first signs of an inflection point — the moment a move starts to REVERSE, or starts to AMPLIFY (continue).
   When you open a stock, ETF or crypto, the card shows two lists: reversal breaths and continuation breaths. A list with no
   breath is not shown. Each breath shows the exact bar it flashed on (bar close time, your clock), the price, how long ago,
   its learned reliability and how many times it repeated.

   Data: 1-minute bars, read live (stocks and ETFs: Yahoo through the Worker, with pre-market and after-hours, every 15 s;
   crypto and Hyperliquid markets: Hyperliquid candles, every 5 s). 5-minute bars are built from the 1-minute bars.
   Only closed bars count, so a breath does not flicker on and off inside a bar.

   The current move: up if the last 30 bars rose 1.5 ATR or more (or EMA 20 > EMA 50 and price above EMA 50), down the
   other way, else no move. A breath is judged against the move of the bar before it.
   Reversal breaths: RSI divergence at a new extreme · volume climax then a reversal bar · rejection wick at a 20-bar extreme
     · snap back from a 2.5σ VWAP stretch · failed breakout · structure break (change of character) · engulfing bar at the
     extreme · VWAP lost against the move · a squeeze or a range break against the move.
   Continuation breaths: breakout of the 30-bar range on volume · pullback to EMA 20 that held · flag breakout · squeeze
     release with the move · higher low / lower high confirmed · momentum ignition · VWAP reclaimed with the move.

   How it learns (fast, and it keeps the reliable ones): every breath is scored once its time is up (1-minute breaths after
   15 bars, 5-minute breaths after 6 bars): a hit if price moved 1 ATR its way before 1 ATR against it (or ended its way).
   On the first open of a market, all breaths in the last 3–5 days of bars are scored at once, so it starts with a track record.
   Reliability = hit rate on this market, pulled toward the hit rate of the same breath on all markets of the same kind
   (stock, leveraged ETF, crypto) until this market has enough of its own. Proven: 30+ scored and 57%+. Breaths that fail
   (under 46% over 30+) are hidden. Ranking = strength × reliability × repetition (the same breath again, the same type on
   the other time frame, other breaths of the same type) × freshness.
   Push: every new breath is highlighted in its list; a reliable (53%+), repeated or confirmed one also pops up; sound and browser notifications are optional (buttons on the card).
   Into the spider web: fb.rev and fb.cont are emitted as signals (signed by the direction they point), so the web learns them.
   API: FB.select({sym|coin, src:"y"|"hl", cls, label}) · FB.scan(bars, opts) (pure, for tests) · FB.stats() */
(function () {
  "use strict";
  if (window.FB) return;
  const WORKER0 = "https://soxx-sniper-fred.sharpventures.workers.dev", HLAPI = "https://api.hyperliquid.xyz/info", KEY = "fb_v1";
  const TFS = { "1m": { ms: 6e4, H: 15 }, "5m": { ms: 3e5, H: 6 } };
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const cl = (v, a, b) => Math.max(a, Math.min(b, v)), c1 = v => cl(v, -1, 1);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));

  const NAME = {
    "r.div": "RSI divergence at a new extreme", "r.climax": "Volume climax, then a reversal bar", "r.wick": "Rejection wick at the 20-bar extreme",
    "r.snap": "Snap back from a 2.5σ VWAP stretch", "r.fail": "Failed breakout", "r.choch": "Structure break (change of character)",
    "r.engulf": "Engulfing bar at the extreme", "x.vwap": "VWAP cross", "x.break": "Range break on volume", "x.squeeze": "Squeeze release",
    "c.pull": "Pullback to EMA 20 held", "c.flag": "Flag breakout", "c.hl": "Higher low / lower high confirmed", "c.accel": "Momentum ignition"
  };

  // ---------- learned reliability (shared by every site in this browser) ----------
  let ST = lsG(KEY, null); if (!ST || ST.v !== 1) ST = { v: 1, c: {}, s: {}, done: {}, at: {} };
  let stT = 0, stDirty = false;
  const stSave = force => { if (!stDirty || (!force && Date.now() - stT < 1e4)) return; stT = Date.now(); stDirty = false;
    const syms = Object.keys(ST.s); if (syms.length > 300) syms.sort((a, b) => (ST.at[a] || 0) - (ST.at[b] || 0)).slice(0, syms.length - 300).forEach(s => { delete ST.s[s]; delete ST.at[s]; Object.keys(ST.done).forEach(k => { if (k.startsWith(s + "|")) delete ST.done[k]; }); });
    lsS(KEY, ST); };
  setInterval(() => stSave(), 15e3); addEventListener("pagehide", () => stSave(true));
  const reloadSt = () => { const f = lsG(KEY, null); if (f && f.v === 1) { // merge: keep the larger counts (another tab may have learned more)
      for (const L of ["c", "s"]) for (const g in f[L]) for (const k in f[L][g]) { const a = f[L][g][k], b = ((ST[L][g] = ST[L][g] || {})[k]); if (!b || a[0] > b[0]) ST[L][g][k] = a; }
      for (const k in f.done) if (!ST.done[k] || f.done[k] > ST.done[k]) ST.done[k] = f.done[k]; } };
  function learn(sym, cls, key, hit, r) {
    for (const [L, g] of [["c", cls], ["s", sym]]) { const G = ST[L][g] = ST[L][g] || {}, o = G[key] = G[key] || [0, 0, 0]; o[0]++; o[1] += hit; o[2] = Math.round((o[2] + cl(r, -3, 3)) * 100) / 100; }
    ST.at[sym] = Date.now(); stDirty = true;
  }
  function rel(sym, cls, key) {
    const C = (ST.c[cls] || {})[key] || [0, 0, 0], S = (ST.s[sym] || {})[key] || [0, 0, 0];
    const base = (C[1] + 5) / (C[0] + 10), p = (S[1] + base * 20) / (S[0] + 20), nEff = S[0] + C[0] * 0.25;
    const avgR = (S[2] + C[2] * 0.25) / Math.max(1, nEff);
    const tier = nEff >= 30 && p >= 0.57 ? "proven" : nEff >= 30 && p < 0.46 ? "weak" : nEff >= 10 ? "learning" : "new";
    return { p, n: S[0], nc: C[0], nEff, avgR, tier, z: S[0] ? (S[1] - S[0] / 2) / Math.sqrt(S[0] / 4) : 0 };
  }

  // ---------- indicators (one pass each, O(n)) ----------
  const isDST = ms => { const y = new Date(ms).getUTCFullYear(), nth = (m, n) => { const w = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((7 - w) % 7) + (n - 1) * 7; };
    return ms >= Date.UTC(y, 2, nth(2, 2), 7) && ms < Date.UTC(y, 10, nth(10, 1), 6); };
  const sessOf = (t, crypto) => crypto ? Math.floor(t / 864e5) : Math.floor((t - (isDST(t) ? 4 : 5) * 36e5) / 864e5);
  function ema(a, n) { const k = 2 / (n + 1), o = new Array(a.length); let e = null; for (let i = 0; i < a.length; i++) { e = e == null ? a[i] : a[i] * k + e * (1 - k); o[i] = e; } return o; }
  function prep(B, crypto) {
    const n = B.length, t = new Array(n), o = new Array(n), h = new Array(n), l = new Array(n), c = new Array(n), v = new Array(n);
    for (let i = 0; i < n; i++) { const b = B[i]; t[i] = b[0]; o[i] = +b[1]; h[i] = +b[2]; l[i] = +b[3]; c[i] = +b[4]; v[i] = +b[5] || 0; }
    const e9 = ema(c, 9), e20 = ema(c, 20), e50 = ema(c, 50), atr = new Array(n), rsi = new Array(n), vav = new Array(n), vw = new Array(n), vsd = new Array(n);
    let a = null, g = 0, ls = 0, vs = 0, pv = 0, vv = 0, p2 = 0, sk = null;
    for (let i = 0; i < n; i++) {
      const tr = i ? Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1])) : h[i] - l[i];
      a = a == null ? tr : (a * 13 + tr) / 14; atr[i] = i >= 14 ? Math.max(a, c[i] * 2e-4) : NaN;
      if (i) { const d = c[i] - c[i - 1]; if (i <= 14) { g += Math.max(d, 0) / 14; ls += Math.max(-d, 0) / 14; } else { g = (g * 13 + Math.max(d, 0)) / 14; ls = (ls * 13 + Math.max(-d, 0)) / 14; } }
      rsi[i] = i >= 14 ? (ls === 0 ? 100 : 100 - 100 / (1 + g / ls)) : NaN;
      vav[i] = i >= 20 ? vs / 20 : NaN; vs += v[i]; if (i >= 20) vs -= v[i - 20];
      const s = sessOf(t[i], crypto); if (s !== sk) { sk = s; pv = 0; vv = 0; p2 = 0; }
      const tp = (h[i] + l[i] + c[i]) / 3, w = Math.max(v[i], 1e-9) + (v[i] > 0 ? 0 : 1); pv += tp * w; vv += w; p2 += tp * tp * w;
      vw[i] = pv / vv; vsd[i] = Math.sqrt(Math.max(0, p2 / vv - vw[i] * vw[i]));
    }
    // Bollinger 20/2 and its width; rolling extremes of the PRIOR bars
    const bbU = new Array(n), bbD = new Array(n), bbw = new Array(n), hh30 = new Array(n), ll30 = new Array(n), hh20 = new Array(n), ll20 = new Array(n);
    let s1 = 0, s2 = 0;
    for (let i = 0; i < n; i++) { s1 += c[i]; s2 += c[i] * c[i]; if (i >= 20) { s1 -= c[i - 20]; s2 -= c[i - 20] * c[i - 20]; }
      if (i >= 19) { const m = s1 / 20, sd = Math.sqrt(Math.max(0, s2 / 20 - m * m)); bbU[i] = m + 2 * sd; bbD[i] = m - 2 * sd; bbw[i] = m > 0 ? 4 * sd / m : NaN; } else { bbU[i] = bbD[i] = bbw[i] = NaN; }
      let H3 = -Infinity, L3 = Infinity, H2 = -Infinity, L2 = Infinity;
      for (let k = Math.max(0, i - 30); k < i; k++) { if (h[k] > H3) H3 = h[k]; if (l[k] < L3) L3 = l[k]; if (k >= i - 20) { if (h[k] > H2) H2 = h[k]; if (l[k] < L2) L2 = l[k]; } }
      hh30[i] = H3; ll30[i] = L3; hh20[i] = H2; ll20[i] = L2; }
    // the move each bar belongs to: +1 up, −1 down, 0 none
    const dir = new Array(n).fill(0);
    for (let i = 50; i < n; i++) { const m = c[i] - c[i - 30], A = atr[i]; if (!(A > 0)) continue;
      dir[i] = Math.abs(m) >= 1.5 * A ? Math.sign(m) : e20[i] > e50[i] && c[i] > e50[i] ? 1 : e20[i] < e50[i] && c[i] < e50[i] ? -1 : 0; }
    return { n, t, o, h, l, c, v, e9, e20, e50, atr, rsi, vav, vw, vsd, bbU, bbD, bbw, hh30, ll30, hh20, ll20, dir };
  }

  // ---------- the breaths (pure: bars in, flashes out) ----------
  function scan(P, from) {
    const { n, t, o, h, l, c, v, e20, e50, atr, rsi, vav, vw, vsd, bbU, bbD, bbw, hh30, ll30, hh20, ll20, dir } = P, F = [], last = {};
    let PH = null, pPH = null, PL = null, pPL = null, side = 0, run = 0;
    const st = Math.max(60, from || 0);
    for (let i = 3; i < n; i++) {
      // pivots confirmed at i (3 bars each side), causal
      const j = i - 3; if (j >= 3) { let isH = true, isL = true; for (let k = j - 3; k <= j + 3; k++) { if (k === j) continue; if (h[k] > h[j]) isH = false; if (l[k] < l[j]) isL = false; }
        if (isH) { pPH = PH; PH = { j, p: h[j], at: i }; } if (isL) { pPL = PL; PL = { j, p: l[j], at: i }; } }
      const sd = Math.sign(c[i] - vw[i]); let cross = 0;
      if (sd && sd !== side) { if (side && run >= 8) cross = sd; side = sd; run = 1; } else if (sd) run++;
      if (i < st) continue;
      const A = atr[i], d = dir[i - 1]; if (!(A > 0)) continue;
      const vk = vav[i] > 0, vr = vk ? v[i] / vav[i] : 1, push = (id, dx, s, why, fixed) => {
        if (!dx) return; const type = fixed || (d && dx === d ? "cont" : d ? "rev" : "cont");
        const pv = last[id + dx]; if (pv != null && i - pv <= 3) return; last[id + dx] = i;   // the same breath on the next 3 bars is one breath
        F.push({ id, i, t: t[i], dir: dx, type, s: Math.round(cl(s, 0.2, 1) * 100) / 100, px: c[i], atr: A, why }); };
      // --- reversal breaths (need a move) ---
      if (d) {
        const P1 = d > 0 ? PH : PL;
        if (P1 && i - P1.j >= 5 && i - P1.j <= 40 && isFinite(rsi[P1.j])) {
          if (d > 0 && h[i] > hh30[i] && h[i] > P1.p && rsi[P1.j] >= 60 && rsi[i] < rsi[P1.j] - 4) push("r.div", -1, (rsi[P1.j] - rsi[i]) / 15, `new high, but RSI ${rsi[i].toFixed(0)} < ${rsi[P1.j].toFixed(0)} at the last high`, "rev");
          if (d < 0 && l[i] < ll30[i] && l[i] < P1.p && rsi[P1.j] <= 40 && rsi[i] > rsi[P1.j] + 4) push("r.div", 1, (rsi[i] - rsi[P1.j]) / 15, `new low, but RSI ${rsi[i].toFixed(0)} > ${rsi[P1.j].toFixed(0)} at the last low`, "rev");
        }
        const k = i - 1, rk = h[k] - l[k], mid = (h[k] + l[k]) / 2;
        if (vav[k] > 0 && v[k] >= 3 * vav[k] && rk >= 1.8 * atr[k] && Math.sign(c[k] - o[k]) === d && (d > 0 ? c[i] < mid : c[i] > mid))
          push("r.climax", -d, v[k] / vav[k] / 6, `volume ${(v[k] / vav[k]).toFixed(1)}× normal on a ${(rk / atr[k]).toFixed(1)} ATR bar, then a close back past its middle`, "rev");
        const rg = h[i] - l[i], wk = d > 0 ? h[i] - Math.max(o[i], c[i]) : Math.min(o[i], c[i]) - l[i];
        if (rg >= 1.2 * A && wk >= 0.6 * rg && (d > 0 ? h[i] >= hh20[i] : l[i] <= ll20[i]) && (!vk || vr >= 1))
          push("r.wick", -d, wk / rg, `${Math.round(wk / rg * 100)}% of the bar is a ${d > 0 ? "top" : "bottom"} wick at the 20-bar ${d > 0 ? "high" : "low"}`, "rev");
        if (vsd[i] > 0 && vsd[i - 1] > 0 && (d > 0 ? c[i - 1] > vw[i - 1] + 2.5 * vsd[i - 1] && c[i] < vw[i] + 2 * vsd[i] : c[i - 1] < vw[i - 1] - 2.5 * vsd[i - 1] && c[i] > vw[i] - 2 * vsd[i]))
          push("r.snap", -d, 0.7, `was ${Math.abs((c[i - 1] - vw[i - 1]) / vsd[i - 1]).toFixed(1)}σ from VWAP, now back inside 2σ`, "rev");
        for (let q = i - 3; q < i; q++) { const L0 = d > 0 ? hh30[q] : ll30[q];
          if (isFinite(L0) && (d > 0 ? c[q] > L0 + 0.1 * A && c[i] < L0 - 0.4 * A && c[i - 1] >= L0 - 0.4 * A : c[q] < L0 - 0.1 * A && c[i] > L0 + 0.4 * A && c[i - 1] <= L0 + 0.4 * A)) {
            push("r.fail", -d, 0.75, `broke the 30-bar ${d > 0 ? "high" : "low"} ${L0.toPrecision(5)} ${i - q} bar${i - q > 1 ? "s" : ""} ago, now back ${d > 0 ? "below" : "above"} it`, "rev"); break; } }
        const P2 = d > 0 ? PL : PH, Pp = d > 0 ? pPL : pPH;
        if (P2 && i - P2.j <= 60 && (d > 0 ? c[i] < P2.p && c[i - 1] >= P2.p : c[i] > P2.p && c[i - 1] <= P2.p)) {
          const clean = Pp && (d > 0 ? P2.p > Pp.p : P2.p < Pp.p);
          push("r.choch", -d, clean ? 0.8 : 0.55, `closed ${d > 0 ? "below the last swing low" : "above the last swing high"} ${P2.p.toPrecision(5)}${clean ? ` (it was a ${d > 0 ? "higher low" : "lower high"})` : ""}`, "rev"); }
        const bi = Math.abs(c[i] - o[i]), bk = Math.abs(c[k] - o[k]);
        if (bk > 0.2 * A && bi >= bk && (!vk || vr >= 1) && (d > 0 ? c[k] > o[k] && h[k] >= hh20[k] && c[i] < o[i] && o[i] >= c[k] && c[i] <= o[k] : c[k] < o[k] && l[k] <= ll20[k] && c[i] > o[i] && o[i] <= c[k] && c[i] >= o[k]))
          push("r.engulf", -d, 0.5 + Math.min(0.4, (bi / bk - 1)), `${d > 0 ? "down" : "up"} bar swallows the last ${d > 0 ? "up" : "down"} bar at the 20-bar ${d > 0 ? "high" : "low"}`, "rev");
        if (cross) push("x.vwap", cross, 0.55, `${cross > 0 ? "reclaimed" : "lost"} VWAP ${vw[i].toPrecision(5)} after 8+ bars on the other side`);
        // --- continuation breaths (need a move) ---
        if ((d > 0 ? e20[i] > e50[i] : e20[i] < e50[i])) { let ext = d > 0 ? Infinity : -Infinity; for (let q = i - 4; q <= i; q++) ext = d > 0 ? Math.min(ext, l[q]) : Math.max(ext, h[q]);
          let str = 0; for (let q = i - 16; q < i - 4; q++) str = Math.max(str, d * (c[q] - e20[q]) / A);
          const touched = str >= 1.5 && (d > 0 ? ext <= e20[i] + 0.15 * A && ext >= e50[i] - 0.5 * A : ext >= e20[i] - 0.15 * A && ext <= e50[i] + 0.5 * A);
          if (touched && (d > 0 ? c[i] > e20[i] && c[i] > h[i - 1] && c[i] > o[i] : c[i] < e20[i] && c[i] < l[i - 1] && c[i] < o[i])) push("c.pull", d, 0.6, `ran ${str.toFixed(1)} ATR from EMA 20, dipped back to it (${e20[i].toPrecision(5)}) and held; this bar closed past the last bar's ${d > 0 ? "high" : "low"}`, "cont"); }
        if (i >= 21) { const imp = d * (c[i - 9] - c[i - 21]); let fh = -Infinity, fl = Infinity; for (let q = i - 8; q < i; q++) { fh = Math.max(fh, h[q]); fl = Math.min(fl, l[q]); }
          if (imp >= 2.5 * A && fh - fl <= 1.3 * A && (d > 0 ? fl >= c[i - 9] - 0.5 * imp && c[i] > fh : fh <= c[i - 9] + 0.5 * imp && c[i] < fl))
            push("c.flag", d, 0.6 + Math.min(0.4, imp / A / 15), `a ${(imp / A).toFixed(1)} ATR push, 8 tight bars, then a break ${d > 0 ? "up" : "down"}`, "cont"); }
        const Pn = d > 0 ? PL : PH, Po = d > 0 ? pPL : pPH;
        if (Pn && Pn.at === i && Po && (d > 0 ? Pn.p - Po.p >= 0.5 * A && c[i] > e20[i] && Pn.p <= Math.min(...l.slice(Math.max(0, Pn.j - 8), i + 1)) : Po.p - Pn.p >= 0.5 * A && c[i] < e20[i] && Pn.p >= Math.max(...h.slice(Math.max(0, Pn.j - 8), i + 1))))
          push("c.hl", d, 0.55, `${d > 0 ? "higher low" : "lower high"} ${Pn.p.toPrecision(5)} confirmed (last one ${Po.p.toPrecision(5)})`, "cont");
        const m5 = d * (c[i] - c[i - 5]), m5p = d * (c[i - 5] - c[i - 10]); let v5 = 0; for (let q = i - 4; q <= i; q++) v5 += v[q];
        if (m5 >= 1.8 * A && m5p < 0.6 * m5 && (!vk || v5 >= 1.8 * 5 * vav[i])) push("c.accel", d, 0.5 + Math.min(0.5, m5 / A / 8), `${(m5 / A).toFixed(1)} ATR in 5 bars, faster than the 5 before${vk ? `, volume ${(v5 / 5 / vav[i]).toFixed(1)}×` : ""}`, "cont");
      }
      // --- both kinds: a range break or a squeeze; its type comes from the move (with it = continuation, against it = reversal) ---
      if (c[i] > hh30[i] && c[i - 1] <= hh30[i - 1] && (!vk || vr >= 1.5)) push("x.break", 1, vk ? vr / 4 : 0.45, `first close above the 30-bar high ${hh30[i].toPrecision(5)}${vk ? `, volume ${vr.toFixed(1)}×` : ""}`);
      if (c[i] < ll30[i] && c[i - 1] >= ll30[i - 1] && (!vk || vr >= 1.5)) push("x.break", -1, vk ? vr / 4 : 0.45, `first close below the 30-bar low ${ll30[i].toPrecision(5)}${vk ? `, volume ${vr.toFixed(1)}×` : ""}`);
      if (isFinite(bbw[i - 1])) { let mn = Infinity; for (let q = Math.max(19, i - 60); q < i; q++) if (bbw[q] < mn) mn = bbw[q];
        if (bbw[i - 1] <= 1.05 * mn && i - 60 >= 19) { const dx = c[i] > bbU[i] ? 1 : c[i] < bbD[i] ? -1 : 0;
          if (dx) push("x.squeeze", dx, 0.7, `the tightest Bollinger width in 60 bars, now a close ${dx > 0 ? "above" : "below"} the band`); } }
    }
    return F;
  }
  // outcome of a flash: +1 ATR its way before −1 ATR against it; else where it ended. null = not known yet (or a session gap)
  function outcome(P, f, H, tfms) {
    const { n, t, h, l, c } = P, i = f.i, end = Math.min(n - 1, i + H), up = f.px + f.dir * f.atr, dn = f.px - f.dir * f.atr;
    for (let q = i + 1; q <= end; q++) { const tg = f.dir > 0 ? h[q] >= up : l[q] <= up, sp = f.dir > 0 ? l[q] <= dn : h[q] >= dn;
      if (sp) return { done: true, hit: 0, r: -1, at: t[q], how: "stop" }; if (tg) return { done: true, hit: 1, r: 1, at: t[q], how: "target" }; }
    if (i + H > n - 1) return { done: false, r: f.dir * (c[n - 1] - f.px) / f.atr };
    if (t[i + H] - t[i] > H * tfms * 3) return null;
    const r = f.dir * (c[i + H] - f.px) / f.atr; return { done: true, hit: r > 0 ? 1 : 0, r, at: t[i + H], how: "time" };
  }
  function agg(B, ms) { const o = []; let cur = null, k = -1; for (const b of B) { const kk = Math.floor(b[0] / ms); if (kk !== k) { if (cur) o.push(cur); k = kk; cur = [kk * ms, b[1], b[2], b[3], b[4], b[5] || 0]; } else { cur[2] = Math.max(cur[2], b[2]); cur[3] = Math.min(cur[3], b[3]); cur[4] = b[4]; cur[5] += b[5] || 0; } }
    if (cur) o.push(cur); return o; }

  // ---------- the selected market ----------
  const LEV = new Set("SOXL SOXS TQQQ SQQQ SPXL SPXS UPRO SPXU TNA TZA LABU LABD FNGU FNGD TECL TECS NVDL NVDU NVDD TSLL TSLQ TSLZ CONL MSTU MSTX MSTZ UDOW SDOW YINN YANG FAS FAZ NUGT DUST JNUG JDST GUSH DRIP ERX ERY UVXY SVXY BITX BITU SBIT ETHU AMDL QLD SSO SDS QID BOIL KOLD UCO SCO TMF TMV".split(" "));
  let SEL = null, X = null, alive = 0;   // X: state of the selected market
  const proxy = () => { try { return (localStorage.getItem("soxx_fred_proxy") || "").trim().replace(/\/+$/, "") || WORKER0; } catch (e) { return WORKER0; } };
  async function fetchBars(x, first) {
    if (x.src === "hl") { const end = Date.now(), start = first || !x.B.length ? end - 3 * 864e5 : x.B[Math.max(0, x.B.length - 3)][0];
      const r = await fetch(HLAPI, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "candleSnapshot", req: { coin: x.coin, interval: "1m", startTime: start, endTime: end } }) });
      if (!r.ok) throw new Error("Hyperliquid " + r.status); const j = await r.json(); return (j || []).map(b => [b.t, +b.o, +b.h, +b.l, +b.c, +b.v * +b.c]); }
    const r = await fetch(`${proxy()}/chart?t=${encodeURIComponent(x.ysym)}&range=${first || !x.B.length ? "5d" : "1d"}&interval=1m`); const j = await r.json();
    if (j.status !== "ok") throw new Error(j.error || "chart error"); return (j.bars || []).filter(b => b[1] != null && b[2] != null && b[3] != null && b[4] != null);
  }
  function merge(A, N) { if (!N.length) return A; const t0 = N[0][0]; const out = A.filter(b => b[0] < t0).concat(N); return out.length > 6000 ? out.slice(-6000) : out; }

  function select(s) {
    if (!s || !(s.sym || s.coin)) { SEL = null; return; }
    const key = (s.src || "y") + ":" + (s.coin || s.sym); if (SEL && SEL.key === key) return;
    SEL = { ...s, key }; X = { key, src: s.src || "y", coin: s.coin, ysym: s.ysym || s.sym, sym: String(s.sym || String(s.coin).split(":").pop()).toUpperCase(), cls: s.cls || "stock", label: s.label || s.sym || s.coin,
      B: [], R: null, err: "", at: 0, busy: false, seen: null, flashT: {}, pushT: {}, first: true };
    refresh(true);
  }
  async function refresh(first) {
    const x = X; if (!x || x.busy) return; x.busy = true;
    try { const N = await fetchBars(x, first || x.first); if (x !== X) return; x.B = merge(x.B, N); x.err = x.B.length ? "" : "No 1-minute bars for this market yet."; x.at = Date.now(); compute(x); x.first = false; }
    catch (e) { if (x === X) { x.err = x.src === "y" ? "The Worker did not answer /chart (" + (e.message || e) + ")" : "Hyperliquid did not answer (" + (e.message || e) + ")"; if (x.src === "hl" && x.ysym) { x.src = "y"; } } }
    finally { x.busy = false; draw(); }
  }
  function compute(x) {
    reloadSt(); const now = Date.now(), crypto = x.cls === "crypto";
    let B1 = x.B; if (B1.length && B1[B1.length - 1][0] + 6e4 > now - 1500) B1 = B1.slice(0, -1);   // the forming bar does not count
    const lastEnd = B1.length ? B1[B1.length - 1][0] + 6e4 : 0, out = { act: [], recent: [], tally: { hit: 0, n: 0 }, move: null, scored: 0 };
    for (const [tf, T] of Object.entries(TFS)) {
      const B = tf === "1m" ? B1 : agg(B1, T.ms).filter(b => b[0] + T.ms <= lastEnd); if (B.length < 80) continue;
      const P = prep(B, crypto), F = scan(P), dk = x.sym + "|" + x.cls + "|" + tf; let done = ST.done[dk] || 0, mx = done;
      for (const f of F) { const key = f.id + "|" + f.type + "|" + tf, oc = outcome(P, f, T.H, T.ms);
        if (oc && oc.done && f.t > done) { learn(x.sym, x.cls, key, oc.hit, oc.r); mx = Math.max(mx, f.t); out.scored++; }
        if (oc && oc.done && now - (f.t + T.ms) < 6 * 36e5) { out.tally.n++; out.tally.hit += oc.hit; }
        if (now - (f.t + T.ms) < 2 * 36e5) out.recent.push({ id: f.id, dir: f.dir, tf, flashed: f.t + T.ms });
        if (oc && !oc.done) out.act.push({ ...f, tf, key, tfms: T.ms, H: T.H, age: P.n - 1 - f.i, r: oc.r, flashed: f.t + T.ms }); }
      if (mx > done) ST.done[dk] = mx;
      if (tf === "1m") { const n = P.n, dNow = P.dir[n - 1]; let k = n - 1; while (k > 0 && P.dir[k - 1] === dNow) k--;
        out.move = { d: dNow, since: P.t[k], from: P.c[k], px: P.c[n - 1], atr: P.atr[n - 1], vw: P.vw[n - 1], lastBar: P.t[n - 1] + 6e4 }; }
    }
    stSave(out.scored > 50);
    // rank: strength × reliability × repetition × freshness; hide breaths that have proven to fail
    const A = out.act;
    A.forEach(f => { f.rel = rel(x.sym, x.cls, f.key);
      f.reps = out.recent.filter(g => g.id === f.id && g.dir === f.dir && g.tf === f.tf && g.flashed <= f.flashed && f.flashed - g.flashed <= 60 * 6e4).length || 1;   // this breath and its repeats in the hour before it
      f.conf = A.filter(g => g !== f && g.type === f.type && g.dir === f.dir && (g.id !== f.id || g.tf !== f.tf) && Math.abs(g.flashed - f.flashed) <= 15 * 6e4).length;
      const edge = cl((f.rel.p - 0.42) / 0.18, 0.1, 1.6), fresh = 1 - 0.5 * f.age / f.H;
      f.score = f.s * edge * Math.min(2.2, 1 + 0.25 * (f.reps - 1) + 0.2 * f.conf) * fresh; });
    x.R = { ...out, rev: A.filter(f => f.type === "rev" && f.rel.tier !== "weak").sort((a, b) => b.score - a.score), cont: A.filter(f => f.type === "cont" && f.rel.tier !== "weak").sort((a, b) => b.score - a.score),
      hidden: A.filter(f => f.rel.tier === "weak").length };
    // push new breaths (not on the first read: those are history)
    const ids = new Set(A.map(f => f.key + "|" + f.t + "|" + f.dir));
    if (x.seen) { const nw = [...x.R.rev, ...x.R.cont].filter(f => !x.seen.has(f.key + "|" + f.t + "|" + f.dir)); nw.forEach(f => x.flashT[f.key + "|" + f.t + "|" + f.dir] = x.pushT[f.key + "|" + f.t + "|" + f.dir] = now); if (nw.length) alertNew(x, nw); }
    else A.forEach(f => { if (now - f.flashed < 3 * 6e4) x.flashT[f.key + "|" + f.t + "|" + f.dir] = now; });
    x.seen = new Set([...(x.seen || []), ...ids]);
    // into the spider web: the direction each list points, by its weight
    try { if (window.Web) { const sum = L => L.reduce((s, f) => s + f.dir * f.score, 0);
      if (x.R.rev.length) Web.emit("fb.rev", x.sym, c1(sum(x.R.rev) / 1.5), "First Breaths · reversal breaths (live, 1m/5m)");
      if (x.R.cont.length) Web.emit("fb.cont", x.sym, c1(sum(x.R.cont) / 1.5), "First Breaths · continuation breaths (live, 1m/5m)"); } } catch (e) { }
    // into the knowledge hub (scored live, never fitted: out of sample)
    try { if (window.Hub && (!x.hubT || now - x.hubT > 10 * 6e4)) { x.hubT = now; const S = ST.s[x.sym] || {};
      Hub.report(Object.entries(S).filter(([, o]) => o[0] >= 20).map(([k, o]) => { const [id, type, tf] = k.split("|"); return { eng: "First Breaths", mkt: x.sym, rule: (NAME[id] || id) + " · " + type, h: tf + "×" + TFS[tf].H, n: o[0], m: o[1] / o[0], unit: "hit", z: (o[1] - o[0] / 2) / Math.sqrt(o[0] / 4), oos: true }; })); } } catch (e) { }
  }

  // ---------- alerts ----------
  let PREF = lsG("fb_pref", { snd: 0, note: 0 });
  let toastBox = null;
  function toast(html) {
    if (!toastBox) { toastBox = document.createElement("div"); toastBox.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:9999;display:flex;flex-direction:column;gap:6px;max-width:340px"; document.body.appendChild(toastBox); }
    const d = document.createElement("div"); d.className = "fbToast"; d.innerHTML = html; d.onclick = () => { const c = document.getElementById("fbCard"); if (c) c.scrollIntoView({ behavior: "smooth", block: "start" }); d.remove(); };
    toastBox.appendChild(d); setTimeout(() => d.remove(), 12e3); while (toastBox.children.length > 4) toastBox.firstChild.remove();
  }
  let AC = null;
  function beep(up) { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = up ? 880 : 520; g.gain.value = 0.06; o.connect(g); g.connect(AC.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.35); o.stop(AC.currentTime + 0.36); } catch (e) { } }
  function alertNew(x, L) {
    const best = L.filter(f => f.rel.p >= 0.53 || f.reps >= 2 || f.conf >= 1).sort((a, b) => b.score - a.score).slice(0, 2); if (!best.length) return;   // pop-ups only for reliable or repeated breaths; the rest still show in the lists
    best.forEach(f => toast(`<b class="${f.dir > 0 ? "fbU" : "fbD"}">🌬 ${esc(x.label)} · ${f.type === "rev" ? "reversal" : "continuation"} breath ${f.dir > 0 ? "▲" : "▼"}</b><div>${esc(NAME[f.id] || f.id)} · ${f.tf} · ${tm(f.flashed)}</div><div class="fbDim">reliability ${Math.round(f.rel.p * 100)}%${f.reps > 1 ? ` · repeated ×${f.reps}` : ""}</div>`));
    if (PREF.snd) beep(best[0] && best[0].dir > 0);
    if (PREF.note && "Notification" in window && Notification.permission === "granted" && document.hidden) {
      try { const f = best[0]; new Notification(`${x.label}: ${f.type === "rev" ? "reversal" : "continuation"} breath ${f.dir > 0 ? "▲" : "▼"}`, { body: `${NAME[f.id] || f.id} · ${f.tf} · ${tm(f.flashed)} · reliability ${Math.round(f.rel.p * 100)}%`, tag: "fb-" + x.key }); } catch (e) { } }
  }

  // ---------- the card ----------
  const tm = ms => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const ago = ms => { const s = Math.max(0, Math.round((Date.now() - ms) / 1000)); return s < 60 ? s + "s ago" : s < 3600 ? Math.floor(s / 60) + "m " + String(s % 60).padStart(2, "0") + "s ago" : Math.floor(s / 3600) + "h " + Math.floor(s % 3600 / 60) + "m ago"; };
  const fx = p => !isFinite(p) ? "–" : p >= 1000 ? p.toFixed(2) : p >= 1 ? p.toFixed(p >= 100 ? 2 : 3) : p.toPrecision(4);
  const st = document.createElement("style");
  st.textContent = `#fbCard{--fbU:var(--up,var(--bull,#19d38a));--fbD:var(--down,var(--bear,#ff4d5e));--fbI:var(--ink,var(--text,#e6edf5));--fbM:var(--mute,var(--dim,var(--faint,#8a94a3)));--fbL:var(--line,rgba(127,127,127,.25))}
#fbCard .fbU,.fbToast .fbU{color:var(--up,var(--bull,#19d38a))} #fbCard .fbD,.fbToast .fbD{color:var(--down,var(--bear,#ff4d5e))}
#fbCard .fbHd{display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:space-between}
#fbCard .fbT{font:600 13px var(--sans,system-ui);color:var(--fbI)} #fbCard .fbDim,.fbToast .fbDim{color:var(--fbM);font:11.5px var(--mono,ui-monospace,monospace)}
#fbCard .fbBtns button{font:11px var(--mono,ui-monospace,monospace);padding:3px 8px;margin-left:4px;border-radius:6px;border:1px solid var(--fbL);background:transparent;color:var(--fbI);cursor:pointer}
#fbCard .fbBtns button.on{border-color:var(--fbU);color:var(--fbU)}
#fbCard .fbMove{font:12px var(--mono,ui-monospace,monospace);color:var(--fbI);margin:6px 0}
#fbCard .fbLean{display:flex;height:8px;border-radius:4px;overflow:hidden;margin:4px 0 8px;background:var(--fbL)} #fbCard .fbLean b{display:block;height:100%}
#fbCard .fbCols{display:flex;flex-wrap:wrap;gap:10px} #fbCard .fbCol{flex:1 1 300px;min-width:0;border:1px solid var(--fbL);border-radius:10px;padding:8px 10px}
#fbCard .fbCol h4{margin:0 0 6px;font:600 12px var(--sans,system-ui);text-transform:uppercase;letter-spacing:.05em}
#fbCard .fbIt{padding:6px 0;border-top:1px solid var(--fbL);font:12px var(--mono,ui-monospace,monospace);color:var(--fbI)} #fbCard .fbIt:first-of-type{border-top:0}
#fbCard .fbIt.new{animation:fbPulse 1.2s ease-in-out 4;border-radius:6px} @keyframes fbPulse{50%{background:rgba(255,181,71,.18)}}
#fbCard .fbTag{display:inline-block;font:600 10px var(--mono,ui-monospace,monospace);padding:1px 5px;border-radius:4px;border:1px solid currentColor;margin-left:4px}
#fbCard .fbBar{display:inline-block;width:42px;height:6px;border-radius:3px;background:var(--fbL);vertical-align:1px;margin:0 4px;overflow:hidden} #fbCard .fbBar i{display:block;height:100%;background:currentColor}
#fbCard .fbHelp{font:11.5px var(--mono,ui-monospace,monospace);color:var(--fbM);line-height:1.5;margin-top:8px}
.fbToast{background:var(--panel,var(--card,#141a22));color:var(--ink,var(--text,#e6edf5));border:1px solid var(--line,rgba(127,127,127,.35));border-left:3px solid #ffb547;border-radius:8px;padding:8px 10px;font:12px var(--mono,ui-monospace,monospace);box-shadow:0 6px 20px rgba(0,0,0,.35);cursor:pointer}`;
  document.head.appendChild(st);
  const CARD = document.createElement("section"); CARD.className = "card"; CARD.id = "fbCard"; CARD.style.marginBottom = "12px";
  let help = false, lastHtml = "";
  CARD.addEventListener("click", async e => {
    const b = e.target.closest("[data-fb]"); if (!b) return; e.preventDefault(); e.stopPropagation(); const k = b.dataset.fb;
    if (k === "snd") { PREF.snd = PREF.snd ? 0 : 1; if (PREF.snd) beep(true); }
    if (k === "note") { if (!PREF.note && "Notification" in window) { try { const p = await Notification.requestPermission(); PREF.note = p === "granted" ? 1 : 0; } catch (x) { PREF.note = 0; } } else PREF.note = 0; }
    if (k === "help") help = !help;
    if (k === "now") refresh();
    lsS("fb_pref", PREF); draw(true);
  });
  function item(f, x) {
    const nw = x.flashT[f.key + "|" + f.t + "|" + f.dir] && Date.now() - x.flashT[f.key + "|" + f.t + "|" + f.dir] < 90e3, R = f.rel, cls = f.dir > 0 ? "fbU" : "fbD";
    const tier = R.tier === "proven" ? `<span class="fbTag fbU" title="30+ scored, ${Math.round(R.p * 100)}% hit">★ proven</span>` : R.tier === "new" ? `<span class="fbTag" style="color:#ffb547" title="Under 10 scored: reliability is mostly the prior">new</span>` : "";
    const tgt = f.px + f.dir * f.atr, stp = f.px - f.dir * f.atr;
    return `<div class="fbIt${nw ? " new" : ""}"><div><b class="${cls}">${f.dir > 0 ? "▲" : "▼"}</b> <b>${esc(NAME[f.id] || f.id)}</b> <span class="fbDim">${f.tf}</span>${tier}${f.reps > 1 ? `<span class="fbTag" title="The same breath flashed ${f.reps} times in the last hour">×${f.reps} repeated</span>` : ""}${f.conf ? `<span class="fbTag" title="${f.conf} other breath${f.conf > 1 ? "s" : ""} of this type within 15 minutes">+${f.conf} confirm</span>` : ""}${nw ? `<span class="fbTag" style="color:#ffb547">NEW</span>` : ""}</div>
      <div class="fbDim">flashed <b style="color:var(--fbI)">${tm(f.flashed)}</b> (${f.tf} bar close)${x.pushT[f.key + "|" + f.t + "|" + f.dir] ? ` · pushed ${tm(x.pushT[f.key + "|" + f.t + "|" + f.dir])}` : ""} · ${ago(f.flashed)} · at ${fx(f.px)} · now <span class="${f.r >= 0 ? "fbU" : "fbD"}">${f.r >= 0 ? "+" : ""}${f.r.toFixed(2)} ATR</span> its way</div>
      <div class="fbDim">reliability <b class="${R.p >= 0.55 ? "fbU" : R.p < 0.48 ? "fbD" : ""}">${Math.round(R.p * 100)}%</b> (${R.n} here, ${R.nc} on all ${esc(x.cls === "letf" ? "leveraged ETFs" : x.cls === "crypto" ? "crypto" : "stocks")}) · strength <span class="fbBar ${cls}"><i style="width:${Math.round(f.s * 100)}%"></i></span> · test ${fx(tgt)} / ${fx(stp)} · open ${Math.max(0, f.H - f.age)} more ${f.tf} bar${f.H - f.age === 1 ? "" : "s"}</div>
      <div class="fbDim">${esc(f.why)}</div></div>`;
  }
  function draw(force) {
    const x = X; if (!x || !CARD.isConnected) return;
    const R = x.R, M = R && R.move, src = x.src === "hl" ? "Hyperliquid 1m candles · every 5 s" : "Yahoo 1m bars through the Worker · every 15 s";
    let body = "";
    if (!R) body = `<div class="fbDim" style="margin-top:6px">${x.err ? esc(x.err) : "Reading the last days of 1-minute bars and scoring every past breath…"}</div>`;
    else {
      const rs = R.rev.reduce((s, f) => s + f.score, 0), cs = R.cont.reduce((s, f) => s + f.score, 0), tot = rs + cs;
      const mv = M ? (M.d ? `Current move: <b class="${M.d > 0 ? "fbU" : "fbD"}">${M.d > 0 ? "UP ▲" : "DOWN ▼"}</b> since ${tm(M.since)} (${fx(M.from)} → ${fx(M.px)}, ${((M.px / M.from - 1) * 100).toFixed(2)}%)` : `Current move: <b>none</b> (range) — only range breaks and squeezes can flash`) + ` · ATR ${fx(M.atr)} · VWAP ${fx(M.vw)} · last closed bar ${tm(M.lastBar)}` : "";
      body = `<div class="fbMove">${mv}</div>`;
      if (tot > 0) body += `<div class="fbDim">Lean of the live breaths: <b style="color:#ffb547">reversal ${Math.round(rs / tot * 100)}%</b> · <b class="fbU">continuation ${Math.round(cs / tot * 100)}%</b></div><div class="fbLean"><b style="width:${rs / tot * 100}%;background:#ffb547"></b><b style="width:${cs / tot * 100}%;background:var(--fbU)"></b></div>`;
      const col = (L, t, sub) => L.length ? `<div class="fbCol"><h4>${t} <span class="fbDim" style="text-transform:none;letter-spacing:0;font-weight:400">· ${sub}</span></h4>${L.slice(0, 6).map(f => item(f, x)).join("")}${L.length > 6 ? `<div class="fbDim">+${L.length - 6} weaker</div>` : ""}</div>` : "";
      const cols = col(R.rev, "🔄 Reversal breaths", "the move may turn") + col(R.cont, "⏩ Continuation breaths", "the move may amplify");
      body += cols ? `<div class="fbCols">${cols}</div>` : `<div class="fbDim" style="margin:4px 0">No breaths now. Every new closed 1-minute and 5-minute bar is checked; a new breath shows here and pops up at once.</div>`;
      body += `<div class="fbDim" style="margin-top:6px">${R.tally.n ? `Last 6 h on ${esc(x.label)}: ${R.tally.hit} of ${R.tally.n} breaths reached +1 ATR first or ended their way (${Math.round(R.tally.hit / R.tally.n * 100)}%). ` : ""}${R.hidden ? `${R.hidden} live breath${R.hidden > 1 ? "s" : ""} hidden: that kind has failed here (under 46% over 30+). ` : ""}${R.scored ? `Scored ${R.scored} new breath${R.scored > 1 ? "s" : ""} this read. ` : ""}${x.err ? `<span class="fbD">${esc(x.err)}</span>` : ""}</div>`;
    }
    if (help) body += `<div class="fbHelp">A breath is the first sign that a move turns (reversal) or speeds up (continuation). Only closed bars count. Each one is scored when its time is up (1m: 15 bars, 5m: 6 bars): a hit if price moved 1 ATR its way before 1 ATR against it. Reliability is this market's hit rate, pulled toward the same breath's rate on all markets of its kind until this market has its own record (★ proven = 30+ scored and 57%+). Breaths that fail are hidden. The list puts the strongest, most reliable and most repeated first. "Test" = the +1 / −1 ATR levels it is scored on — use them with your limit-order rules; they are not advice. The live breaths also feed the spider web (fb.rev, fb.cont).</div>`;
    const html = `<div class="fbHd"><div class="fbT">🌬 First Breaths · ${esc(x.label)} <span class="fbDim" style="font-weight:400">· inflection points, live · ${src}${x.at ? ` · read ${tm(x.at)}` : ""}${x.busy ? " · reading…" : ""}</span></div>
      <div class="fbBtns"><button data-fb="snd" class="${PREF.snd ? "on" : ""}" title="Beep on a new breath">🔊 ${PREF.snd ? "on" : "off"}</button><button data-fb="note" class="${PREF.note ? "on" : ""}" title="Browser notification when this tab is in the background">🔔 ${PREF.note ? "on" : "off"}</button><button data-fb="now">↻</button><button data-fb="help">?</button></div></div>${body}`;
    if (force || html !== lastHtml) { lastHtml = html; CARD.innerHTML = html; }
  }

  // ---------- where the card goes on each site ----------
  const $ = id => document.getElementById(id), vis = el => !!(el && el.offsetParent !== null);
  function resolve() {
    try { // Mastermind Investor: the market of the last search
      if ($("ans") && $("qi")) { const m = window.MM_SEL, first = $("ans").querySelector("section.card"); if (!m || !first) return null;
        return { sel: m.crypto && m.coin && !m.coin.includes(":") ? { coin: m.coin, sym: m.s, ysym: m.s + "-USD", src: "hl", cls: "crypto", label: m.s } : { sym: m.s, src: "y", cls: m.fund || LEV.has(m.s) ? "letf" : "stock", label: "$" + m.s }, host: first, mode: "after" }; }
      // LETF Sniper: the fund page
      if (typeof curF !== "undefined" && curF && vis($("fundView"))) return { sel: { sym: curF, src: "y", cls: "letf", label: "$" + curF }, host: $("fundView").querySelector(".fvhead"), mode: "after" };
      // SOXX Sniper: the stock page
      if (typeof curSym !== "undefined" && curSym && vis($("stockView"))) { const cr = typeof CRYPTO !== "undefined" && CRYPTO.includes(curSym);
        return { sel: cr ? { coin: curSym, sym: curSym, ysym: curSym + "-USD", src: "hl", cls: "crypto", label: curSym } : { sym: curSym, src: "y", cls: LEV.has(curSym) ? "letf" : "stock", label: "$" + curSym }, host: $("stockView").querySelector(".sv-head"), mode: "after" }; }
      // Cohort Sniper: the open market row
      if (typeof gotoCoin === "function" && typeof OPEN !== "undefined" && OPEN) { const row = document.querySelector(`.row[data-coin="${CSS.escape(OPEN)}"]`), det = row && row.nextElementSibling;
        if (!det || !det.classList.contains("detail") || !vis(det)) return null; const i = OPEN.indexOf(":"), sym = i < 0 ? OPEN : OPEN.slice(i + 1);
        const name = typeof hlName === "function" ? hlName(OPEN) : OPEN;
        return { sel: { coin: name, sym, ysym: i < 0 ? sym + "-USD" : sym, src: "hl", cls: i < 0 ? "crypto" : LEV.has(sym) ? "letf" : "stock", label: sym + (i < 0 ? "" : " perp") }, host: det, mode: "prepend" }; }
    } catch (e) { }
    return null;
  }
  function place() {
    const R = resolve();
    if (!R || !R.host) { if (CARD.isConnected) CARD.remove(); SEL = null; return; }
    select(R.sel);
    if (R.mode === "after") { if (R.host.nextElementSibling !== CARD) R.host.after(CARD); }
    else if (R.host.firstElementChild !== CARD) R.host.prepend(CARD);
    if (!lastHtml || !CARD.innerHTML) draw(true);
  }
  // loop: place every second (pages re-render), draw every second (live ages), read new bars every 5 s (Hyperliquid) or 15 s (Yahoo)
  setInterval(() => { try { place(); if (!X || !CARD.isConnected) return; draw(); const due = X.src === "hl" ? 5e3 : 15e3;
    if (!X.busy && Date.now() - X.at >= (document.hidden ? Math.max(due, 3e4) : due)) refresh(); } catch (e) { } }, 1000);
  // a page that re-renders can take the card out: put it back at once
  let mo = 0; new MutationObserver(() => { if (mo || !X || CARD.isConnected) return; mo = requestAnimationFrame(() => { mo = 0; try { place(); } catch (e) { } }); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden && X && CARD.isConnected) refresh(); });

  window.FB = { select, refresh: () => refresh(), scan: (bars, o) => { const P = prep(bars, o && o.crypto); return { P, F: scan(P) }; }, outcome, agg, rel, stats: () => ST, names: NAME, state: () => X };
})();
