/* Rhythm engine · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   Four ideas, each made measurable and checked against the market's own history before it is trusted:
   1. Randomness — is the path random now, or does it have memory?
      Variance ratio VR(q): the variance of q-bar moves vs q x the 1-bar variance. VR > 1 = moves continue (momentum);
      VR < 1 = moves reverse (mean reversion); VR ≈ 1 = random walk (no edge from the path itself). Plus the Hurst
      exponent (H > 0.5 trending, < 0.5 reverting), permutation entropy (1.0 = fully random order of ups and downs)
      and a runs test on up/down bars.
   2. Regularity — repeating patterns: return by hour of the day (ET) and by weekday, each with a t-statistic,
      and a dominant cycle (autocorrelation of price around its 48-bar average).
   3. Fibonacci — swings from a zigzag (3 x ATR). Retracement levels 23.6 / 38.2 / 50 / 61.8 / 78.6%.
      Back-test on past swings: how often price turned at a Fibonacci level vs at non-Fibonacci control levels
      (30 / 45 / 70%). Also golden-ratio swing sizes and Fibonacci bar counts vs chance.
   4. Poetry in motion — a smooth trend: efficiency ratio (net move / total path), the same direction on short,
      mid and long windows, and calm, even bar sizes. Smooth flow is a trend to ride, not to fight.
   5. Music — consonant intervals between swings (unison 1:1, octave 2:1, fifth 3:2, fourth 4:3, thirds 5:4 and 6:5,
      golden 1.618) in size and in time, vs a shuffled control; tension (volatility squeeze) and resolution (return to
      "home", the 48-bar mean), each back-tested; the next note = targets for the running swing.
   6. Frequency — the spectrum of the price path (a Fourier transform over up to 512 bars): the strongest waves that beat
      shuffled copies, how much of the movement they carry (signal vs noise), their projection for the next bars, resonance
      when all of them turn the same way, a walk-forward test of the projection (the web gets it only if it worked), and
      Tesla's 3-6-9 (do cycles of 3, 6, 9 … hours carry more power than other lengths, vs chance).
   Bars: [[t, open, high, low, close]], oldest first. Each part gives a signal from -1 to +1 for the signal web. */
