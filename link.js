/* Link engines · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   Two engines that find how things move together. Both feed nodes to the signal web (web.js), which learns what each is worth.

   Ent (entanglement map). Physics: entangled particles share one state, so a reading on one tells you about the other.
   Markets have a real, weaker version: coupled assets. This engine measures it with plain statistics:
     - correlation of returns over the long window and the short window (coupling now vs normal: forming or breaking),
     - lead-lag: does A's return in one bar predict B's return in the next bars (Fisher z test, |z| >= 3 to count),
     - stretch: B's move minus beta x A's move over the last bars, in residual standard deviations. A big stretch on a
       tightly coupled pair tends to close (the follower catches up, or the leader gives back),
     - cohesion: the mean coupling of everything. High = one macro factor drives all (risk-on/off); low = stock-picking.
   Data cleanup: log returns, outliers clipped at 6 robust sigmas (median and MAD), at most 2 missing bars filled, pairs need 60+ bars.

   Sync (coordination). Finds traders who act together:
     - bursts: 3+ different wallets push the same side within the window,
     - linked pairs: two wallets that trade the same side within the window much more often than chance (lift),
       usually one owner with several wallets, copy trading, or the same signal service,
     - mirror pairs: one buys as the other sells, again and again (internal transfers, or one side of a hedge),
     - leaders: in a linked pair, the wallet that moves first in 75%+ of the joint moves,
     - reactions: how each group trades after a big drop or a big rise (dip buyers vs chasers),
     - outcomes: what price did 1h, 4h and 24h after each burst type (best-led, worst-led, mixed).
   Nothing here is proof of collusion: it is a pattern in public on-chain fills. */
