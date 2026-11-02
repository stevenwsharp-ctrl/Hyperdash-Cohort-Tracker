/* P and B ranges · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   The method of Patrick Nill (top 5 in the Robbins World Cup Trading Championship 12 times), as told in "Everyone Laughed
   at His Strategy" (Trade DNA): markets spend ~70% of the time in ranges. Big players need liquidity to fill, so after a
   strong push price goes sideways (a range = an area of fair value), then moves to the next pool of liquidity.
   - P = a strong push up, then a range. B = a strong push down, then a range.
   - A range is valid only after 3 touches of its edges, and only after it has lasted long enough
     (on 15-minute bars about half a day). The longer it lasts, the better the breakout works.
   - Three trades: (1) range trade: buy the bottom, sell the top; (2) breakout with confirmation: a close outside, a test
     back to the edge, then a close beyond the breakout bar; (3) his favorite: the failed breakout — price breaks out,
     cannot follow through and closes back inside: trade the other way with a stop just past the false break (best long).
   - Stops sit on structure and are never moved away; size comes from the stop. Targets: the next area of fair value,
     the origin of the push, or a 1:1 projection of the push. Small ranges after big pushes suit breakouts (high R).
     Value area high / low (volume profile) at a range edge makes the setup stronger.
   This engine finds the pushes and ranges by rule, back-tests every past setup on the same market (win rate, average R,
   with his stop and target rules) and gives the web the live setups: pb.reclaim (failed breakout, back inside),
   pb.break (confirmed breakout), pb.edge (at the bottom + / top − of a valid range), pb.shape (P + / B −).
   Signals carry full strength only for setup types whose back-test made money on this market.
   API: PB.analyze(bars, {tf}) → A (bars [[t,o,h,l,c,(v)]], oldest first) · PB.signals(A) · PB.html(A, title) */
