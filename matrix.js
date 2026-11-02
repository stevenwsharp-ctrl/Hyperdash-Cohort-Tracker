/* Matrix and Dirac engine · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   MATRIX MATH (linear algebra on many markets at once)
   1. Correlation matrix of hourly returns → eigenvalues and eigenvectors (Jacobi rotations).
      The biggest eigenvector is the "market mode": everything moving as one.
   2. Random matrix theory (Marchenko–Pastur): pure noise gives eigenvalues up to λ+ = (1 + √(N/T))². Only eigenvalues above
      λ+ are real structure; the count says how many independent forces drive the basket now.
   3. Absorption ratio (Kritzman): the share of all variance in the top N/5 eigenvectors. When it jumps above its normal,
      markets are tightly coupled and fragile: shocks spread. mx.absorb leans negative on a jump.
   4. Factor residual (Avellaneda–Lee): regress a market on the top factors; its cumulative leftover is an "s-score".
      A big s-score = it moved away from what its factors explain; mx.resid leans to a return (the web learns if it does).
   5. Kalman filter (2 × 2 state matrices: level and slope of log price): the trend with its own uncertainty; mx.kalman =
      slope ÷ its standard error. Live only if the walk-forward test passes.
   DIRAC EQUATION (relativistic quantum mechanics, in 1 space + 1 time dimension)
   Dirac's equation in 1+1 D is the continuum limit of Feynman's checkerboard: a particle moves at the speed of light c,
   left or right, and its mass m is the rate at which it flips direction (each turn carries a factor −i·m·ε). Remove the
   "i" and you get the telegraph process: a move that keeps its direction and flips at rate a. That is measurable:
   - mass a = how often the hourly direction flips (a = ½: a coin; low a: "light", moves run; high a: "heavy", chop).
   - spinor: two components, up-movers and down-movers, coupled by the mass. Persistence φ = 1 − 2a.
   - Zitterbewegung ("trembling motion", from interference of the + and − energy parts): jitter with a period of ~2/a bars.
   - speed of light c: the 99th percentile of the smoothed velocity. Near c, γ = 1/√(1 − v²/c²) grows: momentum costs more
     and more energy (E² = p²c² + m²c⁴), so the move tires. dirac.gamma leans against a move near c.
   - dirac.spin = the last direction × φ now (persistence or reversal).
   Each Dirac and Kalman signal is tested walk-forward (first half learns the sign, second half must confirm, z ≥ 2)
   and is sent to the web only if it passed. These are physics used as measuring tools, not as laws of the market.
   API: Matrix.analyze(S, focus) (S = { name: [[t, close], ...] } hourly) · Matrix.kalman(bars) · Matrix.dirac(bars)
        Matrix.signals({ M, K, D }, focus) · Matrix.html({ M, K, D }, title) */
