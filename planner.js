/* Trade planner · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   One trade plan for each time frame (15 m, 1 h, 4 h, 1 day), each held 14 days or less, taken only at inflection
   points, and checked against every other time frame. The rules are back-tested again at every refresh, and every
   plan issued goes into a paper ledger that is scored as the bars come in.
   1. Inflection points (each known at the close of its bar, no look-ahead):
      piv  a swing turn confirmed (price came back 2 ATR from a high or low)
      ema  EMA 9 crosses EMA 21 (momentum turns)
      rsi  RSI 14 comes back up through 30 or down through 70 (exhaustion turns)
      clx  a volume climax with a long wick against the move (capitulation or blow-off)
      pb   a P/B failed breakout back inside, or a confirmed breakout (pb.js, Patrick Nill)
   2. Every time frame's trend (close vs a rising or falling EMA 21) at the moment of the event, from the last bar of that
      time frame that had already closed. Filters: none · own trend agrees · higher time frames not against (and one with)
      · both.
   3. Trade rules: entry is a LIMIT order 0.25, 0.5 or 1 ATR better than the signal close, alive for a few bars (15 m: 4 h,
      1 h: 12 h, 4 h: 24 h, 1 day: 3 days); the trade (and its test) exists only once price touches it, and a rule must fill at
      least half of its orders. Exits: a LIMIT target at 1.5, 2.5 or 4 R; a stop at MARKET only with a reason (past the last
      swing = the setup is wrong; 2.5 ATR = outside normal noise) or no stop at all (to test whether stops help); time stop
      15 m: 2 days · 1 h: 5 days · 4 h: 10 days · 1 day: 14 days. Costs 0.1% a round trip, in R.
   4. Refine: 5 triggers × 3 limits × 3 stops × 3 targets × 4 filters = 540 rules per time frame. The single best rule is chosen on the first
      60% of history (expectancy, shrunk for small samples), then checked once on the last 40%, which it has not seen. A
      time frame's plan is "proven" only if that rule also made money there (10+ filled trades, t ≥ 2). Otherwise the best
      candidate still plans, marked unproven: it goes to the paper ledger but not to the web.
   5. Ledger: each plan issued (a chosen rule triggers on the last closed bar) is saved in this browser and scored: target,
      stop or time. Live results per time frame are shown next to the back-test, so drift shows early.
   API: Planner.run(key, { "15m": bars, "1h": bars, "4h": bars, "1d": bars }) → P · Planner.signals(P) · Planner.html(P, opts)
        Planner.agg(bars, ms) builds higher time frames. Bars [[t, o, h, l, c, v]], oldest first, t = bar open (ms). */
