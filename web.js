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
   API: Web.emit(id, asset, value −1..1, label) · Web.ingest(src, [{t,a,x,rh:{1,4,24}|r, reg}], label) ·
        Web.forecast(asset[, h]) · Web.render(el, opts) · Web.addPrice(fn) */
(function () {
  "use strict";
  if (window.Web) return;
  const KEY = "web_v3", HZ = [1, 4, 24], BUCKET = 30 * 6e4, H = 36e5;
  const LRF = 0.25, LRS = 0.04, DEC = 0.995, L2 = 0.0005, MAXP = 24;
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const newM = () => ({ f: { w: {}, g: {}, b: 0 }, s: { w: {}, g: {}, b: 0 }, Lf: 0.693, Ls: 0.693, n: 0, calls: 0, right: 0 });
  function fresh() { const d = { v: 2, M: {}, A: { N: {}, P: {} }, hist: {}, S: [], vol: {}, pairs: [], n: 0, at: Date.now() }; HZ.forEach(h => d.M[h] = newM());
    try { localStorage.removeItem("web_v1"); localStorage.removeItem("web_v2"); } catch (e) { } return d; }   // v1 is replaced: history is learned again into the richer model
  const fix = d => { if (!d || d.v !== 2) return fresh(); HZ.forEach(h => { if (!d.M[h]) d.M[h] = newM(); }); d.A = d.A || { N: {}, P: {} }; d.hist = d.hist || {}; d.S = d.S || []; d.vol = d.vol || {}; d.pairs = d.pairs || []; return d; };
  let D = fix(lsG(KEY, null));
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
  function regime(a) { const P = PX[a]; if (!P || P.length < 8) return 0;
    const r = P.slice(-16).map((p, i, A) => i ? Math.abs(Math.log(p / A[i - 1])) : NaN).filter(isFinite), v = r.reduce((s, x) => s + x, 0) / r.length;
    const e = D.vol[a] = D.vol[a] ? D.vol[a] * 0.98 + v * 0.02 : v; return e > 0 ? c1(v / e - 1) : 0; }
  // full feature vector: signals, × regime copies, chosen link pairs
  function expand(x, reg) {
    const z = {}; for (const k in x) { z[k] = x[k]; if (reg) z[k + "~vol"] = Math.round(x[k] * reg * 100) / 100; }
    for (const p of D.pairs) { const [a, b] = p.split("&"); if (x[a] && x[b]) z[p] = Math.round(x[a] * x[b] * 100) / 100; }
    return z; }
  const dot = (L, z) => { let s = L.b; for (const k in z) s += (L.w[k] || 0) * z[k]; return s; };
  function prob(h, z) { const M = D.M[h], pf = sig(dot(M.f, z)), ps = sig(dot(M.s, z)), a = sig((M.Ls - M.Lf) * 12); return { p: a * pf + (1 - a) * ps, pf, ps, a }; }
  function step(L, z, y, lr) { const p = sig(dot(L, z)), g = y - p;
    L.b += lr * 0.3 * g;
    for (const k in z) { const gk = g * z[k]; L.g[k] = (L.g[k] || 0) * DEC + gk * gk; L.w[k] = (L.w[k] || 0) * (1 - L2) + lr * gk / Math.sqrt(1e-3 + L.g[k]); }
    return p; }
  const ll = (p, y) => -Math.log(Math.max(1e-6, y ? p : 1 - p));
  // one lesson for one horizon
  function learnH(h, x, reg, r, p0) {
    if (!isFinite(r) || Math.abs(r) < 0.0005 * Math.sqrt(h)) return;
    const z = expand(x, reg), y = r > 0 ? 1 : 0, M = D.M[h], q = p0 != null ? p0 : prob(h, z).p;
    M.calls++; if ((q > 0.5) === (y === 1)) M.right++;
    const pf = step(M.f, z, y, LRF), ps = step(M.s, z, y, LRS);
    M.Lf = M.Lf * 0.97 + ll(pf, y) * 0.03; M.Ls = M.Ls * 0.995 + ll(ps, y) * 0.005; M.n++; D.n++;
    if (h === 4) { const k = Object.keys(x).filter(q => x[q]), A = D.A;
      for (const q of k) { const o = A.N[q] = A.N[q] || [0, 0, 0, 0, 0]; o[0]++; if (Math.sign(x[q]) === Math.sign(r)) o[1]++; o[2] += Math.sign(x[q]) * c1(r * 5) / 5;
        if (reg > 0.2) { o[3]++; if (Math.sign(x[q]) === Math.sign(r)) o[4]++; } }      // record in wild markets
      for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = k[i] < k[j] ? k[i] : k[j], b = k[i] < k[j] ? k[j] : k[i], e = A.P[a + "&" + b] = A.P[a + "&" + b] || [0, 0, 0];
        e[0]++; if (Math.sign(x[a]) === Math.sign(x[b])) { e[1]++; if (Math.sign(x[a]) === Math.sign(r)) e[2]++; } } }
  }
  // choose the link features: pairs that agree often enough and whose agreement has an outcome bias
  function choosePairs() {
    const P = Object.entries(D.A.P).filter(([, e]) => e[1] >= 150).map(([k, e]) => ({ k, s: Math.abs(e[2] / e[1] - 0.5) * Math.sqrt(e[1]) })).sort((a, b) => b.s - a.s).slice(0, MAXP);
    D.pairs = P.filter(p => p.s >= 1.5).map(p => p.k);
  }

  function tick() {
    reload();
    const now = Date.now(), bk = Math.floor(now / BUCKET);
    for (const a of Object.keys(LIVE)) { const px = price(a); if (px) { const P = PX[a] = PX[a] || []; if (!P.length || now - (P.lastT || 0) >= BUCKET - 6e4) { P.push(px); P.lastT = now; if (P.length > 60) P.shift(); } } }
    for (const a of Object.keys(LIVE)) {
      const x = feats(a); if (!Object.keys(x).length) continue;
      const ex = D.S.find(s => s.a === a && s.bk === bk);
      if (ex) { if (!ex.done) Object.assign(ex.x, x); continue; }
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
    const Q = Object.fromEntries(HZ.map(h => [h, []])), K = Object.fromEntries(HZ.map(h => [h, 0]));
    L.forEach(it => {
      for (const k in it.x) { it.x[k] = Math.round(c1(it.x[k]) * 100) / 100; if (!it.x[k]) delete it.x[k]; }
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
    for (const [k, o] of Object.entries(D.A.N)) N[k] = { id: k, n: o[0], hit: o[1], edge: o[2], nW: o[3] || 0, hitW: o[4] || 0 };
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
    const a = norm(asset), x = feats(a); if (!Object.keys(x).length) return null;
    const reg = regime(a), z = expand(x, reg), hh = h || 4, P = prob(hh, z), M = D.M[hh], al = P.a;
    const contrib = Object.entries(z).map(([k, v]) => ({ id: k, label: k.includes("&") ? k.split("&").map(q => LABEL[q] || q).join(" + ") : k.endsWith("~vol") ? (LABEL[k.slice(0, -4)] || k) + " (in this volatility)" : LABEL[k] || k, v, c: (al * (M.f.w[k] || 0) + (1 - al) * (M.s.w[k] || 0)) * v })).sort((m, n) => Math.abs(n.c) - Math.abs(m.c));
    const ph = Object.fromEntries(HZ.map(q => [q, prob(q, z).p]));
    return { p: P.p, ph, n: M.n, ready: M.n >= 100, reg, fast: al, contrib };
  }
  const stats = () => ({ snaps: D.S.length, open: D.S.filter(s => !s.done).length, trained: D.n, assets: Object.keys(LIVE).length, hist: D.hist, pairs: D.pairs.length,
    hz: Object.fromEntries(HZ.map(h => [h, { n: D.M[h].n, hit: D.M[h].calls ? D.M[h].right / D.M[h].calls : null, fast: sig((D.M[h].Ls - D.M[h].Lf) * 12) }])) });

  // ---------- picture ----------
  function render(el, opts) {
    if (!el) return; opts = opts || {};
    const N = nodes(), st = stats(), cv = getComputedStyle(document.documentElement), col = k => cv.getPropertyValue(k).trim();
    const up = col("--bull") || col("--up") || "#19d38a", dn = col("--bear") || col("--down") || "#ff4d5e", line = col("--line") || "#333", ink = col("--text") || col("--ink") || "#ddd", dim = col("--dim") || "#888", acc = col("--accent") || "#4da3ff";
    const L = Object.values(N).sort((a, b) => b.n - a.n).slice(0, opts.compact ? 18 : 40), idx = new Map(L.map((n, i) => [n.id, i]));
    const E = edges().filter(e => idx.has(e.a) && idx.has(e.b) && (e.learned || e.n >= 30)).sort((a, b) => (b.learned - a.learned) || b.n - a.n).slice(0, opts.compact ? 40 : 90);
    const W = el.clientWidth || 800, Ht = opts.h || 360;
    const P = L.map((n, i) => ({ x: W / 2 + Math.cos(i * 2.4) * (60 + i * 6), y: Ht / 2 + Math.sin(i * 2.4) * (40 + i * 4), vx: 0, vy: 0 }));
    const links = E.map(e => ({ i: idx.get(e.a), j: idx.get(e.b), s: e.agreeR, e }));
    for (let it = 0; it < 240; it++) {
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d2 = dx * dx + dy * dy + 0.01, f = 380 / d2; P[i].vx += dx * f; P[i].vy += dy * f; P[j].vx -= dx * f; P[j].vy -= dy * f; }
      links.forEach(l => { const a = P[l.i], b = P[l.j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, k = (d - (150 - 90 * l.s)) * 0.004; a.vx += dx * k; a.vy += dy * k; b.vx -= dx * k; b.vy -= dy * k; });
      P.forEach(p => { p.vx += (W / 2 - p.x) * 0.01; p.vy += (Ht / 2 - p.y) * 0.012; p.x += Math.max(-8, Math.min(8, p.vx * 0.1)); p.y += Math.max(-8, Math.min(8, p.vy * 0.1)); p.vx *= 0.6; p.vy *= 0.6; p.x = Math.max(30, Math.min(W - 30, p.x)); p.y = Math.max(20, Math.min(Ht - 20, p.y)); });
    }
    const svgL = links.map(l => { const e = l.e, c = e.learned ? (e.w >= 0 ? up : dn) : e.bothR == null ? line : e.bothR >= 0.5 ? up : dn;
      return `<line x1="${P[l.i].x.toFixed(1)}" y1="${P[l.i].y.toFixed(1)}" x2="${P[l.j].x.toFixed(1)}" y2="${P[l.j].y.toFixed(1)}" stroke="${c}" stroke-opacity="${e.learned ? 0.85 : (0.12 + 0.45 * Math.min(1, e.n / 300)).toFixed(2)}" stroke-width="${e.learned ? (1.5 + Math.min(3, Math.abs(e.w) * 4)).toFixed(1) : (0.5 + 1.5 * l.s).toFixed(1)}"${e.learned ? ' stroke-dasharray="1 0"' : ""}><title>${LABEL[e.a] || e.a} + ${LABEL[e.b] || e.b}\nfire together ${e.n.toLocaleString()}× · agree ${Math.round(l.s * 100)}% · right when they agree ${e.bothR == null ? "–" : Math.round(e.bothR * 100) + "%"}${e.learned ? `\nlearned link weight ${e.w.toFixed(2)}` : ""}</title></line>`; }).join("");
    const svgN = L.map((n, i) => { const r = 5 + Math.min(16, Math.sqrt(n.n) * 0.6), c = n.n < 10 ? dim : n.hitR >= 0.5 ? up : dn, ring = Math.min(4, Math.abs(n.w) * 3);
      return `<g><circle cx="${P[i].x.toFixed(1)}" cy="${P[i].y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}" fill-opacity="${n.n < 10 ? 0.35 : (0.35 + Math.min(0.6, Math.abs(n.hitR - 0.5) * 4)).toFixed(2)}" stroke="${n.w >= 0 ? up : dn}" stroke-width="${ring.toFixed(1)}"><title>${n.label}\nchecks ${n.n.toLocaleString()} · right ${Math.round(n.hitR * 100)}%${n.hitWild != null ? ` (in wild markets ${Math.round(n.hitWild * 100)}%)` : ""}\nlearned weight ${n.w.toFixed(2)} · in high volatility ${n.wv >= 0 ? "+" : ""}${n.wv.toFixed(2)}</title></circle>
        <text x="${P[i].x.toFixed(1)}" y="${(P[i].y + r + 10).toFixed(1)}" fill="${ink}" font-size="10" text-anchor="middle" font-family="var(--mono)">${String(n.label).replace(/^(SOXX|Cohort|Radar|Macro) · /, "").slice(0, 22)}</text></g>`; }).join("");
    const top = Object.values(N).filter(n => n.n >= 30).sort((a, b) => Math.abs(b.w) - Math.abs(a.w)).slice(0, 6);
    const flips = Object.values(N).filter(n => n.n >= 30 && Math.abs(n.wv) > 0.15 && Math.sign(n.wv) !== Math.sign(n.w)).slice(0, 3);
    const hz = HZ.map(h => { const s = st.hz[h]; return `${h}h ${s.hit != null ? `<b style="color:${s.hit >= 0.5 ? up : dn}">${Math.round(s.hit * 100)}%</b>` : "–"} <span style="color:${dim}">(${s.n.toLocaleString()}${s.fast > 0.6 ? ", relearning" : ""})</span>`; }).join(" · ");
    const head = `<div style="font:11.5px var(--mono);color:${dim};margin-bottom:4px"><b style="color:${ink}">${D.n.toLocaleString()}</b> lessons · <b style="color:${ink}">${Object.keys(N).length}</b> signals · <b style="color:${ink}">${D.pairs.length}</b> learned links · calls right: ${hz}</div>`;
    const lst = top.length ? `<div style="font:11.5px var(--mono);margin-top:4px;line-height:1.55">${top.slice(0, opts.compact ? 3 : 6).map(n => `<div><b style="color:${n.w >= 0 ? up : dn}">${n.w >= 0 ? "+" : ""}${n.w.toFixed(2)}</b> ${n.label} <span style="color:${dim}">· right ${Math.round(n.hitR * 100)}% of ${n.n.toLocaleString()}</span></div>`).join("")}${flips.length && !opts.compact ? `<div style="color:${dim};margin-top:3px">Flip in wild markets: ${flips.map(n => n.label).join(", ")}</div>` : ""}</div>` : "";
    el.innerHTML = head + `<svg viewBox="0 0 ${W} ${Ht}" width="100%" height="${Ht}" style="display:block;border-radius:10px${opts.compact ? "" : ";border:1px solid " + line}">${svgL}${svgN}</svg>` + lst +
      (opts.compact ? "" : `<div style="font:11.5px var(--mono);color:${dim};margin-top:6px;line-height:1.5">Dot = a signal: fill green = right more than half the time, red = wrong more often, grey = under 10 checks; the ring shows its learned weight (thicker = more influence; green ring = pushes up when the signal is up, red ring = the web learned to fade it). Thick lines = learned links (two signals together have their own weight); thin lines = signals that fire together. Each horizon has a fast and a slow learner; "relearning" = the fast one leads because the market changed. Hover for numbers.</div>`);
  }
  function forecastHtml(asset) {
    const F = forecast(asset); if (!F) return "";
    const cv = getComputedStyle(document.documentElement), up = cv.getPropertyValue("--bull").trim() || cv.getPropertyValue("--up").trim(), dn = cv.getPropertyValue("--bear").trim() || cv.getPropertyValue("--down").trim();
    const pp = p => `<b style="color:${p >= 0.5 ? up : dn}">${Math.round(p * 100)}%</b>`;
    return `<span style="font:12px var(--mono)">Signal web P(up): 1h ${pp(F.ph[1])} · 4h ${pp(F.ph[4])} · 24h ${pp(F.ph[24])}${F.ready ? "" : ` <span style="opacity:.6">(learning, ${F.n}/100)</span>`} · drivers: ${F.contrib.slice(0, 3).map(c => `${c.label} ${c.c >= 0 ? "+" : ""}${c.c.toFixed(2)}`).join(", ")}</span>`;
  }
  window.Web = { emit, tick, ingest, forecast, forecastHtml, render, nodes, edges, stats, addPrice: f => PRICE.push(f), data: () => D };
  setInterval(tick, 60000); setTimeout(tick, 15000);
})();
