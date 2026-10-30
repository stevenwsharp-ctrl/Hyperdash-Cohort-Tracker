/* Cohort Sniper · Market chart (one per open market)
   TradingView Lightweight Charts 4.2 (Apache-2.0). Candles from Hyperliquid (candleSnapshot, live), with:
   VWAP ±1σ/±2σ, EMA 9/21/50, Bollinger 20/2, volume, visible-range volume profile, the liquidation map as side bars,
   max pain for longs and shorts, 30-day POC and value area, options max pain, smart-vs-fools events as markers,
   a lower pane with smart bias, fools bias and the gap from the 5-minute Hyperdash snapshots,
   and drawing tools (trend, extended line, ray, level, alert line, channel, zone, Fibonacci, long/short, measure).
   Depends on globals from index.html: ROWS, HIST, EVENTS, OPTS, hlName, price, esc, render. */
(function () {
  "use strict";
  const LW = window.LightweightCharts; if (!LW) { console.warn("Market chart: library not loaded"); return; }
  const API = "https://api.hyperliquid.xyz/info";
  const TF = { "1m": { s: 60, d: 1 }, "5m": { s: 300, d: 4 }, "15m": { s: 900, d: 10 }, "1h": { s: 3600, d: 40 }, "4h": { s: 14400, d: 150 }, "1d": { s: 86400, d: 500 } };
  const lsG = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  let O = { tf: "15m", ind: { vwap: 1, vwapb: 1, ema: 1, ema50: 0, bb: 0, vol: 1, vp: 1, liq: 1, lv: 1, ev: 1, bias: 1, rsi: 1, sess: 1, keys: 1 }, draw: {} };
  try { const x = JSON.parse(lsG("cs_mc") || "null"); if (x) { if (!x.v2 && x.ind) { x.ind.vwapb = 1; } O = { ...O, ...x, ind: { ...O.ind, ...(x.ind || {}) }, draw: x.draw || {} }; } } catch (e) { }
  O.v2 = 1;   // v2 = SOXX Sniper look: session shading, VWAP bands, key levels, RSI pane
  const save = () => lsS("cs_mc", JSON.stringify(O));
  const css = `
#mcWrap{display:flex;flex-direction:column;gap:6px;margin:6px 0 12px}
#mcWrap.mcfs{position:fixed;inset:0;z-index:300;background:var(--bg);padding:10px 12px}
.mcbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.mcbar .grp{display:flex;gap:2px;padding:2px;border:1px solid var(--line);border-radius:9px;background:var(--panel2)}
.mcbar button{font:12px var(--mono);padding:4px 8px;border-radius:7px;border:1px solid transparent;background:transparent;color:var(--text);cursor:pointer}
.mcbar .grp button.on{background:var(--panel);border-color:var(--accent);color:var(--accent)}
.mcbar>button{border-color:var(--line);background:var(--panel)}
.mcsp{flex:1}
.mcmain{position:relative;height:480px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--panel)}
.mcpane{position:relative;height:130px;border:1px solid var(--line);border-radius:14px;overflow:hidden;background:var(--panel)}
.mcrsi{height:110px}
.mcfs .mcmain{flex:1;height:auto}
.mcov{position:absolute;left:0;top:0;pointer-events:none;z-index:3}
.mcleg{position:absolute;left:10px;top:8px;z-index:4;font:12px var(--mono);line-height:1.55;pointer-events:none;text-shadow:0 0 3px var(--panel);max-width:calc(100% - 100px)}
.mcleg .s{font-weight:700;font-size:13px;margin-right:6px}.mcleg .k{color:var(--dim)}
.mcpleg{position:absolute;left:10px;top:4px;z-index:4;font:11px var(--mono);color:var(--dim);pointer-events:none}
.mcstat{font:11px var(--mono);color:var(--dim)}
.mcmenu{position:absolute;z-index:20;right:12px;top:44px;width:min(300px,calc(100vw - 32px));padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--panel);box-shadow:0 10px 30px rgba(0,0,0,.35)}
.mcmenu label{display:flex;gap:8px;align-items:center;padding:3px 2px;font-size:13px;cursor:pointer}
@media (max-width:700px){.mcmain{height:360px}.mcpane{height:110px}}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const col = k => getComputedStyle(document.documentElement).getPropertyValue(k).trim() || "#888";
  const T = () => ({ bg: col("--panel"), vi: "#9b6bff", line: col("--line"), text: col("--text"), dim: col("--dim"), up: col("--bull"), dn: col("--bear"), acc: col("--accent"), warn: col("--warn") });
  const alpha = (c, a) => { if (c.startsWith("#") && c.length === 7) return c + Math.round(a * 255).toString(16).padStart(2, "0"); return c; };

  // ---------- DOM ----------
  const wrap = document.createElement("div"); wrap.id = "mcWrap";
  wrap.innerHTML = `<div class="mcbar">
    <div class="grp" id="mcTf">${Object.keys(TF).map(k => `<button data-tf="${k}">${k}</button>`).join("")}</div>
    <div class="grp" id="mcTools">
      <button data-tool="" title="Select a drawing (Delete removes it)">↖</button><button data-tool="trend" title="Trend line">╱ Trend</button><button data-tool="xline" title="Extended line">⟋</button><button data-tool="ray" title="Ray">→</button>
      <button data-tool="hline" title="Horizontal level">—</button><button data-tool="alert" title="Alert line: alert when price crosses">🔔</button><button data-tool="chan" title="Parallel channel">▱</button><button data-tool="rect" title="Zone">▭</button>
      <button data-tool="fib" title="Fibonacci retracement">ƒ</button><button data-tool="long" title="Long position (entry, then target)">▲</button><button data-tool="short" title="Short position (entry, then target)">▼</button><button data-tool="measure" title="Measure">⇕</button></div>
    <button id="mcInd">Indicators ▾</button><button id="mcClr" title="Remove all drawings on this market">Clear</button><button id="mcShot" title="Save a picture">Snapshot</button><button id="mcFs" title="Full screen">⤢</button>
    <span class="mcsp"></span><span class="mcstat" id="mcStat"></span></div>
  <div class="mcmain" id="mcMain"><canvas class="mcov" id="mcOv"></canvas><div class="mcleg" id="mcLeg"></div></div>
  <div class="mcpane mcrsi" id="mcRsi"><div class="mcpleg" id="mcRLeg">RSI 14</div></div>
  <div class="mcpane" id="mcPane"><div class="mcpleg" id="mcPLeg">Smart bias · fools bias · gap (−100 short … +100 long)</div></div>
  <div class="mcmenu" id="mcMenu" hidden></div>`;
  const $m = id => wrap.querySelector("#" + id);
  const opts = main => { const t = T(); return { autoSize: true, layout: { background: { color: t.bg }, textColor: t.dim, fontFamily: "IBM Plex Mono, ui-monospace, monospace", fontSize: 11 },
    rightPriceScale: { borderColor: t.line, minimumWidth: 72 },
    grid: { vertLines: { color: alpha(t.line, 0.5) }, horzLines: { color: alpha(t.line, 0.5) } }, crosshair: { mode: LW.CrosshairMode.Normal },
    timeScale: { borderColor: t.line, timeVisible: true, secondsVisible: false, visible: main ? true : true }, handleScroll: true, handleScale: true }; };
  const chart = LW.createChart($m("mcMain"), opts(true)), pane = LW.createChart($m("mcPane"), opts(false)), rpane = LW.createChart($m("mcRsi"), opts(false));
  const S = {};
  function build() {
    const t = T();
    S.c = chart.addCandlestickSeries({ upColor: t.up, downColor: t.dn, borderUpColor: t.up, borderDownColor: t.dn, wickUpColor: t.up, wickDownColor: t.dn, priceLineVisible: true });
    S.v = chart.addHistogramSeries({ priceScaleId: "vol", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    S.e9 = chart.addLineSeries({ color: t.acc, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    S.e21 = chart.addLineSeries({ color: t.vi, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    S.e50 = chart.addLineSeries({ color: "#22c3e6", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    S.bu = chart.addLineSeries({ color: alpha(t.dim, 0.6), lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    S.bl = chart.addLineSeries({ color: alpha(t.dim, 0.6), lineWidth: 1, lineStyle: 2, priceLineVisible: false, lastValueVisible: false });
    S.sm = pane.addLineSeries({ color: t.acc, lineWidth: 2, priceLineVisible: false, title: "smart" });
    S.fo = pane.addLineSeries({ color: t.warn, lineWidth: 2, priceLineVisible: false, title: "fools" });
    S.gp = pane.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
    S.rsi = rpane.addLineSeries({ color: t.vi, lineWidth: 2, priceLineVisible: false });
    S.rsi.createPriceLine({ price: 70, color: t.dn, lineStyle: 2, lineWidth: 1, axisLabelVisible: false });
    S.rsi.createPriceLine({ price: 30, color: t.up, lineStyle: 2, lineWidth: 1, axisLabelVisible: false });
  }
  build();
  // keep the two time scales together
  let syncing = false;
  chart.timeScale().subscribeVisibleTimeRangeChange(r => { if (syncing || !r) return; syncing = true; try { pane.timeScale().setVisibleRange(r); } catch (e) { } try { const lr = chart.timeScale().getVisibleLogicalRange(); if (lr) rpane.timeScale().setVisibleLogicalRange(lr); } catch (e) { } syncing = false; ovDirty = true; });
  pane.timeScale().subscribeVisibleTimeRangeChange(r => { if (syncing || !r) return; syncing = true; try { chart.timeScale().setVisibleRange(r); } catch (e) { } syncing = false; });
  rpane.timeScale().subscribeVisibleLogicalRangeChange(r => { if (syncing || !r) return; syncing = true; try { chart.timeScale().setVisibleLogicalRange(r); } catch (e) { } syncing = false; });
  // US Eastern time (sessions of stock perps): date and minute of day, cached per hour
  const etF = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" }), etC = new Map();
  function etInfo(ms) { const hk = Math.floor(ms / 36e5); let o = etC.get(hk);
    if (!o) { const p = {}; etF.formatToParts(new Date(hk * 36e5)).forEach(x => p[x.type] = x.value); o = { d: `${p.year}-${p.month}-${p.day}`, h: +p.hour, wd: p.weekday }; etC.set(hk, o); if (etC.size > 5000) etC.clear(); }
    const m = Math.floor((ms % 36e5) / 6e4); return { d: o.d, min: o.h * 60 + m, wk: o.wd === "Sat" || o.wd === "Sun" }; }
  const isEq = () => { const r = rowOf(); return !!(coin && coin.includes(":") && (!r || ["Stock", "ETF", "Index"].includes(r.cls))); };

  // ---------- data ----------
  let coin = null, B = [], loading = false, lastLoad = 0, err = "", ovDirty = true, tool = null, pend = null, sel = -1, plines = [], lastP = NaN;
  const hl = body => fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  const rowOf = () => (typeof ROWS !== "undefined" && ROWS || []).find(r => r.coin === coin) || null;
  async function load(full) {
    if (!coin || loading) return; loading = true;
    try {
      const tf = TF[O.tf], end = Date.now(), name = hlName(coin);
      const start = full || !B.length ? end - tf.d * 86400000 : B[Math.max(0, B.length - 3)].t;
      const c = await hl({ type: "candleSnapshot", req: { coin: name, interval: O.tf, startTime: start, endTime: end } });
      const nb = (c || []).map(x => ({ t: x.t, o: +x.o, h: +x.h, l: +x.l, c: +x.c, v: +x.v * +x.c }));
      if (full || !B.length) B = nb; else { const t0 = nb.length ? nb[0].t : Infinity; B = B.filter(b => b.t < t0).concat(nb); }
      err = B.length ? "" : "No candles for this market on Hyperliquid."; lastLoad = Date.now();
      update(full);
    } catch (e) { err = "Hyperliquid did not answer: " + (e.message || e); stat(err); }
    loading = false;
  }
  const tsec = ms => Math.floor(ms / 1000);
  const ema = (v, n) => { const k = 2 / (n + 1), o = []; let e = null; v.forEach((x, i) => { e = e == null ? x : x * k + e * (1 - k); o.push(i >= n - 1 ? e : NaN); }); return o; };
  let IND = {};
  function calc() {
    const c = B.map(b => b.c);
    IND.e9 = ema(c, 9); IND.e21 = ema(c, 21); IND.e50 = ema(c, 50);
    IND.bm = c.map((_, i) => i >= 19 ? c.slice(i - 19, i + 1).reduce((a, x) => a + x, 0) / 20 : NaN);
    IND.bd = c.map((_, i) => { if (i < 19) return NaN; const s = c.slice(i - 19, i + 1), m = IND.bm[i]; return Math.sqrt(s.reduce((a, x) => a + (x - m) ** 2, 0) / 20); });
    // VWAP: resets each UTC day (Hyperliquid trades 24/7)
    const vm = [], vs = [], vd = [], eq = isEq(); let pv = 0, vv = 0, p2 = 0, day = -1;
    B.forEach(b => { const d = eq ? etInfo(b.t).d : Math.floor(b.t / 86400000); vd.push(d); if (d !== day) { day = d; pv = vv = p2 = 0; } const tp = (b.h + b.l + b.c) / 3, v = Math.max(b.v, 1e-9); pv += tp * v; vv += v; p2 += tp * tp * v; const m = pv / vv; vm.push(m); vs.push(Math.sqrt(Math.max(0, p2 / vv - m * m))); });
    IND.vm = vm; IND.vs = vs; IND.vd = vd;
    // RSI 14 (Wilder)
    const rs = []; let up = 0, dn = 0; for (let i = 0; i < c.length; i++) { if (!i) { rs.push(NaN); continue; } const d = c[i] - c[i - 1];
      if (i <= 14) { up += Math.max(d, 0) / 14; dn += Math.max(-d, 0) / 14; rs.push(i === 14 ? 100 - 100 / (1 + up / (dn || 1e-9)) : NaN); continue; }
      up = (up * 13 + Math.max(d, 0)) / 14; dn = (dn * 13 + Math.max(-d, 0)) / 14; rs.push(100 - 100 / (1 + up / (dn || 1e-9))); } IND.rsi = rs;
  }
  const line = (arr) => B.map((b, i) => isFinite(arr[i]) ? { time: tsec(b.t), value: arr[i] } : { time: tsec(b.t) });
  function update(fit) {
    const t = T(); calc();
    S.c.setData(B.map(b => ({ time: tsec(b.t), open: b.o, high: b.h, low: b.l, close: b.c })));
    S.v.setData(O.ind.vol ? B.map(b => ({ time: tsec(b.t), value: b.v, color: b.c >= b.o ? alpha(t.up, 0.35) : alpha(t.dn, 0.35) })) : []);
    S.e9.setData(O.ind.ema ? line(IND.e9) : []); S.e21.setData(O.ind.ema ? line(IND.e21) : []); S.e50.setData(O.ind.ema50 ? line(IND.e50) : []);
    S.bu.setData(O.ind.bb ? line(IND.bm.map((m, i) => m + 2 * IND.bd[i])) : []); S.bl.setData(O.ind.bb ? line(IND.bm.map((m, i) => m - 2 * IND.bd[i])) : []);
    $m("mcRsi").style.display = O.ind.rsi ? "" : "none"; S.rsi.setData(O.ind.rsi ? line(IND.rsi) : []);
    if (O.ind.rsi) $m("mcRLeg").textContent = `RSI 14  ${isFinite(IND.rsi[IND.rsi.length - 1]) ? IND.rsi[IND.rsi.length - 1].toFixed(1) : "--"}`;
    biasPane(); markers(); levels();
    if (fit) { chart.timeScale().fitContent(); const n = B.length; if (n > 160) chart.timeScale().setVisibleLogicalRange({ from: n - 160, to: n + 6 }); }
    legend(null); ovDirty = true; checkAlerts();
    stat(`${hlName(coin)} · ${O.tf} · ${B.length} candles · live${err ? " · " + err : ""}`);
  }
  function biasPane() {
    $m("mcPane").style.display = O.ind.bias ? "" : "none"; if (!O.ind.bias) return;
    const sn = (typeof HIST !== "undefined" && HIST && HIST.snapshots) || [], pts = [];
    sn.forEach(s => { const v = s.d && s.d[coin]; if (v) pts.push({ t: tsec(Date.parse(s.t)), s: v[0], f: v[1] }); });
    const t = T(); const d = new Map(); pts.forEach(p => d.set(p.t, p)); const P = [...d.values()].sort((a, b) => a.t - b.t);
    S.sm.setData(P.map(p => ({ time: p.t, value: p.s }))); S.fo.setData(P.map(p => ({ time: p.t, value: p.f })));
    S.gp.setData(P.map(p => { const g = (p.s - p.f) / 2; return { time: p.t, value: g, color: g >= 0 ? alpha(t.up, 0.35) : alpha(t.dn, 0.35) }; }));
    const lp = P[P.length - 1];
    $m("mcPLeg").textContent = P.length ? `Smart bias ${Math.round(lp.s)} · fools bias ${Math.round(lp.f)} · gap ${Math.round((lp.s - lp.f) / 2)} (−100 short … +100 long) · bars: gap` : "Bias history builds every 5 minutes (7 days kept).";
  }
  function markers() {
    const mk = [];
    if (O.ind.ev && typeof EVENTS !== "undefined" && EVENTS && EVENTS.log && B.length) {
      const t0 = B[0].t; EVENTS.log.filter(e => e.coin === coin && Date.parse(e.t) >= t0).slice(0, 60).forEach(e => {
        const tt = Date.parse(e.t), i = idxAt(tt); if (i < 0) return; const bad = e.type === "exit" || e.type === "fade";
        mk.push({ time: tsec(B[i].t), position: bad ? "aboveBar" : "belowBar", color: e.type === "flip" ? T().warn : bad ? T().dn : T().up, shape: e.type === "flip" ? "square" : bad ? "arrowDown" : "arrowUp", text: e.type });
      });
    }
    mk.sort((a, z) => a.time - z.time); try { S.c.setMarkers(mk); } catch (e) { }
  }
  function levels() {
    plines.forEach(l => { try { S.c.removePriceLine(l); } catch (e) { } }); plines = [];
    const t = T(), add = (p, c, title, style, w) => { if (isFinite(p) && p > 0) plines.push(S.c.createPriceLine({ price: p, color: c, title, lineStyle: style ?? 2, lineWidth: w || 1, axisLabelVisible: true })); };
    const r = rowOf();
    if (r && O.ind.lv) {
      const L = r.fl && r.fl.liq;
      if (L && L.long && L.long.pain) add(L.long.pain.px, t.dn, "Max pain longs", 2, 2);
      if (L && L.short && L.short.pain) add(L.short.pain.px, t.up, "Max pain shorts", 2, 2);
      const V = r.fl && (r.fl.vp30 || r.fl.vp7); if (V) { add(V.poc, t.acc, "POC 30d", 0); add(V.vah, alpha(t.acc, 0.6), "VAH", 3); add(V.val, alpha(t.acc, 0.6), "VAL", 3); }
      const o = r.tools && r.tools.optSym && typeof OPTS !== "undefined" && OPTS && OPTS.m ? OPTS.m[r.tools.optSym] : null, px = r.ctx && r.ctx.px;
      if (o && o.maxPain && o.price && px) add(px * o.maxPain / o.price, "#c58af0", `Opt. max pain (${o.s})`, 1);
    }
    if (O.ind.vwap && IND.vm && IND.vm.length) add(IND.vm[IND.vm.length - 1], t.warn, "VWAP", 0);
    // SOXX Sniper key levels for stock perps: prior regular session high / low / close, today's pre-market high / low
    if (O.ind.keys && isEq() && B.length && TF[O.tf].s <= 3600) {
      const E = B.map(b => ({ b, e: etInfo(b.t) })), today = E[E.length - 1].e.d;
      const reg = E.filter(x => !x.e.wk && x.e.min >= 570 && x.e.min < 960), days = [...new Set(reg.map(x => x.e.d))].filter(d => d < today || E[E.length - 1].e.min >= 960);
      const pdD = days.filter(d => d < today).pop() || (E[E.length - 1].e.min >= 960 ? null : null);
      if (pdD) { const pd = reg.filter(x => x.e.d === pdD).map(x => x.b); if (pd.length) { add(Math.max(...pd.map(x => x.h)), t.dim, "PDH", 2); add(Math.min(...pd.map(x => x.l)), t.dim, "PDL", 2); add(pd[pd.length - 1].c, alpha(t.dim, 0.8), "Prev close", 1); } }
      const pm = E.filter(x => x.e.d === today && x.e.min >= 240 && x.e.min < 570).map(x => x.b);
      if (pm.length) { add(Math.max(...pm.map(x => x.h)), t.warn, "PM high", 3); add(Math.min(...pm.map(x => x.l)), t.warn, "PM low", 3); }
    }
    drawings().forEach(d => { if (d.type === "hline" || d.type === "alert") add(d.p1.p, d.type === "alert" ? t.warn : t.acc, d.type === "alert" ? "🔔" : "", 0, sel >= 0 && drawings()[sel] === d ? 3 : 1); });
  }
  const fp = v => !isFinite(v) ? "--" : typeof price === "function" ? price(v) : v.toFixed(v >= 100 ? 2 : 4);
  const fv = v => !isFinite(v) ? "--" : v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? "$" + (v / 1e3).toFixed(0) + "K" : "$" + v.toFixed(0);
  function legend(i) {
    if (!B.length) { $m("mcLeg").innerHTML = `<span class="s">${esc(coin || "")}</span><span class="k">${err || "Loading…"}</span>`; return; }
    if (i == null || i < 0 || i >= B.length) i = B.length - 1;
    const b = B[i], pc = i ? B[i - 1].c : b.o, ch = b.c / pc - 1, r = rowOf();
    let h = `<span class="s">${esc(r ? r.sym : coin)}</span><span class="k">${O.tf}</span> <span class="k">O</span> ${fp(b.o)} <span class="k">H</span> ${fp(b.h)} <span class="k">L</span> ${fp(b.l)} <span class="k">C</span> <span style="color:${ch >= 0 ? T().up : T().dn}">${fp(b.c)} ${(ch * 100).toFixed(2)}%</span> <span class="k">Vol</span> ${fv(b.v)}`;
    const v = []; if (O.ind.vwap) v.push(`<span style="color:${T().warn}">VWAP ${fp(IND.vm[i])}</span>`); if (O.ind.ema) v.push(`<span style="color:${T().acc}">EMA9 ${fp(IND.e9[i])}</span> <span style="color:#c58af0">EMA21 ${fp(IND.e21[i])}</span>`);
    if (r) v.push(`<span class="k">Smart ${Math.round(r.sm.b * 100)} · fools ${Math.round(r.fo.b * 100)} · setup ${r.dir > 0 ? "SMART LONG" : "SMART SHORT"}</span>`);
    $m("mcLeg").innerHTML = h + (v.length ? "<br>" + v.join(" ") : "");
  }
  function stat(s) { $m("mcStat").textContent = s; }
  function idxAt(ms) { let lo = 0, hi = B.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (B[m].t <= ms) { k = m; lo = m + 1; } else hi = m - 1; } return k; }

  // ---------- drawings ----------
  const drawings = () => O.draw[coin] || (O.draw[coin] = []);
  const barMs = () => TF[O.tf].s * 1000;
  function tToL(ms) { if (!B.length) return NaN; const k = idxAt(ms); if (k < 0) return (ms - B[0].t) / barMs(); if (k === B.length - 1) return k + (ms - B[k].t) / barMs(); return k + Math.min(1, (ms - B[k].t) / Math.max(1, B[k + 1].t - B[k].t)); }
  function lToT(l) { if (!B.length) return NaN; const k = Math.floor(l); if (k < 0) return B[0].t + l * barMs(); if (k >= B.length - 1) return B[B.length - 1].t + (l - (B.length - 1)) * barMs(); return B[k].t + (l - k) * (B[k + 1].t - B[k].t); }
  const X = ms => { const L = tToL(ms); if (!isFinite(L)) return null; const ts = chart.timeScale(), f = Math.floor(L), x = ts.logicalToCoordinate(f); return x == null ? null : x + (L - f) * (ts.options().barSpacing || 6); };
  const Y = p => S.c.priceToCoordinate(p);
  const ONE = { hline: 1, alert: 1 };
  function ptFrom(param) { if (!param.point) return null; const l = chart.timeScale().coordinateToLogical(param.point.x), p = S.c.coordinateToPrice(param.point.y); if (l == null || p == null) return null; return { t: lToT(Math.round(l)), p }; }
  let lastMeasure = null;

  // Clicks: our own pointer handler (Lightweight Charts can drop a click that follows a mouse move), so every click on the plot counts.
  function onPlotClick(el, ch, cb) {
    let down = null;
    el.addEventListener("pointerdown", e => { if (e.button === 0) down = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);
    el.addEventListener("pointerup", e => {
      if (!down || e.button !== 0) return; const d = down; down = null;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5 || Date.now() - d.t > 800) return;   // a drag (pan) is not a click
      const r = el.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      if (x > ch.timeScale().width() || y > r.height - ch.timeScale().height()) return;            // price axis or time axis
      const lg = ch.timeScale().coordinateToLogical(x);
      cb({ point: { x, y }, logical: lg == null ? null : lg });
    }, true);
  }
  onPlotClick($m("mcMain"), chart, param => {
    const pt = ptFrom(param); if (!pt) return;
    if (tool) {
      if (ONE[tool]) { drawings().push({ type: tool, p1: pt, p2: pt }); finish(); return; }
      if (!pend) { pend = { type: tool, p1: pt, p2: pt }; ovDirty = true; return; }
      pend.p2 = pt; if (tool === "chan") chanFit(pend); if (tool === "measure") lastMeasure = pend; else drawings().push(pend); pend = null; finish(); return;
    }
    sel = hitTest(param.point.x, param.point.y); levels(); ovDirty = true; stat(sel >= 0 ? "Drawing selected · press Delete to remove" : "");
  });
  function finish() { save(); levels(); ovDirty = true; if (tool !== "measure") setTool(null); }
  chart.subscribeCrosshairMove(param => { if (pend && param.point) { const p = ptFrom(param); if (p) { pend.p2 = p; ovDirty = true; } } legend(param.logical != null ? Math.round(param.logical) : null); });
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
  const FIBS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  function setTool(t) { tool = t || null; pend = null; wrap.querySelectorAll("#mcTools [data-tool]").forEach(b => b.classList.toggle("on", (b.dataset.tool || null) === tool)); stat(tool ? "Click on the chart · Esc to cancel" : ""); }
  function checkAlerts() { const P = B.length ? B[B.length - 1].c : NaN; if (isFinite(lastP) && isFinite(P)) drawings().forEach(d => { if (d.type !== "alert") return; const L = d.p1.p; if ((lastP < L && P >= L) || (lastP > L && P <= L)) {
      const txt = `🔔 ${coin} crossed ${P >= L ? "above" : "below"} your line ${fp(L)} → ${fp(P)}`; try { if (typeof toast === "function") toast(txt); } catch (e) { } try { if ("Notification" in window && Notification.permission === "granted") new Notification("Cohort Sniper", { body: txt }); } catch (e) { } } }); lastP = P; }

  // ---------- overlay: liquidation map, volume profile, drawings ----------
  const ov = $m("mcOv");
  function drawOv() {
    if (!ovDirty || !wrap.isConnected) return; ovDirty = false;
    const main = $m("mcMain"), w = chart.timeScale().width(), h = main.clientHeight - chart.timeScale().height(), dpr = window.devicePixelRatio || 1; if (!(w > 0 && h > 0)) return;
    if (ov.width !== Math.round(w * dpr) || ov.height !== Math.round(h * dpr)) { ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr); ov.style.width = w + "px"; ov.style.height = h + "px"; }
    const g = ov.getContext("2d"), t = T(); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); if (!B.length) return;
    const ts = chart.timeScale(), vr = ts.getVisibleLogicalRange(); if (!vr) return; const bs = ts.options().barSpacing || 6, i0 = Math.max(0, Math.floor(vr.from)), i1 = Math.min(B.length - 1, Math.ceil(vr.to));
    g.font = "10px IBM Plex Mono, monospace";
    // session shading (stock perps): pre-market, after-hours and overnight in amber, weekends darker
    if (O.ind.sess && isEq() && TF[O.tf].s <= 3600) {
      for (let i = i0; i <= i1; i++) { const e = etInfo(B[i].t); if (e.wk || e.min < 570 || e.min >= 960) { const x = ts.logicalToCoordinate(i); if (x == null) continue;
        g.fillStyle = alpha(t.warn, e.wk ? 0.1 : e.min < 240 || e.min >= 1200 ? 0.08 : 0.05); g.fillRect(x - bs / 2, 0, bs + 0.5, h); } }
    }
    // VWAP and bands
    if (O.ind.vwap || O.ind.vwapb) { const L = []; if (O.ind.vwapb) [[2, 0.3], [1, 0.5], [-1, 0.5], [-2, 0.3]].forEach(([m, a]) => L.push({ m, a, w: 1, d: [4, 3] })); if (O.ind.vwap) L.push({ m: 0, a: 1, w: 2, d: [] });
      L.forEach(Ln => { g.strokeStyle = alpha(t.warn, Ln.a); g.lineWidth = Ln.w; g.setLineDash(Ln.d); g.beginPath(); let on = false, day = -1;
        for (let i = Math.max(0, i0 - 1); i <= i1; i++) { const dd = IND.vd ? IND.vd[i] : Math.floor(B[i].t / 86400000), v = IND.vm[i] + Ln.m * IND.vs[i], x = ts.logicalToCoordinate(i), y = Y(v); if (x == null || y == null) { on = false; continue; } if (!on || dd !== day) { g.moveTo(x, y); on = true; day = dd; } else g.lineTo(x, y); }
        g.stroke(); g.setLineDash([]); }); }
    // liquidation map: side bars at the left edge
    const r = rowOf(), L = r && r.fl && r.fl.liq, px = r && r.ctx && r.ctx.px;
    if (O.ind.liq && L && L.w && px) { const mx = Math.max(1, ...L.w.map(x => x.usd)), W0 = Math.min(140, w * 0.18);
      L.w.forEach(b => { const ya = Y(px * (1 + b.a)), yb = Y(px * (1 + b.b)); if (ya == null || yb == null) return; const len = b.usd / mx * W0, below = b.b <= 0;
        g.fillStyle = alpha(below ? t.dn : t.up, 0.32); g.fillRect(0, Math.min(ya, yb), len, Math.max(1, Math.abs(yb - ya) - 1));
        if (b.usd >= mx * 0.35) { g.fillStyle = below ? t.dn : t.up; g.fillText(fv(b.usd), len + 4, (ya + yb) / 2 + 3); } });
      g.fillStyle = t.dim; g.fillText("liquidations", 4, h - 6); }
    // volume profile of the visible range (right edge)
    if (O.ind.vp && i1 > i0 + 5) { let lo = Infinity, hi = -Infinity; for (let i = i0; i <= i1; i++) { lo = Math.min(lo, B[i].l); hi = Math.max(hi, B[i].h); }
      const N = 40, s = (hi - lo) / N, vol = new Array(N).fill(0), up = new Array(N).fill(0);
      if (s > 0) { for (let i = i0; i <= i1; i++) { const x = B[i], a = Math.max(0, Math.min(N - 1, Math.floor((x.l - lo) / s))), z = Math.max(0, Math.min(N - 1, Math.floor((x.h - lo) / s))), v = (x.v || 1) / (z - a + 1); for (let k = a; k <= z; k++) { vol[k] += v; if (x.c >= x.o) up[k] += v; } }
        const mx = Math.max(...vol), W = Math.min(160, w * 0.22), poc = vol.indexOf(mx);
        for (let k = 0; k < N; k++) { const yA = Y(lo + (k + 1) * s), yB = Y(lo + k * s); if (yA == null || yB == null) continue; const Ln = vol[k] / mx * W, hh = Math.max(1, yB - yA - 1), U = up[k] / (vol[k] || 1) * Ln;
          g.fillStyle = alpha(t.up, k === poc ? 0.45 : 0.2); g.fillRect(w - Ln, yA, U, hh); g.fillStyle = alpha(t.dn, k === poc ? 0.45 : 0.2); g.fillRect(w - Ln + U, yA, Ln - U, hh); } } }
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
      else if (d.type === "fib") { const R = d.p1.p - d.p2.p; FIBS.forEach(rr => { const p = d.p2.p + R * rr, y = Y(p); if (y == null) return; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(Math.min(x1, x2), y); g.lineTo(w, y); g.stroke(); g.fillText(`${(rr * 100).toFixed(1)}%  ${fp(p)}`, Math.min(x1, x2) + 4, y - 3); g.globalAlpha = 1; }); }
      else if (d.type === "long" || d.type === "short") { const stop = posStop(d), ys = Y(stop), xl = Math.min(x1, x2), xr = Math.max(x1, x2, x1 + 60), wd = xr - xl; if (ys == null) return;
        g.fillStyle = alpha(t.up, 0.16); g.fillRect(xl, Math.min(y1, y2), wd, Math.abs(y2 - y1)); g.fillStyle = alpha(t.dn, 0.16); g.fillRect(xl, Math.min(y1, ys), wd, Math.abs(ys - y1));
        const rr = Math.abs(d.p2.p - d.p1.p) / Math.max(1e-12, Math.abs(d.p1.p - stop)); g.font = "11px IBM Plex Mono, monospace";
        const lab = (y, s, cc) => { const tw = g.measureText(s).width; g.fillStyle = cc; g.fillRect(xl + 2, y - 8, tw + 8, 16); g.fillStyle = "#fff"; g.fillText(s, xl + 6, y + 4); };
        lab(y2 + (y2 < y1 ? 10 : -10), `Target ${fp(d.p2.p)} (${((d.p2.p / d.p1.p - 1) * 100).toFixed(2)}%)`, t.up); lab(ys + (ys > y1 ? -10 : 10), `Stop ${fp(stop)} (${((stop / d.p1.p - 1) * 100).toFixed(2)}%)`, t.dn);
        lab(y1, `${d.type === "long" ? "Long" : "Short"} ${fp(d.p1.p)} · R:R ${rr.toFixed(2)}`, isSel ? t.warn : t.acc); g.font = "10px IBM Plex Mono, monospace"; }
      else if (d.type === "measure") { const ch = d.p2.p / d.p1.p - 1, c2 = ch >= 0 ? t.up : t.dn; g.fillStyle = alpha(c2, 0.14); g.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); g.strokeStyle = c2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        const s = `${(ch * 100).toFixed(2)}% · ${Math.round(tToL(d.p2.t) - tToL(d.p1.t))} bars`; g.font = "12px IBM Plex Mono, monospace"; const tw = g.measureText(s).width; g.fillStyle = c2; g.fillRect(x2 + 6, y2 - 10, tw + 10, 18); g.fillStyle = "#fff"; g.fillText(s, x2 + 11, y2 + 3); g.font = "10px IBM Plex Mono, monospace"; }
    });
  }
  (function loop() { try { drawOv(); } catch (e) { } requestAnimationFrame(loop); })();
  new ResizeObserver(() => { ovDirty = true; }).observe($m("mcMain"));

  // ---------- controls ----------
  const IND_LIST = [["vwap", "VWAP"], ["vwapb", "VWAP ±1σ / ±2σ bands"], ["ema", "EMA 9 / 21"], ["ema50", "EMA 50"], ["bb", "Bollinger 20 / 2"], ["vol", "Volume"], ["vp", "Volume profile (visible range)"], ["liq", "Liquidation map (side bars)"], ["lv", "Max pain, POC / value area, options max pain"], ["ev", "Smart-money events (exit, flip, fade, add)"], ["bias", "Smart vs fools bias pane"], ["rsi", "RSI 14 pane"], ["sess", "Session shading (stock perps)"], ["keys", "Prev close, PDH / PDL, pre-market high / low"]];
  function syncUi() { wrap.querySelectorAll("#mcTf [data-tf]").forEach(b => b.classList.toggle("on", b.dataset.tf === O.tf)); $m("mcMenu").innerHTML = IND_LIST.map(([k, l]) => `<label><input type="checkbox" data-ind="${k}" ${O.ind[k] ? "checked" : ""}> ${l}</label>`).join(""); }
  syncUi();
  $m("mcTf").addEventListener("click", e => { const b = e.target.closest("[data-tf]"); if (!b) return; O.tf = b.dataset.tf; save(); syncUi(); B = []; load(true); });
  $m("mcTools").addEventListener("click", e => { const b = e.target.closest("[data-tool]"); if (!b) return; setTool(b.dataset.tool); if (!b.dataset.tool) { lastMeasure = null; ovDirty = true; } });
  $m("mcInd").onclick = () => { $m("mcMenu").hidden = !$m("mcMenu").hidden; };
  $m("mcMenu").addEventListener("change", e => { const k = e.target.dataset.ind; if (!k) return; O.ind[k] = e.target.checked ? 1 : 0; save(); update(false); });
  $m("mcClr").onclick = () => { if (!coin || !drawings().length) return; if (!confirm(`Remove all ${drawings().length} drawings on ${coin}?`)) return; O.draw[coin] = []; sel = -1; save(); levels(); ovDirty = true; };
  $m("mcFs").onclick = () => { wrap.classList.toggle("mcfs"); $m("mcFs").textContent = wrap.classList.contains("mcfs") ? "✕" : "⤢"; ovDirty = true; };
  $m("mcShot").onclick = () => { try { const c = chart.takeScreenshot(), g = c.getContext("2d"), dpr = c.width / $m("mcMain").clientWidth;
      g.drawImage(ov, 0, 0, ov.width, ov.height, 0, 0, ov.width / (window.devicePixelRatio || 1) * dpr, ov.height / (window.devicePixelRatio || 1) * dpr);
      g.font = `${Math.round(13 * dpr)}px IBM Plex Mono, monospace`; g.fillStyle = T().text; g.fillText(`${coin} · ${O.tf} · Cohort Sniper`, 10 * dpr, 22 * dpr);
      c.toBlob(bl => { const a = document.createElement("a"); a.href = URL.createObjectURL(bl); a.download = `${coin.replace(":", "-")}-${O.tf}.png`; document.body.appendChild(a); a.click(); a.remove(); try { navigator.clipboard.write([new ClipboardItem({ "image/png": bl })]); } catch (e) { } }, "image/png"); } catch (e) { stat("Snapshot failed"); } };
  document.addEventListener("keydown", e => { if (!wrap.isConnected || e.target.closest && e.target.closest("input,select,textarea")) return;
    if (e.key === "Escape") { if (tool || pend) setTool(null); else if (wrap.classList.contains("mcfs")) $m("mcFs").click(); ovDirty = true; }
    if ((e.key === "Delete" || e.key === "Backspace") && sel >= 0) { drawings().splice(sel, 1); sel = -1; save(); levels(); ovDirty = true; e.preventDefault(); } });
  new MutationObserver(() => { chart.applyOptions(opts(true)); pane.applyOptions(opts(false)); rpane.applyOptions(opts(false)); const t = T(); S.c.applyOptions({ upColor: t.up, downColor: t.dn, borderUpColor: t.up, borderDownColor: t.dn, wickUpColor: t.up, wickDownColor: t.dn }); update(false); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ---------- attach to the open market (the list re-renders often: move the same chart into the new mount) ----------
  window.mcAttach = function () {
    const m = [...document.querySelectorAll(".mcMount")].find(x => x.offsetParent !== null) || null; if (!m) { if (wrap.isConnected && !wrap.classList.contains("mcfs")) wrap.remove(); return; }
    if (wrap.parentNode !== m) m.appendChild(wrap);
    const c = m.dataset.coin; if (c && c !== coin) { coin = c; B = []; sel = -1; setTool(null); lastP = NaN; legend(null); load(true); } else { biasPane(); levels(); ovDirty = true; }
  };
  setInterval(() => { if (coin && wrap.isConnected && !loading && Date.now() - lastLoad > (document.hidden ? 15000 : 4000)) load(false); }, 1000);
})();