(function () {
  "use strict";
  if (window.Planner) return;
  const TF = ["15m", "1h", "4h", "1d"], DUR = { "15m": 9e5, "1h": 36e5, "4h": 144e5, "1d": 864e5 }, MAXH = { "15m": 192, "1h": 120, "4h": 60, "1d": 14 };
  const TRG = { piv: "swing turn", ema: "EMA 9/21 cross", rsi: "RSI turn from 30/70", clx: "volume climax", pb: "P/B breakout or failed breakout" };
  const LIM = [0.25, 0.5, 1], FILLW = { "15m": 16, "1h": 12, "4h": 6, "1d": 3 };   // limit entry: this many ATR better than the signal close; the order lives this many bars
  const STOPS = ["struct", "atr2.5", "none"], STOPWHY = { struct: "past the last swing: the setup is wrong if that breaks", "atr2.5": "outside normal noise (2.5 × ATR)", none: "no stop: the time limit is the exit (tests whether stops help)" }, TGT = [1.5, 2.5, 4], FIL = ["none", "self", "higher", "all"], FILN = { none: "no filter", self: "own trend agrees", higher: "higher time frames not against", all: "own and higher trends agree" };
  const COST = 0.001, c1 = v => Math.max(-1, Math.min(1, v));
  function agg(B, ms) { const out = []; let cur = null; for (const b of B) { const k = Math.floor(b[0] / ms) * ms; if (!cur || cur[0] !== k) { if (cur) out.push(cur); cur = [k, b[1], b[2], b[3], b[4], b[5] || 0]; } else { cur[2] = Math.max(cur[2], b[2]); cur[3] = Math.min(cur[3], b[3]); cur[4] = b[4]; cur[5] += b[5] || 0; } } if (cur) out.push(cur); return out; }
  function ind(B) {
    const n = B.length, e9 = [], e21 = [], atr = [], rsi = [], tr = []; let a9 = B[0][4], a21 = B[0][4], at = 0, up = 0, dn = 0;
    for (let i = 0; i < n; i++) { const c = B[i][4]; a9 += (c - a9) * 2 / 10; a21 += (c - a21) * 2 / 22; e9.push(a9); e21.push(a21);
      const t = i ? Math.max(B[i][2] - B[i][3], Math.abs(B[i][2] - B[i - 1][4]), Math.abs(B[i][3] - B[i - 1][4])) : B[i][2] - B[i][3]; at = i ? at + (t - at) / 14 : t; atr.push(at);
      const d = i ? c - B[i - 1][4] : 0; up = i ? up + (Math.max(0, d) - up) / 14 : 0; dn = i ? dn + (Math.max(0, -d) - dn) / 14 : 0; rsi.push(dn ? 100 - 100 / (1 + up / dn) : 50);
      tr.push(i >= 3 ? (c > a21 && a21 > e21[i - 3] ? 1 : c < a21 && a21 < e21[i - 3] ? -1 : 0) : 0); }
    // swing turns, confirmed when price comes back 2 ATR; lastLow/lastHigh = the swing known at each bar
    const piv = new Array(n).fill(0), lastLow = new Array(n).fill(null), lastHigh = new Array(n).fill(null); let dir = 0, hi0 = B[0][2], lo0 = B[0][3], ext = 0, LL = null, LH = null;
    for (let i = 1; i < n; i++) { const h = B[i][2], l = B[i][3], k = 2 * atr[i];
      if (dir === 0) { hi0 = Math.max(hi0, h); lo0 = Math.min(lo0, l); if (hi0 - l >= k) { dir = -1; LH = hi0; ext = l; } else if (h - lo0 >= k) { dir = 1; LL = lo0; ext = h; } }
      else if (dir > 0) { if (h > ext) ext = h; if (ext - l >= k) { piv[i] = -1; LH = ext; dir = -1; ext = l; } }
      else { if (l < ext) ext = l; if (h - ext >= k) { piv[i] = 1; LL = ext; dir = 1; ext = h; } }
      lastLow[i] = LL; lastHigh[i] = LH; }
    const vm = new Array(n).fill(null); for (let i = 20; i < n; i++) { const w = B.slice(i - 20, i).map(b => b[5] || 0).sort((x, y) => x - y); vm[i] = w[10]; }
    return { e9, e21, atr, rsi, tr, piv, lastLow, lastHigh, vm };
  }
  function triggers(B, X, tf) {
    const n = B.length, T = [];
    for (let i = 30; i < n; i++) {
      if (X.piv[i]) T.push({ i, side: X.piv[i], k: "piv" });
      const cr = Math.sign(X.e9[i] - X.e21[i]), pr = Math.sign(X.e9[i - 1] - X.e21[i - 1]); if (cr && pr && cr !== pr) T.push({ i, side: cr, k: "ema" });
      if (X.rsi[i - 1] < 30 && X.rsi[i] >= 30) T.push({ i, side: 1, k: "rsi" }); if (X.rsi[i - 1] > 70 && X.rsi[i] <= 70) T.push({ i, side: -1, k: "rsi" });
      const b = B[i], rg = b[2] - b[3], v = b[5] || 0;
      if (X.vm[i] && v >= 2.5 * X.vm[i] && rg > 1.2 * X.atr[i]) { const pos = (b[4] - b[3]) / (rg || 1), mv = b[4] - B[i - 5][4];
        if (mv < 0 && pos >= 0.6) T.push({ i, side: 1, k: "clx" }); else if (mv > 0 && pos <= 0.4) T.push({ i, side: -1, k: "clx" }); } }
    try { if (window.PB) { const A = window.PB.analyze(B, { tf: tf === "15m" || tf === "1h" ? tf : "4h" }); if (A) A.E.filter(e => e.type === "reclaim" || e.type === "break").forEach(e => T.push({ i: e.at, side: e.side, k: "pb" })); } } catch (e) { }
    return T;
  }
  // trend of every time frame at a moment: the last bar of that frame that had closed by then
  function ctxAt(F, t) { const o = {}; for (const tf of TF) { const f = F[tf]; if (!f) continue; const ct = t - DUR[tf]; let lo = 0, hi = f.B.length - 1, j = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (f.B[m][0] <= ct) { j = m; lo = m + 1; } else hi = m - 1; } o[tf] = j >= 0 ? f.X.tr[j] : 0; } return o; }
  function pass(fil, tf, side, ctx) {
    const hi = TF.slice(TF.indexOf(tf) + 1).filter(t => ctx[t] != null), own = ctx[tf] === side, hiOk = hi.length ? hi.every(t => ctx[t] !== -side) && hi.some(t => ctx[t] === side) : true;
    return fil === "none" ? true : fil === "self" ? own : fil === "higher" ? hiOk : own && hiOk; }
  // entry: a LIMIT order lim × ATR better than the signal bar's close, alive for W bars; the trade exists only if price touches it.
  // exits: the target is a LIMIT order (tR × the risk); the stop (if any) and the time limit exit at MARKET.
  function sim(B, X, i, side, lim, stopM, tR, maxH, W) {
    const n = B.length, a = X.atr[i], lp = B[i][4] - side * lim * a; let q0 = -1, e = lp;
    for (let q = i + 1; q <= Math.min(n - 1, i + W); q++) { const b = B[q]; if (side > 0 ? b[3] <= lp : b[2] >= lp) { q0 = q; e = side > 0 ? Math.min(b[1], lp) : Math.max(b[1], lp); break; } }
    const levels = ep => { let st = null; if (stopM === "struct") { const s = side > 0 ? X.lastLow[i] : X.lastHigh[i]; let d = s != null ? Math.abs(ep - s) + 0.2 * a : 2 * a; d = Math.max(0.7 * a, Math.min(4 * a, d)); st = ep - side * d; } else if (stopM === "atr2.5") st = ep - side * 2.5 * a;
      const risk = st != null ? Math.abs(ep - st) : 2 * a; return { st, risk, tg: ep + side * tR * risk }; };
    if (q0 < 0) { if (i + W >= n - 1) { const L = levels(lp); return { pending: true, limit: lp, stop: L.st, target: L.tg, risk: L.risk }; } return { nofill: true, at: i + W }; }
    const { st, risk, tg } = levels(e), cost = e * COST / risk;
    let xa = 0, xf = 0; for (let q = q0; q < Math.min(n, q0 + 1 + maxH); q++) { const b = B[q]; xa = Math.min(xa, (side > 0 ? b[3] - e : e - b[2]) / risk); xf = Math.max(xf, (side > 0 ? b[2] - e : e - b[3]) / risk); }   // no stop, no target: worst and best point (R)
    for (let q = q0; q < Math.min(n, q0 + 1 + maxH); q++) { const b = B[q];
      if (st != null && (side > 0 ? b[3] <= st : b[2] >= st)) return { R: -1 - cost, how: "stop", at: q, fill: q0, xa, xf };   // on the fill bar too (we cannot know the order inside a bar: assume the worst)
      if (q > q0 && (side > 0 ? b[2] >= tg : b[3] <= tg)) return { R: tR - cost, how: "target", at: q, fill: q0, xa, xf }; }
    if (q0 + maxH >= n) return { open: true, limit: lp, entry: e, stop: st, target: tg, risk, fill: q0 };
    return { R: (B[q0 + maxH][4] - e) * side / risk - cost, how: "time", at: q0 + maxH, fill: q0, xa, xf };
  }
  const LK = "plan_ledger_v1", ld = () => { try { return JSON.parse(localStorage.getItem(LK) || "[]"); } catch (e) { return []; } }, ls = L => { try { localStorage.setItem(LK, JSON.stringify(L.slice(-400))); } catch (e) { } };
  function run(key, bars) {
    const F = {}; for (const tf of TF) { const B = bars[tf]; if (B && B.length >= 150) F[tf] = { B, X: ind(B) }; }
    const out = { key, at: Date.now(), tf: {} };
    for (const tf of TF) { const f = F[tf]; if (!f) continue; const { B, X } = f, n = B.length, maxH = MAXH[tf], cut = B[Math.floor(n * 0.6)][0];
      const T = triggers(B, X, tf).map(t => ({ ...t, ctx: ctxAt(F, B[t.i][0] + DUR[tf]) }));
      // all 540 rules: results on the first 60% (train) and the last 40% (test); a trade counts only once its limit filled
      const V = [], W = FILLW[tf], C = {}, simC = (t, lim, sm, tR) => { const k2 = t.i + "|" + t.side + "|" + lim + "|" + sm + "|" + tR; return C[k2] || (C[k2] = sim(B, X, t.i, t.side, lim, sm, tR, maxH, W)); };
      for (const k of Object.keys(TRG)) for (const lim of LIM) for (const sm of STOPS) for (const tR of TGT) for (const fil of FIL) { const tr = [], te = [], xs = []; let tries = 0, fills = 0;
        let busy = -1; for (const t of T) { if (t.k !== k || t.i <= busy || !pass(fil, tf, t.side, t.ctx)) continue; const r = simC(t, lim, sm, tR); if (r.open || r.pending) continue; tries++; busy = r.at; if (r.nofill) continue; fills++; (B[t.i][0] < cut ? tr : te).push(r.R); xs.push([r.xa, r.xf, r.R]); }   // one order at a time
        const st = a => { const m = a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0, sd = a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)) : 1; return { n: a.length, m, win: a.length ? a.filter(v => v > 0).length / a.length : 0, t: a.length > 1 ? m / (sd / Math.sqrt(a.length)) : 0 }; };
        const A = st(tr), Bt = st(te), fr = tries ? fills / tries : 0; const q = (a, p) => { if (!a.length) return null; const z = a.slice().sort((x, y) => x - y); return z[Math.floor(p * (z.length - 1))]; }, ex = xs.length >= 8 ? { mae50: q(xs.map(x => x[0]), 0.5), mae90: q(xs.map(x => x[0]), 0.1), mfe50: q(xs.map(x => x[1]), 0.5), mfe90: q(xs.map(x => x[1]), 0.9), winMae80: (() => { const w = xs.filter(x => x[2] > 0).map(x => x[0]); return w.length >= 5 ? q(w, 0.2) : null; })() } : null;
        V.push({ ex, k, lim, sm, tR, fil, tr: A, te: Bt, fr, score: A.n >= 12 && fr >= 0.5 ? A.m - 1 / Math.sqrt(A.n) : -9 }); }   // "likely to fill": at least half of the limit orders must fill
      V.sort((a, b) => b.score - a.score);
      const best = V[0] && V[0].score > -9 && V[0].tr.m > 0 ? V[0] : null, pick = best && best.te.n >= 10 && best.te.m > 0 && best.te.t >= 2 ? best : null, top = V.slice(0, 5);   // only the single best rule on the learning part may be tested on the unseen part: searching the unseen part for a winner would be cheating
      // now: triggers on the last closed bar (the last bar may still be forming: use n-2 when it has not closed)
      const lastClosed = B[n - 1][0] + DUR[tf] <= Date.now() + 6e4 ? n - 1 : n - 2, ctxNow = ctxAt(F, B[lastClosed][0] + DUR[tf]);
      const now = T.filter(t => t.i >= lastClosed - 1);
      let plan = null;
      const use = pick || best;   // no proven rule: the best candidate still plans, marked "unproven" (paper only, kept out of the web)
      if (use) { const t = now.find(t => t.k === use.k && pass(use.fil, tf, t.side, t.ctx)); if (t) { const r = sim(B, X, t.i, t.side, use.lim, use.sm, use.tR, maxH, W), t0 = B[t.i][0] + DUR[tf];
        if (r.pending || r.open) plan = { side: t.side, limit: r.limit, status: r.open ? "filled" : "pending", entry: r.open ? r.entry : r.limit, stop: r.stop, target: r.target, risk: r.risk, t0, until: t0 + W * DUR[tf], exp: (r.open ? B[r.fill][0] : t0 + W * DUR[tf]) + maxH * DUR[tf], rule: use, why: TRG[t.k], proven: !!pick }; } }
      out.tf[tf] = { n, trend: ctxNow[tf], ctx: ctxNow, pick, best, top, plan, now, px: B[n - 1][4], atr: X.atr[n - 1], rules: V.length };
    }
    // ledger: save new plans; score open ones with the bars of their time frame
    if (/^hubtest:/.test(key)) { out.ledger = []; return out; }   // test-runner runs do not write to the paper ledger
    const L = ld(); let ch = false;
    for (const tf of TF) { const p = out.tf[tf] && out.tf[tf].plan; if (p && !L.some(x => x.key === key && x.tf === tf && x.t0 === p.t0)) { L.push({ key, tf, t0: p.t0, until: p.until, exp: p.exp, side: p.side, limit: p.limit, entry: p.limit, stop: p.stop, target: p.target, risk: p.risk, maxH: MAXH[tf], rule: `${p.rule.k}/limit ${p.rule.lim} ATR/${p.rule.sm}/${p.rule.tR}R/${p.rule.fil}`, proven: p.proven, st: "pending" }); ch = true; } }
    L.forEach(x => { if (x.key !== key || !F[x.tf] || !["open", "pending"].includes(x.st)) return; const B = F[x.tf].B, d = DUR[x.tf];
      if (x.st === "pending") { if (x.limit == null) { x.st = "open"; x.fillT = x.t0; } else { const b = B.find(b => b[0] >= x.t0 && b[0] < (x.until || x.t0 + 12 * d) && (x.side > 0 ? b[3] <= x.limit : b[2] >= x.limit));
          if (b) { x.st = "open"; x.fillT = b[0]; x.entry = x.side > 0 ? Math.min(b[1], x.limit) : Math.max(b[1], x.limit); x.exp = b[0] + (x.maxH || 48) * d; ch = true; } else if (B.length && B[B.length - 1][0] >= (x.until || x.t0 + 12 * d)) { x.st = "cancelled"; x.done = Date.now(); ch = true; return; } else return; } }
      const risk = x.risk || Math.abs(x.entry - x.stop) || x.entry * 0.02;
      for (const b of B) { if (b[0] < x.fillT) continue; if (x.stop != null && (x.side > 0 ? b[3] <= x.stop : b[2] >= x.stop)) { x.st = "stop"; x.R = (x.stop - x.entry) * x.side / risk; break; } if (b[0] > x.fillT && (x.side > 0 ? b[2] >= x.target : b[3] <= x.target)) { x.st = "target"; x.R = Math.abs(x.target - x.entry) / risk; break; } if (b[0] >= x.exp) { x.st = "time"; x.R = (b[4] - x.entry) * x.side / risk; break; } }
      if (x.st !== "open") { x.done = Date.now(); ch = true; } else x.now = (B[B.length - 1][4] - x.entry) * x.side / risk; });
    if (ch) ls(L);
    out.ledger = L.filter(x => x.key === key);
    return out;
  }
  function signals(P) {
    if (!P) return []; const I = [];
    for (const tf of TF) { const o = P.tf[tf]; if (!o || !o.plan || !o.plan.proven) continue; const q = Math.min(1, Math.max(0.3, o.pick.te.m)); I.push(["plan." + tf, c1(o.plan.side * q * 0.8), `Plan · ${tf}: ${o.plan.side > 0 ? "LONG" : "SHORT"} on ${o.plan.why} (back-tested)`]); }
    // agreement across time frames: the trend of each frame, weighted toward the higher ones
    const tw = { "15m": 0.5, "1h": 0.75, "4h": 1, "1d": 1.25 }; let s = 0, w = 0; for (const tf of TF) { const o = P.tf[tf]; if (o) { s += (o.trend || 0) * tw[tf]; w += tw[tf]; } }
    if (w) I.push(["plan.align", c1(s / w), "Plan · trends of all time frames together"]);
    return I;
  }
  function html(P, o) {
    o = o || {}; const fx = o.px || (v => v >= 100 ? v.toFixed(2) : v.toPrecision(4)), dt = t => new Date(t).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
    if (!P || !Object.keys(P.tf).length) return `<div class="note">The planner needs at least 150 bars on a time frame.</div>`;
    const ar = v => v > 0 ? `<span class="L">▲ up</span>` : v < 0 ? `<span class="S">▼ down</span>` : `<span style="color:var(--dim)">― flat</span>`, rs = r => `${TRG[r.k]} · limit entry ${r.lim} ATR better · stop: ${r.sm === "struct" ? "last swing" : r.sm === "none" ? "none (time exit)" : "2.5 ATR"} · limit exit ${r.tR} R · ${FILN[r.fil]} · ${Math.round((r.fr || 0) * 100)}% of orders filled`;
    const exs = e => e ? `<div style="font-size:11px;color:var(--dim)">Held with no stop and no target: typical drawdown ${e.mae50.toFixed(2)} R (worst 10%: ${e.mae90.toFixed(2)} R), typical best point +${e.mfe50.toFixed(2)} R (top 10%: +${e.mfe90.toFixed(2)} R)${e.winMae80 != null ? `; 80% of winners never went below ${e.winMae80.toFixed(2)} R` : ""}.</div>` : "";
    const st = s => s.n ? `${s.n} trades, ${Math.round(s.win * 100)}% win, <b class="${s.m > 0 ? "L" : "S"}">${s.m >= 0 ? "+" : ""}${s.m.toFixed(2)} R</b>/trade` : "no trades";
    const rows = TF.filter(tf => P.tf[tf]).map(tf => { const x = P.tf[tf], p = x.plan, lg = (P.ledger || []).filter(l => l.tf === tf && !["open", "pending", "cancelled"].includes(l.st)), lc = (P.ledger || []).filter(l => l.tf === tf && l.st === "cancelled").length, lgp = lg.filter(l => l.proven), lmp = lgp.length ? lgp.reduce((s, l) => s + l.R, 0) / lgp.length : null, lm = lg.length ? lg.reduce((s, l) => s + l.R, 0) / lg.length : null, op = (P.ledger || []).filter(l => l.tf === tf && l.st === "open"), pe = (P.ledger || []).filter(l => l.tf === tf && l.st === "pending").length;
      return `<tr><td style="text-align:left"><b>${tf}</b><div style="color:var(--dim);font-size:11px">max ${tf === "1d" ? "14 days" : tf === "4h" ? "10 days" : tf === "1h" ? "5 days" : "2 days"}</div></td><td>${ar(x.trend)}</td>
        <td style="text-align:left">${p ? `<b class="${p.side > 0 ? "L" : "S"}">LIMIT ${p.side > 0 ? "BUY" : "SELL SHORT"}</b> at <b>${fx(p.limit)}</b> ${p.status === "filled" ? `<b class="L">· filled</b>` : `(now ${fx(x.px)}, ${((p.limit / x.px - 1) * 100).toFixed(2)}%) · valid until ${dt(p.until)}, cancel if not touched`}
            <div style="font-size:11.5px">Exit: limit ${p.side > 0 ? "sell" : "buy"} at ${fx(p.target)} (${p.rule.tR} R)${p.stop != null ? ` · stop ${fx(p.stop)} at market — ${STOPWHY[p.rule.sm]}` : ` · no stop — ${STOPWHY.none}`} · else at market by ${dt(p.exp)}</div><div style="color:var(--dim);font-size:11px">${p.why}${p.proven ? "" : ` · <b style="color:var(--amber)">unproven rule: paper only</b>`}</div>`
          : x.pick || x.best ? `<span style="color:var(--dim)">Waiting for the ${x.pick ? "" : "(unproven) "}rule to trigger.</span>${x.now.length ? `<div style="font-size:11px;color:var(--dim)">Inflection now: ${x.now.map(t => `${TRG[t.k]} ${t.side > 0 ? "▲" : "▼"}`).join(", ")} (not the proven rule, or a filter says no)</div>` : ""}` : `<span style="color:var(--dim)">No proven rule: no trade on this time frame.</span>`}</td>
        <td style="text-align:left">${x.pick ? `<b class="L">proven</b> · ${rs(x.pick)}<div style="font-size:11px">learn: ${st(x.pick.tr)} · <b>unseen: ${st(x.pick.te)}</b></div>${exs(x.pick.ex)}` : x.best ? `<b style="color:var(--amber)">unproven</b> · ${rs(x.best)}<div style="font-size:11px">learn: ${st(x.best.tr)} · unseen: ${st(x.best.te)} (not enough to trust)</div>${exs(x.best.ex)}` : `<span style="font-size:11px;color:var(--dim)">no rule made money even on the learning part</span>`}</td>
        <td style="text-align:left;font-size:11.5px">${lg.length ? `${lg.length} closed, <b class="${lm > 0 ? "L" : "S"}">${lm >= 0 ? "+" : ""}${lm.toFixed(2)} R</b> avg${lgp.length ? `<div>proven only: ${lgp.length}, ${lmp >= 0 ? "+" : ""}${lmp.toFixed(2)} R</div>` : ""}` : "no closed plans yet"}${pe ? `<div>${pe} limit order${pe > 1 ? "s" : ""} waiting</div>` : ""}${lc ? `<div style="color:var(--dim)">${lc} not filled (cancelled, not counted)</div>` : ""}${op.length ? `<div>${op.length} open${op[op.length - 1].now != null ? `, now ${op[op.length - 1].now >= 0 ? "+" : ""}${op[op.length - 1].now.toFixed(2)} R` : ""}</div>` : ""}</td></tr>`; }).join("");
    return `<table class="tr"><thead><tr><th style="text-align:left">Time frame</th><th>Trend</th><th style="text-align:left">Plan now</th><th style="text-align:left">Chosen rule (best of 540, re-tested at every refresh)</th><th style="text-align:left">Ledger (live plans)</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="note" style="max-width:none">Plans marked "unproven" come from the best candidate rule when no rule passed: they are tracked on paper, never sent to the web. Every plan is a LIMIT order placed better than the current price; the trade and its test exist only once price touches it (orders that never fill are cancelled and not counted). Targets are limit exits; stops exit at market and are used only with a reason. Plans start only at inflection points (swing turns, EMA 9/21 crosses, RSI turns, volume climaxes, P/B breakouts) and must pass the rule's trend filter across the time frames. The one best rule is chosen on the first 60% of history and must also make money on the last 40%, which it did not see (10+ filled trades, t ≥ 2); on random data this lets a false rule through about 1 time in 20 per time frame. "Learn" vs "unseen" shows how much of the edge survives. A big drop from learn to unseen = an overfit rule: trust the unseen number. Every plan goes to the ledger in this browser and is scored when it hits its target, its stop or its time limit. R = result in units of the risk (stop distance); costs of 0.1% a round trip included. These are rules tested on history, not advice.</div>`;
  }
  window.Planner = { run, signals, html, agg, TF };
})();