(function () {
  "use strict";
  const c1 = v => Math.max(-1, Math.min(1, v));
  const zf = (r, n) => Math.atanh(Math.max(-0.999, Math.min(0.999, r))) * Math.sqrt(Math.max(1, n - 3));
  // ======================= Ent =======================
  function grid(S, bar) {
    const names = Object.keys(S).filter(n => S[n] && S[n].length > 10); let t0 = Infinity, t1 = -Infinity;
    names.forEach(n => { t0 = Math.min(t0, S[n][0][0]); t1 = Math.max(t1, S[n][S[n].length - 1][0]); });
    const B = Math.floor((t1 - t0) / bar) + 1; if (!(B > 20) || B > 5000) return null;
    const P = {}; names.forEach(n => { const a = new Array(B).fill(null); S[n].forEach(([t, p]) => { if (p > 0) a[Math.floor((t - t0) / bar)] = p; });
      let last = null, gap = 0; for (let i = 0; i < B; i++) { if (a[i] != null) { last = a[i]; gap = 0; } else if (last != null && gap < 2) { a[i] = last; gap++; } } P[n] = a; });
    return { names, B, t0, P };
  }
  function analyze(S, o) {
    o = Object.assign({ bar: 9e5, short: 24, k: 8, maxLag: 3, minN: 60 }, o || {});
    const G = grid(S, o.bar); if (!G) return null; const { B } = G, R = {};
    G.names.forEach(n => { const a = G.P[n], r = new Array(B).fill(null); for (let i = 1; i < B; i++) if (a[i] && a[i - 1]) r[i] = Math.log(a[i] / a[i - 1]);
      const v = r.filter(x => x != null).sort((x, y) => x - y); if (v.length < o.minN) return;
      const med = v[v.length >> 1], mad = v.map(x => Math.abs(x - med)).sort((x, y) => x - y)[v.length >> 1] || 1e-9, cap = 6 * 1.4826 * mad;
      R[n] = { r: r.map(x => x == null ? null : Math.max(med - cap, Math.min(med + cap, x))), sd: 1.4826 * mad }; });
    const corr = (x, y, lag, from) => { let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
      for (let i = Math.max(from, lag + 1); i < B; i++) { const a = x[i - lag], b = y[i]; if (a == null || b == null) continue; n++; sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b; }
      if (n < 12) return { r: 0, n, beta: 0 }; const cv = sxy / n - sx * sy / n / n, va = sxx / n - sx * sx / n / n, vb = syy / n - sy * sy / n / n;
      return { r: va > 0 && vb > 0 ? cv / Math.sqrt(va * vb) : 0, n, beta: va > 0 ? cv / va : 0 }; };
    const stretch = (x, y, beta) => {   // y's residual vs x over the last k bars, in residual sigmas
      const e = []; for (let i = 1; i < B; i++) if (x[i] != null && y[i] != null) e.push(y[i] - beta * x[i]); if (e.length < o.minN) return null;
      const m = e.reduce((a, v) => a + v, 0) / e.length, sd = Math.sqrt(e.reduce((a, v) => a + (v - m) ** 2, 0) / e.length) || 1e-9;
      let s = 0, k = 0; for (let i = B - o.k; i < B; i++) if (x[i] != null && y[i] != null) { s += y[i] - beta * x[i] - m; k++; }
      return k ? { z: s / (sd * Math.sqrt(k)), res: s } : null; };
    const N = Object.keys(R), pairs = [];
    for (let i = 0; i < N.length; i++) for (let j = i + 1; j < N.length; j++) {
      const a = N[i], b = N[j], x = R[a].r, y = R[b].r, L = corr(x, y, 0, 0); if (L.n < o.minN) continue;
      const Sh = corr(x, y, 0, B - o.short), zL = zf(L.r, L.n);
      let lead = null; for (let k = 1; k <= o.maxLag; k++) { [[a, b, x, y], [b, a, y, x]].forEach(([p, q, u, w]) => { const c = corr(u, w, k, 0), z = zf(c.r, c.n);
        if (Math.abs(z) >= 3 && Math.abs(c.r) >= 0.1 && (!lead || Math.abs(c.r) > Math.abs(lead.r))) lead = { from: p, to: q, lag: k, r: c.r, z }; }); }
      if (lead) { const back = corr(lead.from === a ? y : x, lead.from === a ? x : y, lead.lag, 0); if (Math.abs(back.r) >= Math.abs(lead.r) * 0.8) lead = null; }   // two-way = common driver, not a lead
      const bBA = corr(x, y, 0, 0).beta, bAB = corr(y, x, 0, 0).beta;
      pairs.push({ a, b, r: L.r, rs: Sh.r, n: L.n, zL, lead, sB: Math.abs(L.r) >= 0.4 ? stretch(x, y, bBA) : null, sA: Math.abs(L.r) >= 0.4 ? stretch(y, x, bAB) : null });
    }
    const ok = pairs.filter(p => Math.abs(p.zL) >= 3), mean = f => ok.length ? ok.reduce((s, p) => s + Math.abs(f(p)), 0) / ok.length : null;
    const E = { at: Date.now(), B, bar: o.bar, k: o.k, short: o.short, R, pairs, coh: { long: mean(p => p.r), short: mean(p => p.rs) } };
    if (o.tag) try { E.G = groups(E, o.tag, corr, o); } catch (e) { console.warn("groups", e); }
    return E;
  }
  // ---- groups: asset class, sector, industry (peers), size, listing age. Index = mean member return per bar ----
  function groups(E, tag, corr, o) {
    const B = E.B, N = Object.keys(E.R), TG = {}; N.forEach(n => TG[n] = tag(n));
    const dims = { cls: "Asset class", sec: "Sector", ind: "Industry (peers)", cap: "Size", age: "Company age" }, out = { dims, by: {}, x: [], peer: {}, TG };
    const idx = (ms, skip) => { const r = new Array(B).fill(null); for (let i = 1; i < B; i++) { let s = 0, k = 0; ms.forEach(m => { if (m === skip) return; const v = E.R[m].r[i]; if (v != null) { s += v; k++; } }); if (k) r[i] = s / k; } return r; };
    const PI = {}; E.pairs.forEach(p => PI[p.a + "|" + p.b] = p);
    const pr = (a, b) => PI[a + "|" + b] || PI[b + "|" + a];
    const sum = (r, n) => { let s = 0; for (let i = Math.max(1, B - n); i < B; i++) s += r[i] || 0; return s; };
    const day = Math.max(1, Math.round(864e5 / E.bar));
    Object.keys(dims).forEach(d => { const M = {}; N.forEach(n => { const v = TG[n][d]; if (v && v !== "n/a" && v !== "Unknown") (M[v] = M[v] || []).push(n); });
      out.by[d] = Object.entries(M).filter(([, ms]) => ms.length >= 2).map(([g, ms]) => { let rl = 0, rs = 0, k = 0;
        for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) { const p = pr(ms[i], ms[j]); if (p) { rl += p.r; rs += p.rs; k++; } }
        const ix = idx(ms); return { d, g, ms, rl: k ? rl / k : null, rs: k ? rs / k : null, ix, mk: Math.exp(sum(ix, E.k)) - 1, m24: Math.exp(sum(ix, day)) - 1 }; })
        .sort((a, b) => b.ms.length - a.ms.length); });
    // class vs class and sector vs sector: correlated, independent, or opposite
    ["cls", "sec"].forEach(d => { const G = out.by[d]; for (let i = 0; i < G.length; i++) for (let j = i + 1; j < G.length; j++) {
      const L = corr(G[i].ix, G[j].ix, 0, 0), S = corr(G[i].ix, G[j].ix, 0, B - (o.short || 24)); if (L.n >= 30) out.x.push({ d, a: G[i].g, b: G[j].g, r: L.r, rs: S.r, n: L.n }); } });
    // each name vs its peers (same industry; else same sector), peers' index without the name itself
    N.forEach(n => { const t = TG[n]; let grp = (out.by.ind.find(g => g.g === t.ind && g.ms.length >= 3) || out.by.sec.find(g => g.g === t.sec && g.ms.length >= 4)); if (!grp) return;
      const px = idx(grp.ms, n), c = corr(px, E.R[n].r, 0, 0); if (c.n < 30 || c.r < 0.3) return;
      const e = []; for (let i = 1; i < B; i++) if (px[i] != null && E.R[n].r[i] != null) e.push(E.R[n].r[i] - c.beta * px[i]);
      const m = e.reduce((a, v) => a + v, 0) / e.length, sd = Math.sqrt(e.reduce((a, v) => a + (v - m) ** 2, 0) / e.length) || 1e-9;
      let s = 0, k = 0; for (let i = B - E.k; i < B; i++) if (px[i] != null && E.R[n].r[i] != null) { s += E.R[n].r[i] - c.beta * px[i] - m; k++; }
      if (k) out.peer[n] = { grp: grp.g, r: c.r, z: s / (sd * Math.sqrt(k)), n: grp.ms.length - 1 }; });
    return out;
  }
  const sn = n => String(n).split(":").pop();
  // signals for one asset: catch-up (stretch closes) and lead (a leader already moved)
  function signals(E, t) {
    if (!E || !E.R[t]) return null; const out = { catchup: 0, lead: 0, why: [] }; let wc = 0, wl = 0;
    E.pairs.forEach(p => { if (p.a !== t && p.b !== t) return; const other = p.a === t ? p.b : p.a, st = p.a === t ? p.sA : p.sB;
      if (st && Math.abs(p.r) >= 0.5 && Math.abs(st.z) >= 1.5) { const v = -Math.sign(st.z) * Math.min(1, Math.abs(st.z) / 3), w = Math.abs(p.r); out.catchup += v * w; wc += w;
        out.why.push(`${sn(t)} is ${st.z > 0 ? "ahead of" : "behind"} ${sn(other)} by ${Math.abs(st.z).toFixed(1)}σ (coupling ${p.r.toFixed(2)})`); }
      if (p.lead && p.lead.to === t) { const r = E.R[p.lead.from].r, sd = E.R[p.lead.from].sd; let s = 0; for (let i = E.B - p.lead.lag; i < E.B; i++) s += r[i] || 0;
        const z = s / (sd * Math.sqrt(p.lead.lag) || 1e-9); if (Math.abs(z) >= 1) { out.lead += c1(z / 3) * Math.sign(p.lead.r) * Math.min(1, Math.abs(p.lead.r) * 3); wl += 1;
          out.why.push(`${sn(p.lead.from)} leads ${sn(t)} by ${p.lead.lag} bar${p.lead.lag > 1 ? "s" : ""} and just moved ${z > 0 ? "up" : "down"} ${Math.abs(z).toFixed(1)}σ`); } } });
    out.catchup = wc ? c1(out.catchup / wc) : 0; out.lead = wl ? c1(out.lead / wl) : 0; out.peer = 0;
    const P = E.G && E.G.peer[t]; if (P && Math.abs(P.z) >= 1.5) { out.peer = -Math.sign(P.z) * Math.min(1, Math.abs(P.z) / 3) * Math.min(1, P.r * 1.5); out.why.push(`${sn(t)} is ${P.z > 0 ? "ahead of" : "behind"} its ${P.n} peers (${P.grp}) by ${Math.abs(P.z).toFixed(1)}σ`); }
    return out;
  }
  // ======================= Sync =======================
  // T: [{t, a, g ("best"/"worst"/...), d (+1 buy pressure / -1 sell), usd, c (market, optional)}]; o.px(t) -> price or null
  function sync(T, o) {
    o = Object.assign({ win: 15 * 6e4, minW: 3, px: null }, o || {});
    T = T.filter(x => x && x.t && x.a && x.d).sort((x, y) => x.t - y.t); if (!T.length) return null;
    const span = Math.max(36e5, T[T.length - 1].t - T[0].t), cnt = {};
    T.forEach(x => { cnt[x.a] = (cnt[x.a] || 0) + 1; });
    // bursts (per market, per side)
    const bursts = [], open = {};
    const close = k => { const b = open[k]; delete open[k]; if (b && b.W.size >= o.minW) { const gs = [...b.G.values()], nb = gs.filter(g => g === "best").length, nw = gs.filter(g => g === "worst").length;
      bursts.push({ t: b.t, t1: b.t1, c: b.c, d: b.d, w: b.W.size, usd: b.usd, nb, nw, typ: nb >= 2 * Math.max(1, nw) ? "best" : nw >= 2 * Math.max(1, nb) ? "worst" : "mixed", W: [...b.W] }); } };
    T.forEach(x => { const k = (x.c || "") + "|" + x.d, b = open[k];
      if (b && x.t - b.t <= o.win) { b.W.add(x.a); b.G.set(x.a, x.g); b.usd += x.usd || 0; b.t1 = x.t; }
      else { close(k); open[k] = { t: x.t, t1: x.t, c: x.c || "", d: x.d, W: new Set([x.a]), G: new Map([[x.a, x.g]]), usd: x.usd || 0 }; } });
    Object.keys(open).forEach(close);
    // outcomes
    const H = [1, 4, 24], st = {};
    if (o.px) bursts.forEach(b => { const p0 = o.px(b.t1, b.c); if (!p0) return; b.out = {};
      H.forEach(h => { const p = o.px(b.t1 + h * 36e5, b.c); if (p && b.t1 + h * 36e5 < Date.now()) b.out[h] = b.d * (p / p0 - 1); });
      const s = st[b.typ] = st[b.typ] || { n: 0, h: {} }; s.n++; H.forEach(h => { if (b.out[h] == null) return; const q = s.h[h] = s.h[h] || { n: 0, hit: 0, sum: 0 }; q.n++; q.sum += b.out[h]; if (b.out[h] > 0) q.hit++; }); });
    // pairs (same market)
    // one entry per wallet, market, time bucket and side (a busy wallet counts once per bucket, not once per fill)
    const bk = t => Math.floor(t / o.win), first = new Map(), nb = {};
    T.forEach(x => { const k = x.a + "|" + (x.c || "") + "|" + bk(x.t) + "|" + x.d; if (!first.has(k)) { first.set(k, x); nb[x.a] = (nb[x.a] || 0) + 1; } });
    const byB = {}; first.forEach(x => { const k = (x.c || "") + "|" + bk(x.t); (byB[k] = byB[k] || []).push(x); });
    const co = {}, lead = {}, mir = {}, seenP = new Set();
    Object.entries(byB).forEach(([k, xs]) => { const [c, b] = [k.slice(0, k.lastIndexOf("|")), +k.slice(k.lastIndexOf("|") + 1)], ys = xs.concat(byB[c + "|" + (b + 1)] || []);
      for (const x of xs) for (const y of ys) { if (x.a === y.a || y.t < x.t || y.t - x.t > o.win) continue; const p = x.a < y.a ? x.a + "|" + y.a : y.a + "|" + x.a, u = p + "|" + c + "|" + b + "|" + (x.d === y.d);
        if (seenP.has(u)) continue; seenP.add(u);
        if (x.d === y.d) { co[p] = (co[p] || 0) + 1; if (y.t - x.t >= 6e4) lead[x.a + ">" + y.a] = (lead[x.a + ">" + y.a] || 0) + 1; } else mir[p] = (mir[p] || 0) + 1; } });
    const G = {}; T.forEach(x => G[x.a] = x.g);
    const nBk = Math.max(1, Object.keys(byB).length);   // buckets with any activity (trading clusters in busy hours)
    const exp = (a, b) => Math.min(nb[a], nb[b], nb[a] * nb[b] * 2 / nBk * 0.5);   // chance of a same-side match in this or the next bucket
    const linked = Object.entries(co).map(([k, n]) => { const [a, b] = k.split("|"), e = exp(a, b), la = lead[a + ">" + b] || 0, lb = lead[b + ">" + a] || 0;
      return { a, b, ga: G[a], gb: G[b], n, lift: e > 0 ? n / e : 0, leader: la + lb >= 5 && la >= 0.75 * (la + lb) ? a : la + lb >= 5 && lb >= 0.75 * (la + lb) ? b : null }; })
      .filter(p => p.n >= 10 && p.lift >= 6).sort((x, y) => y.lift * Math.log(y.n) - x.lift * Math.log(x.n));
    const mirror = Object.entries(mir).map(([k, n]) => { const [a, b] = k.split("|"), e = exp(a, b); return { a, b, ga: G[a], gb: G[b], n, lift: e > 0 ? n / e : 0 }; })
      .filter(p => p.n >= 8 && p.lift >= 4).sort((x, y) => y.lift - x.lift);
    // reactions: trades after a big 4h price move, by group
    let react = null;
    if (o.px) { const R = T.map(x => { const p = o.px(x.t, x.c), q = o.px(x.t - 4 * 36e5, x.c); return p && q ? { x, m: p / q - 1 } : null; }).filter(Boolean);
      if (R.length >= 40) { const sd = Math.sqrt(R.reduce((s, r) => s + r.m * r.m, 0) / R.length) || 1e-9; react = {};
        R.forEach(({ x, m }) => { const g = x.g || "all", q = react[g] = react[g] || { base: [0, 0], drop: [0, 0], rise: [0, 0] }, w = Math.max(1, Math.log10((x.usd || 0) + 10));
          const add = k => { q[k][0] += w; if (x.d > 0) q[k][1] += w; }; add("base"); if (m <= -1.5 * sd) add("drop"); if (m >= 1.5 * sd) add("rise"); });
        Object.values(react).forEach(q => ["base", "drop", "rise"].forEach(k => q[k + "B"] = q[k][0] >= 3 ? q[k][1] / q[k][0] : null)); } }
    return { at: Date.now(), n: T.length, wallets: Object.keys(cnt).length, bursts, st, linked, mirror, react, win: o.win, T };
  }
  // live: bursts in the last 'age' ms and leaders who just moved (followers not yet)
  function live(Y, c, age) {
    if (!Y) return null; age = age || 2 * 36e5; const now = Date.now(), out = { burst: 0, best: 0, worst: 0, leader: 0, why: [] };
    Y.bursts.filter(b => (c == null || b.c === c) && now - b.t1 < age).forEach(b => { const f = Math.exp(-(now - b.t1) / age), v = b.d * Math.min(1, b.w / 5) * f;
      out.burst += v; if (b.typ === "best") out.best += v; if (b.typ === "worst") out.worst += v;
      out.why.push(`${b.w} wallets ${b.d > 0 ? "bought" : "sold"} together ${Math.round((now - b.t1) / 6e4)} min ago (${b.typ === "mixed" ? "mixed groups" : b.typ + " traders"})`); });
    Y.linked.filter(p => p.leader).forEach(p => { const L = p.leader, F = L === p.a ? p.b : p.a;
      const lm = Y.T.filter(x => x.a === L && (c == null || x.c === c) && now - x.t < 60 * 6e4).pop(); if (!lm) return;
      const fm = Y.T.some(x => x.a === F && (c == null || x.c === c) && x.t > lm.t && x.d === lm.d); if (fm) return;
      out.leader += lm.d; out.nl = (out.nl || 0) + 1; out.why.push(`a leader wallet ${lm.d > 0 ? "bought" : "sold"}; its follower has not yet (${p.n} joint moves before)`); });
    if (out.nl) out.leader = out.leader / out.nl * Math.min(1, 0.4 + 0.15 * out.nl);   // average of the leaders, more weight when several agree
    ["burst", "best", "worst", "leader"].forEach(k => out[k] = c1(out[k])); return out;
  }
  // ======================= HTML =======================
  const pc = v => v == null ? "–" : (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
  const sh = a => a && a.length > 12 ? a.slice(0, 6) + "…" + a.slice(-4) : a;
  function entHtml(E, nm) {
    nm = nm || (x => x); if (!E) return `<div class="note">The coupling map needs more price history; it fills in as bars load.</div>`;
    const P = E.pairs.filter(p => Math.abs(p.zL) >= 3), top = P.slice().sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, 8);
    const brk = P.filter(p => Math.abs(p.r) >= 0.4 && Math.abs(p.r - p.rs) >= 0.35).sort((x, y) => Math.abs(y.r - y.rs) - Math.abs(x.r - x.rs)).slice(0, 6);
    const lds = E.pairs.filter(p => p.lead).sort((x, y) => Math.abs(y.lead.z) - Math.abs(x.lead.z)).slice(0, 6);
    const st = E.pairs.flatMap(p => [p.sA && { t: p.a, o: p.b, r: p.r, z: p.sA.z }, p.sB && { t: p.b, o: p.a, r: p.r, z: p.sB.z }]).filter(x => x && Math.abs(x.r) >= 0.5 && Math.abs(x.z) >= 1.5).sort((x, y) => Math.abs(y.z) - Math.abs(x.z)).slice(0, 6);
    const hrs = E.bar / 36e5, bl = hrs >= 1 ? hrs + "h" : Math.round(E.bar / 6e4) + "m";
    const coh = E.coh.long != null ? `<b>Cohesion</b> ${E.coh.short != null ? (E.coh.short * 100).toFixed(0) : "–"} now vs ${(E.coh.long * 100).toFixed(0)} normal: ${E.coh.short > E.coh.long + 0.08 ? "everything moves together more than usual — one macro force (rates, dollar, risk appetite) drives price; single-name calls are weaker" : E.coh.short < E.coh.long - 0.08 ? "markets move apart more than usual — each name trades on its own story; single-name signals are stronger" : "normal"}.` : "";
    const tb = (h, rows) => rows.length ? `<table class="tr" style="margin-top:4px"><thead><tr>${h.map((x, i) => `<th${i ? "" : ' style="text-align:left"'}>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>` : "";
    return `<div class="note" style="max-width:none">${coh} Bars: ${bl}, ${E.B} bars.</div>
      ${tb(["Most coupled pairs", "Normal", "Now"], top.map(p => `<tr><td style="text-align:left">${nm(p.a)} ↔ ${nm(p.b)}</td><td>${p.r.toFixed(2)}</td><td class="${Math.abs(p.rs) < Math.abs(p.r) - 0.3 ? "S" : ""}">${p.rs.toFixed(2)}</td></tr>`))}
      ${tb(["Coupling breaking or forming", "Normal", "Now"], brk.map(p => `<tr><td style="text-align:left">${nm(p.a)} ↔ ${nm(p.b)}: ${Math.abs(p.rs) < Math.abs(p.r) ? "breaking — a new, separate story" : "forming — a common driver took over"}</td><td>${p.r.toFixed(2)}</td><td>${p.rs.toFixed(2)}</td></tr>`))}
      ${tb(["Leaders (move first)", "Lag", "Strength"], lds.map(p => `<tr><td style="text-align:left">${nm(p.lead.from)} → ${nm(p.lead.to)}${p.lead.r < 0 ? " (opposite way)" : ""}</td><td>${p.lead.lag * hrs >= 1 ? (p.lead.lag * hrs).toFixed(hrs >= 1 ? 0 : 1) + "h" : Math.round(p.lead.lag * E.bar / 6e4) + "m"}</td><td>z ${Math.abs(p.lead.z).toFixed(1)}</td></tr>`))}
      ${tb(["Stretched now (tends to close)", "Stretch", "Lean"], st.map(x => `<tr><td style="text-align:left">${nm(x.t)} vs ${nm(x.o)} (coupling ${x.r.toFixed(2)})</td><td>${x.z.toFixed(1)}σ</td><td class="${x.z < 0 ? "L" : "S"}">${nm(x.t)} ${x.z < 0 ? "▲ catch up" : "▼ give back"}</td></tr>`))}`;
  }
  function groupHtml(E, nm, pick) {
    nm = nm || (x => x); const G = E && E.G; if (!G) return "";
    const pc = v => v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%", f2 = v => v == null ? "–" : v.toFixed(2);
    const tb = (h, rows) => rows.length ? `<table class="tr" style="margin-top:4px"><thead><tr>${h.map((x, i) => `<th${i ? "" : ' style="text-align:left"'}>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>` : "";
    const kb = Math.round(E.k * E.bar / 36e5);
    const dimT = d => tb([G.dims[d], "Names", "Coupling normal", "Now", `${kb}h move`, "24h move"], G.by[d].slice(0, d === "ind" ? 14 : 10).map(g => `<tr><td style="text-align:left" title="${g.ms.map(nm).join(", ")}">${g.g}</td><td>${g.ms.length}</td><td>${f2(g.rl)}</td><td class="${g.rl != null && g.rs != null ? (g.rs > g.rl + 0.15 ? "S" : g.rs < g.rl - 0.15 ? "L" : "") : ""}">${f2(g.rs)}</td><td class="${g.mk >= 0 ? "L" : "S"}">${pc(g.mk)}</td><td class="${g.m24 >= 0 ? "L" : "S"}">${pc(g.m24)}</td></tr>`));
    const X = G.x.slice().sort((a, b) => Math.abs(b.r) - Math.abs(a.r));
    const rel = x => Math.abs(x.r) < 0.1 ? "independent — a diversifier" : x.r < 0 ? "opposite — a hedge" : x.r >= 0.5 ? "move together" : "loosely linked";
    const xs = X.filter(x => x.d === "cls").concat(X.filter(x => x.d === "sec").slice(0, 10));
    const pe = Object.entries(G.peer).filter(([, p]) => Math.abs(p.z) >= 1.5).sort((a, b) => Math.abs(b[1].z) - Math.abs(a[1].z)).slice(0, 10);
    return `${tb(["Markets vs markets", "Normal", "Now", "Reading"], xs.slice(0, 14).map(x => `<tr><td style="text-align:left">${x.a} ↔ ${x.b}</td><td>${f2(x.r)}</td><td class="${Math.abs(x.rs - x.r) >= 0.3 ? "S" : ""}">${f2(x.rs)}</td><td style="text-align:left">${rel(x)}${Math.abs(x.rs - x.r) >= 0.3 ? (Math.abs(x.rs) > Math.abs(x.r) ? " · tighter now" : " · looser now") : ""}</td></tr>`))}
      ${(pick || ["cls", "sec", "ind", "cap", "age"]).map(dimT).join("")}
      ${tb(["Ahead of or behind its peers", "Peers", "Fit", "Stretch", "Lean"], pe.map(([n, p]) => `<tr><td style="text-align:left">${nm(n)} vs ${p.grp}</td><td>${p.n}</td><td>${f2(p.r)}</td><td>${p.z.toFixed(1)}σ</td><td class="${p.z < 0 ? "L" : "S"}">${p.z < 0 ? "▲ catch up" : "▼ give back"}</td></tr>`))}
      <div class="note" style="max-width:none">Coupling = the mean correlation of returns inside the group. Higher now than normal = one force drives the whole group (sector news, flows into or out of the theme); lower = members trade on their own stories. Size and age groups show style tides: small and young names move together in risk-on, mega and old names in risk-off. Peer stretch = a name moved away from comparable companies more than usual; it tends to close unless the name has its own news.</div>`;
  }
  function syncHtml(Y, o) {
    o = o || {}; if (!Y) return `<div class="note">The coordination study needs trade history; it fills in as fills load.</div>`;
    const lab = o.label || sh, gL = g => g === "best" ? '<span class="L">best</span>' : g === "worst" ? '<span class="S">worst</span>' : (g || "");
    const tb = (h, rows) => rows.length ? `<table class="tr" style="margin-top:4px"><thead><tr>${h.map((x, i) => `<th${i ? "" : ' style="text-align:left"'}>${x}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>` : "";
    const st = ["best", "worst", "mixed"].filter(k => Y.st[k]).map(k => { const s = Y.st[k], f = h => s.h[h] && s.h[h].n >= 3 ? `${Math.round(s.h[h].hit / s.h[h].n * 100)}% · ${pc(s.h[h].sum / s.h[h].n)}` : "–";
      return `<tr><td style="text-align:left">${k === "mixed" ? "Mixed groups" : k === "best" ? "Best traders together" : "Worst traders together"}</td><td>${s.n}</td><td>${f(1)}</td><td>${f(4)}</td><td>${f(24)}</td></tr>`; });
    const rc = Y.react ? Object.entries(Y.react).filter(([g]) => g === "best" || g === "worst" || g === "all").map(([g, q]) => `<tr><td style="text-align:left">${gL(g) || g}</td><td>${q.baseB != null ? Math.round(q.baseB * 100) + "%" : "–"}</td><td class="${q.dropB != null && q.baseB != null ? (q.dropB > q.baseB + 0.1 ? "L" : q.dropB < q.baseB - 0.1 ? "S" : "") : ""}">${q.dropB != null ? Math.round(q.dropB * 100) + "%" : "–"}</td><td class="${q.riseB != null && q.baseB != null ? (q.riseB > q.baseB + 0.1 ? "L" : q.riseB < q.baseB - 0.1 ? "S" : "") : ""}">${q.riseB != null ? Math.round(q.riseB * 100) + "%" : "–"}</td><td style="text-align:left">${q.dropB != null && q.baseB != null ? (q.dropB > q.baseB + 0.1 ? "buys dips" : q.dropB < q.baseB - 0.1 ? "sells into drops" : "steady") + " · " + (q.riseB != null && q.riseB > q.baseB + 0.1 ? "chases rises" : q.riseB != null && q.riseB < q.baseB - 0.1 ? "sells rises" : "steady") : ""}</td></tr>`) : [];
    const rb = Y.bursts.slice(-8).reverse().map(b => `<tr><td style="text-align:left">${new Date(b.t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}${b.c && o.showC ? " · " + b.c : ""}</td><td class="${b.d > 0 ? "L" : "S"}">${b.d > 0 ? "buy" : "sell"}</td><td>${b.w} (${b.nb}B/${b.nw}W)</td><td>${o.usd ? o.usd(b.usd) : Math.round(b.usd)}</td><td>${b.out && b.out[4] != null ? pc(b.out[4]) : "–"}</td></tr>`);
    return `<div class="note" style="max-width:none">${Y.n} moves by ${Y.wallets} wallets · ${Y.bursts.length} bursts (${Y.win / 6e4}-min window, 3+ wallets, same side) · ${Y.linked.length} linked pairs · ${Y.mirror.length} mirror pairs.</div>
      ${tb(["After a burst (did it pay?)", "Bursts", "1h hit · avg", "4h", "24h"], st)}
      ${tb(["How each group responds", "Buys normally", "Buys after a big drop", "Buys after a big rise", "Habit"], rc)}
      ${tb(["Linked wallets (trade together)", "Joint moves", "× chance", "Leader"], Y.linked.slice(0, 8).map(p => `<tr><td style="text-align:left">${lab(p.a)} ${gL(p.ga)} + ${lab(p.b)} ${gL(p.gb)}</td><td>${p.n}</td><td>${p.lift.toFixed(0)}×</td><td>${p.leader ? lab(p.leader) : "–"}</td></tr>`))}
      ${tb(["Mirror wallets (one buys, one sells)", "Times", "× chance"], Y.mirror.slice(0, 5).map(p => `<tr><td style="text-align:left">${lab(p.a)} ${gL(p.ga)} ⇄ ${lab(p.b)} ${gL(p.gb)}</td><td>${p.n}</td><td>${p.lift.toFixed(0)}×</td></tr>`))}
      ${tb(["Latest bursts", "Side", "Wallets", "Size", "4h after"], rb)}
      <div class="note" style="max-width:none;margin-top:4px">Linked = they trade the same side within ${Y.win / 6e4} minutes at least 6× more often than chance (in hours when anyone trades): often one owner with several wallets, copy trading, or one signal group. Hit = the share of bursts where price then moved their way. This is a pattern in public fills, not proof of collusion.</div>`;
  }
  window.Ent = { analyze, signals, html: entHtml, groupHtml };
  window.Sync = { analyze: sync, live, html: syncHtml };
})();
