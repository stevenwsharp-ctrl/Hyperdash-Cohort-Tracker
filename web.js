/* Signal Web · shared by Cohort Sniper and SOXX Sniper (same file in both repos, same browser storage on github.io).
   Every signal on both sites (cohort gap, specialists, market-maker inventory, whale moves, rebalance flow, tested
   session rules, the semis basket, ...) is a node. Every 30 minutes each asset gets a snapshot of all its live signals
   and its price. Four hours later the snapshot is scored against what price did. From the scored snapshots the web:
     - learns a weight for each node with online logistic regression (it keeps learning as long as either site is open),
     - measures each node alone (hit rate, edge) and each pair of nodes (how often they agree, and how they do together),
     - forecasts each asset: P(up in 4h) from the live signals and the learned weights.
   Assets: tickers without venue (NVDA, SOXL, BTC). SOXL, SOXX and SOXS (inverted) also feed one "SEMIS" asset,
   so both sites' semis signals train the same part of the web. */
(function () {
  "use strict";
  if (window.Web) return;
  const KEY = "web_v1", H = 4 * 36e5, BUCKET = 30 * 6e4, LR = 0.05, L2 = 0.001;
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  let D = lsG(KEY, null); if (!D || D.v !== 1) D = { v: 1, w: {}, b: 0, n: 0, S: [], at: Date.now() };   // w: weights, S: snapshots
  // A = what has been learned, kept compact so years of history fit: per node and per pair of nodes.
  // hist = how far each past-data source has been read (so nothing is learned twice).
  if (!D.A) D.A = { N: {}, P: {} }; if (!D.hist) D.hist = {};
  const LIVE = {};                // asset -> { sig -> { v, t, label } }
  const PRICE = [];               // price functions registered by the sites
  const LABEL = lsG("web_labels", {});
  const SEMIS = { SOXL: 1, SOXX: 1, SOXS: -1 };
  const norm = a => String(a || "").toUpperCase().replace(/^[A-Z]+:/, "");
  const sig = x => 1 / (1 + Math.exp(-x));
  const save = () => { D.at = Date.now(); if (D.S.length > 4000) D.S = D.S.slice(-4000); lsS(KEY, D); };

  // a site reports a signal: id (e.g. "cohort.gap"), asset, value -1..1 (+ = up), label for people
  function emit(id, asset, v, label) {
    if (!isFinite(v) || !id) return; v = Math.round(Math.max(-1, Math.min(1, v)) * 100) / 100; if (!v) return;
    const add = (a, val) => { (LIVE[a] = LIVE[a] || {})[id] = { v: val, t: Date.now() }; };
    const a = norm(asset); add(a, v); if (SEMIS[a]) add("SEMIS", v * SEMIS[a]);
    if (label && LABEL[id] !== label) { LABEL[id] = label; lsS("web_labels", LABEL); }
  }
  const price = a => { for (const f of PRICE) { try { const p = f(a); if (p > 0) return p; } catch (e) { } } if (a === "SEMIS") return price("SOXX") || price("SOXL"); return null; };
  const feats = a => { const L = LIVE[a] || {}, now = Date.now(), x = {}; for (const [k, o] of Object.entries(L)) if (now - o.t < 2 * BUCKET) x[k] = o.v; return x; };
  function predict(x) { let z = D.b; for (const k in x) z += (D.w[k] || 0) * x[k]; return sig(z); }

  // every minute: take snapshots, score the old ones, train
  function tick() {
    // both sites write the same store: start from the newest saved copy so neither site drops the other's lessons
    const fresh = lsG(KEY, null); if (fresh && fresh.v === 1 && fresh.at >= D.at) D = fresh;
    const now = Date.now(), bk = Math.floor(now / BUCKET);
    // 1. snapshot each asset once per 30 minutes
    for (const a of Object.keys(LIVE)) {
      const x = feats(a); if (!Object.keys(x).length) continue;
      const ex = D.S.find(s => s.a === a && s.bk === bk);
      if (ex) { if (ex.r == null) Object.assign(ex.x, x); continue; }   // the other site already took this snapshot: join our signals to it
      const px = price(a); if (!px) continue;
      D.S.push({ a, bk, t: now, px, x, p: Math.round(predict(x) * 1000) / 1000 });
    }
    // 2. score snapshots that are 4 hours old, and train on them (online logistic regression, L2)
    let trained = 0;
    for (const s of D.S) {
      if (s.r != null || now - s.t < H) continue;
      if (now - s.t > H + 3 * 36e5) { s.r = NaN; continue; }   // nobody had a price at the 4h mark
      const px = price(s.a); if (!px) continue;
      s.r = px / s.px - 1; if (Math.abs(s.r) < 0.001) continue;  // flat: no lesson
      learn(s.x, s.r, s.p); trained++;
    }
    if (trained || D.S.length) save();
  }
  // one lesson: train the weights, add to the node and pair records
  function learn(x, r, p0, lr) {
    const y = r > 0 ? 1 : 0, p = predict(x), g = y - p, k = Object.keys(x).filter(q => x[q]);
    D.b += (lr || LR) * g; for (const q of k) D.w[q] = (D.w[q] || 0) * (1 - L2) + (lr || LR) * g * x[q];
    D.n++;
    const A = D.A; A.calls = (A.calls || 0) + 1; if ((p0 != null ? p0 : p) > 0.5 === r > 0) A.right = (A.right || 0) + 1;
    for (const q of k) { const o = A.N[q] = A.N[q] || [0, 0, 0]; o[0]++; if (Math.sign(x[q]) === Math.sign(r)) o[1]++; o[2] += Math.sign(x[q]) * Math.max(-0.2, Math.min(0.2, r)); }
    for (let i = 0; i < k.length; i++) for (let j = i + 1; j < k.length; j++) { const a = k[i] < k[j] ? k[i] : k[j], b = k[i] < k[j] ? k[j] : k[i], e = A.P[a + "|" + b] = A.P[a + "|" + b] || [0, 0, 0];
      e[0]++; if (Math.sign(x[a]) === Math.sign(x[b])) { e[1]++; if (Math.sign(x[a]) === Math.sign(r)) e[2]++; } }
  }
  /* Past data: a site hands over old snapshots it can rebuild from its own stored history (Cohort Sniper: 7 days of
     5-minute cohort snapshots; SOXX Sniper: 2 years of SOXL sessions). Each item: { t, a, x, r } with r = the move
     over about 4 hours after t. Items older than what this source already gave are skipped. Several passes, oldest first. */
  function ingest(src, items, label) {
    const last = D.hist[src] ? D.hist[src].t : 0, L = items.filter(it => it.t > last && isFinite(it.r) && Math.abs(it.r) >= 0.001 && Object.keys(it.x).length).sort((a, b) => a.t - b.t);
    if (!L.length) return 0;
    const fresh = lsG(KEY, null); if (fresh && fresh.v === 1 && fresh.at >= D.at) { D = fresh; if (!D.A) D.A = { N: {}, P: {} }; if (!D.hist) D.hist = {}; }
    L.forEach(it => { for (const k in it.x) it.x[k] = Math.round(Math.max(-1, Math.min(1, it.x[k])) * 100) / 100; learn(it.x, it.r, null, LR * 0.5); });
    D.hist[src] = { t: L[L.length - 1].t, n: (D.hist[src] ? D.hist[src].n : 0) + L.length, label: label || src, at: Date.now() };
    save(); return L.length;
  }

  // ---------- what the web knows ----------
  function nodes() {
    const N = {};
    for (const [k, o] of Object.entries(D.A.N)) N[k] = { id: k, n: o[0], hit: o[1], edge: o[2] };
    Object.values(N).forEach(o => { o.hitR = o.n ? o.hit / o.n : 0; o.edgeM = o.n ? o.edge / o.n : 0; o.w = D.w[o.id] || 0; o.label = LABEL[o.id] || o.id; });
    for (const id of new Set([].concat(...Object.values(LIVE).map(L => Object.keys(L))))) if (!N[id]) N[id] = { id, n: 0, hitR: 0, edgeM: 0, w: D.w[id] || 0, label: LABEL[id] || id };
    return N;
  }
  function edges() {
    const E = {};
    for (const [k, e] of Object.entries(D.A.P)) { const [a, b] = k.split("|"); E[k] = { a, b, n: e[0], agree: e[1], both: e[1], bothHit: e[2] }; }
    // live links too: signals that are on at the same time on the same assets (before any result exists)
    const now = Date.now();
    for (const L of Object.values(LIVE)) { const ks = Object.keys(L).filter(k => now - L[k].t < 2 * BUCKET); for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) {
      const a = ks[i] < ks[j] ? ks[i] : ks[j], b = ks[i] < ks[j] ? ks[j] : ks[i], k = a + "|" + b, e = E[k] = E[k] || { a, b, n: 0, agree: 0, both: 0, bothHit: 0, live: 0 };
      if (e.live == null) e.live = 0; e.live++; e.n++; if (Math.sign(L[a].v) === Math.sign(L[b].v)) e.agree++; } }
    return Object.values(E).map(e => ({ ...e, agreeR: e.n ? e.agree / e.n : 0, bothR: e.both ? e.bothHit / e.both : null }));
  }
  function forecast(asset) {
    const a = norm(asset), x = feats(a); if (!Object.keys(x).length) return null;
    const p = predict(x), contrib = Object.entries(x).map(([k, v]) => ({ id: k, label: LABEL[k] || k, v, c: (D.w[k] || 0) * v })).sort((m, n) => Math.abs(n.c) - Math.abs(m.c));
    return { p, n: D.n, ready: D.n >= 100, contrib };
  }
  const stats = () => { const done = D.S.filter(s => isFinite(s.r) && Math.abs(s.r) >= 0.001);
    return { snaps: D.S.length, scored: done.length, trained: D.n, hit: D.A.calls ? (D.A.right || 0) / D.A.calls : null, open: D.S.filter(s => s.r == null).length, assets: Object.keys(LIVE).length, hist: D.hist }; };

  // ---------- picture: a force-laid web of nodes and links ----------
  function render(el, opts) {
    if (!el) return; opts = opts || {};
    const N = nodes(), E = edges().filter(e => e.n >= 5), st = stats();
    const cv = getComputedStyle(document.documentElement), col = k => cv.getPropertyValue(k).trim();
    const up = col("--bull") || col("--up") || "#19d38a", dn = col("--bear") || col("--down") || "#ff4d5e", line = col("--line") || "#333", ink = col("--text") || col("--ink") || "#ddd", dim = col("--dim") || "#888";
    const L = Object.values(N).sort((a, b) => b.n - a.n).slice(0, 40), idx = new Map(L.map((n, i) => [n.id, i]));
    const W = el.clientWidth || 800, Ht = opts.h || 360;
    // layout: fixed-seed force simulation
    const P = L.map((n, i) => ({ x: W / 2 + Math.cos(i * 2.4) * (60 + i * 6), y: Ht / 2 + Math.sin(i * 2.4) * (40 + i * 4), vx: 0, vy: 0 }));
    const links = E.filter(e => idx.has(e.a) && idx.has(e.b)).map(e => ({ i: idx.get(e.a), j: idx.get(e.b), s: e.agreeR, e }));
    for (let it = 0; it < 220; it++) {
      for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d2 = dx * dx + dy * dy + 0.01, f = 350 / d2; P[i].vx += dx * f; P[i].vy += dy * f; P[j].vx -= dx * f; P[j].vy -= dy * f; }
      links.forEach(l => { const a = P[l.i], b = P[l.j], dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1, k = (d - (140 - 90 * l.s)) * 0.004; a.vx += dx / d * k * d; a.vy += dy / d * k * d; b.vx -= dx / d * k * d; b.vy -= dy / d * k * d; });
      P.forEach(p => { p.vx += (W / 2 - p.x) * 0.01; p.vy += (Ht / 2 - p.y) * 0.012; p.x += Math.max(-8, Math.min(8, p.vx * 0.1)); p.y += Math.max(-8, Math.min(8, p.vy * 0.1)); p.vx *= 0.6; p.vy *= 0.6; p.x = Math.max(30, Math.min(W - 30, p.x)); p.y = Math.max(20, Math.min(Ht - 20, p.y)); });
    }
    const svgL = links.map(l => `<line x1="${P[l.i].x.toFixed(1)}" y1="${P[l.i].y.toFixed(1)}" x2="${P[l.j].x.toFixed(1)}" y2="${P[l.j].y.toFixed(1)}" stroke="${l.e.bothR == null ? line : l.e.bothR >= 0.5 ? up : dn}" stroke-opacity="${(0.15 + 0.6 * Math.min(1, l.e.n / 60)).toFixed(2)}" stroke-width="${(0.5 + 2.5 * l.s).toFixed(1)}"><title>${l.e.a} + ${l.e.b}: agree ${Math.round(l.s * 100)}% of ${l.e.n}; together right ${l.e.bothR == null ? "–" : Math.round(l.e.bothR * 100) + "%"}</title></line>`).join("");
    const svgN = L.map((n, i) => { const r = 5 + Math.min(16, Math.sqrt(n.n) * 1.4), c = n.n < 10 ? dim : n.hitR >= 0.5 ? up : dn;
      return `<g><circle cx="${P[i].x.toFixed(1)}" cy="${P[i].y.toFixed(1)}" r="${r.toFixed(1)}" fill="${c}" fill-opacity="${n.n < 10 ? 0.35 : (0.35 + Math.min(0.6, Math.abs(n.hitR - 0.5) * 4)).toFixed(2)}" stroke="${c}"><title>${n.label}\nchecks ${n.n} · right ${Math.round(n.hitR * 100)}% · avg edge ${(n.edgeM * 100).toFixed(2)}% · learned weight ${n.w.toFixed(2)}</title></circle>
        <text x="${P[i].x.toFixed(1)}" y="${(P[i].y + r + 10).toFixed(1)}" fill="${ink}" font-size="10" text-anchor="middle" font-family="var(--mono)">${String(n.label).slice(0, 22)}</text></g>`; }).join("");
    const top = Object.values(N).filter(n => n.n >= 10).sort((a, b) => Math.abs(b.hitR - 0.5) * Math.sqrt(b.n) - Math.abs(a.hitR - 0.5) * Math.sqrt(a.n)).slice(0, 8);
    el.innerHTML = `<div style="font:12px var(--mono);color:${dim};margin-bottom:6px">${D.n.toLocaleString()} lessons learned${Object.values(st.hist).length ? ` (past data: ${Object.values(st.hist).map(h => `${h.label} ${h.n.toLocaleString()}`).join(", ")})` : ""} · ${st.snaps} live snapshots · ${st.scored} scored · ${st.open} waiting for their 4h result · ${Object.keys(N).length} signals · ${st.assets} assets live${st.hit != null ? ` · web's own calls right ${Math.round(st.hit * 100)}%` : ""}${D.n < 100 ? ` · learning: ${D.n}/100 scored before the forecast counts` : ""}</div>
      <svg viewBox="0 0 ${W} ${Ht}" width="100%" height="${Ht}" style="display:block;border:1px solid ${line};border-radius:12px">${svgL}${svgN}</svg>
      <div style="font:11.5px var(--mono);color:${dim};margin-top:6px">Node = a signal (size = how often it was scored; green = right more than half the time, red = wrong more often, grey = under 10 checks). Link = two signals live on the same asset at the same time (thicker = they agree more; green = right when they agree). Hover for numbers.</div>
      ${top.length ? `<div style="font:12px var(--mono);margin-top:6px">${top.map(n => `<div><b style="color:${n.hitR >= 0.5 ? up : dn}">${Math.round(n.hitR * 100)}%</b> of ${n.n} · ${n.label} · weight ${n.w.toFixed(2)}</div>`).join("")}</div>` : ""}`;
  }
  function forecastHtml(asset) {
    const F = forecast(asset); if (!F) return "";
    const cv = getComputedStyle(document.documentElement), up = cv.getPropertyValue("--bull").trim() || cv.getPropertyValue("--up").trim(), dn = cv.getPropertyValue("--bear").trim() || cv.getPropertyValue("--down").trim();
    return `<span style="font:12px var(--mono)">Signal web: <b style="color:${F.p >= 0.5 ? up : dn}">P(up 4h) ${Math.round(F.p * 100)}%</b>${F.ready ? "" : ` <span style="opacity:.6">(learning, ${F.n}/100)</span>`} · drivers: ${F.contrib.slice(0, 3).map(c => `${c.label} ${c.c >= 0 ? "+" : ""}${c.c.toFixed(2)}`).join(", ")}</span>`;
  }
  window.Web = { emit, tick, ingest, forecast, forecastHtml, render, nodes, edges, stats, addPrice: f => PRICE.push(f), data: () => D };
  setInterval(tick, 60000); setTimeout(tick, 15000);
})();