(function () {
  "use strict";
  if (window.PB) return;
  const c1 = v => Math.max(-1, Math.min(1, v));
  function atrs(B, n) { const a = new Array(B.length).fill(null); let v = 0; for (let i = 1; i < B.length; i++) { const tr = Math.max(B[i][2] - B[i][3], Math.abs(B[i][2] - B[i - 1][4]), Math.abs(B[i][3] - B[i - 1][4])); v = i === 1 ? tr : v + (tr - v) / n; a[i] = v; } a[0] = a[1]; return a; }
  // find ranges: a push (net move ≥ 3 ATR over ≤ 8 bars, efficient), then bars that stay in a box ≤ 60% of the push
  function ranges(B, o) {
    const A = atrs(B, 14), out = [], minBars = o.minBars, n = B.length; let i = 20;
    while (i < n - 2) {
      let best = null;
      for (let k = 3; k <= 8 && i - k >= 0; k++) { const mv = B[i][4] - B[i - k][4], path = B.slice(i - k + 1, i + 1).reduce((s, b, j, a) => s + Math.abs(b[4] - (j ? a[j - 1][4] : B[i - k][4])), 0);
        if (Math.abs(mv) >= 3 * A[i] && path && Math.abs(mv) / path >= 0.6 && (!best || Math.abs(mv) > Math.abs(best.mv))) best = { k, mv, from: i - k }; }
      if (!best) { i++; continue; }
      const dir = Math.sign(best.mv), cap = Math.abs(best.mv) * 0.6; let hi = -Infinity, lo = Infinity, j = i + 1;
      for (; j < n; j++) { const h2 = Math.max(hi, B[j][2]), l2 = Math.min(lo, B[j][3]); if (h2 - l2 > cap) break; hi = h2; lo = l2; }
      const len = j - i - 1;
      if (len >= minBars) {
        // touches: separate visits to the top 20% or bottom 20% of the box (a new visit after leaving the zone)
        const z = (hi - lo) * 0.2; let t = 0, at = 0, touchAt = [];
        for (let q = i + 1; q < j; q++) { const top = B[q][2] >= hi - z, bot = B[q][3] <= lo + z, s = top ? 1 : bot ? -1 : 0; if (s && s !== at) { t++; touchAt.push(q); } at = s || (Math.abs(B[q][4] - (hi + lo) / 2) < z ? 0 : at); }
        out.push({ dir, push: best.mv, pushFrom: best.from, origin: B[best.from][4], start: i + 1, end: j - 1, hi, lo, len, touches: t, valid: t >= 3, validAt: t >= 3 ? touchAt[2] : null, out: j < n ? j : null, atr: A[i] });
        i = j; } else i = i + 1;
    }
    return { R: out, A };
  }
  // what happened at each range end: failed breakout (back inside within 3 bars), confirmed breakout, or nothing clear
  function events(B, R, A, H, mb) {
    const E = [], n = B.length;
    R.forEach(r => { if (!r.valid || r.out == null) return; const j = r.out, up = B[j][4] > r.hi, dn = B[j][4] < r.lo; if (!up && !dn) return; const s = up ? 1 : -1, edge = up ? r.hi : r.lo;
      let back = null; for (let q = j; q <= Math.min(n - 1, j + 3); q++) if (B[q][4] < r.hi && B[q][4] > r.lo) { back = q; break; }
      if (back != null) { const xt = s > 0 ? Math.max(...B.slice(j, back + 1).map(b => b[2])) : Math.min(...B.slice(j, back + 1).map(b => b[3]));
        E.push({ type: "reclaim", side: -s, at: back, entry: B[back][4], stop: xt + s * 0.1 * r.atr, target: s > 0 ? r.lo : r.hi, far: s > 0 ? Math.min(r.lo, r.origin) : Math.max(r.hi, r.origin), r }); return; }
      // confirmation: a pullback toward the edge, then a close beyond the breakout bar's extreme
      const bx = s > 0 ? B[j][2] : B[j][3]; let tested = false;
      for (let q = j + 1; q <= Math.min(n - 1, j + 12); q++) { if (s > 0 ? B[q][3] <= edge + 0.5 * r.atr : B[q][2] >= edge - 0.5 * r.atr) tested = true;
        if (tested && (s > 0 ? B[q][4] > bx : B[q][4] < bx)) { const sz = r.hi - r.lo; E.push({ type: "break", side: s, at: q, entry: B[q][4], stop: s > 0 ? r.lo + sz * 0.5 - 0 : r.hi - sz * 0.5, target: B[q][4] + s * Math.max(sz, Math.abs(r.push) * 0.5), r }); break; }
        if (s > 0 ? B[q][4] < r.lo : B[q][4] > r.hi) break; } });
    // range trades, using only what was known at that bar (the box so far, the touches so far): buy near the bottom, sell
    // near the top, stop 25% of the box beyond the edge, target the other edge
    R.forEach(r => { let hi = -Infinity, lo = Infinity, t = 0, at = 0;
      for (let q = r.start; q <= r.end; q++) { const b = B[q];
        if (q - r.start >= mb && t >= 3) { const sz = hi - lo, z = sz * 0.2;
          if (b[3] <= lo + z * 0.5) { E.push({ type: "edge", side: 1, at: q, entry: lo + z * 0.5, stop: lo - sz * 0.25, target: hi - z * 0.5, r }); }
          else if (b[2] >= hi - z * 0.5) { E.push({ type: "edge", side: -1, at: q, entry: hi - z * 0.5, stop: hi + sz * 0.25, target: lo + z * 0.5, r }); } }
        hi = Math.max(hi, b[2]); lo = Math.min(lo, b[3]); const z = (hi - lo) * 0.2, sd = b[2] >= hi - z ? 1 : b[3] <= lo + z ? -1 : 0; if (sd && sd !== at) t++; at = sd || at;
        if (E.length && E[E.length - 1].at === q && E[E.length - 1].type === "edge") q += 3; } });
    // score each: walk forward up to H bars; stop first = −1 R, target = +R multiple, else mark to market
    E.forEach(e => { const risk = Math.abs(e.entry - e.stop); if (!risk) return; e.rr = Math.abs(e.target - e.entry) / risk; let res = null;
      for (let q = e.at + 1; q < Math.min(n, e.at + 1 + H); q++) { const b = B[q], hitS = e.side > 0 ? b[3] <= e.stop : b[2] >= e.stop, hitT = e.side > 0 ? b[2] >= e.target : b[3] <= e.target; if (hitS) { res = -1; break; } if (hitT) { res = e.rr; break; } }
      if (res == null) { const last = Math.min(n - 1, e.at + H); if (e.at + H >= n) { e.open = true; return; } res = (B[last][4] - e.entry) * e.side / risk; } e.R = res; });
    return E;
  }
  function analyze(B, o) {
    o = o || {}; if (!B || B.length < 200) return null; const tf = o.tf || "15m", minBars = tf === "15m" ? 24 : tf === "1h" ? 8 : 6, H = tf === "15m" ? 32 : 16;
    const { R, A } = ranges(B, { minBars }), E = events(B, R, A, H, minBars), n = B.length, done = E.filter(e => e.R != null);
    const stat = t => { const L = done.filter(e => e.type === t), w = L.filter(e => e.R > 0).length, avg = L.length ? L.reduce((s, e) => s + e.R, 0) / L.length : null, sd = L.length > 1 ? Math.sqrt(L.reduce((s, e) => s + (e.R - avg) ** 2, 0) / (L.length - 1)) : null;
      return { n: L.length, win: L.length ? w / L.length : null, avgR: avg, t: sd ? avg / (sd / Math.sqrt(L.length)) : 0, longR: (() => { const x = L.filter(e => e.side > 0); return x.length ? x.reduce((s, e) => s + e.R, 0) / x.length : null; })(), shortR: (() => { const x = L.filter(e => e.side < 0); return x.length ? x.reduce((s, e) => s + e.R, 0) / x.length : null; })() }; };
    const S = { reclaim: stat("reclaim"), break: stat("break"), edge: stat("edge") };
    // value area of the last ~5 days of bars: a range edge near VAH / VAL = confluence
    let VP = null; try { if (window.VFlow) VP = VFlow.profile(B.slice(-(tf === "15m" ? 480 : 120))); } catch (e) { }
    const px = B[n - 1][4], at = A[n - 1];
    // the live picture: the last range (still running, or just ended) and setups in the last 3 bars
    const last = R[R.length - 1], running = last && last.end >= n - 2 && last.out == null;
    const live = E.filter(e => e.at >= n - 3);
    const conf = r => VP && r ? [VP.vah, VP.val].some(v => Math.abs(v - r.hi) <= 0.5 * at || Math.abs(v - r.lo) <= 0.5 * at) : false;
    return { tf, n, R, E, S, VP, px, atr: at, last, running, live, conf: conf(last), recent: R.slice(-6).reverse() };
  }
  const trust = s => !s || s.n < 8 ? 0.5 : s.avgR > 0 && s.t >= 1 ? 1 : s.avgR > 0 ? 0.7 : 0.25;   // full weight only where it paid on this market
  function signals(A) {
    if (!A) return []; const I = [], f = A.conf ? 1.2 : 1;
    A.live.forEach(e => { const k = { reclaim: ["pb.reclaim", 0.8, "P/B · failed breakout, back inside the range (Nill's favorite)"], break: ["pb.break", 0.6, "P/B · breakout confirmed (close, test, close beyond)"], edge: ["pb.edge", 0.4, "P/B · at the edge of a valid range (range trade)"] }[e.type];
      if (k) I.push([k[0], c1(e.side * k[1] * trust(A.S[e.type]) * f), k[2]]); });
    const r = A.last; if (A.running && r && r.valid) I.push(["pb.shape", r.dir * 0.3, `P/B · ${r.dir > 0 ? "P (push up, then range)" : "B (push down, then range)"} with ${r.touches} touches`]);
    return I;
  }
  const pc = v => (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + "%";
  function html(A, title, fx) {
    if (!A) return `<div class="note">P/B ranges need about 200 bars.</div>`; fx = fx || (v => v >= 100 ? v.toFixed(2) : v.toPrecision(4));
    const r = A.last, L = A.live, nm = { reclaim: "Failed breakout → back inside", break: "Breakout with confirmation", edge: "Range trade at an edge" };
    const now = A.running && r ? `<b>${r.dir > 0 ? "P" : "B"}</b> range ${fx(r.lo)} – ${fx(r.hi)} (${r.len} bars, ${r.touches} touch${r.touches === 1 ? "" : "es"}, <b class="${r.valid ? "L" : ""}">${r.valid ? "valid" : "not valid yet: wait for 3 touches"}</b>${A.conf ? ", an edge sits on the value area high/low" : ""}). Price ${fx(A.px)} is ${Math.round((A.px - r.lo) / ((r.hi - r.lo) || 1) * 100)}% up the box. A small box after a big push favors the breakout; a big box favors range trades (box / push = ${Math.round((r.hi - r.lo) / Math.abs(r.push) * 100)}%).` : `No range forming now${r ? ` · last ${r.dir > 0 ? "P" : "B"} ${fx(r.lo)} – ${fx(r.hi)}` : ""}.`;
    const setups = L.length ? L.map(e => `<div><b class="${e.side > 0 ? "L" : "S"}">${e.side > 0 ? "LONG" : "SHORT"}</b> · ${nm[e.type]} · entry ${fx(e.entry)}, stop ${fx(e.stop)} (on structure: never move it away), target ${fx(e.target)}${e.far ? ` then ${fx(e.far)} (origin of the push)` : ""} · R:R ${e.rr.toFixed(1)}</div>`).join("") : `<div style="color:var(--dim)">No setup in the last 3 bars.</div>`;
    const row = (k, s) => `<tr><td style="text-align:left">${nm[k]}</td><td>${s.n}</td><td>${s.win != null ? Math.round(s.win * 100) + "%" : "–"}</td><td class="${s.avgR > 0 ? "L" : s.avgR < 0 ? "S" : ""}">${s.avgR != null ? (s.avgR >= 0 ? "+" : "") + s.avgR.toFixed(2) + " R" : "–"}</td><td>${s.longR != null ? s.longR.toFixed(2) : "–"} / ${s.shortR != null ? s.shortR.toFixed(2) : "–"}</td><td>${s.t.toFixed(1)}</td></tr>`;
    return `<div class="note" style="max-width:none">${title ? `<b>${title}</b> · ${A.tf} bars · ` : ""}${now}</div><div style="font-size:12.5px;margin:4px 0">${setups}</div>
      <table class="tr" style="width:auto"><thead><tr><th style="text-align:left">Back-test on this market (${A.R.filter(x => x.valid).length} valid ranges)</th><th>trades</th><th>win</th><th>avg</th><th>long / short R</th><th>t</th></tr></thead><tbody>${row("reclaim", A.S.reclaim)}${row("break", A.S.break)}${row("edge", A.S.edge)}</tbody></table>
      <div class="note" style="max-width:none">Each past setup is scored with his rules: stop on structure (−1 R if hit first), target at the far edge or the next fair value (+R), else marked to market after ${A.tf === "15m" ? "8 hours" : "16 bars"}. R = gain in units of the risk. A setup type gets full weight in the web only when its back-test made money here (t ≥ 1). His day rule: after 3–4 losses in a day, stop and start fresh tomorrow.</div>`;
  }
  window.PB = { analyze, signals, html };
})();