(function () {
  "use strict";
  if (window.Matrix) return;
  const c1 = v => Math.max(-1, Math.min(1, v)), mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1), sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1)); };
  // symmetric eigen decomposition, cyclic Jacobi
  function eig(A) {
    const n = A.length, a = A.map(r => r.slice()), V = a.map((_, i) => a.map((_, j) => i === j ? 1 : 0));
    for (let sw = 0; sw < 60; sw++) { let off = 0; for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] ** 2; if (off < 1e-12) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) { if (Math.abs(a[p][q]) < 1e-15) continue; const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; } } }
    return a.map((r, i) => ({ val: r[i], vec: V.map(row => row[i]) })).sort((x, y) => y.val - x.val);
  }
  function corr(X) { const n = X.length, T = X[0].length, Z = X.map(r => { const m = mean(r), s = sd(r) || 1; return r.map(v => (v - m) / s); }); return { Z, C: Z.map(a => Z.map(b => a.reduce((s, v, t) => s + v * b[t], 0) / (T - 1))) }; }
  function analyze(S, focus) {
    // align hourly closes on common hours, returns matrix N × T
    const names = Object.keys(S).filter(k => S[k] && S[k].length >= 60), H = {};
    names.forEach(k => S[k].forEach(([t, p]) => { const h = Math.floor(t / 36e5); (H[h] = H[h] || {})[k] = p; }));
    const hrs = Object.keys(H).map(Number).sort((a, b) => a - b), use = names.filter(k => hrs.filter(h => H[h][k] != null).length >= hrs.length * 0.8);
    const rows = hrs.filter(h => use.every(k => H[h][k] != null)); if (use.length < 5 || rows.length < 80) return null;
    const X = use.map(k => rows.slice(1).map((h, i) => Math.log(H[h][k] / H[rows[i]][k])));
    const T = X[0].length, N = use.length, { Z, C } = corr(X), E = eig(C), lp = (1 + Math.sqrt(N / T)) ** 2, sig = E.filter(e => e.val > lp).length, k = Math.max(1, Math.ceil(N / 5));
    const ar = E.slice(0, k).reduce((s, e) => s + e.val, 0) / N;
    // absorption ratio now (last 60 hours) vs the whole window
    const W = Math.min(60, Math.floor(T / 2)), Cs = corr(X.map(r => r.slice(-W))).C, Es = eig(Cs), arS = Es.slice(0, k).reduce((s, e) => s + e.val, 0) / N;
    // market mode: sign it so most loadings are positive
    const v1 = E[0].vec, sg = v1.reduce((s, v) => s + v, 0) >= 0 ? 1 : -1, mode = use.map((n, i) => ({ n, l: v1[i] * sg })).sort((a, b) => b.l - a.l);
    // factor residual of the focus market (top k factors from the standardized returns)
    const resOf = fi => { const F = E.slice(0, Math.max(1, sig)).map(e => Array.from({ length: T }, (_, t) => e.vec.reduce((s, v, i) => s + v * Z[i][t], 0)));
      const y = Z[fi], beta = F.map(f => f.reduce((s, v, t) => s + v * y[t], 0) / f.reduce((s, v) => s + v * v, 0)), e = y.map((v, t) => v - F.reduce((s, f, j) => s + beta[j] * f[t], 0));
      const cum = []; e.reduce((s, v, t) => (cum[t] = s + v, cum[t]), 0); const w = cum.slice(-Math.min(120, T)), s = (w[w.length - 1] - mean(w)) / (sd(w) || 1);
      return { s, r2: 1 - e.reduce((a, v) => a + v * v, 0) / y.reduce((a, v) => a + v * v, 0) }; };
    const res = use.indexOf(focus) >= 0 ? resOf(use.indexOf(focus)) : null, resAll = focus === "*" ? Object.fromEntries(use.map((n, i) => [n, resOf(i)])) : null;
    return { N, T, names: use, E: E.map(e => e.val), lp, sig, k, ar, arS, dAR: arS - ar, mode, res, resAll, cond: E[0].val / Math.max(1e-6, E[E.length - 1].val), pr: (E.reduce((s, e) => s + e.val, 0) ** 2) / E.reduce((s, e) => s + e.val * e.val, 0) };
  }
  // walk-forward check of a signal series: first half learns the sign, second half must confirm
  function wf(sigs, fut, h) { h = h || 4; const idx = sigs.map((v, i) => i).filter(i => i % h === 0 && sigs[i] && fut[i] != null);   /* every h-th bar only: the h-bar outcomes do not overlap, so the calls are independent */ if (idx.length < 40) return { z: 0, sign: 0, n: idx.length };
    const half = Math.floor(idx.length / 2), hz = L => { let h = 0; L.forEach(i => { if (Math.sign(sigs[i]) === Math.sign(fut[i])) h++; }); return (h - L.length / 2) / Math.sqrt(L.length / 4); };
    const z1 = hz(idx.slice(0, half)), sign = z1 >= 0 ? 1 : -1, z2 = hz(idx.slice(half)) * sign; return { z: z2, sign, n: idx.length, zl: z1 }; }
  const futOf = (c, h) => c.map((v, i) => i + h < c.length ? Math.log(c[i + h] / v) : null);
  function kalman(B) {
    if (!B || B.length < 300) return null; const y = B.map(b => Math.log(b[4])), r = y.slice(1).map((v, i) => v - y[i]), R = sd(r) ** 2 || 1e-6, q1 = R * 0.05, q2 = R * 1e-4;
    let x0 = y[0], x1 = 0, P = [[R, 0], [0, R * 0.01]]; const tt = [];
    for (let t = 1; t < y.length; t++) { x0 += x1; P = [[P[0][0] + 2 * P[0][1] + P[1][1] + q1, P[0][1] + P[1][1]], [P[0][1] + P[1][1], P[1][1] + q2]];
      const S = P[0][0] + R, K0 = P[0][0] / S, K1 = P[1][0] / S, e = y[t] - x0; x0 += K0 * e; x1 += K1 * e; P = [[(1 - K0) * P[0][0], (1 - K0) * P[0][1]], [P[1][0] - K1 * P[0][0], P[1][1] - K1 * P[0][1]]]; tt.push(x1 / Math.sqrt(Math.max(1e-12, P[1][1]))); }
    tt.unshift(0); const W = wf(tt.map(v => Math.abs(v) >= 1 ? Math.sign(v) : 0), futOf(B.map(b => b[4]), 4));
    return { t: tt[tt.length - 1], slope: x1, W, pass: W.z >= 2 };
  }
  function dirac(B) {
    if (!B || B.length < 300) return null; const c = B.map(b => b[4]), r = c.slice(1).map((v, i) => Math.log(v / c[i])), n = r.length;
    const flips = (a, b) => { let f = 0, m = 0; for (let i = Math.max(1, a); i < b; i++) { if (!r[i] || !r[i - 1]) continue; m++; if (Math.sign(r[i]) !== Math.sign(r[i - 1])) f++; } return m ? f / m : 0.5; };
    const aAll = flips(n - 1000, n), aNow = flips(n - 48, n);
    // smoothed velocity (EMA 6) and its speed limit c (99th percentile of |v|)
    const v = []; let e = 0; r.forEach((x, i) => { e += (x - e) * 2 / 7; v.push(e); }); const av = v.slice(-1000).map(Math.abs).sort((a, b) => a - b), cc = av[Math.floor(av.length * 0.99)] || 1e-9;
    const beta = Math.min(0.99, Math.abs(v[n - 1]) / cc), gamma = 1 / Math.sqrt(1 - beta * beta);
    // signal histories for the walk-forward tests (rolling 48-bar mass, no look-ahead)
    const spin = new Array(n + 1).fill(0), gam = new Array(n + 1).fill(0); let f = 0, m = 0; const q = [];
    for (let i = 1; i < n; i++) { const fl = r[i] && r[i - 1] ? (Math.sign(r[i]) !== Math.sign(r[i - 1]) ? 1 : 0) : null; q.push(fl); if (fl != null) { f += fl; m++; } if (q.length > 48) { const o = q.shift(); if (o != null) { f -= o; m--; } }
      const phi = m ? 1 - 2 * f / m : 0; if (Math.abs(phi) >= 0.08) spin[i + 1] = Math.sign(r[i]) * phi;
      const b = Math.abs(v[i]) / cc; if (b >= 0.8) gam[i + 1] = -Math.sign(v[i]); }
    const fut = futOf(c, 4), Ws = wf(spin, fut), Wg = wf(gam, fut), phiNow = 1 - 2 * aNow;
    return { aAll, aNow, phi: phiNow, zb: aNow > 0 ? 2 / aNow : null, c: cc, beta, gamma, dir: Math.sign(v[n - 1]), last: Math.sign(r[n - 1]), Ws, Wg, spinNow: spin[n], gamNow: gam[n],
      E: Math.sqrt((v[n - 1] / cc) ** 2 + (aNow * 2) ** 2) };
  }
  function signals(X, focus) {
    const I = [], M = X.M, K = X.K, D = X.D;
    if (M) { if (Math.abs(M.dAR) >= 0.03) I.push(["mx.absorb", c1(-M.dAR / 0.1), "Matrix · absorption ratio vs normal (coupled = fragile)"]); if (M.res && Math.abs(M.res.s) >= 1) I.push(["mx.resid", c1(-M.res.s / 2.5), "Matrix · factor residual (s-score), drift back"]); }
    if (K && K.pass && Math.abs(K.t) >= 1) I.push(["mx.kalman", c1(K.W.sign * Math.sign(K.t) * Math.min(1, Math.abs(K.t) / 3)), "Matrix · Kalman trend (slope ÷ its error, tested)"]);
    if (D) { if (D.Ws.z >= 2 && D.spinNow) I.push(["dirac.spin", c1(D.Ws.sign * D.spinNow * 2), "Dirac · spin: last direction × persistence (mass), tested"]);
      if (D.Wg.z >= 2 && D.gamNow) I.push(["dirac.gamma", c1(D.Wg.sign * D.gamNow * Math.min(1, (D.gamma - 1))), "Dirac · near the speed limit (γ high): the move tires, tested"]); }
    return I;
  }
  const f2 = v => v == null || !isFinite(v) ? "–" : v.toFixed(2);
  function html(X, title) {
    const M = X.M, K = X.K, D = X.D, ts = W => W ? `${W.n} calls · learn z ${f2(W.zl)} · unseen z <b class="${W.z >= 2 ? "L" : ""}">${f2(W.z)}</b>${W.z >= 2 ? " (live)" : " (not live)"}` : "–";
    const m = M ? `<div class="note" style="max-width:none"><b>Matrix</b> · ${M.N} markets × ${M.T} hours. <b>${M.sig}</b> eigenvalue${M.sig === 1 ? "" : "s"} above the noise edge λ+ ${f2(M.lp)} (real forces now); market mode λ1 ${f2(M.E[0])} = ${Math.round(M.E[0] / M.N * 100)}% of all movement. Effective independent markets ${f2(M.pr)} of ${M.N}. Absorption ratio (top ${M.k}) ${Math.round(M.ar * 100)}% normal, <b class="${M.dAR > 0.03 ? "S" : M.dAR < -0.03 ? "L" : ""}">${Math.round(M.arS * 100)}% last 60 h</b>${M.dAR > 0.05 ? " — coupling jump: fragile, shocks spread" : M.dAR < -0.05 ? " — decoupling: calmer, stock-picking market" : ""}.${M.res ? ` ${title || "Focus"}: factors explain ${Math.round(M.res.r2 * 100)}% of its moves; residual s-score <b>${f2(M.res.s)}</b>${Math.abs(M.res.s) >= 1.5 ? (M.res.s > 0 ? " (rich vs its factors)" : " (cheap vs its factors)") : ""}.` : ""}</div>
      <div class="note" style="max-width:none">Market-mode loadings: ${M.mode.slice(0, 8).map(x => `${x.n} ${f2(x.l)}`).join(" · ")}${M.mode.length > 8 ? " · … · " + M.mode.slice(-3).map(x => `${x.n} ${f2(x.l)}`).join(" · ") : ""}</div>` : X.noM ? "" : `<div class="note">The matrix needs 5+ markets with 80+ common hours.</div>`;
    const k = K ? `<div class="note" style="max-width:none"><b>Kalman trend</b> · slope ${(K.slope * 100).toFixed(3)}%/h, t = <b class="${K.t > 0 ? "L" : "S"}">${f2(K.t)}</b> · test: ${ts(K.W)}${K.W.sign < 0 ? " (works reversed)" : ""}</div>` : "";
    const d = D ? `<div class="note" style="max-width:none"><b>Dirac</b> · mass (flip rate) now <b>${f2(D.aNow)}</b> vs normal ${f2(D.aAll)} (0.50 = coin) → ${D.aNow < D.aAll - 0.04 ? "<b>light</b>: moves run" : D.aNow > D.aAll + 0.04 ? "<b>heavy</b>: chop" : "normal"} · persistence φ ${f2(D.phi)} · Zitterbewegung period ~${D.zb ? D.zb.toFixed(1) : "–"} h · velocity ${Math.round(D.beta * 100)}% of c, γ ${f2(D.gamma)}${D.beta >= 0.8 ? ` <b class="${D.dir > 0 ? "S" : "L"}">near the speed limit</b>` : ""} · energy √(p²+m²) ${f2(D.E)}</div>
      <div class="note" style="max-width:none">Spin test: ${ts(D.Ws)} · speed-limit test: ${ts(D.Wg)}</div>` : "";
    return m + k + d + `<div class="note" style="max-width:none">Linear algebra finds how many real forces move the basket (eigenvalues above the random-matrix edge), how tightly it is coupled (absorption), and what one market does beyond its factors (residual). Dirac's equation in 1+1 D is Feynman's checkerboard: motion at a fixed speed whose mass is the rate of turning; measured on prices, mass = how often direction flips, and moves near the "speed of light" (γ high) cost more energy. Signals go to the web only after a walk-forward test.</div>`;
  }
  window.Matrix = { analyze, kalman, dirac, signals, html, eig };
})();
