/* Signal Web v2 · shared by Cohort Sniper and SOXX Sniper (same file in both repos, same browser storage on github.io).
   Nodes = signals from both sites. Every 30 minutes each asset gets a snapshot of its live signals, its price and its
   volatility regime; the snapshot is scored after 1h, 4h and 24h. Past data from both sites is learned the same way.

   How it learns (and relearns fast):
   - Three horizons (1h, 4h, 24h), each with two online logistic learners: a FAST one (high rate, short memory, adapts
     within hours) and a SLOW one (low rate, long memory). The forecast blends them by which one had the lower recent
     loss, so when the market changes character the fast learner takes over at once, and the slow one keeps what is stable.
   - Per-weight adaptive steps (AdaGrad-style with decay): rare signals still learn quickly, busy ones do not overshoot.
   - Regime features: each signal also gets a "× volatility" copy (signal × how wild the asset is now vs its own normal).
     This learns which signals work in calm markets and which work in wild ones (many flip sign between the two).
   - Link features: the strongest pairs of signals (agreeing often and with an outcome bias) get their own weight
     (signal A × signal B), so the web learns "these two together" and not only each alone.
   - Weights are the influence. Node size = how often a signal was scored, color = hit rate, and the learned weight is in
     the hover text; the links drawn are the learned pair features and the strongest co-firing pairs.
   The hunters (v3 additions, same store):
   - Owl (sees every way, wise): a third, MEDIUM learner; the three are blended by exp(−12 × recent loss) (a hedge over the
     learners), and the result is calibrated: 10 bins of forecast vs what happened, so "60%" means about 60%.
   - Black widow (waits, then strikes): each horizon keeps the hit rate by confidence band. A forecast is a STRIKE only in a
     band that paid (hit ≥ 56% and 2+ points above the average call, over 30+ calls); below that the web says "wait".
   - Daddy long legs (feels faint, far vibrations): "~d" features = how much each signal changed since the last snapshot,
     so a signal that is turning counts, not only its level.
   - Jumping spider (fast pounce): a 30-minute horizon, learned live.
   - Mongoose (fast reflexes, shrugs off venom): if the last 30 calls hit under 42% the market changed: shock mode doubles
     the fast learner's rate and leans on it; very large moves count less (outliers do not poison the weights).
   - Cat (nine lives): after 4 strike losses in a row while the last 20 strikes hit under 50%, the strike bar rises one band;
     after 10 strike wins in a row (or 60%+ over the last 20) it relaxes one band.
   Weather (live nodes on every asset, learned like any signal):
   - wx.jet: the jet stream — the average 4h drift of every asset the web watches; the current that steers them all.
   - wx.storm: a hurricane — volatility above normal AND the asset's signals lined up one way (organized energy).
   - wx.eye: the eye — a sudden calm after wild trading; the far eyewall often comes next, in the storm's direction.
   - wx.twister: a tornado — a sudden, violent 30-minute move in one asset (3σ+ vs its own normal move).
   Cycles (cyc.*, the same clock for every asset; also added to past data by its timestamp, so they learn from history):
   moon phase (new moon +1, full −1), tide (spring tides at new and full moon +1, neap −1), daylight trend (days getting
   longer +), season (Nov–Apr +, May–Oct −: "sell in May"), weekday (Monday, Friday), weekend (crypto only trades), turn of
   the month, quarter end (rebalancing, window dressing), options expiry week (×1.5 in quad-witching months), the day before
   a market holiday, Santa rally and January, Fed days (the 24 h drift before an FOMC decision, the 24 h after), earnings
   season, the US fiscal year-end spending flush (September), Japan's fiscal year end (late March, yen repatriation), and the
   presidential (election) cycle by quarter. Cosmic: the geomagnetic Kp index from NOAA (storms have been linked to lower
   risk appetite). Business, Fed and investment cycles come in through the rates, curve, credit and dollar signals.
   Physics (phy.*, per asset): velocity (4h move vs its normal), acceleration (the move speeding up or slowing), and
   entropy (order in the last 40 moves; low entropy = an ordered path, signed by its direction).
   Edison (trial and error): up to 6 signal pairs run as experiments at a time (70% aimed at the pairs whose product
   already looks strongest, 30% random); after 400 lessons a pair is kept only if its product (A × B)
   beats chance (|z| ≥ 2.5) and it earned its own weight; the rest are dropped and new ones are tried (a dropped pair is not retried for 3,000 lessons).
   The lab (always on, every 2 minutes): 40 new ideas — pairs, triples, conditionals and flips — tested on half of the
   memory of 4,000 lessons, then confirmed on the other half; confirmed ideas join the forecast and are re-checked.
   Discovery: after every scoring round the web tests each signal: its hit rate vs what the base rate of up moves gives a
   signal pointing that way (so an always-'+' calendar signal is not mistaken for skill). Proven signals (z ≥ 3) are
   drawn as stars; signals that are pure noise after 300+ checks (|z| < 0.7) are muted: their weights decay 20× faster.
   Balance and scale: outcomes are graded by the size of the move (not win or lose); each signal's average move per call is
   tracked; every asset has three balance points (4 h, 12 h, 24 h) and a swing phase (bal.*); a balanced tug of war between
   strong signals blocks a strike.
   API: Web.emit(id, asset, value −1..1, label) · Web.ingest(src, [{t,a,x,rh:{1,4,24}|r, reg}], label) ·
        Web.forecast(asset[, h]) · Web.render(el, opts) · Web.addPrice(fn) */
