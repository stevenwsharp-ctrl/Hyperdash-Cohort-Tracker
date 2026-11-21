/* Cohort Sniper · Cohort Flow page (flow.html)
   TradingView Lightweight Charts 4.2 (Apache-2.0). Candles and volume from Hyperliquid (candleSnapshot, live).
   Cohort flows from the cohort book (cohort branch, cf/<COIN>.json, written by scripts/cohortbook.mjs):
   per candle, how much each cohort added or cut on the long side and on the short side, price-adjusted.
   Shows: two flow panes (cohort A, cohort B), a net position pane, a cohort volume profile (buys / sells by price),
   estimated average entry lines, big-flow markers, a range summary for all cohorts, and a scanner of all markets.
   Drawing tools: trend, extended line, ray, level, alert line, channel, zone, Fibonacci, long / short, measure. */
(function () {
  "use strict";
  const LW = window.LightweightCharts;
  const API = "https://api.hyperliquid.xyz/info";
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lsG = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  window.LIVE_T = 0;   // heartbeat for site.js
  if (!LW) { $("fcMount").innerHTML = `<div class="empty">The chart library did not load. Check the connection and reload.</div>`; return; }

  // ---------- data locations ----------
  function repo() {
    const h = location.hostname;
    if (h.endsWith(".github.io")) { let r = location.pathname.split("/").filter(Boolean)[0]; if (!r || /\.html?$/.test(r)) r = h; return { owner: h.split(".")[0], repo: r }; }
    return null;
  }
  function cfBase() {
    const q = new URLSearchParams(location.search).get("cf"); if (q) return q.replace(/\/?$/, "/");
    const r = repo(); return r ? `https://raw.githubusercontent.com/${r.owner}/${r.repo}/cohort/cf/` : "./cf/";
  }
  function dataBase() {
    const q = new URLSearchParams(location.search).get("data"); if (q) return q.replace(/\/?$/, "/");
    const r = repo(); return r ? `https://raw.githubusercontent.com/${r.owner}/${r.repo}/data/` : "./data/";
  }
  const getJson = async name => { const r = await fetch(cfBase() + name + "?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" }); if (!r.ok) throw new Error(name + ": HTTP " + r.status); return r.json(); };
  const hl = body => fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });

  // ---------- settings ----------
  const TF = { "5m": { s: 300, d: 12 }, "15m": { s: 900, d: 37 }, "30m": { s: 1800, d: 45 }, "1h": { s: 3600, d: 60 }, "2h": { s: 7200, d: 90 }, "4h": { s: 14400, d: 150 },
    "8h": { s: 28800, d: 300 }, "12h": { s: 43200, d: 400 }, "1d": { s: 86400, d: 800 }, "3d": { s: 259200, d: 1500 }, "1w": { s: 604800, d: 2500 } };
  const IND_LIST = [["vol", "Volume (exact, all traders)"], ["prof", "Cohort profile: buys / sells by price"], ["mvp", "Market volume profile (left edge)"], ["basis", "Est. entry lines (longs L, shorts S)"],
    ["marks", "Big-flow markers"], ["book", "Order book now (all resting orders, left edge)"], ["heat", "Order book heatmap over time (where orders wait)"], ["ords", "Top holders' resting orders (good vs bad: entries, stops, targets)"], ["ema", "EMA 21 / 50"], ["fa", "Flow pane: cohort A"], ["fb", "Flow pane: cohort B"], ["pos", "Net position pane (A and B)"]];
  let O = { coin: "BTC", tf: "1h", a: "sm", b: "fo", ind: { vol: 1, prof: 1, mvp: 0, basis: 1, marks: 1, ema: 0, fa: 1, fb: 1, pos: 1, book: 1, heat: 1, ords: 1 }, draw: {} };
  try { const x = JSON.parse(lsG("cs_flow") || "null"); if (x) O = { ...O, ...x, ind: { ...O.ind, ...(x.ind || {}) }, draw: x.draw || {} }; } catch (e) { }
  const qp = new URLSearchParams(location.search); if (qp.get("c")) O.coin = qp.get("c"); if (TF[qp.get("tf")]) O.tf = qp.get("tf");
  if (!TF[O.tf]) O.tf = "1h";
  const save = () => lsS("cs_flow", JSON.stringify(O));

  // ---------- styles and DOM ----------
  const css = `
#fcWrap{display:flex;flex-direction:column;gap:6px}
#fcWrap.fcfs{position:fixed;inset:0;z-index:300;background:var(--bg);padding:10px 12px;overflow:auto}
.fcbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.fcbar .grp{display:flex;flex-wrap:wrap;gap:2px;padding:2px;border:1px solid var(--line);border-radius:9px;background:var(--panel2)}
.fcbar button{font:12px var(--mono);padding:4px 8px;border-radius:7px;border:1px solid transparent;background:transparent;color:var(--text);cursor:pointer}
.fcbar .grp button.on{background:var(--panel);border-color:var(--accent);color:var(--accent)}
.fcbar>button{border-color:var(--line);background:var(--panel)}
.fcsp{flex:1}
.fcmain{position:relative;height:520px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel)}
.fcpane{position:relative;height:120px;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--panel)}
.fcfs .fcmain{height:58vh}
.fcov{position:absolute;left:0;top:0;pointer-events:none;z-index:3}
.fcleg{position:absolute;left:10px;top:8px;z-index:4;font:12px var(--mono);line-height:1.55;pointer-events:none;text-shadow:0 0 3px var(--panel);max-width:calc(100% - 100px)}
.fcleg .s{font-weight:700;font-size:13px;margin-right:6px}.fcleg .k{color:var(--dim)}
.fcpleg{position:absolute;left:10px;top:4px;z-index:4;font:11px var(--mono);color:var(--dim);pointer-events:none;text-shadow:0 0 3px var(--panel)}
.fcstat{font:11px var(--mono);color:var(--dim)}
.fcmenu{position:absolute;z-index:20;right:12px;top:44px;width:min(320px,calc(100vw - 32px));padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--panel);box-shadow:0 10px 30px rgba(0,0,0,.35)}
.fcmenu label{display:flex;gap:8px;align-items:center;padding:3px 2px;font-size:13px;cursor:pointer}
@media (max-width:700px){.fcmain{height:380px}.fcpane{height:100px}.fcbar button{padding:4px 6px}}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const col = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim() || "#888";
  const T = () => ({ bg: col("--panel"), line: col("--line"), text: col("--text"), dim: col("--dim"), up: col("--bull"), dn: col("--bear"), acc: col("--accent"), warn: col("--warn") });
  const alpha = (c, a) => c.startsWith("#") && c.length === 7 ? c + Math.round(a * 255).toString(16).padStart(2, "0") : c;

  const wrap = document.createElement("div"); wrap.id = "fcWrap"; wrap.style.position = "relative";
  wrap.innerHTML = `<div class="fcbar">
    <div class="grp" id="fcTf">${Object.keys(TF).map(k => `<button data-tf="${k}">${k}</button>`).join("")}</div>
    <div class="grp" id="fcTools">
      <button data-tool="" title="Select a drawing (Delete removes it)">↖</button><button data-tool="trend" title="Trend line">╱</button><button data-tool="xline" title="Extended line">⟋</button><button data-tool="ray" title="Ray">→</button>
      <button data-tool="hline" title="Horizontal level">—</button><button data-tool="alert" title="Alert line: alert when price crosses">🔔</button><button data-tool="chan" title="Parallel channel">▱</button><button data-tool="rect" title="Zone">▭</button>
      <button data-tool="fib" title="Fibonacci retracement">ƒ</button><button data-tool="long" title="Long position (entry, then target)">▲</button><button data-tool="short" title="Short position (entry, then target)">▼</button><button data-tool="measure" title="Measure">⇕</button></div>
    <button id="fcInd">Layers ▾</button><button id="fcClr" title="Remove all drawings on this market">Clear</button><button id="fcShot" title="Save a picture">Snapshot</button><button id="fcFs" title="Full screen">⤢</button>
    <span class="fcsp"></span><span class="fcstat" id="fcStat"></span></div>
  <div class="fcmain" id="fcMain"><canvas class="fcov" id="fcOv"></canvas><div class="fcleg" id="fcLeg"></div></div>
  <div class="fcpane" id="fcPA"><div class="fcpleg" id="fcLA"></div></div>
  <div class="fcpane" id="fcPB"><div class="fcpleg" id="fcLB"></div></div>
  <div class="fcpane" id="fcPP"><div class="fcpleg" id="fcLP"></div></div>
  <div class="fcmenu" id="fcMenu" hidden></div>`;
  $("fcMount").appendChild(wrap);
  const $m = id => wrap.querySelector("#" + id);

  const tzOff = () => new Date().getTimezoneOffset() * 60;
  const fmtT = s => new Date(s * 1000).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  const opts = () => { const t = T(); return { autoSize: true, layout: { background: { color: t.bg }, textColor: t.dim, fontFamily: "IBM Plex Mono, ui-monospace, monospace", fontSize: 11 },
    rightPriceScale: { borderColor: t.line, minimumWidth: 80 }, leftPriceScale: { borderColor: t.line, visible: false },
    grid: { vertLines: { color: alpha(t.line, 0.5) }, horzLines: { color: alpha(t.line, 0.5) } }, crosshair: { mode: LW.CrosshairMode.Normal },
    localization: { timeFormatter: fmtT },
    timeScale: { borderColor: t.line, timeVisible: true, secondsVisible: false, rightOffset: 6,
      tickMarkFormatter: (s, type) => { const d = new Date(s * 1000); return type <= 1 ? d.toLocaleDateString([], type === 0 ? { year: "numeric" } : { month: "short" }) : type === 2 ? d.toLocaleDateString([], { month: "short", day: "numeric" }) : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); } } }; };
  const chart = LW.createChart($m("fcMain"), opts()), pA = LW.createChart($m("fcPA"), opts()), pB = LW.createChart($m("fcPB"), opts()), pP = LW.createChart($m("fcPP"), opts());
  pP.applyOptions({ leftPriceScale: { visible: true, borderColor: T().line } });
  const S = {};
  (function build() {
    const t = T();
    S.c = chart.addCandlestickSeries({ upColor: t.up, downColor: t.dn, borderUpColor: t.up, borderDownColor: t.dn, wickUpColor: t.up, wickDownColor: t.dn });
    S.v = chart.addHistogramSeries({ priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.84, bottom: 0 } });
    S.e21 = chart.addLineSeries({ color: "#c58af0", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    S.e50 = chart.addLineSeries({ color: "#22c3e6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const vf = { type: "custom", formatter: v => usdS(v), minMove: 1 };
    S.fa = pA.addHistogramSeries({ priceFormat: vf, priceLineVisible: false });
    S.fb = pB.addHistogramSeries({ priceFormat: vf, priceLineVisible: false });
    S.pa = pP.addLineSeries({ color: t.acc, lineWidth: 2, priceFormat: vf, priceLineVisible: false, priceScaleId: "right" });
    S.pb = pP.addLineSeries({ color: t.warn, lineWidth: 2, priceFormat: vf, priceLineVisible: false, priceScaleId: "left" });
  })();
  const charts = [chart, pA, pB, pP];
  let syncing = false;
  charts.forEach(c => c.timeScale().subscribeVisibleLogicalRangeChange(r => { if (syncing || !r) return; syncing = true; charts.forEach(o => { if (o !== c) try { o.timeScale().setVisibleLogicalRange(r); } catch (e) { } }); syncing = false; ovDirty = true; sumDirty = true; }));

  // ---------- formatting ----------
  function usdS(n) { if (!isFinite(n)) return "--"; const a = Math.abs(n); return (n < 0 ? "−$" : "$") + (a >= 1e9 ? (a / 1e9).toFixed(2) + "B" : a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + "K" : Math.round(a)); }
  const sgnU = n => !isFinite(n) || Math.abs(n) < 0.5 ? `<span class="mut">$0</span>` : `<span class="${n > 0 ? "up" : "dn"}">${n > 0 ? "+" : ""}${usdS(n)}</span>`;
  const fp = p => !isFinite(p) || !p ? "--" : p >= 1000 ? p.toLocaleString(undefined, { maximumFractionDigits: 0 }) : p >= 1 ? p.toFixed(p >= 100 ? 2 : 3) : p.toPrecision(4);
  const pct = (v, d = 1) => !isFinite(v) ? "--" : (v > 0 ? "+" : "") + (v * 100).toFixed(d) + "%";
  function stat(s) { $m("fcStat").textContent = s; }

  // ---------- cohort groups ----------
  let INDEX = null, BOOK = null, B = [], loading = false, err = "", ovDirty = true, sumDirty = true, tool = null, pend = null, sel = -1, plines = [], lastP = NaN, lastMeasure = null;
  let LV = null, OB = null, LIVEOB = [];   // levels.json (top holders' orders), current order book, live book samples
  const SMART = ["extremely_profitable", "very_profitable"], FOOLS = ["unprofitable", "very_unprofitable", "rekt"];
  function groups(co, lb, np) {
    const g = [["sm", "Smart (Extremely + Very Profitable)"], ["fo", "Fools (Unprofitable + Very Unprofitable + Rekt)"], ["all", "All traders"]];
    co.forEach((id, i) => g.push(["c" + i, (i < np ? "" : "Size: ") + lb[i]]));
    return g;
  }
  const shortName = k => k === "sm" ? "Smart" : k === "fo" ? "Fools" : k === "all" ? "All traders" : (BOOK || INDEX) ? (BOOK || INDEX).lb[+k.slice(1)] : k;
  function members(k, co, np) {
    if (k === "sm") return SMART.map(id => co.indexOf(id)).filter(i => i >= 0);
    if (k === "fo") return FOOLS.map(id => co.indexOf(id)).filter(i => i >= 0);
    if (k === "all") return co.map((_, i) => i).filter(i => i >= np);
    const i = +k.slice(1); return i >= 0 && i < co.length ? [i] : [];
  }
  // Points of one group: {t, px, L, S, nL, nS} ($K), or {t, px, N} for net-only back-fill (fools).
  function points(k) {
    if (!BOOK) return [];
    const P = [];
    if (BOOK.bf && (k === "sm" || k === "fo" || k === "all")) for (const r of BOOK.bf) {
      const t = r[0] * 6e4, px = r[1]; if (!(px > 0)) continue;
      if (k === "sm") P.push({ t, px, L: r[2], S: r[3], bf: 1 }); else if (k === "fo") P.push({ t, px, N: r[4], bf: 1 }); else P.push({ t, px, L: r[5], S: r[6], bf: 1 });
    }
    const cs = members(k, BOOK.co, BOOK.np);
    for (const r of BOOK.r) { if (!(r[1] > 0)) continue; let L = 0, S = 0, nL = 0, nS = 0; for (const i of cs) { const o = 2 + i * 4; nL += r[o]; nS += r[o + 1]; L += r[o + 2]; S += r[o + 3]; } P.push({ t: r[0] * 6e4, px: r[1], L, S, nL, nS }); }
    return P;
  }
  // Flows between points, price-adjusted, with a running estimate of the average entry of open longs and shorts.
  function flows(P) {
    const F = []; let qL = null, qS = null, bL = null, bS = null;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (i) {
        const a = P[i - 1], pm = (a.px + p.px) / 2, f = { t: p.t, ta: a.t, p: pm, la: 0, lc: 0, sa: 0, sc: 0, nx: 0, lcx: 0, scx: 0, dnL: 0, dnS: 0, cnt: false };
        if (a.L != null && p.L != null) {
          const fL = (p.L / p.px - a.L / a.px) * pm * 1000, fS = (p.S / p.px - a.S / a.px) * pm * 1000;
          if (fL > 0) f.la = fL; else { f.lc = -fL; if (bL && pm < bL) f.lcx = -fL; }
          if (fS > 0) f.sa = fS; else { f.sc = -fS; if (bS && pm > bS) f.scx = -fS; }
        } else { const na = a.N != null ? a.N : a.L - a.S, nb = p.N != null ? p.N : p.L - p.S; f.nx = (nb / p.px - na / a.px) * pm * 1000; }
        if (a.nL != null && p.nL != null) { f.dnL = p.nL - a.nL; f.dnS = p.nS - a.nS; f.cnt = true; }
        F.push(f);
        if (p.L != null) {   // average entry update (adds move it, cuts do not)
          const q = p.L / p.px, s = p.S / p.px;
          if (qL == null || qL <= 1e-12) bL = q > 0 ? pm : null; else if (q > qL) bL = (bL * qL + pm * (q - qL)) / q;
          if (qS == null || qS <= 1e-12) bS = s > 0 ? pm : null; else if (s > qS) bS = (bS * qS + pm * (s - qS)) / s;
          qL = q; qS = s;
        }
      } else if (p.L != null) { qL = p.L / p.px; qS = p.S / p.px; bL = qL > 0 ? p.px : null; bS = qS > 0 ? p.px : null; }
      p.bL = bL; p.bS = bS; p.net = (p.N != null ? p.N : p.L - p.S) * 1000;
    }
    return F;
  }
  const G = {};   // cache per group key: {P, F}
  function grp(k) { if (!G[k]) { const P = points(k); G[k] = { P, F: flows(P) }; } return G[k]; }
  const buyOf = f => f.la + f.sc + Math.max(f.nx, 0), sellOf = f => f.lc + f.sa + Math.max(-f.nx, 0), netOf = f => f.la - f.lc - f.sa + f.sc + f.nx;

  // ---------- candles ----------
  const tsec = ms => Math.floor(ms / 1000);
  const barMs = () => TF[O.tf].s * 1000;
  function idxAt(ms) { let lo = 0, hi = B.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (B[m].t <= ms) { k = m; lo = m + 1; } else hi = m - 1; } return k; }
  const hlName = () => (BOOK && BOOK.n) || (INDEX && INDEX.m[O.coin] && INDEX.m[O.coin].n) || O.coin;
  async function loadCandles(full) {
    if (loading) return; loading = true;
    try {
      const tf = TF[O.tf], end = Date.now(), start = full || !B.length ? end - tf.d * 864e5 : B[Math.max(0, B.length - 3)].t;
      const c = await hl({ type: "candleSnapshot", req: { coin: hlName(), interval: O.tf, startTime: start, endTime: end } });
      const nb = (c || []).map(x => ({ t: x.t, o: +x.o, h: +x.h, l: +x.l, c: +x.c, v: +x.v * +x.c, n: +x.n || 0 }));
      if (full || !B.length) B = nb; else { const t0 = nb.length ? nb[0].t : Infinity; B = B.filter(b => b.t < t0).concat(nb); }
      err = B.length ? "" : "No candles for this market on Hyperliquid."; window.LIVE_T = Date.now();
      update(full);
    } catch (e) { err = "Hyperliquid did not answer: " + (e.message || e); stat(err); }
    loading = false;
  }
  async function loadBook() {
    const m = INDEX && INDEX.m[O.coin];
    try { BOOK = await getJson((m ? m.f : O.coin.replace(/[^A-Za-z0-9_-]/g, "_")) + ".json"); }
    catch (e) { BOOK = null; }
    for (const k in G) delete G[k];
  }

  // ---------- resting orders ----------
  async function loadOB() {
    try {
      const c = O.coin, j = await hl({ type: "l2Book", coin: hlName(), nSigFigs: 3 }); if (c !== O.coin || !j || !j.levels) return;
      const side = a => (a || []).map(x => [+x.px, +x.sz * +x.px]).filter(x => x[1] > 0);
      OB = { t: Date.now(), b: side(j.levels[0]), a: side(j.levels[1]) }; LIVEOB.push(OB); if (LIVEOB.length > 4000) LIVEOB.splice(0, 1000); ovDirty = true; orders();
    } catch (e) { }
  }
  async function loadLevels() { try { const r = await fetch(dataBase() + "levels.json?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" }); if (r.ok) { LV = await r.json(); orders(); ovDirty = true; } } catch (e) { } }
  // book samples: server (every 15 min, 24 h) and live (every 10 s while the page is open)
  function obSamples() {
    const S2 = []; if (BOOK && BOOK.ob) for (const r of BOOK.ob) S2.push({ t: r[0] * 6e4, b: r[1].map(x => [x[0], x[1] * 1000]), a: r[2].map(x => [x[0], x[1] * 1000]) });
    return S2.concat(LIVEOB).sort((x, y) => x.t - y.t);
  }
  const GRP = { good: "Good", bad: "Bad", mid: "Mid" };
  function holderOrders() {
    const m = LV && LV.m && LV.m[O.coin]; if (!m || !m.h) return { list: [], t: m && m.t };
    const list = []; for (const a in m.h) { const l = m.h[a]; (l.ord || []).forEach(o => list.push({ a, g: l.g || "mid", coh: l.coh, px: o[0], usd: o[1], k: o[2], sd: o[3], pos: l.sz })); }
    return { list, t: m.t };
  }
  function orders() {
    const el = $("ordT"); if (!el) return;
    const px = B.length ? B[B.length - 1].c : NaN, H = holderOrders();
    const sumBk = (arr, f) => arr.reduce((s, x) => s + (f(x[0]) ? x[1] : 0), 0);
    let bk = "";
    if (OB && isFinite(px)) { const z = [0.01, 0.02, 0.05].map(d => [d, sumBk(OB.b, p => p >= px * (1 - d)), sumBk(OB.a, p => p <= px * (1 + d))]);
      const wall = (arr) => arr.slice().sort((x, y) => y[1] - x[1])[0];
      const wb = wall(OB.b), wa = wall(OB.a);
      bk = `<div class="leg" style="margin:0 0 8px">${z.map(([d, b, a]) => `<span>±${d * 100}%: bids <b class="up">${usdS(b)}</b> · asks <b class="dn">${usdS(a)}</b> (${b + a ? Math.round((b - a) / (b + a) * 100) : 0} imbalance)</span>`).join("")}${wb ? `<span>Biggest bid ${usdS(wb[1])} at ${fp(wb[0])}</span>` : ""}${wa ? `<span>Biggest ask ${usdS(wa[1])} at ${fp(wa[0])}</span>` : ""}</div>`; }
    if (!H.list.length) { el.innerHTML = bk + `<div class="note">${LV ? "No tracked top-holder orders for this market now. The levels job checks the top 30 holders of the top setups, one market about every 45 s." : "Loading the top holders' orders…"}</div>`; return; }
    const K = { a: "Entry / add", s: "Stop", t: "Target" }, by = g => H.list.filter(o => o.g === g);
    const tot = (L, f) => L.filter(f).reduce((s, o) => s + o.usd, 0);
    const line = (g, cls) => { const L = by(g); if (!L.length) return ""; return `<span><b class="${cls}">${GRP[g]} traders</b>: buys waiting ${usdS(tot(L, o => o.sd > 0))}, sells waiting ${usdS(tot(L, o => o.sd < 0))} · stops ${usdS(tot(L, o => o.k === "s"))} · targets ${usdS(tot(L, o => o.k === "t"))} · new entries ${usdS(tot(L, o => o.k === "a"))}</span>`; };
    const L = H.list.slice().sort((x, y) => y.px - x.px);
    el.innerHTML = bk + `<div class="leg" style="margin:0 0 8px">${line("good", "A")}${line("bad", "B")}${line("mid", "")}</div><div class="tw" style="max-height:320px"><table><thead><tr><th>Price</th><th>From price</th><th>Size</th><th>Order</th><th>Type</th><th>Trader</th><th>Cohort</th><th>Position</th></tr></thead><tbody>` +
      L.map(o => `<tr${isFinite(px) && Math.abs(o.px / px - 1) < 0.01 ? ` class="hl"` : ""}><td>${fp(o.px)}</td><td class="${o.px >= px ? "up" : "dn"}">${pct(o.px / px - 1, 2)}</td><td>${usdS(o.usd)}</td><td class="${o.sd > 0 ? "up" : "dn"}">${o.sd > 0 ? "Buy" : "Sell"}</td><td>${K[o.k] || o.k}</td>
        <td style="color:${o.g === "good" ? "var(--accent)" : o.g === "bad" ? "var(--warn)" : "var(--dim)"}">${GRP[o.g]}</td><td><a href="https://hyperdash.com/address/${esc(o.a)}" target="_blank" rel="noopener">${esc(o.a.slice(0, 6) + "…" + o.a.slice(-4))}</a> <span class="mut">${esc(o.coh || "")}</span></td>
        <td class="${o.pos > 0 ? "up" : "dn"}">${o.pos > 0 ? "Long" : "Short"} ${usdS(Math.abs(o.pos * px))}</td></tr>`).join("") + `</tbody></table></div><div class="note">Top-holder orders checked ${H.t ? new Date(H.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "--"}. Good = Extremely / Very Profitable or wins on this coin; Bad = losing cohorts or loses on this coin.</div>`;
  }

  // ---------- per-candle cohort data ----------
  let CA = [], CB = [];
  function perCandle(k) {
    const out = B.map(() => ({ la: 0, lc: 0, sa: 0, sc: 0, nx: 0, lcx: 0, scx: 0, dnL: 0, dnS: 0, cnt: false, coarse: false, any: false }));
    if (!B.length) return out;
    const F = grp(k).F, end = B[B.length - 1].t + barMs();
    for (const f of F) { if (f.t <= B[0].t || f.t > end) continue; const i = idxAt(f.t - 1); if (i < 0) continue; const o = out[i];
      o.la += f.la; o.lc += f.lc; o.sa += f.sa; o.sc += f.sc; o.nx += f.nx; o.lcx += f.lcx; o.scx += f.scx; o.dnL += f.dnL; o.dnS += f.dnS; o.cnt = o.cnt || f.cnt; o.any = true;
      if (f.t - f.ta > barMs() * 1.5) o.coarse = true; }
    out.forEach(o => { o.net = o.la - o.lc - o.sa + o.sc + o.nx; });
    return out;
  }
  function posAt(k) {   // net position at each candle close (last point at or before the candle end)
    const P = grp(k).P; let j = -1; const tfm = barMs();
    return B.map(b => { const e = b.t + tfm; while (j + 1 < P.length && P[j + 1].t <= e) j++; return j >= 0 && P[j].t > b.t - 30 * 864e5 ? P[j] : null; });
  }
  const ema = (v, n) => { const k = 2 / (n + 1), o = []; let e = null; v.forEach((x, i) => { e = e == null ? x : x * k + e * (1 - k); o.push(i >= n - 1 ? e : NaN); }); return o; };

  function update(fit) {
    const t = T();
    S.c.setData(B.map(b => ({ time: tsec(b.t), open: b.o, high: b.h, low: b.l, close: b.c })));
    S.v.setData(O.ind.vol ? B.map(b => ({ time: tsec(b.t), value: b.v, color: b.c >= b.o ? alpha(t.up, 0.35) : alpha(t.dn, 0.35) })) : []);
    const cl = B.map(b => b.c), ln = arr => B.map((b, i) => isFinite(arr[i]) ? { time: tsec(b.t), value: arr[i] } : { time: tsec(b.t) });
    S.e21.setData(O.ind.ema ? ln(ema(cl, 21)) : []); S.e50.setData(O.ind.ema ? ln(ema(cl, 50)) : []);
    CA = perCandle(O.a); CB = perCandle(O.b);
    const hist = (C, up, dn) => B.map((b, i) => { const o = C[i]; if (!o.any) return { time: tsec(b.t) };
      const opened = o.net >= 0 ? o.la : o.sa, closed = o.net >= 0 ? o.sc : o.lc;   // bright when mostly opening, pale when mostly closing
      const a = o.nx ? 0.55 : opened >= closed ? 0.9 : 0.45; return { time: tsec(b.t), value: o.net, color: alpha(o.net >= 0 ? up : dn, a) }; });
    $m("fcPA").style.display = O.ind.fa ? "" : "none"; $m("fcPB").style.display = O.ind.fb ? "" : "none"; $m("fcPP").style.display = O.ind.pos ? "" : "none";
    S.fa.setData(hist(CA, t.up, t.dn)); S.fb.setData(hist(CB, t.up, t.dn));
    const PA = posAt(O.a), PB = posAt(O.b), pl = PP => B.map((b, i) => PP[i] ? { time: tsec(b.t), value: PP[i].net } : { time: tsec(b.t) });
    S.pa.setData(pl(PA)); S.pb.setData(pl(PB));
    paneLegends(null);
    markers(); levels();
    if (fit) { chart.timeScale().fitContent(); const n = B.length; if (n > 180) chart.timeScale().setVisibleLogicalRange({ from: n - 180, to: n + 6 }); }
    legend(null); ovDirty = true; sumDirty = true; checkAlerts(); orders();
    const span = BOOK && BOOK.r.length ? Math.round((BOOK.r[BOOK.r.length - 1][0] - (BOOK.bf && BOOK.bf.length ? BOOK.bf[0][0] : BOOK.r[0][0])) / 60) : 0;
    stat(`${hlName()} · ${O.tf} · ${B.length} candles · live · cohort book ${BOOK ? (span >= 48 ? Math.round(span / 24) + " days" : span + " h") + ", last " + new Date(BOOK.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "not found"}${err ? " · " + err : ""}`);
  }
  function breakdown(o, name, cls) {
    if (!o || !o.any) return `<span class="k">${esc(name)}: no snapshot in this candle</span>`;
    if (o.nx && !o.la && !o.lc && !o.sa && !o.sc) return `<b style="color:${cls}">${esc(name)}</b> net ${sgnU(o.net)} <span class="k">(back-fill, net only)</span>`;
    const p = [];
    if (o.la >= 1) p.push(`<span class="up">+L ${usdS(o.la)}</span>`); if (o.lc >= 1) p.push(`<span class="dn">−L ${usdS(o.lc)}${o.lcx >= o.lc * 0.5 ? " cut loose" : ""}</span>`);
    if (o.sa >= 1) p.push(`<span class="dn">+S ${usdS(o.sa)}</span>`); if (o.sc >= 1) p.push(`<span class="up">−S ${usdS(o.sc)}${o.scx >= o.sc * 0.5 ? " cut loose" : ""}</span>`);
    const tr = o.cnt && (o.dnL || o.dnS) ? ` <span class="k">traders L ${o.dnL >= 0 ? "+" : ""}${o.dnL} S ${o.dnS >= 0 ? "+" : ""}${o.dnS}</span>` : "";
    return `<b style="color:${cls}">${esc(name)}</b> net ${sgnU(o.net)} ${p.join(" ")}${tr}${o.coarse ? ` <span class="k">(coarse rows)</span>` : ""}`;
  }
  function legend(i) {
    const t = T();
    if (!B.length) { $m("fcLeg").innerHTML = `<span class="s">${esc(O.coin)}</span><span class="k">${esc(err || "Loading…")}</span>`; return; }
    if (i == null || i < 0 || i >= B.length) i = B.length - 1;
    const b = B[i], pc = i ? B[i - 1].c : b.o, ch = b.c / pc - 1;
    let h = `<span class="s">${esc(O.coin)}</span><span class="k">${O.tf}</span> <span class="k">O</span> ${fp(b.o)} <span class="k">H</span> ${fp(b.h)} <span class="k">L</span> ${fp(b.l)} <span class="k">C</span> <span style="color:${ch >= 0 ? t.up : t.dn}">${fp(b.c)} ${pct(ch, 2)}</span> <span class="k">Vol</span> ${usdS(b.v)}${b.n ? ` <span class="k">${b.n.toLocaleString()} trades</span>` : ""}`;
    const share = o => o && o.any && b.v ? ` <span class="k">(${(Math.abs(o.net) / b.v * 100).toFixed(1)}% of vol)</span>` : "";
    h += `<br>${breakdown(CA[i], shortName(O.a), t.acc)}${share(CA[i])}<br>${breakdown(CB[i], shortName(O.b), t.warn)}${share(CB[i])}`;
    $m("fcLeg").innerHTML = h;
  }
  function paneLegends(i) {
    const n = B.length; if (i == null || i < 0 || i >= n) i = n - 1;
    const a = CA[i], b = CB[i];
    $m("fcLA").innerHTML = `<b style="color:${T().acc}">${esc(shortName(O.a))}</b> flow per candle (up = bought, down = sold; bright = opening, pale = closing) ${a && a.any ? "· " + sgnU(a.net) : ""}`;
    $m("fcLB").innerHTML = `<b style="color:${T().warn}">${esc(shortName(O.b))}</b> flow per candle ${b && b.any ? "· " + sgnU(b.net) : ""}`;
    const PA = grp(O.a).P, PB = grp(O.b).P, la = PA[PA.length - 1], lb = PB[PB.length - 1];
    $m("fcLP").innerHTML = `Net position (long − short): <b style="color:${T().acc}">${esc(shortName(O.a))}</b> ${la ? sgnU(la.net) : "--"} (right scale) · <b style="color:${T().warn}">${esc(shortName(O.b))}</b> ${lb ? sgnU(lb.net) : "--"} (left scale)`;
  }
  function markers() {
    const mk = [], t = T();
    if (O.ind.marks && B.length) [[CA, O.a, t.acc], [CB, O.b, t.warn]].forEach(([C, k, c]) => {
      const v = C.filter(o => o.any).map(o => Math.abs(o.net)); if (v.length < 12) return;
      const m = v.reduce((s, x) => s + x, 0) / v.length, sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length), th = m + 2.5 * sd;
      const L = []; C.forEach((o, i) => { if (o.any && Math.abs(o.net) >= th && Math.abs(o.net) > 0) L.push(i); });
      L.sort((x, y) => Math.abs(C[y].net) - Math.abs(C[x].net)).slice(0, 40).forEach(i => { const o = C[i], buy = o.net > 0, cut = buy ? o.scx > o.sc * 0.5 && o.sc > o.la : o.lcx > o.lc * 0.5 && o.lc > o.sa;
        const nm = k === "sm" ? "S" : k === "fo" ? "F" : shortName(k).slice(0, 3);
        mk.push({ time: tsec(B[i].t), position: buy ? "belowBar" : "aboveBar", color: c, shape: buy ? "arrowUp" : "arrowDown", text: `${nm}${cut ? " cut" : ""} ${buy ? "+" : "−"}${usdS(Math.abs(o.net)).replace("$", "")}` }); });
    });
    mk.sort((a, z) => a.time - z.time); try { S.c.setMarkers(mk); } catch (e) { }
  }
  function levels() {
    plines.forEach(l => { try { S.c.removePriceLine(l); } catch (e) { } }); plines = [];
    const t = T(), add = (p, c, title, style, w) => { if (isFinite(p) && p > 0) plines.push(S.c.createPriceLine({ price: p, color: c, title, lineStyle: style ?? 2, lineWidth: w || 1, axisLabelVisible: true })); };
    if (O.ind.basis && BOOK) [[O.a, t.acc], [O.b, t.warn]].forEach(([k, c]) => { const P = grp(k).P, p = P[P.length - 1]; if (!p) return; const nm = shortName(k);
      if (p.bL && p.L > 0) add(p.bL, c, `${nm} L entry`, 2, 1); if (p.bS && p.S > 0) add(p.bS, alpha(c, 0.7), `${nm} S entry`, 1, 1); });
    drawings().forEach(d => { if (d.type === "hline" || d.type === "alert") add(d.p1.p, d.type === "alert" ? t.warn : t.acc, d.type === "alert" ? "🔔" : "", 0, sel >= 0 && drawings()[sel] === d ? 3 : 1); });
  }
  chart.subscribeCrosshairMove(param => {
    if (pend && param.point) { const p = ptFrom(param); if (p) { pend.p2 = p; ovDirty = true; } }
    const i = param.logical != null ? Math.round(param.logical) : null; legend(i); paneLegends(i);
  });

  // ---------- range summary and verdict ----------
  function visRange() {
    const r = chart.timeScale().getVisibleLogicalRange(); if (!r || !B.length) return null;
    const i0 = Math.max(0, Math.floor(r.from)), i1 = Math.min(B.length - 1, Math.ceil(r.to)); if (i1 < i0) return null;
    return { i0, i1, t0: B[i0].t, t1: B[i1].t + barMs() };
  }
  function sumGroup(k, t0, t1) {
    const { P, F } = grp(k), s = { la: 0, lc: 0, sa: 0, sc: 0, nx: 0, lcx: 0, scx: 0, dnL: 0, dnS: 0, laP: 0, saP: 0, n: 0 };
    for (const f of F) { if (f.t <= t0 || f.t > t1) continue; s.n++; s.la += f.la; s.lc += f.lc; s.sa += f.sa; s.sc += f.sc; s.nx += f.nx; s.lcx += f.lcx; s.scx += f.scx; s.dnL += f.dnL; s.dnS += f.dnS; s.laP += f.la * f.p; s.saP += f.sa * f.p; }
    s.net = s.la - s.lc - s.sa + s.sc + s.nx;
    let last = null; for (const p of P) { if (p.t <= t1) last = p; else break; } s.last = last;
    return s;
  }
  function summary() {
    if (!sumDirty) return; sumDirty = false;
    const R = visRange(), px = B.length ? B[B.length - 1].c : NaN;
    if (!R || !BOOK) { $("sumT").innerHTML = `<tr><td class="empty">${BOOK ? "Loading…" : "No cohort book for this market yet. It starts with the next 5-minute snapshot."}</td></tr>`; $("verdict").textContent = BOOK ? "" : "No cohort book yet."; return; }
    const keys = ["sm", "fo", "all", ...BOOK.co.map((_, i) => "c" + i)];
    const head = `<thead><tr><th>Cohort · ${esc(fmtT(tsec(R.t0)))} → ${esc(fmtT(tsec(Math.min(Date.now(), R.t1))))}</th><th>Net</th><th>Long add</th><th>Long cut</th><th>cut loose</th><th>Short add</th><th>Cover</th><th>cut loose</th><th>Avg long add</th><th>Avg short add</th><th>Est. L entry</th><th>Est. S entry</th><th>Open L</th><th>Open S</th><th>Δ traders L / S</th></tr></thead>`;
    const rows = keys.map(k => { const s = sumGroup(k, R.t0, R.t1), l = s.last, hlc = k === O.a ? ` style="box-shadow:inset 3px 0 0 var(--accent)"` : k === O.b ? ` style="box-shadow:inset 3px 0 0 var(--warn)"` : "";
      const ent = (b, side) => !b ? "--" : `${fp(b)} <span class="${(side > 0 ? px >= b : px <= b) ? "up" : "dn"}">${pct(side > 0 ? px / b - 1 : 1 - px / b)}</span>`;
      const netOnly = s.nx && !s.la && !s.lc && !s.sa && !s.sc;
      return `<tr class="${k.length < 4 && k[0] !== "c" ? "grp" : ""}"${hlc}><td>${esc(shortName(k))}</td><td>${sgnU(s.net)}</td>
        <td>${netOnly ? "–" : usdS(s.la)}</td><td>${netOnly ? "–" : usdS(s.lc)}</td><td class="dn">${s.lcx >= 1 ? usdS(s.lcx) : ""}</td><td>${netOnly ? "–" : usdS(s.sa)}</td><td>${netOnly ? "–" : usdS(s.sc)}</td><td class="dn">${s.scx >= 1 ? usdS(s.scx) : ""}</td>
        <td>${s.la ? fp(s.laP / s.la) : "--"}</td><td>${s.sa ? fp(s.saP / s.sa) : "--"}</td><td>${l && l.L > 0 ? ent(l.bL, 1) : "--"}</td><td>${l && l.S > 0 ? ent(l.bS, -1) : "--"}</td>
        <td>${l && l.L != null ? usdS(l.L * 1000) : "--"}</td><td>${l && l.S != null ? usdS(l.S * 1000) : "--"}</td><td>${s.dnL || s.dnS ? `${s.dnL >= 0 ? "+" : ""}${s.dnL} / ${s.dnS >= 0 ? "+" : ""}${s.dnS}` : "--"}</td></tr>`; }).join("");
    $("sumT").innerHTML = head + "<tbody>" + rows + "</tbody>";
    // verdict for A vs B
    const a = sumGroup(O.a, R.t0, R.t1), b = sumGroup(O.b, R.t0, R.t1), nA = shortName(O.a), nB = shortName(O.b);
    const act = s => { if (s.nx && !s.la && !s.lc && !s.sa && !s.sc) return s.nx > 0 ? "net buying" : "net selling";
      const m = [["adding longs", s.la], ["cutting longs", s.lc], ["adding shorts", s.sa], ["covering shorts", s.sc]].sort((x, y) => y[1] - x[1])[0];
      const loose = m[0] === "cutting longs" && s.lcx > s.lc * 0.5 || m[0] === "covering shorts" && s.scx > s.sc * 0.5; return m[1] > 0 ? m[0] + (loose ? " (cut loose, under water)" : "") : "flat"; };
    const side = s => s.net > 0 ? "net bought" : "net sold";
    const pc = B.length ? B[R.i1].c / B[R.i0].o - 1 : 0;
    let v;
    if (!a.n && !b.n) v = "No cohort snapshots in the visible range. Zoom out or pick a longer time frame.";
    else {
      const opp = Math.sign(a.net) !== Math.sign(b.net) && Math.abs(a.net) > 0 && Math.abs(b.net) > 0;
      v = `<b>${opp ? "Opposite sides." : "Same side."}</b> In the visible range (price ${pct(pc)}), <b class="A">${esc(nA)}</b> ${side(a)} ${usdS(Math.abs(a.net))}, mostly ${act(a)}; <b class="B">${esc(nB)}</b> ${side(b)} ${usdS(Math.abs(b.net))}, mostly ${act(b)}.`;
      const la = a.last, lb = b.last;
      const uw = (l, nm) => { if (!l || !isFinite(px)) return ""; const o = []; if (l.bL && l.L > 0) o.push(`longs ${pct(px / l.bL - 1)} from est. entry ${fp(l.bL)}`); if (l.bS && l.S > 0) o.push(`shorts ${pct(1 - px / l.bS)} from ${fp(l.bS)}`); return o.length ? ` ${esc(nm)}: ${o.join(", ")}.` : ""; };
      v += uw(la, nA) + uw(lb, nB);
    }
    $("verdict").innerHTML = v;
  }
  setInterval(summary, 400);

  // ---------- drawings ----------
  const drawings = () => O.draw[O.coin] || (O.draw[O.coin] = []);
  function tToL(ms) { if (!B.length) return NaN; const k = idxAt(ms); if (k < 0) return (ms - B[0].t) / barMs(); if (k === B.length - 1) return k + (ms - B[k].t) / barMs(); return k + Math.min(1, (ms - B[k].t) / Math.max(1, B[k + 1].t - B[k].t)); }
  function lToT(l) { if (!B.length) return NaN; const k = Math.floor(l); if (k < 0) return B[0].t + l * barMs(); if (k >= B.length - 1) return B[B.length - 1].t + (l - (B.length - 1)) * barMs(); return B[k].t + (l - k) * (B[k + 1].t - B[k].t); }
  const X = ms => { const L = tToL(ms); if (!isFinite(L)) return null; const ts = chart.timeScale(), f = Math.floor(L), x = ts.logicalToCoordinate(f); return x == null ? null : x + (L - f) * (ts.options().barSpacing || 6); };
  const Y = p => S.c.priceToCoordinate(p);
  const ONE = { hline: 1, alert: 1 }, FIBS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  function ptFrom(param) { if (!param.point) return null; const l = chart.timeScale().coordinateToLogical(param.point.x), p = S.c.coordinateToPrice(param.point.y); if (l == null || p == null) return null; return { t: lToT(Math.round(l)), p }; }
  (function onPlotClick(el, ch, cb) {
    let down = null;
    el.addEventListener("pointerdown", e => { if (e.button === 0) down = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);
    el.addEventListener("pointerup", e => {
      if (!down || e.button !== 0) return; const d = down; down = null;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5 || Date.now() - d.t > 800) return;
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x > ch.timeScale().width() || y > r.height - ch.timeScale().height()) return;
      cb({ point: { x, y } });
    }, true);
  })($m("fcMain"), chart, param => {
    const pt = ptFrom(param); if (!pt) return;
    if (tool) {
      if (ONE[tool]) { drawings().push({ type: tool, p1: pt, p2: pt }); finish(); return; }
      if (!pend) { pend = { type: tool, p1: pt, p2: pt }; ovDirty = true; return; }
      pend.p2 = pt; if (tool === "chan") chanFit(pend); if (tool === "measure") lastMeasure = pend; else drawings().push(pend); pend = null; finish(); return;
    }
    sel = hitTest(param.point.x, param.point.y); levels(); ovDirty = true; stat(sel >= 0 ? "Drawing selected · press Delete to remove" : "");
  });
  function finish() { save(); levels(); ovDirty = true; if (tool !== "measure") setTool(null); }
  function chanFit(d) { const a = idxAt(Math.min(d.p1.t, d.p2.t)), z = idxAt(Math.max(d.p1.t, d.p2.t)); if (a < 0 || z <= a) { d.off = (d.p2.p - d.p1.p) * 0.5 || d.p1.p * 0.01; return; }
    const at = t => d.p1.p + (d.p2.p - d.p1.p) * (t - d.p1.t) / ((d.p2.t - d.p1.t) || 1); let up = 0, dn = 0; for (let i = a; i <= z; i++) { const L = at(B[i].t); up = Math.max(up, B[i].h - L); dn = Math.max(dn, L - B[i].l); } d.off = up >= dn ? up : -dn; }
  const posStop = d => d.p1.p - (d.p2.p - d.p1.p) / 2;
  function seg(px, py, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy; let t = L ? ((px - x1) * dx + (py - y1) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)); }
  function hitTest(px, py) {
    let best = -1, bd = 7;
    drawings().forEach((d, i) => { const x1 = X(d.p1.t), y1 = Y(d.p1.p), x2 = X(d.p2.t), y2 = Y(d.p2.p); let dist = Infinity;
      if (d.type === "hline" || d.type === "alert") dist = Math.abs(py - y1);
      else if (x1 == null || x2 == null || y1 == null || y2 == null) return;
      else if (d.type === "trend" || d.type === "measure") dist = seg(px, py, x1, y1, x2, y2);
      else if (d.type === "ray" || d.type === "xline") { const k = 4000; dist = seg(px, py, d.type === "xline" ? x1 - (x2 - x1) * k : x1, d.type === "xline" ? y1 - (y2 - y1) * k : y1, x2 + (x2 - x1) * k, y2 + (y2 - y1) * k); }
      else if (d.type === "chan") { const o1 = Y(d.p1.p + (d.off || 0)), o2 = Y(d.p2.p + (d.off || 0)); dist = Math.min(seg(px, py, x1, y1, x2, y2), o1 != null && o2 != null ? seg(px, py, x1, o1, x2, o2) : Infinity); }
      else if (d.type === "rect" || d.type === "long" || d.type === "short") { const ys = d.type === "rect" ? [y1, y2] : [y1, y2, Y(posStop(d))].filter(v => v != null); dist = px >= Math.min(x1, x2) - 2 && px <= Math.max(x1, x2, x1 + 60) && py >= Math.min(...ys) && py <= Math.max(...ys) ? 3 : Infinity; }
      else if (d.type === "fib") FIBS.forEach(r => { const y = Y(d.p2.p + (d.p1.p - d.p2.p) * r); if (y != null) dist = Math.min(dist, Math.abs(py - y)); });
      if (dist < bd) { bd = dist; best = i; } });
    return best;
  }
  function setTool(t) { tool = t || null; pend = null; wrap.querySelectorAll("#fcTools [data-tool]").forEach(b => b.classList.toggle("on", (b.dataset.tool || null) === tool)); stat(tool ? "Click on the chart · Esc to cancel" : ""); }
  function checkAlerts() { const P = B.length ? B[B.length - 1].c : NaN; if (isFinite(lastP) && isFinite(P)) drawings().forEach(d => { if (d.type !== "alert") return; const L = d.p1.p; if ((lastP < L && P >= L) || (lastP > L && P <= L)) {
      const txt = `🔔 ${O.coin} crossed ${P >= L ? "above" : "below"} your line ${fp(L)} → ${fp(P)}`; stat(txt); try { if ("Notification" in window && Notification.permission === "granted") new Notification("Cohort Flow", { body: txt }); } catch (e) { } } }); lastP = P; }

  // ---------- overlay: cohort profile, market volume profile, drawings ----------
  const ov = $m("fcOv");
  function drawOv() {
    if (!ovDirty || !wrap.isConnected) return; ovDirty = false;
    const main = $m("fcMain"), w = chart.timeScale().width(), h = main.clientHeight - chart.timeScale().height(), dpr = window.devicePixelRatio || 1; if (!(w > 0 && h > 0)) return;
    if (ov.width !== Math.round(w * dpr) || ov.height !== Math.round(h * dpr)) { ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr); ov.style.width = w + "px"; ov.style.height = h + "px"; }
    const g = ov.getContext("2d"), t = T(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); if (!B.length) return;
    const R = visRange(); if (!R) return; const { i0, i1 } = R;
    g.font = "10px IBM Plex Mono, monospace";
    let lo = Infinity, hi = -Infinity; for (let i = i0; i <= i1; i++) { lo = Math.min(lo, B[i].l); hi = Math.max(hi, B[i].h); }
    const N = 36, s = (hi - lo) / N;
    // market volume profile (left edge, exact candles)
    if (O.ind.mvp && s > 0) { const vol = new Array(N).fill(0); for (let i = i0; i <= i1; i++) { const x = B[i], a = Math.max(0, Math.min(N - 1, Math.floor((x.l - lo) / s))), z = Math.max(0, Math.min(N - 1, Math.floor((x.h - lo) / s))), v = (x.v || 0) / (z - a + 1); for (let k = a; k <= z; k++) vol[k] += v; }
      const mx = Math.max(1, ...vol), W = Math.min(120, w * 0.14);
      for (let k = 0; k < N; k++) { const yA = Y(lo + (k + 1) * s), yB = Y(lo + k * s); if (yA == null || yB == null) continue; g.fillStyle = alpha(t.dim, vol[k] === mx ? 0.4 : 0.18); g.fillRect(0, yA, vol[k] / mx * W, Math.max(1, yB - yA - 1)); }
      g.fillStyle = t.dim; g.fillText("volume (all)", 4, h - 6); }
    // order book heatmap: resting orders per candle (latest sample in the candle, carried forward up to 16 min)
    const bsp = chart.timeScale().options().barSpacing || 6;
    if (O.ind.heat) { const SM = obSamples(); if (SM.length) { let mx = 1; const pick = []; let j = -1;
        for (let i = i0; i <= i1; i++) { const e = B[i].t + barMs(); while (j + 1 < SM.length && SM[j + 1].t < e) j++; const sm = j >= 0 && e - SM[j].t <= barMs() + 16 * 6e4 ? SM[j] : null; pick.push(sm); if (sm) for (const x of sm.b.concat(sm.a)) mx = Math.max(mx, x[1]); }
        pick.forEach((sm, n) => { if (!sm) return; const x = chart.timeScale().logicalToCoordinate(i0 + n); if (x == null) return;
          const all = sm.b.concat(sm.a).map(z => z[0]).sort((p, q) => p - q); let bk = Infinity; for (let k = 1; k < all.length; k++) if (all[k] > all[k - 1]) bk = Math.min(bk, all[k] - all[k - 1]); if (!isFinite(bk)) bk = all[0] * 0.002;
          [[sm.b, t.up], [sm.a, t.dn]].forEach(([arr, c]) => arr.forEach(([p, u]) => { const ya = Y(p + bk / 2), yb = Y(p - bk / 2); if (ya == null || yb == null) return; g.fillStyle = alpha(c, Math.min(0.75, 0.05 + 0.7 * Math.sqrt(u / mx))); g.fillRect(x - bsp / 2, ya, bsp + 0.5, Math.max(1, yb - ya)); })); });
        g.fillStyle = t.dim; g.fillText("order book heatmap", 4, 12); } }
    // order book now: side bars at the left edge
    let xBook = O.ind.mvp ? Math.min(120, w * 0.14) + 6 : 0;
    if (O.ind.book && OB) { const mx = Math.max(1, ...OB.b.map(x => x[1]), ...OB.a.map(x => x[1])), W = Math.min(140, w * 0.16);
      const all = OB.b.concat(OB.a).map(z => z[0]).sort((p, q) => p - q); let bk = Infinity; for (let k = 1; k < all.length; k++) if (all[k] > all[k - 1]) bk = Math.min(bk, all[k] - all[k - 1]); if (!isFinite(bk)) bk = (all[0] || 1) * 0.002;
      [[OB.b, t.up], [OB.a, t.dn]].forEach(([arr, c]) => arr.forEach(([p, u]) => { const ya = Y(p + bk / 2), yb = Y(p - bk / 2); if (ya == null || yb == null) return; const len = u / mx * W;
        g.fillStyle = alpha(c, 0.45); g.fillRect(xBook, ya, len, Math.max(1, yb - ya - 1)); if (u >= mx * 0.4) { g.fillStyle = c; g.fillText(usdS(u), xBook + len + 4, (ya + yb) / 2 + 3); } }));
      g.fillStyle = t.dim; g.fillText("book now", xBook + 4, h - 30); }
    // top holders' resting orders: ticks in a strip left of the cohort profile (good = A color, bad = B color)
    if (O.ind.ords) { const H = holderOrders().list; if (H.length) { const colW = Math.min(130, w * 0.15), x1 = (O.ind.prof ? w - colW * 2 - 12 : w) - 6, mx = Math.max(1, ...H.map(o => o.usd));
        H.forEach(o => { const y = Y(o.px); if (y == null || y < 0 || y > h) return; const c = o.g === "good" ? t.acc : o.g === "bad" ? t.warn : t.dim, len = 10 + Math.sqrt(o.usd / mx) * 60;
          g.strokeStyle = c; g.lineWidth = 2; g.setLineDash(o.k === "s" ? [3, 2] : []); g.beginPath(); g.moveTo(x1 - len, y); g.lineTo(x1, y); g.stroke(); g.setLineDash([]);
          g.fillStyle = c; g.fillText(`${o.k === "s" ? "stop" : o.k === "t" ? "tgt" : o.sd > 0 ? "buy" : "sell"} ${usdS(o.usd)}`, x1 - len - 62, y + 3); });
        g.fillStyle = t.dim; g.fillText("top holders' orders", x1 - 110, 12); } }
    // cohort profile: two columns at the right edge, buys to the right of each center line, sells to the left
    if (O.ind.prof && s > 0 && BOOK) {
      const colW = Math.min(130, w * 0.15), gap = 8, xs = [w - colW * 2 - gap - 4, w - colW - 4];
      const prof = k => { const b = new Array(N).fill(0), se = new Array(N).fill(0); for (const f of grp(k).F) { if (f.t <= R.t0 || f.t > R.t1) continue; const j = Math.max(0, Math.min(N - 1, Math.floor((f.p - lo) / s))); b[j] += buyOf(f); se[j] += sellOf(f); } return { b, se }; };
      const PA = prof(O.a), PB = prof(O.b), mx = Math.max(1, ...PA.b, ...PA.se, ...PB.b, ...PB.se);
      [[PA, xs[0], t.acc, shortName(O.a)], [PB, xs[1], t.warn, shortName(O.b)]].forEach(([P, x0, c, nm]) => {
        const cx = x0 + colW / 2;
        g.fillStyle = alpha(t.bg, 0.55); g.fillRect(x0, 0, colW, h);
        for (let k = 0; k < N; k++) { const yA = Y(lo + (k + 1) * s), yB = Y(lo + k * s); if (yA == null || yB == null) continue; const hh = Math.max(1, yB - yA - 1);
          const bw = P.b[k] / mx * colW / 2, sw = P.se[k] / mx * colW / 2, net = P.b[k] - P.se[k];
          g.fillStyle = alpha(t.up, net > 0 ? 0.75 : 0.35); g.fillRect(cx, yA, bw, hh);
          g.fillStyle = alpha(t.dn, net < 0 ? 0.75 : 0.35); g.fillRect(cx - sw, yA, sw, hh); }
        g.strokeStyle = c; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, h); g.stroke();
        g.fillStyle = c; g.font = "bold 10px IBM Plex Mono, monospace"; const lab = nm.length > 16 ? nm.slice(0, 15) + "…" : nm; g.fillText(lab, x0 + 3, h - 6); g.font = "10px IBM Plex Mono, monospace";
        g.fillStyle = t.dim; g.fillText("sell ◂ ▸ buy", x0 + 3, h - 18);
      });
    }
    // drawings
    const D = drawings().slice(); if (pend) D.push(pend); if (lastMeasure) D.push(lastMeasure);
    D.forEach((d, i) => {
      const isSel = i === sel && d !== pend, c = isSel ? t.warn : t.acc, x1 = X(d.p1.t), y1 = Y(d.p1.p), x2 = X(d.p2.t), y2 = Y(d.p2.p);
      g.strokeStyle = c; g.fillStyle = c; g.lineWidth = isSel ? 2.5 : 1.5; if (d.type === "hline" || d.type === "alert") return; if (x1 == null || x2 == null || y1 == null || y2 == null) return;
      const dot = (x, y) => { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); };
      if (d.type === "trend") { g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); dot(x1, y1); dot(x2, y2); }
      else if (d.type === "ray" || d.type === "xline") { if (x2 === x1) return; const k = 4000; g.beginPath(); g.moveTo(d.type === "xline" ? x1 - (x2 - x1) * k : x1, d.type === "xline" ? y1 - (y2 - y1) * k : y1); g.lineTo(x2 + (x2 - x1) * k, y2 + (y2 - y1) * k); g.stroke(); dot(x1, y1); dot(x2, y2); }
      else if (d.type === "chan") { const off = d === pend ? 0 : (d.off || 0), o1 = Y(d.p1.p + off), o2 = Y(d.p2.p + off); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        if (o1 != null && o2 != null && off) { g.beginPath(); g.moveTo(x1, o1); g.lineTo(x2, o2); g.stroke(); g.fillStyle = alpha(t.acc, 0.1); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x2, o2); g.lineTo(x1, o1); g.closePath(); g.fill(); } }
      else if (d.type === "rect") { g.fillStyle = alpha(t.acc, 0.12); g.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); g.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); }
      else if (d.type === "fib") { const Rr = d.p1.p - d.p2.p; FIBS.forEach(rr => { const p = d.p2.p + Rr * rr, y = Y(p); if (y == null) return; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(Math.min(x1, x2), y); g.lineTo(w, y); g.stroke(); g.fillText(`${(rr * 100).toFixed(1)}%  ${fp(p)}`, Math.min(x1, x2) + 4, y - 3); g.globalAlpha = 1; }); }
      else if (d.type === "long" || d.type === "short") { const stop = posStop(d), ys = Y(stop), xl = Math.min(x1, x2), xr = Math.max(x1, x2, x1 + 60), wd = xr - xl; if (ys == null) return;
        g.fillStyle = alpha(t.up, 0.16); g.fillRect(xl, Math.min(y1, y2), wd, Math.abs(y2 - y1)); g.fillStyle = alpha(t.dn, 0.16); g.fillRect(xl, Math.min(y1, ys), wd, Math.abs(ys - y1));
        const rr = Math.abs(d.p2.p - d.p1.p) / Math.max(1e-12, Math.abs(d.p1.p - stop)); g.font = "11px IBM Plex Mono, monospace";
        const lab = (y, s2, cc) => { const tw = g.measureText(s2).width; g.fillStyle = cc; g.fillRect(xl + 2, y - 8, tw + 8, 16); g.fillStyle = "#fff"; g.fillText(s2, xl + 6, y + 4); };
        lab(y2 + (y2 < y1 ? 10 : -10), `Target ${fp(d.p2.p)} (${pct(d.p2.p / d.p1.p - 1, 2)})`, t.up); lab(ys + (ys > y1 ? -10 : 10), `Stop ${fp(stop)} (${pct(stop / d.p1.p - 1, 2)})`, t.dn);
        lab(y1, `${d.type === "long" ? "Long" : "Short"} ${fp(d.p1.p)} · R:R ${rr.toFixed(2)}`, isSel ? t.warn : t.acc); g.font = "10px IBM Plex Mono, monospace"; }
      else if (d.type === "measure") { const ch = d.p2.p / d.p1.p - 1, c2 = ch >= 0 ? t.up : t.dn; g.fillStyle = alpha(c2, 0.14); g.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); g.strokeStyle = c2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        const s2 = `${pct(ch, 2)} · ${Math.round(tToL(d.p2.t) - tToL(d.p1.t))} bars`; g.font = "12px IBM Plex Mono, monospace"; const tw = g.measureText(s2).width; g.fillStyle = c2; g.fillRect(x2 + 6, y2 - 10, tw + 10, 18); g.fillStyle = "#fff"; g.fillText(s2, x2 + 11, y2 + 3); g.font = "10px IBM Plex Mono, monospace"; }
    });
  }
  (function loop() { try { drawOv(); } catch (e) { } requestAnimationFrame(loop); })();
  new ResizeObserver(() => { ovDirty = true; }).observe($m("fcMain"));

  // ---------- controls ----------
  function fillSelects() {
    const src = BOOK || INDEX; if (!src) return;
    const g = groups(src.co, src.lb, src.np), o = g.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("");
    $("gA").innerHTML = o; $("gB").innerHTML = o; $("gA").value = O.a; $("gB").value = O.b;
    if ($("gA").value !== O.a) $("gA").value = O.a = "sm"; if ($("gB").value !== O.b) $("gB").value = O.b = "fo";
  }
  function syncUi() { wrap.querySelectorAll("#fcTf [data-tf]").forEach(b => b.classList.toggle("on", b.dataset.tf === O.tf)); $m("fcMenu").innerHTML = IND_LIST.map(([k, l]) => `<label><input type="checkbox" data-ind="${k}" ${O.ind[k] ? "checked" : ""}> ${l}</label>`).join(""); $("coinIn").value = O.coin; }
  syncUi();
  function setUrl() { try { const u = new URL(location.href); u.searchParams.set("c", O.coin); u.searchParams.set("tf", O.tf); history.replaceState(null, "", u); } catch (e) { } }
  async function selectCoin(c) {
    if (!c) return; c = c.trim(); if (INDEX) { const k = Object.keys(INDEX.m).find(x => x.toUpperCase() === c.toUpperCase()) || Object.keys(INDEX.m).find(x => x.split(":").pop().toUpperCase() === c.toUpperCase()); if (k) c = k; }
    O.coin = c; save(); syncUi(); setUrl(); B = []; sel = -1; lastMeasure = null; err = ""; legend(null);
    OB = null; LIVEOB = [];
    await loadBook(); fillSelects(); await loadCandles(true); renderScan(); loadOB(); orders();
  }
  $("coinIn").addEventListener("change", e => selectCoin(e.target.value));
  $("coinIn").addEventListener("keydown", e => { if (e.key === "Enter") selectCoin(e.target.value); });
  $("gA").onchange = e => { O.a = e.target.value; save(); update(false); };
  $("gB").onchange = e => { O.b = e.target.value; save(); update(false); };
  $("swap").onclick = () => { [O.a, O.b] = [O.b, O.a]; save(); fillSelects(); update(false); };
  $m("fcTf").addEventListener("click", e => { const b = e.target.closest("[data-tf]"); if (!b) return; O.tf = b.dataset.tf; save(); syncUi(); setUrl(); B = []; loadCandles(true); });
  $m("fcTools").addEventListener("click", e => { const b = e.target.closest("[data-tool]"); if (!b) return; setTool(b.dataset.tool); if (!b.dataset.tool) { lastMeasure = null; ovDirty = true; } });
  $m("fcInd").onclick = () => { $m("fcMenu").hidden = !$m("fcMenu").hidden; };
  document.addEventListener("click", e => { if (!$m("fcMenu").hidden && !e.target.closest("#fcMenu,#fcInd")) $m("fcMenu").hidden = true; });
  $m("fcMenu").addEventListener("change", e => { const k = e.target.dataset.ind; if (!k) return; O.ind[k] = e.target.checked ? 1 : 0; save(); update(false); });
  $m("fcClr").onclick = () => { if (!drawings().length) return; if (!confirm(`Remove all ${drawings().length} drawings on ${O.coin}?`)) return; O.draw[O.coin] = []; sel = -1; save(); levels(); ovDirty = true; };
  $m("fcFs").onclick = () => { wrap.classList.toggle("fcfs"); $m("fcFs").textContent = wrap.classList.contains("fcfs") ? "✕" : "⤢"; ovDirty = true; };
  $m("fcShot").onclick = () => { try { const c = chart.takeScreenshot(), g = c.getContext("2d"), dpr = c.width / $m("fcMain").clientWidth;
      g.drawImage(ov, 0, 0, ov.width, ov.height, 0, 0, ov.width / (window.devicePixelRatio || 1) * dpr, ov.height / (window.devicePixelRatio || 1) * dpr);
      g.font = `${Math.round(13 * dpr)}px IBM Plex Mono, monospace`; g.fillStyle = T().text; g.fillText(`${O.coin} · ${O.tf} · ${shortName(O.a)} vs ${shortName(O.b)} · Cohort Flow`, 10 * dpr, 22 * dpr);
      c.toBlob(bl => { const a = document.createElement("a"); a.href = URL.createObjectURL(bl); a.download = `${O.coin.replace(":", "-")}-${O.tf}-flow.png`; document.body.appendChild(a); a.click(); a.remove(); try { navigator.clipboard.write([new ClipboardItem({ "image/png": bl })]); } catch (e) { } }, "image/png"); } catch (e) { stat("Snapshot failed"); } };
  document.addEventListener("keydown", e => { if (e.target.closest && e.target.closest("input,select,textarea")) return;
    if (e.key === "Escape") { if (tool || pend) setTool(null); else if (wrap.classList.contains("fcfs")) $m("fcFs").click(); ovDirty = true; }
    if ((e.key === "Delete" || e.key === "Backspace") && sel >= 0) { drawings().splice(sel, 1); sel = -1; save(); levels(); ovDirty = true; e.preventDefault(); } });
  new MutationObserver(() => { charts.forEach(c => c.applyOptions(opts())); pP.applyOptions({ leftPriceScale: { visible: true } }); const t = T();
    S.c.applyOptions({ upColor: t.up, downColor: t.dn, borderUpColor: t.up, borderDownColor: t.dn, wickUpColor: t.up, wickDownColor: t.dn }); S.pa.applyOptions({ color: t.acc }); S.pb.applyOptions({ color: t.warn }); update(false); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ---------- scanner ----------
  let scSort = "edge", scShow = 40;
  const PAT = { sbuy: "Smart buying · fools selling", ssell: "Smart selling · fools buying", bbuy: "Both buying", bsell: "Both selling", flat: "Flat" };
  const dom = x => { const m = [["adds L", x[0]], ["cuts L", x[1]], ["adds S", x[2]], ["covers S", x[3]]].sort((a, b) => b[1] - a[1])[0]; return m[1] > 0 ? m[0] : ""; };
  function scanRows() {
    if (!INDEX) return [];
    const w = $("scW").value, minOi = +$("scOi").value, q = $("scQ").value.trim().toUpperCase(), f = $("scF").value;
    return Object.entries(INDEX.m).map(([c, m]) => { const W = m.w[w]; if (!W) return null; const sn = W.sm[0] - W.sm[1] - W.sm[2] + W.sm[3], fn = W.fo[0] - W.fo[1] - W.fo[2] + W.fo[3];
      const tiny = Math.max(2e4, (m.oi || 0) * 5e-4), sS = Math.abs(sn) < tiny ? 0 : Math.sign(sn), fS = Math.abs(fn) < tiny ? 0 : Math.sign(fn);
      const pat = sS > 0 && fS < 0 ? "sbuy" : sS < 0 && fS > 0 ? "ssell" : sS > 0 && fS > 0 ? "bbuy" : sS < 0 && fS < 0 ? "bsell" : "flat";
      return { c, m, W, sn, fn, pat, edge: m.oi ? ((sS ? sn : 0) - (fS ? fn : 0)) / m.oi : 0 }; }).filter(r => r && (r.m.oi || 0) >= minOi && (!q || r.c.toUpperCase().includes(q)) &&
      (f === "all" || (f === "opp" && (r.pat === "sbuy" || r.pat === "ssell")) || r.pat === f || (f === "same" && (r.pat === "bbuy" || r.pat === "bsell"))));
  }
  function renderScan() {
    if (!INDEX) { $("scT").innerHTML = `<tr><td class="empty">The cohort book is not on the server yet. It starts with the next data run.</td></tr>`; return; }
    const R = scanRows(), key = { edge: r => Math.abs(r.edge), sm: r => Math.abs(r.sn), fo: r => Math.abs(r.fn), oi: r => r.m.oi || 0, ch: r => Math.abs(r.m.ch || 0), c: r => r.c }[scSort];
    R.sort((a, b) => scSort === "c" ? a.c.localeCompare(b.c) : key(b) - key(a));
    const span = R.length ? Math.max(...R.map(r => r.W.span || 0)) : 0, want = { "1h": 60, "4h": 240, "24h": 1440, "7d": 10080 }[$("scW").value];
    const th = (k, l) => `<th class="s" data-sort="${k}">${l}${scSort === k ? " ▾" : ""}</th>`;
    $("scT").innerHTML = `<thead><tr>${th("c", "Market")}<th>Price</th>${th("ch", "24h")}${th("oi", "OI")}${th("sm", "Smart net")}<th>Smart mostly</th>${th("fo", "Fools net")}<th>Fools mostly</th><th>All traders</th><th>Pattern</th>${th("edge", "Edge")}</tr></thead><tbody>` +
      R.slice(0, scShow).map(r => { const an = r.W.all[0] - r.W.all[1] - r.W.all[2] + r.W.all[3];
        return `<tr class="click${r.c === O.coin ? " hl" : ""}" data-c="${esc(r.c)}"><td><b>${esc(r.c)}</b></td><td>${fp(r.m.px)}</td><td class="${(r.m.ch || 0) >= 0 ? "up" : "dn"}">${r.m.ch != null ? (r.m.ch > 0 ? "+" : "") + r.m.ch.toFixed(2) + "%" : "--"}</td><td>${usdS(r.m.oi || 0)}</td>
        <td>${sgnU(r.sn)}</td><td class="mut">${dom(r.W.sm)}</td><td>${sgnU(r.fn)}</td><td class="mut">${dom(r.W.fo)}</td><td>${sgnU(an)}</td>
        <td><span class="tag${r.pat === "sbuy" ? " opp" : r.pat === "ssell" ? " opp2" : ""}">${PAT[r.pat]}</span></td><td class="${r.edge >= 0 ? "up" : "dn"}">${(r.edge * 1e4).toFixed(0)} bp</td></tr>`; }).join("") +
      (R.length > scShow ? `<tr><td colspan="11" style="text-align:center"><a href="#" id="scMore">Show ${Math.min(R.length - scShow, 80)} more of ${R.length - scShow}</a></td></tr>` : "") + `</tbody>` +
      (span && span < want * 0.9 ? `<caption style="caption-side:bottom;text-align:left;padding-top:6px;color:var(--faint);font-size:11px">The cohort book covers ${span >= 120 ? Math.round(span / 60) + " h" : span + " min"} of this window so far.</caption>` : "");
  }
  $("scT").addEventListener("click", e => { const s = e.target.closest("[data-sort]"); if (s) { scSort = s.dataset.sort; renderScan(); return; }
    if (e.target.id === "scMore") { e.preventDefault(); scShow += 80; renderScan(); return; }
    const r = e.target.closest("tr[data-c]"); if (r) { selectCoin(r.dataset.c); $("coinIn").scrollIntoView({ behavior: "smooth", block: "start" }); } });
  ["scW", "scF", "scOi"].forEach(id => $(id).onchange = () => { scShow = 40; renderScan(); }); $("scQ").oninput = () => renderScan();

  // ---------- start and live updates ----------
  async function loadIndex() {
    try { const x = await getJson("_index.json"); const changed = !INDEX || INDEX.t !== x.t; INDEX = x;
      $("coinList").innerHTML = Object.keys(INDEX.m).sort().map(c => `<option value="${esc(c)}">`).join("");
      $("stat").innerHTML = `Cohort snapshot ${new Date(INDEX.t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}<br>${Object.keys(INDEX.m).length} markets`;
      return changed;
    } catch (e) { $("stat").textContent = "Cohort book not found yet (" + (e.message || e) + ")"; return false; }
  }
  (async function start() {
    await loadIndex(); loadLevels(); await selectCoin(O.coin);
    setInterval(() => { if (!document.hidden) loadOB(); }, 10000);
    setInterval(() => { if (!document.hidden) loadLevels(); }, 5 * 60000);
    setInterval(() => { if (!document.hidden) loadCandles(false); }, 10000);
    setInterval(async () => { if (document.hidden) return; if (await loadIndex()) { await loadBook(); fillSelects(); update(false); renderScan(); } }, 60000);
  })();
})();
