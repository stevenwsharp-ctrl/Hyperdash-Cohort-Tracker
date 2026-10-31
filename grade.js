/* Trader grade · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   Dollars alone do not show skill: one lucky trade can top a list. The grade looks at HOW a trader handles each trade:
     - Keep rate (capture): realized profit as a share of the best open profit the trade reached (MFE).
       A trader who sells near the top keeps a lot; one who rides a winner back down keeps little.
     - Round trips: trades that were up 2%+ at some point (price move from entry) and still closed at a loss.
     - Held and won: trades that were down 3%+ at some point and still closed with a profit (conviction that paid).
     - Sold the bottom: trades closed at a loss after a 3%+ drawdown, where price then came back past the entry within 2 days.
     - Open now: the current open profit vs the best open profit of this position (giving back right now?).
     - All holdings: unrealized profit and loss across every open position (all markets), vs the account value.
   Score Q from -1 (poor) to +1 (strong), shrunk toward 0 when there are few trades. Rank weight = 1 + 0.5 x Q.
   Input moves: [{ t, entry (true/false), side (+1 long / -1 short), px, usd }], time order. Bars: [[t, high, low, close]], hourly. */
(function () {
  "use strict";
  try { const st = document.createElement("style"); st.textContent = `.grd,.grt{display:inline-block;min-width:22px;padding:1px 6px;border-radius:99px;font:600 11px var(--mono,monospace);text-align:center;border:1px solid currentColor;cursor:help}.grd.up,.grt.up{color:var(--up,#16a34a)}.grd.down,.grt.down{color:var(--down,#dc2626)}`; document.head.appendChild(st); } catch (e) { }
  const c1 = v => Math.max(-1, Math.min(1, v));
  function idx(B, t) { let lo = 0, hi = B.length - 1; if (!B.length || t < B[0][0]) return 0; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (B[m][0] <= t) lo = m; else hi = m - 1; } return lo; }
  // rebuild round trips from moves (entries and exits), then measure each with the price path
  // path stats from t0 to t1 for a position with average entry avg and side
  function path(B, t0, t1, avg, side) {
    if (!B || !B.length) return {}; const i0 = idx(B, t0), i1 = idx(B, t1); let hi = -Infinity, lo = Infinity;
    for (let i = i0; i <= i1; i++) { hi = Math.max(hi, B[i][1]); lo = Math.min(lo, B[i][2]); }
    const r = {}; if (isFinite(hi)) { r.mfe = Math.max(0, side > 0 ? hi / avg - 1 : 1 - lo / avg); r.mae = Math.min(0, side > 0 ? lo / avg - 1 : 1 - hi / avg); }
    const j = idx(B, t1 + 48 * 36e5); if (j > i1) { r.after = false; for (let i = i1 + 1; i <= j; i++) if (side > 0 ? B[i][1] >= avg : B[i][2] <= avg) { r.after = true; break; } }
    return r;
  }
  // every exit (sale or cover) is one graded leg: its result vs the price path since the position opened
  function trips(M, B) {
    const legs = []; let q = 0, avg = 0, t0 = 0, side = 0;
    for (const m of M) {
      if (!(m.px > 0) || !(m.usd > 0)) continue; const u = m.usd / m.px;
      if (m.entry) {
        if (side && m.side !== side) { if (q > 0) legs.push(Object.assign({ t0, t1: m.t, side, avg, px: m.px, cost: q * avg, real: (m.px - avg) * q * side }, path(B, t0, m.t, avg, side))); q = 0; side = 0; }
        if (!side) { side = m.side; t0 = m.t; avg = 0; }
        avg = (avg * q + m.px * u) / (q + u); q += u;
      } else if (side && m.side === side && q > 0) {
        const x = Math.min(u, q); legs.push(Object.assign({ t0, t1: m.t, side, avg, px: m.px, cost: x * avg, real: (m.px - avg) * x * side }, path(B, t0, m.t, avg, side)));
        q -= x; if (q <= 1e-9 * avg || q * avg < 50) { q = 0; side = 0; }
      }
    }
    return { trips: legs, open: side && q > 0 ? { t0, side, avg, q } : null };
  }
  function grade(T, o) {
    o = o || {}; const L = T.trips.filter(x => x.mfe != null);
    const R = { n: L.length, keep: null, rt: 0, rtOf: 0, held: 0, heldOf: 0, bottom: 0, openGive: null, upnl: o.upnl, acct: o.acct, Q: 0, parts: [] };
    if (L.length) {
      let num = 0, den = 0; L.forEach(x => { if (x.mfe > 0.002) { num += Math.max(-x.mfe, Math.min(x.real / x.cost, x.mfe)) * x.cost; den += x.mfe * x.cost; } }); R.keep = den > 0 ? num / den : null;
      // counts by dollar-weighted legs, so many tiny fills do not swamp one big trade (one "trade" = the median leg size)
      const med = L.map(x => x.cost).sort((a, b) => a - b)[L.length >> 1] || 1, wt = x => Math.min(3, x.cost / med);
      const up = L.filter(x => x.mfe >= 0.02), dn = L.filter(x => x.mae <= -0.03), sw = A => A.reduce((a, x) => a + wt(x), 0);
      R.rtOf = Math.round(sw(up)); R.rt = Math.round(sw(up.filter(x => x.real <= 0)));
      R.heldOf = Math.round(sw(dn)); R.held = Math.round(sw(dn.filter(x => x.real > 0))); R.bottom = Math.round(sw(dn.filter(x => x.real <= 0 && x.after)));
    }
    // open position now: profit given back from its best point
    if (T.open && o.bars && o.bars.length && o.px > 0) { const i0 = idx(o.bars, T.open.t0); let best = -Infinity; for (let i = i0; i < o.bars.length; i++) best = Math.max(best, T.open.side > 0 ? o.bars[i][1] / T.open.avg - 1 : 1 - o.bars[i][2] / T.open.avg);
      const now = T.open.side > 0 ? o.px / T.open.avg - 1 : 1 - o.px / T.open.avg; R.openNow = now; R.openBest = best; if (best >= 0.02) R.openGive = (best - now) / best; }
    // score parts, each -1..+1
    const P = R.parts, sh = (k, n0) => k / (k + n0);   // trust grows with the sample
    if (R.keep != null) P.push(["Keeps gains", c1((R.keep - 0.25) / 0.35) * sh(R.n, 8), `keeps ${Math.round(R.keep * 100)}% of the best open profit`]);
    if (R.rtOf >= 3) P.push(["Avoids round trips", c1(0.5 - R.rt / R.rtOf) * 2 * sh(R.rtOf, 6), `${R.rt} of ${R.rtOf} sales after a 2%+ gain closed at a loss`]);
    if (R.heldOf >= 3) P.push(["Holds through drawdowns", c1((R.held - R.bottom * 1.5) / R.heldOf * 1.5) * sh(R.heldOf, 6), `${R.held} of ${R.heldOf} sales after a 3%+ drawdown ended in profit${R.bottom ? `; ${R.bottom} sold near the bottom` : ""}`]);
    if (R.openGive != null) P.push(["Open position", c1(0.5 - R.openGive) * 0.8, `gave back ${Math.round(R.openGive * 100)}% of its best open profit`]);
    if (o.upnl != null && o.acct > 0) P.push(["All holdings", c1(o.upnl / o.acct * 5) * 0.8, `open P&L across all positions ${o.upnl >= 0 ? "+" : "-"}$${Math.abs(o.upnl) >= 1e6 ? (Math.abs(o.upnl) / 1e6).toFixed(1) + "M" : (Math.abs(o.upnl) / 1e3).toFixed(1) + "K"} (${(o.upnl / o.acct * 100).toFixed(1)}% of the account)`]);
    const w = { "Keeps gains": 1, "Avoids round trips": 1, "Holds through drawdowns": 1, "Open position": 0.5, "All holdings": 0.7 };
    let s = 0, sw = 0; P.forEach(([k, v]) => { s += v * w[k]; sw += w[k]; }); R.Q = sw ? c1(s / sw) : 0;
    R.mult = 1 + 0.5 * R.Q;
    return R;
  }
  /* Grit: discipline vs impulse. High grit = steady, rule-based, not impulsive — or impulsive only when it pays;
     patient when patience pays, quick when speed pays.
     A trader can trade a lot and still have high grit (consistent size, small losses, steady weeks); a trader who chases,
     revenge-trades and panics, and keeps losing, has low grit.
       Impulse acts (each judged by price 24h later in the trade's direction — impulse that pays is forgiven):
         revenge = a new entry within 30 min after a losing sale; chase = entry the same way as a 2σ+ hourly move just before;
         flip = entry on the opposite side within 2h of the last trade; panic = sale right after a 2σ+ move against the position,
         with price better 24h later.
       Discipline: steady size (low spread of entry sizes), losses smaller than wins, share of positive weeks. */
  function grit(M, B, T) {
    const E = M.filter(m => m.entry && m.px > 0 && m.usd > 0), X = M.filter(m => !m.entry && m.px > 0), legs = (T && T.trips) || [];
    const G = { n: E.length, parts: [], G: 0, score: 50 }; if (E.length < 5) return G;
    let sd = 0; if (B && B.length > 30) { const r = []; for (let i = 1; i < B.length; i++) r.push(B[i][3] / B[i - 1][3] - 1); sd = Math.sqrt(r.reduce((a, v) => a + v * v, 0) / r.length); }
    const hr = t => { if (!B || !B.length || !sd) return 0; const i = idx(B, t); return i > 0 ? (B[i][3] / B[i - 1][3] - 1) / sd : 0; };
    const fwd = (t, side, px) => { if (!B || !B.length) return null; const j = idx(B, t + 24 * 36e5); return B[j][0] > t + 20 * 36e5 && px > 0 ? side * (B[j][3] / px - 1) : null; };
    const all = M.slice().sort((a, b) => a.t - b.t), lossExit = legs.filter(l => l.real < 0).map(l => l.t1);
    let imp = 0, impPay = 0, impN = 0, rev = 0, cha = 0, fl = 0;
    E.forEach(e => { const k = all.indexOf(e), prev = k > 0 ? all[k - 1] : null; let why = 0;
      if (lossExit.some(t => e.t - t >= 0 && e.t - t <= 30 * 6e4)) { rev++; why = 1; }
      if (sd && Math.sign(hr(e.t)) === e.side && Math.abs(hr(e.t)) >= 2) { cha++; why = 1; }
      if (prev && prev.side !== e.side && e.t - prev.t <= 2 * 36e5) { fl++; why = 1; }
      if (why) { imp++; const f = fwd(e.t, e.side, e.px); if (f != null) { impPay += f; impN++; } } });
    let pan = 0, panOf = 0; X.forEach(x => { if (!sd) return; const h = hr(x.t); if (Math.sign(h) === -x.side && Math.abs(h) >= 2) { panOf++; const f = fwd(x.t, x.side, x.px); if (f != null && f > 0) pan++; } });
    const rate = imp / E.length, pay = impN ? impPay / impN : 0, sh = (k, n0) => k / (k + n0), P = G.parts;
    G.imp = { n: imp, rev, cha, fl, rate, pay }; G.pan = { n: pan, of: panOf };
    P.push(["Impulse", c1((c1((0.15 - rate * (pay > 0.005 ? 0.4 : 1.3)) * 2) + (pay > 0.005 && imp >= 3 ? 0.15 : 0)) * sh(E.length, 10)),
      `${imp} of ${E.length} entries impulsive (${rev} revenge, ${cha} chase, ${fl} quick flip); ${impN ? `they ${pay > 0 ? "paid" : "lost"} ${(Math.abs(pay) * 100).toFixed(1)}% on average a day later` : "outcome n/a"}`]);
    if (panOf >= 3) P.push(["Panic sales", c1(0.5 - pan / panOf * 1.5) * sh(panOf, 6), `${pan} of ${panOf} sales into a sharp move against them were followed by a recovery`]);
    const ls = E.map(e => Math.log(e.usd)), mu = ls.reduce((a, v) => a + v, 0) / ls.length, cv = Math.sqrt(ls.reduce((a, v) => a + (v - mu) ** 2, 0) / ls.length);
    P.push(["Steady size", c1((1.5 - cv) / 0.8) * sh(E.length, 10), `entry size spread ${cv.toFixed(2)} (log units; lower = steadier)`]);
    const W = legs.filter(l => l.real > 0 && l.cost > 0), L = legs.filter(l => l.real < 0 && l.cost > 0);
    if (W.length >= 3 && L.length >= 3) { const aw = W.reduce((a, l) => a + l.real / l.cost, 0) / W.length, al = -L.reduce((a, l) => a + l.real / l.cost, 0) / L.length, r = al / aw;
      P.push(["Cuts losses", c1((1.3 - r) / 0.8) * sh(W.length + L.length, 12), `average loss ${(al * 100).toFixed(1)}% vs average win ${(aw * 100).toFixed(1)}%`]); }
    // timing: patience when it pays, speed when it pays. Each sale vs its hold time and what price did in the next 24h.
    const TL = legs.filter(l => l.px > 0 && l.t1 > l.t0); if (TL.length >= 6) {
      const hm = TL.map(l => l.t1 - l.t0).sort((x, y) => x - y)[TL.length >> 1]; let gq = 0, gp = 0, ip = 0, st = 0;
      TL.forEach(l => { const quick = l.t1 - l.t0 < hm, a = fwd(l.t1, l.side, l.px), r = l.real / (l.cost || 1);
        if (quick) { if (a != null && a <= -0.01) gq++; else if (r > 0 && a != null && a >= 0.02) ip++; }
        else { if (r > 0) gp++; else if (l.mae != null && l.mae <= -0.03) st++; } });
      G.timing = { gq, gp, ip, st, n: TL.length, hold: hm };
      const hh = hm >= 864e5 ? (hm / 864e5).toFixed(1) + " days" : hm >= 36e5 ? (hm / 36e5).toFixed(1) + "h" : Math.round(hm / 6e4) + " min";
      P.push(["Timing", c1((gq + gp - ip - 1.3 * st) / TL.length * 2.5) * sh(TL.length, 12), `typical hold ${hh}; patience that paid ${gp}, quick exits before a drop ${gq}; sold too early ${ip}, held a loser too long ${st}`]); }
    const wk = {}; legs.forEach(l => { const k = Math.floor(l.t1 / (7 * 864e5)); wk[k] = (wk[k] || 0) + l.real; }); const wv = Object.values(wk);
    if (wv.length >= 4) { const pos = wv.filter(v => v > 0).length / wv.length; P.push(["Steady weeks", c1((pos - 0.5) * 3) * sh(wv.length, 6), `${Math.round(pos * 100)}% of ${wv.length} active weeks positive`]); }
    const w = { Impulse: 1.2, "Panic sales": 0.8, "Steady size": 0.5, "Cuts losses": 1, Timing: 1.3, "Steady weeks": 1 };
    let s = 0, sw = 0; P.forEach(([k, v]) => { s += v * w[k]; sw += w[k]; }); G.G = sw ? c1(s / sw) : 0; G.score = Math.round(50 + 50 * G.G);
    return G;
  }
  function gritBadge(G) {
    if (!G || G.n < 5) return '<span class="sub">n/a</span>';
    const cl = G.score >= 60 ? "up" : G.score <= 40 ? "down" : "";
    return `<span class="grt ${cl}" title="Grit ${G.score}/100 (high = steady, disciplined, not impulsive unless it pays): ${G.parts.map(p => `${p[0]}: ${p[2]}`).join(" · ")}">${G.score}</span>`;
  }
  function badge(R) {
    if (!R || (!R.parts.length)) return "";
    const cl = R.Q >= 0.2 ? "up" : R.Q <= -0.2 ? "down" : "", lab = R.Q >= 0.4 ? "A" : R.Q >= 0.15 ? "B" : R.Q > -0.15 ? "C" : R.Q > -0.4 ? "D" : "F";
    return `<span class="grd ${cl}" title="Trade grade ${lab} (${R.Q >= 0 ? "+" : ""}${R.Q.toFixed(2)}): ${R.parts.map(p => `${p[0]}: ${p[2]}`).join(" · ")}">${lab}</span>`;
  }
  window.Grade = { trips, grade, badge, grit, gritBadge };
})();