(function () {
  "use strict";
  if (window.Web) return;
  const KEY = "web_v3", HZ = [0.5, 1, 4, 24], BUCKET = 30 * 6e4, H = 36e5;
  const LRF = 0.25, LRM = 0.1, LRS = 0.04, BANDS = [0, 0.03, 0.06, 0.1, 0.15], DEC = 0.995, L2 = 0.0005, MAXP = 24;
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const newL = () => ({ w: {}, g: {}, b: 0 });
  const newM = () => ({ f: newL(), m: newL(), s: newL(), Lf: 0.693, Lm: 0.693, Ls: 0.693, n: 0, calls: 0, right: 0 });
  const hunt = M => { if (!M.m) { M.m = JSON.parse(JSON.stringify(M.s)); M.Lm = M.Ls; } M.cal = M.cal || Array.from({ length: 10 }, () => [0, 0]); M.band = M.band || BANDS.map(() => [0, 0]);
    M.rec = M.rec || []; M.lvl = M.lvl || 0; M.ls = M.ls || 0; M.ws = M.ws || 0; return M; };
  function fresh() { const d = { v: 2, M: {}, A: { N: {}, P: {} }, hist: {}, S: [], vol: {}, pairs: [], n: 0, at: Date.now() }; HZ.forEach(h => d.M[h] = hunt(newM()));
    try { localStorage.removeItem("web_v1"); localStorage.removeItem("web_v2"); } catch (e) { } return d; }   // v1 is replaced: history is learned again into the richer model
  const fix = d => { if (!d || d.v !== 2) return fresh(); HZ.forEach(h => { if (!d.M[h]) d.M[h] = newM(); hunt(d.M[h]); }); d.A = d.A || { N: {}, P: {} }; d.hist = d.hist || {}; d.S = d.S || []; d.vol = d.vol || {}; d.pairs = d.pairs || []; return d; };
  let D = fix(lsG(KEY, null));
  setTimeout(() => { try { MUTE = new Set(D.mute || []); } catch (e) { } }, 0);
  const LIVE = {}, PRICE = [], LABEL = lsG("web_labels", {}), PX = {};   // PX: recent prices per asset (for the live volatility regime)
  const SEMIS = { SOXL: 1, SOXX: 1, SOXS: -1 };
  const norm = a => String(a || "").toUpperCase().replace(/^[A-Z]+:/, "");
  const sig = x => 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, x))));
  const c1 = v => Math.max(-1, Math.min(1, v));
  const save = () => { D.at = Date.now(); if (D.S.length > 5000) D.S = D.S.slice(-5000); lsS(KEY, D); };
  const reload = () => { const f = lsG(KEY, null); if (f && f.v === 2 && f.at >= D.at) D = fix(f); };

  function emit(id, asset, v, label) {
    if (!isFinite(v) || !id) return; v = Math.round(c1(v) * 100) / 100; if (!v) return;
    const add = (a, val) => { (LIVE[a] = LIVE[a] || {})[id] = { v: val, t: Date.now() }; };
    const a = norm(asset); add(a, v); if (SEMIS[a]) add("SEMIS", v * SEMIS[a]);
    if (label && LABEL[id] !== label) { LABEL[id] = label; lsS("web_labels", LABEL); }
  }
  const price = a => { for (const f of PRICE) { try { const p = f(a); if (p > 0) return p; } catch (e) { } } if (a === "SEMIS") return price("SOXX") || price("SOXL"); return null; };
  const feats = a => { const L = LIVE[a] || {}, now = Date.now(), x = {}; for (const [k, o] of Object.entries(L)) if (now - o.t < 2 * BUCKET) x[k] = o.v; return x; };
  // volatility regime of an asset: recent 30-minute moves vs its own long-run average (−1 calm … +1 wild)
  function regime(a, ro) { const P = PX[a]; if (!P || P.length < 8) return 0;
    const r = P.slice(-16).map((p, i, A) => i ? Math.abs(Math.log(p / A[i - 1])) : NaN).filter(isFinite), v = r.reduce((s, x) => s + x, 0) / r.length;
    const e = ro ? (D.vol[a] || v) : (D.vol[a] = D.vol[a] ? D.vol[a] * 0.98 + v * 0.02 : v); return e > 0 ? c1(v / e - 1) : 0; }
  // full feature vector: signals, × regime copies, chosen link pairs
  function expand(x, reg) {
    const z = {}; for (const k in x) { z[k] = x[k]; if (reg && !k.endsWith("~d")) z[k + "~vol"] = Math.round(x[k] * reg * 100) / 100; }
    for (const p of D.pairs) { const v = linkVal(p, x); if (v) z[p] = Math.round(v * 100) / 100; }
    return z; }
  // a link's value: "a&b(&c)" = product; "a|b+" = a only while b is up; "a|b-" = a only while b is down; "-a" = a flipped
  function linkVal(k, x) { if (k.includes("|")) { const [a, c] = k.split("|"), b = c.slice(0, -1), sg = c.slice(-1) === "+" ? 1 : -1; return x[a] && x[b] && Math.sign(x[b]) === sg ? x[a] : 0; }
    if (k.includes("&")) { let v = 1; for (const q of k.split("&")) { if (!x[q]) return 0; v *= x[q]; } return v; } return 0; }
  const dot = (L, z) => { let s = L.b; for (const k in z) s += (L.w[k] || 0) * z[k]; return s; };
  // owl: hedge over the three learners, then calibration
  function calib(M, p) { const C = M.cal, i = Math.min(9, Math.floor(p * 10)), c = C[i]; if (!c || c[0] < 20) return p;
    const f = c[1] / c[0], w = Math.min(1, c[0] / 100); return Math.max(0.02, Math.min(0.98, (1 - w) * p + w * f)); }
  function prob(h, z) { const M = D.M[h], pf = sig(dot(M.f, z)), pm = sig(dot(M.m, z)), ps = sig(dot(M.s, z));
    const sh = M.shock ? 0.5 : 0, ef = Math.exp(-12 * (M.Lf - sh)), em = Math.exp(-12 * M.Lm), es = Math.exp(-12 * M.Ls), t = ef + em + es;
    const raw = (ef * pf + em * pm + es * ps) / t; return { p: calib(M, raw), raw, pf, pm, ps, a: ef / t, am: em / t }; }
  const bandOf = q => { const d = Math.abs(q - 0.5); let i = 0; BANDS.forEach((b, j) => { if (d >= b) i = j; }); return i; };
  // black widow + cat: is this forecast a strike?
  const bar = M => Math.max(0.56, (M.calls ? M.right / M.calls : 0.5) + 0.02);   // a strike must beat this horizon's average call
  function strike(M, q) { const i = bandOf(q), b = M.band[i]; const hit = b[0] ? b[1] / b[0] : null; return { i, hit, n: b[0], on: i >= M.lvl && i > 0 && b[0] >= 30 && hit >= bar(M) }; }
  let MUTE = new Set();
  function step(L, z, y, lr) { const p = sig(dot(L, z)), g = y - p;
    L.b += lr * 0.3 * g;
    for (const k in z) { const gk = g * z[k], dec = MUTE.has(k.split("~")[0]) ? L2 * 20 : L2; L.g[k] = (L.g[k] || 0) * DEC + gk * gk; L.w[k] = (L.w[k] || 0) * (1 - dec) + lr * gk / Math.sqrt(1e-3 + L.g[k]); }
    return p; }
  const ll = (p, y) => -(y * Math.log(Math.max(1e-6, p)) + (1 - y) * Math.log(Math.max(1e-6, 1 - p)));   // works for graded targets too
  // one lesson for one horizon
  function learnH(h, x, reg, r, p0) {
    if (!isFinite(r) || Math.abs(r) < 0.0005 * Math.sqrt(h)) return;
    const z = expand(x, reg), y = r > 0 ? 1 : 0, M = hunt(D.M[h]), P0 = prob(h, z), q = p0 != null ? p0 : P0.p, ok = (q > 0.5) === (y === 1);
    M.calls++; if (ok) M.right++;
    // black widow / cat: record by confidence band; strike losses raise the bar, strike wins lower it
    const sk = strike(M, q), bd = M.band[sk.i]; bd[0]++; if (ok) bd[1]++;
    if (sk.on) { M.sr = M.sr || []; M.sr.push(ok ? 1 : 0); if (M.sr.length > 20) M.sr.shift(); const h20 = M.sr.length >= 10 ? M.sr.reduce((a, v) => a + v, 0) / M.sr.length : 0.55;
      if (ok) { M.ls = 0; if ((++M.ws >= 10 || (h20 >= 0.6 && M.sr.length >= 20)) && M.lvl > 0) { M.lvl--; M.ws = 0; M.sr = []; } }
      else { M.ws = 0; if (++M.ls >= 4 && h20 < 0.5) { M.lvl = Math.min(BANDS.length - 1, M.lvl + 1); M.ls = 0; M.sr = []; } } }
    // owl: calibration bins on the raw blend
    const cb = M.cal[Math.min(9, Math.floor(P0.raw * 10))]; cb[0] = cb[0] * 0.998 + 1; cb[1] = cb[1] * 0.998 + y;
    // mongoose: shock when the last 30 calls hit under 42%; huge moves count less
    M.rec.push(ok ? 1 : 0); if (M.rec.length > 30) M.rec.shift(); M.shock = M.rec.length >= 30 && M.rec.reduce((a, v) => a + v, 0) / M.rec.length < 0.42 ? 1 : 0;
    const big = Math.abs(r) / (0.01 * Math.sqrt(h)), dmp = big > 4 ? 4 / big : 1;
    // outcomes on a scale: the target is graded by the size of the move vs this horizon's normal move (a tiny wiggle ≈ 0.5,
    // a normal move ≈ 0.82 / 0.18, a big move ≈ 1 / 0): results are not just win or lose
    M.ar = M.ar ? M.ar * 0.995 + Math.abs(r) * 0.005 : Math.abs(r); const ys = sig(r / (M.ar || 1e-4) * 1.5);
    const pf = step(M.f, z, ys, LRF * (M.shock ? 2 : 1) * dmp), pm = step(M.m, z, ys, LRM * dmp), ps = step(M.s, z, ys, LRS * dmp);
    M.Lf = M.Lf * 0.97 + ll(pf, ys) * 0.03; M.Lm = M.Lm * 0.985 + ll(pm, ys) * 0.015; M.Ls = M.Ls * 0.995 + ll(ps, ys) * 0.005; M.n++; D.n++;
    if (h === 4) { const k = Object.keys(x).filter(q => x[q] && !q.endsWith("~d")), A = D.A;
      const LB = D.lab = D.lab || []; const xs = {}; k.forEach(q => { xs[q] = Math.round(x[q] * 10) / 10 || (x[q] > 0 ? 0.1 : -0.1); }); LB.push([xs, r > 0 ? 1 : 0]); if (LB.length > 4000) LB.splice(0, LB.length - 4000);
      A.U = A.U || [0, 0]; A.U[0]++; if (r > 0) A.U[1]++;   // the base rate of up moves
      for (const q of k) { const o = A.N[q] = A.N[q] || [0, 0, 0, 0, 0, 0]; o[0]++; if (Math.sign(x[q]) === Math.sign(r)) o[1]++; o[2] += Math.sign(x[q]) * c1(r * 5) / 5; if (x[q] > 0) o[5] = (o[5] || 0) + 1; o[6] = (o[6] || 0) + Math.sign(x[q]) * Math.max(-0.2, Math.min(0.2, r));   // signed move per call (a scale, not win/lose)
        if (reg > 0.2) { o[3]++; if (Math.sign(x[q]) === Math.sign(r)) o[4]++; } }      // record in wild markets
      for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = k[i] < k[j] ? k[i] : k[j], b = k[i] < k[j] ? k[j] : k[i], e = A.P[a + "&" + b] = A.P[a + "&" + b] || [0, 0, 0];
        e[0]++; if (Math.sign(x[a]) === Math.sign(x[b])) { e[1]++; if (Math.sign(x[a]) === Math.sign(r)) e[2]++; }
        if (Math.sign(x[a] * x[b]) === Math.sign(r)) e[3] = (e[3] || 0) + 1; if (x[a] * x[b] > 0) e[4] = (e[4] || 0) + 1; } }   // the product A × B vs the outcome (for Edison)
  }
  // evidence that a signal beats chance: its hit rate vs what the base rate of up moves gives a signal that points this way
  // (a signal that is always "+" — weekend, season — is right exactly as often as prices rise; that is not skill)
  function zNode(o) { const n = o[0]; if (!n) return 0; const U = D.A.U && D.A.U[0] >= 100 ? D.A.U[1] / D.A.U[0] : 0.5, np = o[5] != null ? o[5] : n / 2;
    const e = np * U + (n - np) * (1 - U), v = n * U * (1 - U) || n / 4; return (o[1] - e) / Math.sqrt(v); }
  /* ---------- the lab: always on ----------
     Every 2 minutes it invents 40 new ideas from the signals in its memory of the last 4,000 scored 4-hour lessons —
     pairs (A×B), triples (A×B×C), conditionals (A only while B is up / down) and flipped single signals — including
     ideas that make no obvious sense. Each idea is tested on one half of the memory; only if it beats chance there
     (|z| ≥ 2.5) is it tested on the other half; it is confirmed only if it holds there too (|z| ≥ 2, same direction) AND it beats its best single part on the
     same lessons (it must add something, not restate a known signal).
     Confirmed ideas join the forecast as link features (up to 20) and are re-checked every run; one that stops working
     is dropped. Many ideas are tested, so the bar is two independent passes, not one. */
  function labTest(v, LB, half) { let n = 0, hit = 0, np = 0, up = 0; for (let i = half; i < LB.length; i += 2) { const [x, y] = LB[i], val = v(x); if (!val) continue; n++; if (y) up++; if (val > 0) np++; if ((val > 0) === (y === 1)) hit++; }
    if (n < 40) return null; const U = D.A.U && D.A.U[0] >= 100 ? D.A.U[1] / D.A.U[0] : 0.5, e = np * U + (n - np) * (1 - U), vr = n * U * (1 - U) || n / 4; return { n, z: (hit - e) / Math.sqrt(vr), hit: hit / n }; }
  // added value: the idea's edge (z per √n, on the lessons where it is active) must beat each single part's edge (on
  // the lessons where that part is active)
  // by 0.04 (≈ 2 points of hit rate) in both halves
  function adds(k, v, LB) { if (k[0] === "-") return true; const parts = k.includes("|") ? [k.split("|")[0], k.split("|")[1].slice(0, -1)] : k.split("&");
    for (const h of [0, 1]) { const ri = labTest(v, LB, h); if (!ri) return false; const e = q => { const r = labTest(q, LB, h); return r ? Math.abs(r.z) / Math.sqrt(r.n) : 0; };   // each over its own active lessons
      const ei = Math.abs(ri.z) / Math.sqrt(ri.n), best = Math.max(...parts.map(p => e(x => x[p] || 0))); if (ei < best + Math.max(0.04, 2 / Math.sqrt(ri.n))) return false; }   // a small subset must gain more
    return true; }
  function labRun() {
    const LB = D.lab || []; if (LB.length < 300) return; const S = D.labS = D.labS || { tested: 0, ok: [], seen: {} };
    const F = {}; LB.slice(-1500).forEach(([x]) => { for (const k in x) F[k] = (F[k] || 0) + 1; }); const keys = Object.keys(F).filter(k => F[k] >= 60); if (keys.length < 3) return;
    const pick = () => keys[Math.floor(Math.random() * keys.length)], fn = k => x => linkVal(k, x) || (k[0] === "-" ? -(x[k.slice(1)] || 0) : 0);
    for (let t = 0; t < 40; t++) { const r = Math.random(), a = pick(), b = pick(), c = pick(); if (a === b) continue; let k;
      if (r < 0.35) k = [a, b].sort().join("&"); else if (r < 0.55 && c !== a && c !== b) k = [a, b, c].sort().join("&"); else if (r < 0.9) k = a + "|" + b + (Math.random() < 0.5 ? "+" : "-"); else k = "-" + a;
      if (S.seen[k] && D.n - S.seen[k] < 2000) continue; S.seen[k] = D.n; S.tested++;
      if (S.ok.some(o => o.k === k)) continue; const z1 = labTest(fn(k), LB, 0); if (!z1 || Math.abs(z1.z) < 2.5) continue; const z2 = labTest(fn(k), LB, 1); if (!z2 || Math.abs(z2.z) < 2 || Math.sign(z2.z) !== Math.sign(z1.z)) continue;
      if (!adds(k, fn(k), LB)) continue;   // it must add something beyond its best single part (not a known signal in disguise)
      if (k[0] === "-") continue;   // a flipped single signal is already learned by its own (negative) weight: keep it as a finding only
      S.ok.push({ k, z1: z1.z, z2: z2.z, hit: (z1.hit + z2.hit) / 2, n: z1.n + z2.n, at: Date.now() }); }
    // re-check what was confirmed; keep the 20 strongest
    S.ok = S.ok.map(o => { const a = labTest(fn(o.k), LB, 0), b = labTest(fn(o.k), LB, 1); return a && b ? { ...o, z1: a.z, z2: b.z, hit: (a.hit + b.hit) / 2, n: a.n + b.n } : o; })
      .filter(o => Math.abs(o.z1) >= 2 && Math.abs(o.z2) >= 1.5 && Math.sign(o.z1) === Math.sign(o.z2) && adds(o.k, fn(o.k), LB)).sort((x, y) => Math.abs(y.z1 + y.z2) - Math.abs(x.z1 + x.z2)).slice(0, 20);
    const sk = Object.keys(S.seen); if (sk.length > 5000) sk.sort((a, b) => S.seen[a] - S.seen[b]).slice(0, sk.length - 5000).forEach(k => delete S.seen[k]);
    D.pairs = [...new Set(D.pairs.concat(S.ok.map(o => o.k)))]; save();
  }
  // choose the link features: pairs that agree often enough and whose agreement has an outcome bias
  function choosePairs() {
    const calOnly = k => k.split("&").some(q => /^cyc\./.test(q));   // a calendar term is constant for weeks: such a pair restates the other signal (only the lab, with its added-value test, may link calendar signals)
    const P = Object.entries(D.A.P).filter(([k, e]) => e[1] >= 150 && !calOnly(k)).map(([k, e]) => ({ k, s: Math.abs(e[2] / e[1] - 0.5) * Math.sqrt(e[1]) })).sort((a, b) => b.s - a.s).slice(0, MAXP);
    const base = P.filter(p => p.s >= 1.5).map(p => p.k);
    // Edison: keep up to 6 experiments running — pairs that fire together but have no evidence yet. After 400 lessons an
    // experiment that earned a real weight (|w| ≥ 0.05) is kept for good; the rest are dropped and new ones are tried.
    const E0 = D.ed = D.ed || { exp: [], kept: [], tried: 0, keptN: 0, dropped: {} }, W4 = D.M[4], al = sig((W4.Ls - W4.Lf) * 12), wOf = k => al * (W4.f.w[k] || 0) + (1 - al) * (W4.s.w[k] || 0);
    const zP = k => { const e = D.A.P[k]; return e && e[3] != null ? zNode([e[0], e[3], 0, 0, 0, e[4] || 0]) : 0; };   // the product's hit rate vs chance
    E0.exp = E0.exp.filter(x => { if (D.n - x.at < 250) return true; E0.tried++; if (Math.abs(wOf(x.k)) >= 0.05 && Math.abs(zP(x.k)) >= 2.5) { if (!E0.kept.includes(x.k)) { E0.kept.push(x.k); E0.keptN++; } } else E0.dropped[x.k] = D.n; return false; });
    E0.kept = E0.kept.filter(k => Math.abs(wOf(k)) >= 0.02 && !calOnly(k)).slice(-24); E0.exp = E0.exp.filter(x => !calOnly(x.k));   // a kept link that fades away is let go
    const busy = new Set(base.concat(E0.kept, E0.exp.map(x => x.k)));
    if (E0.exp.length < 12) { const cand = Object.entries(D.A.P).filter(([k, e]) => e[0] >= 60 && !busy.has(k) && !calOnly(k) && !(E0.dropped[k] && D.n - E0.dropped[k] < 3000)).map(([k]) => k);
      // seek: most new experiments go to the pairs whose product already looks strongest; some stay random (exploration)
      const ranked = cand.map(k => ({ k, z: Math.abs(zP(k)) })).sort((a, b) => b.z - a.z), need = 12 - E0.exp.length, nBest = Math.ceil(need * 0.7), pick = ranked.slice(0, nBest).map(o => o.k), rest = ranked.slice(nBest).map(o => o.k);
      for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
      pick.concat(rest.slice(0, need - pick.length)).forEach(k => E0.exp.push({ k, at: D.n })); }
    const dk = Object.keys(E0.dropped); if (dk.length > 400) dk.sort((a, b) => E0.dropped[a] - E0.dropped[b]).slice(0, dk.length - 400).forEach(k => delete E0.dropped[k]);
    D.pairs = [...new Set(base.concat(E0.kept, E0.exp.map(x => x.k), ((D.labS && D.labS.ok) || []).map(o => o.k)))];
    // discovery: test every signal; proven = strong evidence either way, muted = noise after many checks
    const pr = [], mu = []; for (const [k, o] of Object.entries(D.A.N)) { if (o[0] < 50) continue; const z = zNode(o); if (Math.abs(z) >= 3) pr.push(k); else if (o[0] >= 300 && Math.abs(z) < 0.7) mu.push(k); }   // z ≥ 3: many signals are tested at once
    D.proven = pr; D.mute = mu; MUTE = new Set(mu);
  }

  // the same derived inputs for learning and for live forecasts: weather (jet stream, hurricane, eye, tornado) and
  // daddy-long-legs changes since this asset's last snapshot
  const WXL = { "wx.jet": "Weather · jet stream (all assets' 4h drift)", "wx.storm": "Weather · hurricane (wild and organized)", "wx.eye": "Weather · eye of the storm (calm inside a storm)", "wx.twister": "Weather · tornado (sudden violent move)" };
  function jetNow() { const dr = Object.keys(PX).map(a => { const P = PX[a]; return P && P.length >= 9 ? Math.log(P[P.length - 1] / P[P.length - 9]) : null; }).filter(v => v != null && isFinite(v));
    return dr.length >= 3 ? c1(dr.reduce((s, v) => s + v, 0) / dr.length / 0.01) : 0; }
  // ---------- cycles ----------
  const DAY = 864e5, SYN = 29.530588853, NEW0 = Date.UTC(2000, 0, 6, 18, 14);
  const FOMC = ["2026-01-28", "2026-03-18", "2026-04-29", "2026-06-17", "2026-07-29", "2026-09-16", "2026-10-28", "2026-12-09", "2027-01-27", "2027-03-17", "2027-04-28", "2027-06-09", "2027-07-28", "2027-09-15", "2027-10-27", "2027-12-08"]
    .map(d => Date.parse(d + "T14:00:00" + (/-(0[3-9]|10)-/.test(d) ? "-04:00" : "-05:00")));   // 2:00 pm ET (daylight time March–October)
  const HOL = new Set(["2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25", "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
    "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05", "2027-09-06", "2027-11-25", "2027-12-24"]);
  const CYL = { "cyc.moon": "Cycles · moon phase (new moon +, full moon −)", "cyc.tide": "Cycles · tides (spring tide +, neap −)", "cyc.daylight": "Cycles · daylight trend (days longer +)",
    "cyc.season": "Cycles · season (Nov–Apr +, May–Oct −)", "cyc.monday": "Cycles · Monday", "cyc.friday": "Cycles · Friday", "cyc.weekend": "Cycles · weekend (stock markets shut)",
    "cyc.tom": "Cycles · turn of the month (fresh money)", "cyc.qend": "Cycles · quarter end (rebalancing, window dressing)", "cyc.opex": "Cycles · options expiry week",
    "cyc.preholiday": "Cycles · day before a market holiday", "cyc.santa": "Cycles · Santa rally and early January", "cyc.fomc-pre": "Cycles · 24 h before a Fed decision",
    "cyc.fomc-post": "Cycles · 24 h after a Fed decision", "cyc.earnings": "Cycles · earnings season", "cyc.fyflush": "Cycles · US fiscal year-end spending (September)",
    "cyc.jpfy": "Cycles · Japan fiscal year end (yen repatriation)", "cyc.election": "Cycles · presidential cycle (by quarter)", "cyc.geomag": "Cosmic · geomagnetic storm (NOAA Kp)",
    "phy.velocity": "Physics · velocity (4 h move vs normal)", "phy.accel": "Physics · acceleration (move speeding up +)", "phy.entropy": "Physics · low entropy (ordered path), signed" };
  const etp = (() => { let f = null; try { f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", hourCycle: "h23", weekday: "short" }); } catch (e) { }
    return t => { if (!f) { const d = new Date(t - 5 * 36e5); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours(), w: d.getUTCDay(), ds: d.toISOString().slice(0, 10) }; }
      const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value])), w = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
      return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, w, ds: `${p.year}-${p.month}-${p.day}` }; }; })();
  const ELEC = { 0: [0.2, 0.2, 0.2, 0], 1: [0, 0.2, 0, 0.3], 2: [-0.2, -0.5, -0.5, 1], 3: [1, 0.7, 0, 0.3] };   // S&P average by year of the 4-year cycle and quarter (scaled)
  let KP = null, kpT = 0;
  async function kpLoad() { if (Date.now() - kpT < 30 * 6e4) return; kpT = Date.now();
    try { const r = await fetch("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json"); if (r.ok) { const j = await r.json(); const v = j.slice(-60).map(x => +x.estimated_kp).filter(isFinite); if (v.length) KP = { kp: Math.max(...v), t: Date.now() }; } } catch (e) { } }
  function cycles(t) {
    const x = {}, e = etp(t), dt = new Date(t), doy = Math.floor((t - Date.UTC(dt.getUTCFullYear(), 0, 1)) / DAY);
    const ph = (((t - NEW0) / DAY) % SYN + SYN) % SYN / SYN, cm = Math.cos(2 * Math.PI * ph);
    x["cyc.moon"] = Math.round(cm * 100) / 100; x["cyc.tide"] = Math.round((2 * Math.abs(cm) - 1) * 100) / 100;
    x["cyc.daylight"] = Math.round(Math.cos(2 * Math.PI * (doy - 80) / 365.25) * 100) / 100;
    x["cyc.season"] = e.m >= 11 || e.m <= 4 ? 0.5 : -0.5;
    if (e.w === 1) x["cyc.monday"] = 1; if (e.w === 5) x["cyc.friday"] = 1; if (e.w === 0 || e.w === 6) x["cyc.weekend"] = 1;
    const dim = new Date(Date.UTC(e.y, e.m, 0)).getUTCDate(); if (e.d >= dim - 1 || e.d <= 3) x["cyc.tom"] = 1;
    if ([3, 6, 9, 12].includes(e.m) && e.d >= dim - 6) x["cyc.qend"] = 1;
    { const f1 = new Date(Date.UTC(e.y, e.m - 1, 1)).getUTCDay(), third = 1 + ((5 - f1 + 7) % 7) + 14; if (e.d >= third - 4 && e.d <= third) x["cyc.opex"] = [3, 6, 9, 12].includes(e.m) ? 1 : 0.67; }
    { const nx = new Date(Date.UTC(e.y, e.m - 1, e.d + 1)).toISOString().slice(0, 10), nx3 = e.w === 5 ? new Date(Date.UTC(e.y, e.m - 1, e.d + 3)).toISOString().slice(0, 10) : null; if (HOL.has(nx) || (nx3 && HOL.has(nx3))) x["cyc.preholiday"] = 1; }
    if ((e.m === 12 && e.d >= 24) || (e.m === 1 && e.d <= 5)) x["cyc.santa"] = 1;
    for (const f of FOMC) { if (t >= f - DAY && t < f) x["cyc.fomc-pre"] = 1; if (t >= f && t < f + DAY) x["cyc.fomc-post"] = 1; }
    if ([1, 4, 7, 10].includes(e.m) && e.d >= 12 || [2, 5, 8, 11].includes(e.m) && e.d <= 15) x["cyc.earnings"] = 1;
    if (e.m === 9) x["cyc.fyflush"] = 1; if (e.m === 3 && e.d >= 15) x["cyc.jpfy"] = 1;
    x["cyc.election"] = ELEC[e.y % 4][Math.floor((e.m - 1) / 3)] || 0; if (!x["cyc.election"]) delete x["cyc.election"];
    if (KP && Math.abs(t - KP.t) < 3 * 36e5 && KP.kp >= 4) x["cyc.geomag"] = -Math.round(c1((KP.kp - 3) / 4) * 100) / 100;
    return x;
  }
  // ---------- physics: velocity, acceleration and entropy of the asset's own 30-minute path ----------
  function physics(a) {
    const P = PX[a], x = {}; if (!P || P.length < 12) return x; const r = []; for (let i = 1; i < P.length; i++) r.push(Math.log(P[i] / P[i - 1]));
    const sd = Math.sqrt(r.reduce((s, v) => s + v * v, 0) / r.length) || 1e-9, s8 = r.slice(-8).reduce((s, v) => s + v, 0), a4 = r.slice(-4).reduce((s, v) => s + v, 0), b4 = r.slice(-8, -4).reduce((s, v) => s + v, 0);
    const v = c1(s8 / (sd * Math.sqrt(8)) / 2), ac = c1((a4 - b4) / (sd * 2) / 2); if (Math.abs(v) >= 0.2) x["phy.velocity"] = Math.round(v * 100) / 100; if (Math.abs(ac) >= 0.2) x["phy.accel"] = Math.round(ac * 100) / 100;
    if (r.length >= 40) { const q = r.slice(-40), c = {}; let n = 0; for (let i = 2; i < q.length; i++) { const k = [q[i - 2], q[i - 1], q[i]].map((v, j) => [v, j]).sort((m, o) => m[0] - o[0]).map(m => m[1]).join(""); c[k] = (c[k] || 0) + 1; n++; }
      let h = 0; Object.values(c).forEach(k => { const pp = k / n; h -= pp * Math.log(pp); }); const ord = 1 - h / Math.log(6); if (ord >= 0.04 && s8) x["phy.entropy"] = Math.round(c1(Math.sign(s8) * ord * 8) * 100) / 100; }
    return x;
  }
  /* ---------- balance: equilibrium on several scales ----------
     Price swings around balance points like a weight on springs. Three springs per asset: its average over the last 8,
     24 and 48 half-hours (4 h, 12 h, 24 h). For each: the stretch (distance from the balance point in σ). The web learns
     whether each spring pulls price back (a negative weight = mean reversion) or the move keeps going (positive = momentum);
     the scales can disagree (stretched up on 4 h, still below balance on 24 h) and are learned one by one.
     The swing: velocity (last 3 moves) against the 12 h stretch gives the phase — at an extreme and turning back
     (bal.turn), or passing through balance with speed (bal.through: the swing usually overshoots the other way).
     Tug of war (forecast): when many strong signals pull hard in opposite directions, the forces are in balance —
     tension, not an edge: the web says wait. */
  const BALL = { "bal.s8": "Balance · stretch from the 4 h balance point", "bal.s24": "Balance · stretch from the 12 h balance point", "bal.s48": "Balance · stretch from the 24 h balance point",
    "bal.turn": "Balance · at the end of a swing, turning back", "bal.through": "Balance · swinging through balance with speed" };
  function balance(a) {
    const P = PX[a], x = {}; if (!P || P.length < 14) return x; const r = []; for (let i = 1; i < P.length; i++) r.push(Math.log(P[i] / P[i - 1]));
    const sd = Math.sqrt(r.reduce((s, v) => s + v * v, 0) / r.length) || 1e-9, lp = P.map(p => Math.log(p)), now = lp[lp.length - 1];
    const st = k => { if (lp.length < Math.min(k, 12)) return null; const w = lp.slice(-Math.min(k, lp.length)), m = w.reduce((s, v) => s + v, 0) / w.length; return (now - m) / (sd * Math.sqrt(Math.min(k, lp.length) / 3)); };
    [8, 24, 48].forEach(k => { const z = st(k); if (z != null && Math.abs(z) >= 0.5) x["bal.s" + k] = Math.round(c1(z / 2.5) * 100) / 100; });
    const v = r.slice(-3).reduce((s, q) => s + q, 0) / (sd * Math.sqrt(3)), d = st(24);
    if (d != null) { if (Math.abs(d) >= 1.5 && Math.sign(v) === -Math.sign(d) && Math.abs(v) >= 0.5) x["bal.turn"] = Math.round(c1(-Math.sign(d) * Math.min(1, Math.abs(d) / 3) * Math.min(1, Math.abs(v))) * 100) / 100;
      if (Math.abs(d) < 0.4 && Math.abs(v) >= 1.2) x["bal.through"] = Math.round(c1(Math.sign(v) * (Math.abs(v) - 0.8) / 2) * 100) / 100; }
    return x;
  }
  // tug of war: strong signals pulling both ways (high gross pull, small net)
  function tug(x) { let g = 0, n = 0, k = 0; for (const q in x) { if (/^(cyc|wx|phy|bal)\./.test(q) || q.includes("~")) continue; g += Math.abs(x[q]); n += x[q]; k++; } return { gross: g, net: n, k, t: k >= 4 && g >= 2 ? 1 - Math.abs(n) / g : 0 }; }
  function derive(a, x, bk) {
    if (!Object.keys(x).length) return x; x = Object.assign({}, x); const jet = jetNow();
    for (const L0 of [WXL, CYL, BALL]) for (const k in L0) if (LABEL[k] !== L0[k]) { LABEL[k] = L0[k]; lsS("web_labels", LABEL); }
    const P = PX[a], rg = regime(a, true), sv = Object.values(x), cons = sv.length >= 3 ? sv.reduce((s, v) => s + v, 0) / sv.length : 0;
    if (Math.abs(jet) >= 0.15) x["wx.jet"] = Math.round(jet * 100) / 100;
    if (rg >= 0.3 && Math.abs(cons) >= 0.25) x["wx.storm"] = Math.round(c1(Math.sign(cons) * rg * Math.abs(cons) * 3) * 100) / 100;
    if (P && P.length >= 12) { const m = P.slice(-11).map((p, i, A) => i ? Math.log(p / A[i - 1]) : null).slice(1), ab = m.map(Math.abs), prior = ab.slice(0, 8).reduce((s, v) => s + v, 0) / 8, recent = (ab[8] + ab[9]) / 2, avg = D.vol[a] || prior;
      if (avg > 0 && prior > 1.8 * avg && recent < 0.5 * prior) { const dir = Math.sign(m.slice(0, 8).reduce((s, v) => s + v, 0)); if (dir) x["wx.eye"] = Math.round(dir * c1(1 - recent / prior) * 100) / 100; }
      const z = avg > 0 ? m[9] / avg : 0; if (Math.abs(z) >= 3) x["wx.twister"] = Math.round(Math.sign(z) * c1((Math.abs(z) - 2) / 3) * 100) / 100; }
    const b = bk == null ? Math.floor(Date.now() / BUCKET) : bk, pv = D.S.find(s => s.a === a && s.bk === b - 1);
    Object.assign(x, cycles(Date.now()), physics(a), balance(a));
    if (pv) for (const k of Object.keys(x)) { if (k.endsWith("~d") || /^(wx|cyc|phy|bal)\./.test(k)) continue; const d = Math.round(c1(x[k] - (pv.x[k] || 0)) * 100) / 100; if (Math.abs(d) >= 0.2) x[k + "~d"] = d; }
    return x;
  }
  function tick() {
    reload(); kpLoad();
    const now = Date.now(), bk = Math.floor(now / BUCKET);
    for (const a of Object.keys(LIVE)) { const px = price(a); if (px) { const P = PX[a] = PX[a] || []; if (!P.length || now - (P.lastT || 0) >= BUCKET - 6e4) { P.push(px); P.lastT = now; if (P.length > 60) P.shift(); } } }
    for (const a of Object.keys(LIVE)) {
      const x = derive(a, feats(a), bk); if (!Object.keys(x).length) continue;
      const ex = D.S.find(s => s.a === a && s.bk === bk);
      if (ex) { if (!ex.done && now - ex.t < 6e4 * 5) Object.assign(ex.x, x); continue; }
      const px = price(a); if (!px) continue; const reg = regime(a), z = expand(x, reg);
      D.S.push({ a, bk, t: now, px, x, reg, p: Object.fromEntries(HZ.map(h => [h, Math.round(prob(h, z).p * 1000) / 1000])), r: {} });
    }
    let n = 0;
    for (const s of D.S) {
      if (s.done) continue; let open = 0;
      for (const h of HZ) { if (s.r[h] != null) continue; const age = now - s.t;
        if (age < h * H) { open++; continue; } if (age > h * H + 3 * H) { s.r[h] = NaN; continue; }
        const px = price(s.a); if (!px) { open++; continue; } s.r[h] = px / s.px - 1; learnH(h, s.x, s.reg || 0, s.r[h], s.p[h]); n++; }
      if (!open) s.done = 1;
    }
    if (n) choosePairs();
    D.S = D.S.filter(s => !s.done || now - s.t < 30 * H);
    save();
  }
  function ingest(src, items, label) {
    reload();
    const last = D.hist[src] ? D.hist[src].t : 0, L = items.filter(it => it.t > last && Object.keys(it.x || {}).length).sort((a, b) => a.t - b.t);
    if (!L.length) return 0;
    // replay in time order, like live: predict each item when it happens, learn it only once its result would be known
    // (otherwise many markets that share the same future move would leak that move into each other's forecasts)
    const Q = Object.fromEntries(HZ.map(h => [h, []])), K = Object.fromEntries(HZ.map(h => [h, 0])); let nI = 0;
    L.forEach(it => {
      for (const k in it.x) { it.x[k] = Math.round(c1(it.x[k]) * 100) / 100; if (!it.x[k]) delete it.x[k]; }
      Object.assign(it.x, cycles(it.t)); if (!LABEL["cyc.moon"]) { for (const k in CYL) LABEL[k] = CYL[k]; lsS("web_labels", LABEL); }   // the calendar, moon and season are known for any past moment: learn them from history too
      if (++nI % 500 === 0) choosePairs();   // discovery and Edison's experiments run during the replay too
      for (const h of HZ) { const P = Q[h]; while (K[h] < P.length && P[K[h]].ready <= it.t) { const q = P[K[h]++]; learnH(h, q.x, q.reg, q.r, q.p); } if (K[h] > 2000) { P.splice(0, K[h]); K[h] = 0; } }
      const R = it.rh || { 4: it.r }, z = expand(it.x, it.reg || 0);
      for (const h of HZ) if (R[h] != null && isFinite(R[h])) Q[h].push({ ready: it.t + h * H, x: it.x, reg: it.reg || 0, r: R[h], p: prob(h, z).p }); });
    for (const h of HZ) Q[h].slice(K[h]).forEach(q => learnH(h, q.x, q.reg, q.r, q.p));
    choosePairs();
    D.hist[src] = { t: L[L.length - 1].t, n: (D.hist[src] ? D.hist[src].n : 0) + L.length, label: label || src, at: Date.now() };
    save(); return L.length;
  }

  // ---------- what the web knows ----------
  function nodes() {
    const N = {}, W = D.M[4];
    for (const [k, o] of Object.entries(D.A.N)) N[k] = { id: k, n: o[0], hit: o[1], edge: o[2], nW: o[3] || 0, hitW: o[4] || 0, z: zNode(o), avg: o[6] != null && o[0] ? o[6] / o[0] : null };
    for (const id of new Set([].concat(...Object.values(LIVE).map(L => Object.keys(L))))) if (!N[id]) N[id] = { id, n: 0, hit: 0, edge: 0, nW: 0, hitW: 0 };
    Object.values(N).forEach(o => { o.hitR = o.n ? o.hit / o.n : 0; o.edgeM = o.n ? o.edge / o.n : 0; o.hitWild = o.nW >= 10 ? o.hitW / o.nW : null;
      const a = sig((W.Ls - W.Lf) * 12); o.w = a * (W.f.w[o.id] || 0) + (1 - a) * (W.s.w[o.id] || 0); o.wv = a * (W.f.w[o.id + "~vol"] || 0) + (1 - a) * (W.s.w[o.id + "~vol"] || 0); o.label = LABEL[o.id] || o.id; });
    return N;
  }
  function edges() {
    const E = {}, W = D.M[4], a = sig((W.Ls - W.Lf) * 12);
    for (const [k, e] of Object.entries(D.A.P)) { const [x, y] = k.split("&"); E[k] = { a: x, b: y, n: e[0], agree: e[1], both: e[1], bothHit: e[2], learned: D.pairs.includes(k), w: a * (W.f.w[k] || 0) + (1 - a) * (W.s.w[k] || 0) }; }
    const now = Date.now();
    for (const L of Object.values(LIVE)) { const ks = Object.keys(L).filter(k => now - L[k].t < 2 * BUCKET); for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const x = ks[i] < ks[j] ? ks[i] : ks[j], y = ks[i] < ks[j] ? ks[j] : ks[i], k = x + "&" + y, e = E[k] = E[k] || { a: x, b: y, n: 0, agree: 0, both: 0, bothHit: 0, w: 0 };
      e.live = (e.live || 0) + 1; if (!D.A.P[k]) { e.n++; if (Math.sign(L[x].v) === Math.sign(L[y].v)) e.agree++; } } }
    return Object.values(E).map(e => ({ ...e, agreeR: e.n ? e.agree / e.n : 0, bothR: e.both ? e.bothHit / e.both : null }));
  }
  function forecast(asset, h) {
    const a = norm(asset), x = derive(a, feats(a)); if (!Object.keys(x).length) return null;
    const reg = regime(a), z = expand(x, reg), hh = h || 4, P = prob(hh, z), M = D.M[hh], al = P.a;
    const contrib = Object.entries(z).map(([k, v]) => ({ id: k, label: k.includes("|") ? (LABEL[k.split("|")[0]] || k.split("|")[0]) + " — only while " + (LABEL[k.split("|")[1].slice(0, -1)] || k.split("|")[1].slice(0, -1)) + (k.slice(-1) === "+" ? " is up" : " is down") : k.includes("&") ? k.split("&").map(q => LABEL[q] || q).join(" + ") : k.endsWith("~vol") ? (LABEL[k.slice(0, -4)] || k) + " (in this volatility)" : LABEL[k] || k, v, c: (al * (M.f.w[k] || 0) + (1 - al) * (M.s.w[k] || 0)) * v })).sort((m, n) => Math.abs(n.c) - Math.abs(m.c));
    const ph = Object.fromEntries(HZ.map(q => [q, prob(q, z).p]));
    const sk = strike(hunt(M), P.p), TW = tug(x); if (TW.t >= 0.75) sk.on = false;   // balanced tug of war: tension, not an edge
    return { p: P.p, raw: P.raw, ph, n: M.n, ready: M.n >= 100, reg, fast: al, med: P.am, contrib, strike: sk.on, band: sk, shock: !!M.shock, lvl: M.lvl,
      tug: TW, sense: { scale: TW.t >= 0.75 ? `balanced tug of war (${TW.k} signals, pull ${TW.gross.toFixed(1)} vs net ${TW.net.toFixed(1)})` : "one side leads", owl: Math.abs(P.p - P.raw) >= 0.01 ? "calibrated " + Math.round(P.raw * 100) + "% → " + Math.round(P.p * 100) + "%" : "calibrated", widow: sk.on ? "strike" : "wait", mongoose: M.shock ? "shock: relearning fast" : "steady", cat: "strike bar band " + M.lvl } };
  }
  const stats = () => ({ snaps: D.S.length, open: D.S.filter(s => !s.done).length, trained: D.n, assets: Object.keys(LIVE).length, hist: D.hist, pairs: D.pairs.length,
    hz: Object.fromEntries(HZ.map(h => { const M = hunt(D.M[h]); return [h, { n: M.n, hit: M.calls ? M.right / M.calls : null, fast: prob(h, {}).a, shock: !!M.shock, lvl: M.lvl,
      bands: M.band.map((b, i) => ({ from: BANDS[i], n: b[0], hit: b[0] ? b[1] / b[0] : null })), strikeHit: (() => { const B = M.band.filter((b, i) => i >= Math.max(1, M.lvl) && b[0] >= 30 && b[1] / b[0] >= bar(M)); const n = B.reduce((a, b) => a + b[0], 0); return n ? { n, hit: B.reduce((a, b) => a + b[1], 0) / n } : null; })() }]; })) });

  // ---------- picture ----------
  // shapes: ★ proven signal (z ≥ 2.5) · ● signal from the sites (positioning, flows, whales) · ■ environment (markets, cycles,
  // weather, physics, venues) · ▬ behavior (psychology, coordination, coupling, groups, rhythm) · ◆ muted (noise)
  const famOf = id => /^(mkt|cyc|wx|phy|dis|bal)\./.test(id) ? "env" : /^(psy|sync|ent|grp|rhy)\./.test(id) ? "beh" : "site";
  function shape(kind, x, y, r, fill, fo, stroke, sw, extra) {
    const a = `fill="${fill}" fill-opacity="${fo}" stroke="${stroke}" stroke-width="${sw}" ${extra || ""}`;
    if (kind === "star") { let d = ""; for (let k = 0; k < 10; k++) { const rr = k % 2 ? r * 0.45 : r * 1.15, an = -Math.PI / 2 + k * Math.PI / 5; d += (k ? "L" : "M") + (x + rr * Math.cos(an)).toFixed(1) + "," + (y + rr * Math.sin(an)).toFixed(1); } return `<path d="${d}Z" ${a}/>`; }
    if (kind === "env") return `<rect x="${(x - r * 0.85).toFixed(1)}" y="${(y - r * 0.85).toFixed(1)}" width="${(r * 1.7).toFixed(1)}" height="${(r * 1.7).toFixed(1)}" rx="${(r * 0.25).toFixed(1)}" ${a}/>`;
    if (kind === "beh") return `<rect x="${(x - r * 1.25).toFixed(1)}" y="${(y - r * 0.6).toFixed(1)}" width="${(r * 2.5).toFixed(1)}" height="${(r * 1.2).toFixed(1)}" rx="${(r * 0.6).toFixed(1)}" ${a}/>`;
    if (kind === "mute") return `<path d="M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z" ${a}/>`;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" ${a}/>`;
  }
  const icon = (kind, c) => `<svg width="14" height="12" viewBox="0 0 14 12" style="vertical-align:-1px">${shape(kind, 7, 6, 4.2, c, 0.85, c, 0)}</svg>`;
  function render(el, opts) {
    if (!el) return; opts = opts || {};
    const N = nodes(), st = stats(), cv = getComputedStyle(document.documentElement), col = k => cv.getPropertyValue(k).trim();
    const up = col("--bull") || col("--up") || "#19d38a", dn = col("--bear") || col("--down") || "#ff4d5e", line = col("--line") || "#333", ink = col("--text") || col("--ink") || "#ddd", dim = col("--dim") || "#888", acc = col("--accent") || "#4da3ff";
    const PR = new Set(D.proven || []), MU = new Set(D.mute || []), kindOf = n => PR.has(n.id) ? "star" : MU.has(n.id) ? "mute" : famOf(n.id);
    const infl = n => Math.abs(n.w) * 2 + Math.sqrt(n.n) / 40 + (PR.has(n.id) ? 1 : 0);
    const L = Object.values(N).sort((a, b) => infl(b) - infl(a)).slice(0, opts.compact ? 22 : 48), idx = new Map(L.map((n, i) => [n.id, i]));
    const E = edges().filter(e => idx.has(e.a) && idx.has(e.b) && (e.learned || e.n >= 30)).sort((a, b) => (b.learned - a.learned) || b.n - a.n).slice(0, opts.compact ? 40 : 90);
    const W = el.clientWidth || 800, Ht = opts.h || 360, uid = "w" + Math.random().toString(36).slice(2, 7);
    // layout: each family has its own sector of the circle (proven stars near the middle), then forces settle it:
    // links pull, every pair pushes apart, nodes never overlap, and everything drifts gently to the middle
    const rad = n => 5 + Math.min(13, Math.sqrt(n.n) * 0.45 + Math.abs(n.w) * 6), SEC = { site: -Math.PI / 2, env: Math.PI / 6, beh: Math.PI * 5 / 6, star: 0, mute: Math.PI / 2 };
    const P = L.map((n, i) => { const k = kindOf(n), a0 = (SEC[k] != null ? SEC[k] : 0) + ((i * 0.618) % 1 - 0.5) * 1.6, rr = k === "star" ? 30 + (i % 3) * 18 : Math.min(W, Ht) * (0.22 + (i * 0.37 % 1) * 0.22);
      return { x: W / 2 + Math.cos(a0) * rr * (W / Ht) * 0.9, y: Ht / 2 + Math.sin(a0) * rr, vx: 0, vy: 0, r: rad(n) }; });
    E.forEach(e => { e.learned = e.learned && Math.abs(e.w) >= 0.05; });   // drawn as learned only with a real weight
    const links = E.map(e => ({ i: idx.get(e.a), j: idx.get(e.b), s: e.agreeR, e })), deg = P.map(() => 0); links.forEach(l => { deg[l.i]++; deg[l.j]++; });
    const rep0 = Math.max(600, W * Ht / 250);
    for (let it = 0; it < 300; it++) { const cool = 1 - it / 330;
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const a = P[i], b = P[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01, d = Math.sqrt(d2), min = a.r + b.r + 16;
        let f = d < 230 ? rep0 / d2 : 0; if (d < min) f += (min - d) * 0.6 / d;   /* push only nearby nodes, so loose signals settle in, not in the corners */ a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f; }
      links.forEach(l => { const a = P[l.i], b = P[l.j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, k = (d - (170 - 80 * l.s)) * (l.e.learned ? 0.006 : 0.002); a.vx += dx * k; a.vy += dy * k; b.vx -= dx * k; b.vy -= dy * k; });
      P.forEach((p, i) => { const gr = deg[i] ? 1 : 4; p.vx += (W / 2 - p.x) * 0.012 * gr; p.vy += (Ht / 2 - p.y) * 0.02 * gr; p.x += Math.max(-10, Math.min(10, p.vx * 0.1 * cool)); p.y += Math.max(-10, Math.min(10, p.vy * 0.1 * cool)); p.vx *= 0.55; p.vy *= 0.55;
        p.x = Math.max(40, Math.min(W - 40, p.x)); p.y = Math.max(24, Math.min(Ht - 30, p.y)); });
    }
    // links: learned = solid curve + a small square at its middle (its own weight); co-firing = faint dashed curve
    const svgL = links.map(l => { const e = l.e, a = P[l.i], b = P[l.j], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, cx = mx - dy / d * d * 0.12, cy = my + dx / d * d * 0.12;
      const c = e.learned ? (e.w >= 0 ? up : dn) : e.bothR == null ? dim : e.bothR >= 0.5 ? up : dn, tip = `<title>${LABEL[e.a] || e.a} + ${LABEL[e.b] || e.b}\nfire together ${e.n.toLocaleString()}× · agree ${Math.round(l.s * 100)}% · right when they agree ${e.bothR == null ? "–" : Math.round(e.bothR * 100) + "%"}${e.learned ? `\nlearned link weight ${e.w.toFixed(2)}` : ""}</title>`;
      const path = `<path d="M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}" fill="none" stroke="${c}" stroke-linecap="round" stroke-opacity="${e.learned ? 0.8 : (0.1 + 0.3 * Math.min(1, e.n / 300)).toFixed(2)}" stroke-width="${e.learned ? (1.4 + Math.min(3, Math.abs(e.w) * 4)).toFixed(1) : 0.8}"${e.learned ? "" : ' stroke-dasharray="2 4"'}>${tip}</path>`;
      return path + (e.learned ? `<rect x="${((mx + cx) / 2 - 3.5).toFixed(1)}" y="${((my + cy) / 2 - 3.5).toFixed(1)}" width="7" height="7" rx="1.5" fill="${c}" stroke="${ink}" stroke-opacity=".5" stroke-width=".6">${tip}</rect>` : ""); }).join("");
    const lab = n => String(n.label).replace(/^(SOXX|Cohort|Radar|Macro|Cycles|Physics|Weather|Venues|Psychology|Coordination|Coupling|Rhythm|Groups|Cosmic) · /, "").replace(/\s*\(.*\)$/, "").slice(0, 24);
    // labels: the most influential first, skipped where they would overlap one already placed
    const showLab = new Set(), boxes = []; L.forEach((n, i) => { if (showLab.size >= (opts.compact ? 9 : 22)) return; const t = lab(n), w = t.length * 5.6, x = P[i].x - w / 2, y = P[i].y + rad(n) + 2;
      if (boxes.some(b => x < b.x + b.w + 4 && x + w + 4 > b.x && y < b.y + 13 && y + 13 > b.y)) return; boxes.push({ x, y, w }); showLab.add(n.id); });
    const svgN = L.map((n, i) => { const k = kindOf(n), r = rad(n), c = n.n < 10 ? dim : n.hitR >= 0.5 ? up : dn, fo = n.n < 10 ? 0.3 : (0.45 + Math.min(0.5, Math.abs(n.hitR - 0.5) * 4)).toFixed(2), ring = n.w >= 0 ? up : dn;
      const tip = `<title>${n.label}${PR.has(n.id) ? "\n★ proven (strong evidence, z " + n.z.toFixed(1) + ")" : MU.has(n.id) ? "\n◆ muted: noise so far" : ""}\nchecks ${n.n.toLocaleString()} · right ${Math.round(n.hitR * 100)}%${n.hitWild != null ? ` (in wild markets ${Math.round(n.hitWild * 100)}%)` : ""}\nlearned weight ${n.w.toFixed(2)} · in high volatility ${n.wv >= 0 ? "+" : ""}${n.wv.toFixed(2)}</title>`;
      return `<g${k === "star" ? ` filter="url(#${uid}g)"` : ""}>${shape(k, P[i].x, P[i].y, r, c, fo, ring, Math.min(3, 0.8 + Math.abs(n.w) * 3).toFixed(1), "")}${tip}</g>${showLab.has(n.id) ? `<text x="${Math.max(lab(n).length * 2.8 + 4, Math.min(W - lab(n).length * 2.8 - 4, P[i].x)).toFixed(1)}" y="${(P[i].y + r + 11).toFixed(1)}" fill="${ink}" fill-opacity=".82" font-size="10.5" text-anchor="middle" font-family="var(--sans,system-ui)" paint-order="stroke" stroke="${col("--panel") || "#000"}" stroke-width="3" stroke-opacity=".6">${lab(n)}</text>` : ""}`; }).join("");
    const hz = HZ.map(h => { const s = st.hz[h]; return `<span style="white-space:nowrap">${h < 1 ? "30m" : h + "h"} ${s.hit != null ? `<b style="color:${s.hit >= 0.5 ? up : dn}">${Math.round(s.hit * 100)}%</b>` : "–"}${s.strikeHit ? ` <span style="color:${dim}">· 🕷 ${Math.round(s.strikeHit.hit * 100)}%</span>` : ""}</span>`; }).join(" · ");
    const head = `<div style="display:flex;flex-wrap:wrap;gap:4px 14px;align-items:baseline;font:11.5px var(--mono);color:${dim};margin-bottom:6px"><span><b style="color:${ink}">${D.n.toLocaleString()}</b> lessons</span><span><b style="color:${ink}">${Object.keys(N).length}</b> signals</span><span><b style="color:${ink}">${(D.proven || []).length}</b> ★ proven</span><span><b style="color:${ink}">${D.pairs.length}</b> learned links</span><span title="Edison: pairs tried as experiments, and how many earned a place">💡 ${(D.ed && D.ed.tried) || 0} tried · ${(D.ed && D.ed.keptN) || 0} kept</span><span>calls right: ${hz}</span></div>`;
    const legend = `<div style="display:flex;flex-wrap:wrap;gap:4px 14px;font:11px var(--mono);color:${dim};margin-top:6px">${icon("star", acc)} proven ${icon("site", acc)} positioning and flows ${icon("env", acc)} markets, cycles, weather, physics ${icon("beh", acc)} psychology and coordination ${icon("mute", dim)} muted noise <span>· green = right more often · red = wrong more often (the web fades it) · <b style="color:${ink}">━■━</b> learned link · ┄ fire together</span></div>`;
    el.innerHTML = head + `<svg viewBox="0 0 ${W} ${Ht}" width="100%" height="${Ht}" style="display:block;border-radius:12px;border:1px solid ${line}"><defs><radialGradient id="${uid}b" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${acc}" stop-opacity=".07"/><stop offset="1" stop-color="${acc}" stop-opacity="0"/></radialGradient><filter id="${uid}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="100%" height="100%" fill="url(#${uid}b)"/>${svgL}${svgN}</svg>` + legend + (opts.working ? workingHtml({ compact: opts.compact }) : "");
  }
  // ---------- what is working: proven signals, faded signals, proven links, muted noise, strike record ----------
  function discover() {
    const N = nodes(), all = Object.values(N).filter(n => n.n >= 50);
    const E = edges().filter(e => e.learned).map(e => ({ ...e, z: e.both ? (e.bothHit - e.both / 2) / Math.sqrt(e.both / 4) : 0 })).sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
    return { working: all.filter(n => n.z >= 2.5).sort((a, b) => b.z - a.z), reverse: all.filter(n => n.z <= -2.5).sort((a, b) => a.z - b.z), links: E, muted: (D.mute || []).map(k => N[k]).filter(Boolean), st: stats() };
  }
  function workingHtml(o) {
    o = o || {}; const X = discover(), cv = getComputedStyle(document.documentElement), col = k => cv.getPropertyValue(k).trim(), up = col("--bull") || col("--up") || "#19d38a", dn = col("--bear") || col("--down") || "#ff4d5e", dim = col("--dim") || "#888", ink = col("--text") || col("--ink") || "#ddd", line = col("--line") || "#333";
    const PR = new Set(D.proven || []), kind = id => PR.has(id) ? "star" : famOf(id), lim = o.compact ? 5 : 10;
    const row = (n, c) => `<tr><td style="text-align:left;padding:3px 6px">${icon(kind(n.id), c)} ${n.label}</td><td style="text-align:right;padding:3px 6px;color:${c}">${Math.round(n.hitR * 100)}%</td><td style="text-align:right;padding:3px 6px;color:${dim}">${n.n.toLocaleString()}</td><td style="text-align:right;padding:3px 6px;color:${n.avg == null ? dim : n.avg >= 0 ? up : dn}">${n.avg == null ? "–" : (n.avg >= 0 ? "+" : "") + (n.avg * 100).toFixed(2) + "%"}</td><td style="text-align:right;padding:3px 6px">${n.z.toFixed(1)}</td><td style="text-align:right;padding:3px 6px;color:${n.w >= 0 ? up : dn}">${n.w >= 0 ? "+" : ""}${n.w.toFixed(2)}</td></tr>`;
    const tb = (title, rows, note) => `<div style="flex:1 1 320px;min-width:0;border:1px solid ${line};border-radius:10px;padding:8px 10px"><div style="font:600 12px var(--sans,system-ui);color:${ink};margin-bottom:4px">${title}</div>${rows.length ? `<table style="width:100%;border-collapse:collapse;font:11.5px var(--mono)"><tr style="color:${dim}"><th style="text-align:left;padding:2px 6px;font-weight:400">Signal</th><th style="text-align:right;padding:2px 6px;font-weight:400">Right</th><th style="text-align:right;padding:2px 6px;font-weight:400">Checks</th><th style="text-align:right;padding:2px 6px;font-weight:400" title="Average move per call in the signal's direction, 4 h later — results on a scale, not just right or wrong">Avg move</th><th style="text-align:right;padding:2px 6px;font-weight:400">z</th><th style="text-align:right;padding:2px 6px;font-weight:400">Weight</th></tr>${rows.join("")}</table>` : `<div style="font:11.5px var(--mono);color:${dim}">${note}</div>`}</div>`;
    const S = X.st.hz, strike = HZ.map(h => { const s = S[h]; return `<span style="white-space:nowrap">${h < 1 ? "30m" : h + "h"}: all calls <b style="color:${s.hit >= 0.5 ? up : dn}">${s.hit != null ? Math.round(s.hit * 100) + "%" : "–"}</b>${s.strikeHit ? ` · 🕷 strikes <b style="color:${s.strikeHit.hit >= 0.5 ? up : dn}">${Math.round(s.strikeHit.hit * 100)}%</b> of ${s.strikeHit.n.toLocaleString()}` : " · no strike level yet"}${s.shock ? " · ⚡ shock" : ""}</span>`; }).join(" &nbsp;|&nbsp; ");
    return `<div style="margin-top:10px"><div style="font:600 13px var(--sans,system-ui);color:${ink};margin-bottom:4px">What's working</div><div style="font:11.5px var(--mono);color:${dim};margin-bottom:6px">${strike}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">${tb("Working — right more often than chance (z ≥ 2.5)", X.working.slice(0, lim).map(n => row(n, up)), "No signal has strong evidence yet (it needs 50+ checks and z ≥ 2.5 vs chance).")}
      ${tb("Works in reverse — the web fades these (z ≤ −2.5)", X.reverse.slice(0, lim).map(n => row(n, dn)), "None yet.")}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"><div style="flex:1 1 320px;min-width:0;border:1px solid ${line};border-radius:10px;padding:8px 10px"><div style="font:600 12px var(--sans,system-ui);color:${ink};margin-bottom:4px">Learned links — two signals together <span style="font:11px var(--mono);color:${dim};font-weight:400">· 💡 Edison: ${(D.ed && D.ed.tried) || 0} experiments tried, ${(D.ed && D.ed.keptN) || 0} kept, ${(D.ed && D.ed.exp.length) || 0} running</span></div>${X.links.filter(e => Math.abs(e.w) >= 0.05).length ? X.links.filter(e => Math.abs(e.w) >= 0.05).slice(0, lim).map(e => `<div style="font:11.5px var(--mono);padding:2px 0"><b style="color:${e.w >= 0 ? up : dn}">━■━</b> ${LABEL[e.a] || e.a} <span style="color:${dim}">+</span> ${LABEL[e.b] || e.b} <span style="color:${dim}">· right when they agree ${e.bothR == null ? "–" : Math.round(e.bothR * 100) + "%"} · weight ${e.w >= 0 ? "+" : ""}${e.w.toFixed(2)}</span></div>`).join("") : `<div style="font:11.5px var(--mono);color:${dim}">None with a real weight yet: a link is tried when two signals agree 150+ times with an outcome bias, and it counts once the web gives it its own weight (|w| ≥ 0.05).</div>`}</div>
      <div style="flex:1 1 320px;min-width:0;border:1px solid ${line};border-radius:10px;padding:8px 10px"><div style="font:600 12px var(--sans,system-ui);color:${ink};margin-bottom:4px">🧪 The lab — always testing <span style="font:11px var(--mono);color:${dim};font-weight:400">· ${((D.labS && D.labS.tested) || 0).toLocaleString()} ideas tested on ${((D.lab || []).length).toLocaleString()} lessons · ${((D.labS && D.labS.ok) || []).length} confirmed</span></div>${(D.labS && D.labS.ok.length) ? D.labS.ok.slice(0, lim).map(o => { const nm = o.k.includes("|") ? (LABEL[o.k.split("|")[0]] || o.k.split("|")[0]) + " <span style='color:" + dim + "'>only while</span> " + (LABEL[o.k.split("|")[1].slice(0, -1)] || o.k.split("|")[1].slice(0, -1)) + (o.k.slice(-1) === "+" ? " ↑" : " ↓") : o.k.split("&").map(q => LABEL[q] || q).join(" <span style='color:" + dim + "'>×</span> ");
        return `<div style="font:11.5px var(--mono);padding:2px 0"><b style="color:${o.z1 > 0 ? up : dn}">${o.z1 > 0 ? "▲" : "▼"}</b> ${nm} <span style="color:${dim}">· right ${Math.round(o.hit * 100)}% of ${o.n} · z ${o.z1.toFixed(1)} / ${o.z2.toFixed(1)} (both halves)</span></div>`; }).join("") : `<div style="font:11.5px var(--mono);color:${dim}">Nothing has passed both halves yet. Every 2 minutes 40 new ideas are tried — pairs, triples, conditionals and flips, including ones that make no obvious sense.</div>`}</div>
      <div style="flex:1 1 320px;min-width:0;border:1px solid ${line};border-radius:10px;padding:8px 10px"><div style="font:600 12px var(--sans,system-ui);color:${ink};margin-bottom:4px">${icon("mute", dim)} Muted — noise after 300+ checks</div><div style="font:11.5px var(--mono);color:${dim};line-height:1.5">${X.muted.length ? X.muted.slice(0, 14).map(n => n.label.replace(/^[^·]+· /, "")).join(" · ") : "Nothing muted yet."}</div><div style="font:11px var(--mono);color:${dim};margin-top:4px">Muted weights fade 20× faster, so noise stops moving the forecast. A muted signal comes back if it starts to work.</div></div></div></div>`;
  }
  function forecastHtml(asset) {
    const F = forecast(asset); if (!F) return "";
    const cv = getComputedStyle(document.documentElement), up = cv.getPropertyValue("--bull").trim() || cv.getPropertyValue("--up").trim(), dn = cv.getPropertyValue("--bear").trim() || cv.getPropertyValue("--down").trim();
    const pp = p => `<b style="color:${p >= 0.5 ? up : dn}">${Math.round(p * 100)}%</b>`;
    return `<span style="font:12px var(--mono)">Signal web P(up): 30m ${pp(F.ph[0.5])} · 1h ${pp(F.ph[1])} · 4h ${pp(F.ph[4])} · 24h ${pp(F.ph[24])}${F.ready ? "" : ` <span style="opacity:.6">(learning, ${F.n}/100)</span>`} · <b title="Black widow: strike only in confidence bands that paid (56%+ over 30+ calls)">${F.strike ? "🕷 STRIKE" : "wait"}</b>${F.tug && F.tug.t >= 0.75 ? ` · <span title="Strong signals pull hard both ways (gross ${F.tug.gross.toFixed(1)}, net ${F.tug.net.toFixed(1)}): the forces are in balance — tension builds, but no side leads">⚖ tug of war</span>` : ""}${F.shock ? ` · <span title="Mongoose: the last 30 calls missed often; relearning fast">⚡ shock</span>` : ""} · drivers: ${F.contrib.slice(0, 3).map(c => `${c.label} ${c.c >= 0 ? "+" : ""}${c.c.toFixed(2)}`).join(", ")}</span>`;
  }
  setInterval(() => { try { reload(); labRun(); } catch (e) { } }, 120000); setTimeout(() => { try { labRun(); } catch (e) { } }, 40000);
  window.Web = { emit, tick, ingest, forecast, forecastHtml, render, nodes, edges, stats, discover, workingHtml, cycles, lab: () => labRun(), addPrice: f => PRICE.push(f), data: () => D };
  setInterval(tick, 60000); setTimeout(tick, 15000);
})();