(function () {
  "use strict";
  const c1 = v => Math.max(-1, Math.min(1, v)), mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const sdv = a => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length || 1)); };
  const etH = (() => { let f = null; try { f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23", weekday: "short" }); } catch (e) { }
    return t => { if (!f) { const d = new Date(t - 4 * 36e5); return { h: d.getUTCHours(), w: d.getUTCDay() }; } const p = f.formatToParts(new Date(t)), h = +p.find(x => x.type === "hour").value % 24, w = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.find(x => x.type === "weekday").value); return { h, w }; }; })();
  // shuffled copy: the same bar moves (and ranges) in random order — what pure chance looks like on this market
  function surrogate(B) { const r = [], hl = []; for (let i = 1; i < B.length; i++) { r.push(Math.log(B[i][4] / B[i - 1][4])); hl.push([B[i][2] / B[i][4], B[i][3] / B[i][4]]); }
    for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; [hl[i], hl[j]] = [hl[j], hl[i]]; }
    const S = [B[0].slice()]; let p = B[0][4]; for (let i = 0; i < r.length; i++) { const o = p; p *= Math.exp(r[i]); S.push([B[i + 1][0], o, Math.max(o, p * hl[i][0]), Math.min(o, p * hl[i][1]), p]); } return S; }
  // ---------- 1. randomness ----------
  function vr(r, q) { const n = r.length; if (n < q * 8) return null; const v1 = sdv(r) ** 2; if (!v1) return null; const s = [];
    for (let i = q; i <= n; i++) { let x = 0; for (let j = i - q; j < i; j++) x += r[j]; s.push(x); } const m = mean(r) * q, vq = s.reduce((a, x) => a + (x - m) ** 2, 0) / s.length;
    const V = vq / (q * v1), phi = 2 * (2 * q - 1) * (q - 1) / (3 * q * n); return { v: V, z: (V - 1) / Math.sqrt(phi) }; }
  function hurst(r) { const ms = [1, 2, 4, 8, 16, 32].filter(m => r.length / m >= 8), X = [], Y = [];
    ms.forEach(m => { const s = []; for (let i = 0; i + m <= r.length; i += m) { let x = 0; for (let j = i; j < i + m; j++) x += r[j]; s.push(x); } const v = sdv(s) ** 2; if (v > 0) { X.push(Math.log(m)); Y.push(Math.log(v)); } });
    if (X.length < 3) return null; const mx = mean(X), my = mean(Y); let a = 0, b = 0; X.forEach((x, i) => { a += (x - mx) * (Y[i] - my); b += (x - mx) ** 2; }); return a / b / 2; }
  function pent(r) { const c = {}; let n = 0; for (let i = 2; i < r.length; i++) { const k = [r[i - 2], r[i - 1], r[i]].map((v, j) => [v, j]).sort((x, y) => x[0] - y[0]).map(x => x[1]).join(""); c[k] = (c[k] || 0) + 1; n++; }
    if (n < 30) return null; let h = 0; Object.values(c).forEach(k => { const p = k / n; h -= p * Math.log(p); }); return h / Math.log(6); }
  function runs(r) { const s = r.filter(v => v !== 0).map(v => v > 0 ? 1 : 0), n1 = s.filter(x => x).length, n2 = s.length - n1, n = s.length; if (n1 < 10 || n2 < 10) return null;
    let R = 1; for (let i = 1; i < n; i++) if (s[i] !== s[i - 1]) R++; const mu = 2 * n1 * n2 / n + 1, v = 2 * n1 * n2 * (2 * n1 * n2 - n) / (n * n * (n - 1)); return (R - mu) / Math.sqrt(v); }
  // ---------- 3. Fibonacci ----------
  function zigzag(B, k) {
    const tr = []; for (let i = 1; i < B.length; i++) tr.push(Math.max(B[i][2] - B[i][3], Math.abs(B[i][2] - B[i - 1][4]), Math.abs(B[i][3] - B[i - 1][4])));
    const atr = mean(tr.slice(-Math.min(tr.length, 200))) || 0, th = k * atr; if (!th) return [];
    const P = []; let dir = 0, ext = 0, exI = 0;
    for (let i = 0; i < B.length; i++) { const h = B[i][2], l = B[i][3];
      if (!dir) { if (!P.length) { P.push({ i, p: B[i][4], typ: 0 }); ext = B[i][4]; exI = i; } if (h - P[0].p >= th) { dir = 1; ext = h; exI = i; P[0].typ = -1; } else if (P[0].p - l >= th) { dir = -1; ext = l; exI = i; P[0].typ = 1; } continue; }
      if (dir > 0) { if (h > ext) { ext = h; exI = i; } else if (ext - l >= th) { P.push({ i: exI, p: ext, typ: 1 }); dir = -1; ext = l; exI = i; } }
      else { if (l < ext) { ext = l; exI = i; } else if (h - ext >= th) { P.push({ i: exI, p: ext, typ: -1 }); dir = 1; ext = h; exI = i; } } }
    return { P, cur: { i: exI, p: ext, dir }, th };
  }
  const FIBL = [0.236, 0.382, 0.5, 0.618, 0.786], CTRL = [0.3, 0.45, 0.7], FIBN = [3, 5, 8, 13, 21, 34, 55, 89, 144];
  // after swing A->B, the first touch of level L: did price turn back toward B by 25% of the swing before going 15% of the swing past L?
  function levelTest(B, P, levels) { let n = 0, hit = 0;
    for (let s = 1; s < P.length - 1; s++) { const A = P[s - 1], Bp = P[s], sw = Bp.p - A.p, end = Math.min(B.length - 1, Bp.i + 3 * (Bp.i - A.i) + 5); if (!sw) continue;
      levels.forEach(L => { const lp = Bp.p - sw * L, up = sw > 0; let touched = -1;
        for (let i = Bp.i + 1; i <= end; i++) { if (up ? B[i][3] <= lp : B[i][2] >= lp) { touched = i; break; } if (up ? B[i][2] > Bp.p : B[i][3] < Bp.p) break; }
        if (touched < 0) return; n++;
        for (let i = touched; i <= end; i++) { if (up ? B[i][3] < lp - 0.15 * sw : B[i][2] > lp - 0.15 * sw) break; if (up ? B[i][2] >= lp + 0.25 * sw : B[i][3] <= lp + 0.25 * sw) { hit++; break; } } }); }
    return { n, hit, rate: n ? hit / n : null }; }
  function fib(B) {
    const Z = zigzag(B, 3); if (!Z.P || Z.P.length < 4) return null; const P = Z.P, last = P[P.length - 1], prev = P[P.length - 2], px = B[B.length - 1][4];
    // the active swing: from the last confirmed pivot to the running extreme (if it went far enough), else the last confirmed swing
    let A = prev, Bp = last; if (Math.abs(Z.cur.p - last.p) >= Z.th && Z.cur.i > last.i) { A = last; Bp = { i: Z.cur.i, p: Z.cur.p }; }
    const sw = Bp.p - A.p, x = sw ? (Bp.p - px) / sw : null;
    const levels = FIBL.map(L => ({ L, p: Bp.p - sw * L })), near = x != null ? levels.find(o => Math.abs(x - o.L) <= 0.035) : null;
    const tF = levelTest(B, P, [0.382, 0.5, 0.618]), tC = levelTest(B, P, CTRL);
    // golden ratio in swing sizes, vs a control band of the same width
    const len = []; for (let i = 1; i < P.length; i++) len.push(Math.abs(P[i].p - P[i - 1].p)); let g = 0, gc = 0, nr = 0;
    for (let i = 1; i < len.length; i++) { const r = len[i] / len[i - 1]; nr++; if (Math.abs(r - 0.618) <= 0.06 || Math.abs(r - 1.618) <= 0.15) g++; if (Math.abs(r - 0.75) <= 0.06 || Math.abs(r - 1.33) <= 0.15) gc++; }
    // Fibonacci bar counts between pivots vs neighbours
    let fb = 0, nb = 0; for (let i = 1; i < P.length; i++) { const d = P[i].i - P[i - 1].i; nb++; if (FIBN.some(f => Math.abs(d - f) <= (f >= 21 ? 1 : 0))) fb++; }
    const fbBase = (() => { let c = 0, t = 0; for (let d = 2; d <= 150; d++) { t++; if (FIBN.some(f => Math.abs(d - f) <= (f >= 21 ? 1 : 0))) c++; } return c / t; })();
    const since = B.length - 1 - Bp.i, fibTime = FIBN.find(f => Math.abs(since - f) <= (f >= 21 ? 1 : 0));
    const edge = tF.rate != null && tC.rate != null && tF.n >= 8 && tC.n >= 8 ? tF.rate - tC.rate : null;
    let sig = 0; if (near && near.L >= 0.382 && near.L <= 0.618 && tF.rate != null && tF.n >= 8) sig = Math.sign(sw) * c1((tF.rate - 0.5) * 3 + (edge || 0) * 4);
    return { A, B: Bp, sw, x, px, levels, near, tF, tC, edge, gold: { g, gc, n: nr }, fbars: { fb, nb, base: fbBase }, since, fibTime, sig, th: Z.th, pivots: P.length };
  }
  // ---------- music: intervals between swings (size and time), tension and resolution ----------
  const IV = [[1, 1, "unison 1:1"], [2, 1, "octave 2:1"], [3, 2, "fifth 3:2"], [4, 3, "fourth 4:3"], [5, 4, "major third 5:4"], [6, 5, "minor third 6:5"], [1.618, 1, "golden 1.618"]];
  function consonant(x) { if (!(x > 0)) return null; const lx = Math.abs(Math.log(x)); let best = null; IV.forEach(([a, b, n]) => { const d = Math.abs(lx - Math.log(a / b)); if (d <= 0.035 && (!best || d < best.d)) best = { d, n }; }); return best; }
  function share(v) { let c = 0, n = 0; for (let i = 1; i < v.length; i++) { if (!(v[i] > 0 && v[i - 1] > 0)) continue; n++; if (consonant(v[i] / v[i - 1])) c++; } return n ? { c, n, r: c / n } : null; }
  function shuffled(v, k) { let s = 0, m = 0; const a = v.slice(); for (let t = 0; t < k; t++) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } const x = share(a); if (x) { s += x.r; m++; } } return m ? s / m : null; }
  function music(B, Z) {
    if (!Z || !Z.P || Z.P.length < 8) return null; const P = Z.P.concat(Z.cur.i > Z.P[Z.P.length - 1].i ? [{ i: Z.cur.i, p: Z.cur.p }] : []);
    const L = [], D = []; for (let i = 1; i < P.length; i++) { L.push(Math.abs(P[i].p - P[i - 1].p)); D.push(P[i].i - P[i - 1].i); }
    const sz = share(L.slice(0, -1)), tm = share(D.slice(0, -1)), szB = shuffled(L.slice(0, -1), 200), tmB = shuffled(D.slice(0, -1), 200);
    const cnt = {}; for (let i = 1; i < L.length - 1; i++) { const c = consonant(L[i] / L[i - 1]); if (c) cnt[c.n] = (cnt[c.n] || 0) + 1; }
    const fav = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 3);
    // next note: targets for the running swing from the last full swing x common intervals
    const last = L[L.length - 2], dir = Math.sign(P[P.length - 1].p - P[P.length - 2].p), from = P[P.length - 2].p;
    const tg = [["1:1", 1], ["golden", 1.618], ["3:2", 1.5], ["2:1", 2], ["2:3", 2 / 3]].map(([n, k]) => ({ n, p: from + dir * last * k }));
    // tension and resolution: squeeze (low 20-bar volatility vs the last 400) and the pull back to "home" (48-bar mean)
    const r = []; for (let i = 1; i < B.length; i++) r.push(Math.log(B[i][4] / B[i - 1][4]));
    const vol = []; for (let i = 20; i <= r.length; i++) vol.push(sdv(r.slice(i - 20, i))); const vNow = vol[vol.length - 1], vs = vol.slice(-400).slice().sort((a, b) => a - b);
    const pct = vs.length ? vs.findIndex(v => v >= vNow) / vs.length : null;
    const lp = B.map(b => Math.log(b[4])), zAt = i => { if (i < 48) return null; let s = 0, q = 0; for (let j = i - 47; j <= i; j++) { s += lp[j]; } const m = s / 48; for (let j = i - 47; j <= i; j++) q += (lp[j] - m) ** 2; const sd = Math.sqrt(q / 48); return sd ? { z: (lp[i] - m) / sd, m } : null; };
    let home = 0, homeN = 0; for (let i = 48; i < B.length - 24; i += 3) { const a = zAt(i); if (!a || Math.abs(a.z) < 2) continue; homeN++; for (let j = i + 1; j <= i + 24; j++) if (Math.sign(lp[j] - a.m) !== Math.sign(lp[i] - a.m)) { home++; break; } }
    const zn = zAt(B.length - 1), homeR = homeN >= 10 ? home / homeN : null;
    // the same count on shuffled copies: how often price "comes home" by pure chance
    let hb = null; if (homeR != null) { let s = 0, k = 0; for (let t = 0; t < 6; t++) { const S = surrogate(B), lq = S.map(b => Math.log(b[4])); let h2 = 0, n2 = 0;
        for (let i = 48; i < S.length - 24; i += 3) { let a = 0, q = 0; for (let j = i - 47; j <= i; j++) a += lq[j]; const m = a / 48; for (let j = i - 47; j <= i; j++) q += (lq[j] - m) ** 2; const sd = Math.sqrt(q / 48); if (!sd || Math.abs((lq[i] - m) / sd) < 2) continue;
          n2++; for (let j = i + 1; j <= i + 24; j++) if (Math.sign(lq[j] - m) !== Math.sign(lq[i] - m)) { h2++; break; } } if (n2) { s += h2 / n2; k++; } } hb = k ? s / k : null; }
    // squeeze outcome: after the 15% calmest stretches, how big was the next 24-bar move vs normal?
    let sq = [], nm = []; for (let k = 0; k < vol.length - 24; k += 4) { const i = k + 20, mv = Math.abs(lp[Math.min(lp.length - 1, i + 24)] - lp[i]); const pk = vs.length ? vs.findIndex(v => v >= vol[k]) / vs.length : 1; (pk <= 0.15 ? sq : nm).push(mv); }
    const burst = sq.length >= 5 && nm.length ? mean(sq) / (mean(nm) || 1e-9) : null;
    const sig = zn && homeR != null && hb != null && Math.abs(zn.z) >= 2 ? c1(-Math.sign(zn.z) * (homeR - hb) * 4) : 0;
    return { sz, tm, szB, tmB, fav, tg, dir, pct, tension: pct != null && pct <= 0.15, zHome: zn ? zn.z : null, homeR, homeB: hb, homeN, burst, sig };
  }
  // ---------- 6. frequency: the spectrum of the price path, its strongest real waves, and their projection ----------
  // detrended log price over the last N bars; power at each period P (a discrete Fourier transform at 1/P)
  function dft(x, P) { const w = 2 * Math.PI / P; let a = 0, b = 0; for (let t = 0; t < x.length; t++) { a += x[t] * Math.cos(w * t); b += x[t] * Math.sin(w * t); } return { a, b, pw: (a * a + b * b) / x.length }; }
  function detr(lp) { const n = lp.length, mx = (n - 1) / 2, my = lp.reduce((s, v) => s + v, 0) / n; let sxy = 0, sxx = 0; lp.forEach((v, i) => { sxy += (i - mx) * (v - my); sxx += (i - mx) ** 2; }); const k = sxx ? sxy / sxx : 0; return lp.map((v, i) => v - my - k * (i - mx)); }
  const PER = n => { const a = []; for (let p = 4; p <= Math.min(160, n / 3); p += p < 30 ? 1 : p < 80 ? 2 : 4) a.push(p); return a; };
  function waves(B, N) {
    const lp = B.slice(-N).map(b => Math.log(b[4])), x = detr(lp), n = x.length, Ps = PER(n), sp = Ps.map(P => ({ P, ...dft(x, P) })), tot = x.reduce((s, v) => s + v * v, 0) / n || 1e-12;
    const peaks = sp.filter((o, i) => i > 0 && i < sp.length - 1 && o.pw >= sp[i - 1].pw && o.pw >= sp[i + 1].pw).sort((a, b) => b.pw - a.pw).slice(0, 4);
    return { x, n, sp, peaks, tot };
  }
  function project(W, keep, q) { const n = W.n; let d = 0, dir = []; keep.forEach(o => { const w = 2 * Math.PI / o.P, f = t => (2 / n) * (o.a * Math.cos(w * t) + o.b * Math.sin(w * t)); d += f(n - 1 + q) - f(n - 1); dir.push(Math.sign(f(n) - f(n - 1))); }); return { d, dir }; }
  function spectrum(B) {
    if (!B || B.length < 200) return null; const N = Math.min(512, B.length), W = waves(B, N);
    // significance: the same periods on shuffled copies of the same moves (a random walk also has slow "waves")
    const thr = {}; const sv = []; for (let k = 0; k < 12; k++) { const S = surrogate(B.slice(-N - 1)), Ws = waves(S, N); sv.push(Ws); }
    W.sp.forEach(o => { const v = sv.map(Ws => { const m = Ws.sp.find(q => q.P === o.P); return m ? m.pw : 0; }).sort((a, b) => a - b); thr[o.P] = v[v.length - 1] || Infinity; });   // above the strongest of 12 shuffled copies
    let keep = W.peaks.filter(o => o.pw > thr[o.P] * 1.2).slice(0, 3); const snr0 = keep.reduce((s, o) => s + o.pw, 0) / (W.sp.reduce((s, o) => s + o.pw, 0) || 1);
    if (snr0 < 0.08) keep = []; const snr = keep.length ? snr0 : 0;   // a real wave must carry a real share of the movement
    const q = keep.length ? Math.max(2, Math.round(Math.min(...keep.map(o => o.P)) / 4)) : 4, pr = project(W, keep, q);
    // walk-forward test: did the projected direction come true on this market's own past?
    let hit = 0, runs = 0; const r = []; for (let i = 1; i < B.length; i++) r.push(Math.log(B[i][4] / B[i - 1][4])); const sd = Math.sqrt(r.reduce((s, v) => s + v * v, 0) / r.length) || 1e-9;
    for (let end = Math.max(N, 200); end <= B.length - q - 1 && keep.length; end += 12) { const Wb = waves(B.slice(0, end), Math.min(N, end)), kb = Wb.peaks.filter(o => keep.some(k => Math.abs(k.P - o.P) <= Math.max(1, k.P * 0.1))).slice(0, 3); if (!kb.length) continue;
      const pb = project(Wb, kb, q), act = Math.log(B[end - 1 + q][4] / B[end - 1][4]); if (Math.abs(pb.d) < 1e-9 || !act) continue; runs++; if (Math.sign(pb.d) === Math.sign(act)) hit++; }
    const hr = runs ? hit / runs : null, zt = runs ? (hr - 0.5) * 2 * Math.sqrt(runs) : 0, trust = hr != null && runs >= 25 && zt >= 2 ? c1((hr - 0.5) * 6) : 0;   // must beat a coin flip with z ≥ 2
    const res = keep.length >= 2 && pr.dir.every(v => v === pr.dir[0]) ? pr.dir[0] : 0;
    // Tesla 3-6-9: do cycles of 3, 6, 9 … hours carry more power than other lengths? (hourly bars only)
    let tesla = null; const bar = (B[B.length - 1][0] - B[0][0]) / (B.length - 1);
    if (Math.abs(bar - 36e5) < 6e5) { const pw = P => dft(W.x, P).pw, T9 = [6, 9, 12, 18, 24, 27, 36, 45, 54, 72], Ct = [5, 7, 8, 10, 11, 14, 15, 20, 28, 40, 50, 60];
      const m = A => A.reduce((s, P) => s + Math.log(pw(P) + 1e-18), 0) / A.length, d0 = m(T9) - m(Ct);
      const ds = sv.map(Ws => { const p2 = P => dft(Ws.x, P).pw, mm = A => A.reduce((s, P) => s + Math.log(p2(P) + 1e-18), 0) / A.length; return mm(T9) - mm(Ct); }), mu = ds.reduce((s, v) => s + v, 0) / ds.length, sdd = Math.sqrt(ds.reduce((s, v) => s + (v - mu) ** 2, 0) / ds.length) || 1;
      tesla = { ratio: Math.exp(d0), z: (d0 - mu) / sdd }; }
    return { keep, snr, q, proj: pr.d, projZ: pr.d / (sd * Math.sqrt(q)), dir: pr.dir, res, hit: hr, runs, trust, tesla, sp: W.sp, thr, n: N, x: W.x, bar };
  }
  // ---------- main ----------
  function analyze(B, o) {
    o = o || {}; if (!B || B.length < 80) return null; const r = []; for (let i = 1; i < B.length; i++) r.push(Math.log(B[i][4] / B[i - 1][4]));
    const W = Math.min(r.length, o.win || 400), rr = r.slice(-W), bar = (B[B.length - 1][0] - B[0][0]) / (B.length - 1);
    const out = { bar, n: B.length };
    // 1. randomness (recent window)
    const v4 = vr(rr, 4), v16 = vr(rr, 16), H = hurst(rr), pe = pent(rr), rz = runs(rr);
    const zT = v16 ? v16.z : v4 ? v4.z : 0;
    out.rand = { v4, v16, H, pe, rz, label: zT >= 2 ? "Trending: moves tend to continue" : zT <= -2 ? "Mean-reverting: moves tend to snap back" : Math.abs(zT) < 1 ? "Random: the path gives no edge" : zT > 0 ? "Leaning to trend" : "Leaning to reversal", z: zT };
    const k = 16, mv = r.slice(-k).reduce((a, v) => a + v, 0), sd1 = sdv(rr) || 1e-9, mz = mv / (sd1 * Math.sqrt(k));
    out.sig = { trend: Math.abs(zT) >= 1.5 && Math.abs(mz) >= 1 ? c1(Math.sign(zT) * Math.sign(mz) * Math.min(1, (Math.abs(zT) - 1) / 2) * Math.min(1, Math.abs(mz) / 2)) : 0 };
    // 2. regularity: hour of day and weekday (needs hourly or finer bars over many days)
    if (bar <= 36e5 * 1.01 && (B[B.length - 1][0] - B[0][0]) >= 20 * 864e5) {
      const hb = Array.from({ length: 24 }, () => []), wb = Array.from({ length: 7 }, () => []);
      for (let i = 1; i < B.length; i++) { const e = etH(B[i][0]); hb[e.h].push(r[i - 1]); wb[e.w].push(r[i - 1]); }
      const st = a => { if (a.length < 15) return null; const m = mean(a), s = sdv(a); return { m, t: s ? m / (s / Math.sqrt(a.length)) : 0, n: a.length, up: a.filter(v => v > 0).length / a.length }; };
      out.hours = hb.map(st); out.days = wb.map(st);
      const nx = etH(Date.now() + 36e5 * 0.5), hh = out.hours[nx.h]; out.next = { h: nx.h, s: hh };
      out.sig.hour = hh && Math.abs(hh.t) >= 1.5 ? c1(hh.t / 3) : 0;
    }
    // dominant cycle: a real oscillation (the autocorrelation dips below zero, then peaks again) that beats shuffled copies
    { const cyc = BB => { const lp = BB.map(b => Math.log(b[4])), d = []; for (let i = 47; i < lp.length; i++) { let s = 0; for (let j = i - 47; j <= i; j++) s += lp[j]; d.push(lp[i] - s / 48); }
        const dd = d.slice(-Math.min(d.length, 600)), m = mean(dd), v = dd.reduce((a, x) => a + (x - m) ** 2, 0); if (!(v > 0) || dd.length < 120) return null;
        const ac = [1]; for (let L = 1; L <= Math.min(120, dd.length / 3); L++) { let c = 0; for (let i = L; i < dd.length; i++) c += (dd[i] - m) * (dd[i - L] - m); ac.push(c / v); }
        let dip = false, best = null; for (let L = 2; L < ac.length - 1; L++) { if (ac[L] < -0.1) dip = true; if (dip && L >= 8 && ac[L] > ac[L - 1] && ac[L] >= ac[L + 1] && (!best || ac[L] > best.ac)) best = { L, ac: ac[L] }; } return best ? { ...best, dd } : null; };
      const c = cyc(B); let thr = 0.2; if (c) { const sv = []; for (let k = 0; k < 12; k++) { const x = cyc(surrogate(B)); sv.push(x ? x.ac : 0); } sv.sort((a, b) => a - b); thr = Math.max(0.2, sv[Math.floor(sv.length * 0.9)]); }
      if (c && c.ac > thr) { const dd = c.dd, q = Math.max(2, Math.round(c.L / 4)), n = dd.length, then = dd[n - 1 - c.L + q] - dd[n - 1 - c.L];
        out.cycle = { L: c.L, ac: c.ac, thr, hrs: c.L * bar / 36e5, next: then, q }; out.sig.cycle = c1(Math.sign(then) * (c.ac - thr) * 4); } else { out.sig.cycle = 0; out.cycleNone = c ? { ac: c.ac, thr } : null; } }
    // 3. Fibonacci
    out.fib = fib(B); out.sig.fib = out.fib ? out.fib.sig : 0;
    // frequency
    try { out.freq = spectrum(B); const Fq = out.freq; out.sig.wave = Fq && Fq.keep.length && Fq.trust > 0 ? c1(Math.sign(Fq.proj) * Math.min(1, Math.abs(Fq.projZ)) * Fq.trust) : 0;
      out.sig.resonance = Fq && Fq.res && Fq.trust > 0 ? c1(Fq.res * Fq.trust) : 0; } catch (e) { out.sig.wave = 0; out.sig.resonance = 0; }
    // music
    try { out.music = music(B, zigzag(B, 3)); out.sig.home = out.music ? out.music.sig : 0; } catch (e) { out.sig.home = 0; }
    // 4. poetry in motion: smooth, aligned, calm
    const er = n => { const s = B.slice(-n - 1); if (s.length < n + 1) return null; let p = 0; for (let i = 1; i < s.length; i++) p += Math.abs(s[i][4] - s[i - 1][4]); return p ? (s[s.length - 1][4] - s[0][4]) / p : 0; };
    const e8 = er(8), e24 = er(24), e72 = er(72), ab = r.slice(-24).map(Math.abs), calm = ab.length ? 1 - Math.min(1, sdv(ab) / (mean(ab) || 1e-9) / 1.5) : 0;
    const al = [e8, e24, e72].filter(v => v != null), same = al.length === 3 && al.every(v => Math.sign(v) === Math.sign(e24) && v !== 0);
    const score = e24 == null ? 0 : Math.abs(e24) * (same ? 1 : 0.4) * (0.6 + 0.4 * calm);
    out.flow = { e8, e24, e72, same, calm, score, dir: Math.sign(e24 || 0), label: score >= 0.3 ? "Poetry in motion: a smooth, aligned trend" : score >= 0.15 ? "Some flow" : "Choppy: no flow" };
    out.sig.flow = score >= 0.15 ? c1(Math.sign(e24) * score * 2.5) : 0;
    return out;
  }
  // ---------- html ----------
  const pc = v => v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : "") + (v * 100).toFixed(2) + "%";
  const hr = h => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
  function html(R, o) {
    o = o || {}; if (!R) return `<div class="note">Rhythm needs at least 80 bars; it fills in as bars load.</div>`; const f = R.fib, F = R.flow, X = R.rand;
    const fx = v => v == null ? "–" : v.toFixed(2), cl = v => v > 0 ? "L" : v < 0 ? "S" : "";
    const use = X.z >= 2 ? "Buy pullbacks in the trend direction; let winners run; do not fade." : X.z <= -2 ? "Fade stretched moves back toward the average; take profit quickly; do not chase." : Math.abs(X.z) < 1 ? "The path alone gives no edge: trade smaller, and lean on flows, news and positioning instead." : "A weak lean only: small size.";
    let h = `<table class="tr"><tbody>
      <tr><td style="text-align:left"><b>Randomness</b></td><td style="text-align:left">${X.label}. Variance ratio ${X.v16 ? fx(X.v16.v) + " (z " + fx(X.v16.z) + ")" : "–"}, Hurst ${fx(X.H)}, entropy ${fx(X.pe)} of 1.00, runs z ${fx(X.rz)}.<div class="note" style="margin:2px 0 0">How to profit: ${use}</div></td></tr>`;
    if (R.next && R.next.s) { const s = R.next.s, top = (R.hours || []).map((x, i) => [i, x]).filter(x => x[1] && Math.abs(x[1].t) >= 2).sort((a, b) => Math.abs(b[1].t) - Math.abs(a[1].t)).slice(0, 4);
      const dn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], td = (R.days || []).map((x, i) => [i, x]).filter(x => x[1] && Math.abs(x[1].t) >= 2);
      h += `<tr><td style="text-align:left"><b>Regularity</b></td><td style="text-align:left">Next hour (${hr(R.next.h)} ET): average <span class="${cl(s.m)}">${pc(s.m)}</span>, up ${Math.round(s.up * 100)}% of ${s.n} times (t ${fx(s.t)}${Math.abs(s.t) >= 2 ? ", a real pattern" : Math.abs(s.t) >= 1.5 ? ", weak" : ", noise"}).
        ${top.length ? `Strongest hours: ${top.map(([i, x]) => `${hr(i)} <span class="${cl(x.m)}">${pc(x.m)}</span> (t ${fx(x.t)})`).join(", ")}.` : "No hour of the day is strong (|t| ≥ 2)."} ${td.length ? `Weekdays: ${td.map(([i, x]) => `${dn[i]} <span class="${cl(x.m)}">${pc(x.m)}</span>`).join(", ")}.` : ""}
        ${R.cycle ? `Cycle: about every ${R.cycle.hrs >= 24 ? (R.cycle.hrs / 24).toFixed(1) + " days" : R.cycle.hrs.toFixed(1) + "h"} (strength ${fx(R.cycle.ac)}); the same phase last cycle went <span class="${cl(R.cycle.next)}">${R.cycle.next > 0 ? "up" : "down"}</span>.` : "No cycle stronger than chance (shuffled copies of the same moves)."}</td></tr>`; }
    else if (R.cycle) h += `<tr><td style="text-align:left"><b>Regularity</b></td><td style="text-align:left">Cycle: about every ${R.cycle.hrs.toFixed(1)}h (strength ${fx(R.cycle.ac)}); the same phase last cycle went <span class="${cl(R.cycle.next)}">${R.cycle.next > 0 ? "up" : "down"}</span>.</td></tr>`;
    if (f) { const P = o.px || (v => v.toFixed(2));
      h += `<tr><td style="text-align:left"><b>Fibonacci</b></td><td style="text-align:left">Swing ${f.sw > 0 ? "up" : "down"} ${P(f.A.p)} → ${P(f.B.p)}; price is at <b>${f.x != null ? (f.x * 100).toFixed(0) : "–"}%</b> retracement${f.near ? ` — <b>at the ${(f.near.L * 100).toFixed(1)}% level</b>` : ""}. Levels: ${f.levels.map(l => `${(l.L * 100).toFixed(1)}% ${P(l.p)}`).join(" · ")}.
        <div class="note" style="margin:2px 0 0">Back-test on ${f.pivots} swings: price turned at 38.2–61.8% levels ${f.tF.rate != null ? Math.round(f.tF.rate * 100) + "% of " + f.tF.n : "–"} vs ${f.tC.rate != null ? Math.round(f.tC.rate * 100) + "% of " + f.tC.n : "–"} at non-Fibonacci levels → ${f.edge == null ? "not enough swings yet" : f.edge >= 0.08 ? "<b>Fibonacci levels work on this market</b>" : f.edge >= 0.04 ? "<b>a small Fibonacci edge</b> (levels hold a bit more often than others)" : f.edge <= -0.08 ? "Fibonacci levels work worse than other levels here" : "no real Fibonacci edge here (levels act like any other)"}.
        Golden-ratio swings: ${f.gold.g} of ${f.gold.n} (control band ${f.gold.gc}). Fibonacci bar counts between turns: ${f.fbars.fb} of ${f.fbars.nb} (chance ≈ ${Math.round(f.fbars.base * f.fbars.nb)}).${f.fibTime ? ` Now ${f.since} bars since the last turn: a Fibonacci count.` : ""}</div></td></tr>`; }
    h += `<tr><td style="text-align:left"><b>Poetry in motion</b></td><td style="text-align:left">${F.label}${F.dir ? ` (${F.dir > 0 ? "up" : "down"})` : ""}. Efficiency ${fx(F.e8)} / ${fx(F.e24)} / ${fx(F.e72)} (short / mid / long; 1.00 = a straight line), ${F.same ? "all the same direction" : "mixed directions"}, calm ${fx(F.calm)}.<div class="note" style="margin:2px 0 0">How to profit: ${F.score >= 0.3 ? "ride it — enter on small pullbacks, use a wide trailing stop, do not take profit early." : "no flow — take quick profits; wait for a smooth move before you size up."}</div></td></tr>`;
    const Q = R.freq; if (Q) { const cv = typeof getComputedStyle === "function" ? getComputedStyle(document.documentElement) : null, col = k => cv ? cv.getPropertyValue(k).trim() : "", acc = col("--accent") || "#4da3ff", dimc = col("--dim") || "#888", upc = col("--bull") || col("--up") || "#19d38a", dnc = col("--bear") || col("--down") || "#ff4d5e";
      const SW = 280, SH = 70, mx = Math.max(...Q.sp.map(o => o.pw)) || 1, bw = SW / Q.sp.length, keepP = new Set(Q.keep.map(o => o.P));
      const bars = Q.sp.map((o, i) => { const h = Math.max(1, Math.sqrt(o.pw / mx) * (SH - 12)); return `<rect x="${(i * bw).toFixed(1)}" y="${(SH - h).toFixed(1)}" width="${Math.max(1, bw - 0.6).toFixed(1)}" height="${h.toFixed(1)}" fill="${keepP.has(o.P) ? acc : dimc}" fill-opacity="${keepP.has(o.P) ? 0.95 : 0.35}"><title>cycle ${o.P} bars${keepP.has(o.P) ? " — real (beats shuffled copies)" : ""}</title></rect>`; }).join("");
      const L = Math.min(120, Q.x.length), xs = Q.x.slice(-L), wv = t => Q.keep.reduce((s, o) => { const w = 2 * Math.PI / o.P; return s + (2 / Q.n) * (o.a * Math.cos(w * t) + o.b * Math.sin(w * t)); }, 0);
      const all = xs.concat(Array.from({ length: Q.q * 3 }, (_, k) => wv(Q.n - 1 + k + 1))), lo = Math.min(...all, ...xs), hi = Math.max(...all, ...xs), WW = 280, WH = 70, sx = i => i / (L + Q.q * 3) * WW, sy = v => WH - 4 - (v - lo) / ((hi - lo) || 1) * (WH - 8);
      const pp = xs.map((v, i) => (i ? "L" : "M") + sx(i).toFixed(1) + "," + sy(v).toFixed(1)).join(""), wp = Array.from({ length: L }, (_, i) => (i ? "L" : "M") + sx(i).toFixed(1) + "," + sy(wv(Q.n - L + i)).toFixed(1)).join(""), fp = Array.from({ length: Q.q * 3 + 1 }, (_, k) => (k ? "L" : "M") + sx(L - 1 + k).toFixed(1) + "," + sy(wv(Q.n - 1 + k)).toFixed(1)).join("");
      const pic = Q.keep.length ? `<div style="display:flex;flex-wrap:wrap;gap:10px;margin:4px 0"><svg viewBox="0 0 ${SW} ${SH}" width="${SW}" height="${SH}" style="max-width:100%">${bars}</svg><svg viewBox="0 0 ${WW} ${WH}" width="${WW}" height="${WH}" style="max-width:100%"><path d="${pp}" fill="none" stroke="${dimc}" stroke-width="1"/><path d="${wp}" fill="none" stroke="${acc}" stroke-width="1.6"/><path d="${fp}" fill="none" stroke="${Q.proj >= 0 ? upc : dnc}" stroke-width="2" stroke-dasharray="3 3"/></svg></div>` : "";
      const ph = o => o.P * Q.bar / 36e5, hh = v => v >= 24 ? (v / 24).toFixed(1) + " days" : v.toFixed(v < 10 ? 1 : 0) + "h";
      h += `<tr><td style="text-align:left"><b>Frequency</b></td><td style="text-align:left">${Q.keep.length ? `Real waves (stronger than in shuffled copies): ${Q.keep.map(o => `<b>${hh(ph(o))}</b>`).join(", ")}; they carry ${Math.round(Q.snr * 100)}% of the movement (signal vs noise). Projection for the next ${hh(Q.q * Q.bar / 36e5)}: <span class="${cl(Q.proj)}">${Q.proj >= 0 ? "up" : "down"} ${Math.abs(Q.projZ).toFixed(1)}σ</span>${Q.res ? ` · <b>resonance</b>: every wave turns ${Q.res > 0 ? "up" : "down"} together` : ""}.` : "No wave stronger than chance: the spectrum looks like noise now."}
        <div class="note" style="margin:2px 0 0">Walk-forward test on this market's past: the wave projection was right ${Q.hit != null ? Math.round(Q.hit * 100) + "% of " + Q.runs : "–"} times → ${Q.trust > 0 ? "<b>trusted</b> (weight " + Q.trust.toFixed(2) + ")" : "not trusted: no weight in the web"}.${Q.tesla ? ` Tesla 3-6-9: cycles of 6, 9, 12, 18, 24 … hours carry ${Q.tesla.ratio.toFixed(2)}× the power of other lengths, z ${Q.tesla.z.toFixed(1)} vs chance → ${Q.tesla.z >= 2 ? "<b>a real 3-6-9 rhythm here</b>" : "no special 3-6-9 rhythm"}.` : ""}</div>${pic}${Q.keep.length ? `<div class="note" style="margin:0">Left: the spectrum (each bar = one cycle length, blue = real wave). Right: price (grey), the sum of the real waves (blue) and its projection (dashed).</div>` : ""}</td></tr>`; }
    const M = R.music; if (M) { const P = o.px || (v => v.toFixed(2)), pr = x => x ? `${x.c} of ${x.n} (${Math.round(x.r * 100)}%)` : "–", vs = (x, b) => x && b != null ? (x.r > b + 0.08 ? " — <b>more than chance</b>" : x.r < b - 0.08 ? " — less than chance" : " — about chance") : "";
      h += `<tr><td style="text-align:left"><b>Music</b></td><td style="text-align:left">Swing sizes in consonant intervals (1:1, 2:1, 3:2, 4:3, 5:4, 6:5, 1.618): ${pr(M.sz)} vs ${M.szB != null ? Math.round(M.szB * 100) + "%" : "–"} by chance${vs(M.sz, M.szB)}. In time: ${pr(M.tm)} vs ${M.tmB != null ? Math.round(M.tmB * 100) + "%" : "–"}${vs(M.tm, M.tmB)}.${M.fav.length ? ` Most played: ${M.fav.map(x => x[0] + " ×" + x[1]).join(", ")}.` : ""}
        Next note (targets for this ${M.dir > 0 ? "up" : "down"} swing): ${M.tg.map(t => `${t.n} ${P(t.p)}`).join(" · ")}.
        <div class="note" style="margin:2px 0 0">Tension: volatility at the ${M.pct != null ? Math.round(M.pct * 100) : "–"}th percentile${M.tension ? " — <b>a squeeze: tension is building</b>" : ""}${M.burst != null ? `; past squeezes led to moves ${M.burst.toFixed(1)}× the normal size` : ""}. Distance from home (48-bar mean): ${M.zHome != null ? M.zHome.toFixed(1) + "σ" : "–"}${M.homeR != null ? `; after a 2σ stretch, price came back home within 24 bars ${Math.round(M.homeR * 100)}% of ${M.homeN} times vs ${M.homeB != null ? Math.round(M.homeB * 100) + "%" : "–"} by chance` : ""}.
        How to profit: in a squeeze, wait for the first strong bar and go with it (tension resolves with force); far from home in a market that returns home, fade toward the mean; when swings repeat one interval, set targets at the next note.</div></td></tr>`; }
    return h + `</tbody></table><div class="note" style="max-width:none;margin-top:4px"><b>Why rhythm exists — the human side.</b> People see patterns even in pure chance (a coin can land heads 6 times in a row), so every pattern here is tested against shuffled copies of the same moves first. Real rhythm comes from people and their machines: the same open, lunch and close every day; orders resting at levels many traders watch (Fibonacci, round numbers, the last high and low), which makes those levels self-fulfilling when enough people use them; fear and greed that swing from one side to the other and back. Thought works in intervals too: a first reaction, a pause to digest, then a second move — the same "move, rest, move" of a melody. Tension (a quiet squeeze, a stretch far from home) wants resolution, as a dissonant chord wants to resolve. When the market is random, the edge is in the flows and the positioning, not in the shapes.</div>`;
  }
  window.Rhythm = { analyze, html, zigzag };
})();
