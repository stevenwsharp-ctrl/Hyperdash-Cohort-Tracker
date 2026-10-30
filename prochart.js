/* SOXX Sniper · Pro chart
   Built on TradingView Lightweight Charts 4.2 (Apache-2.0, https://github.com/tradingview/lightweight-charts).
   Features: any symbol, 1m–1M timeframes (1, 2, 3, 5, 10, 15, 30 min, 1, 2, 4 h, day, week, month), candles / Heikin Ashi / bars / line / area, log and % scales,
   VWAP ±σ, EMA 9/21/50, SMA 200, Bollinger, volume, visible-range volume profile, RSI and MACD panes,
   key levels, auto Fibonacci, SOXL liquidity levels and Sniper timeframe targets, session shading,
   news and event markers, drawing tools (trend line, ray, horizontal line with alert, vertical line,
   rectangle, Fibonacci, measure), compare symbol, bar replay, screenshot, fullscreen.
   Depends on globals from index.html: Q, FUND, HOLDINGS, ETFS, fredProxy, demo, ySym, isDST, etInfo, etDate,
   fmtPx, fmtPct, esc, lsGet, lsSet, alert1, EARN, BIGEARN, FRESH, soxlLevels, mhRead, macroState. */
(function () {
  "use strict";
  const LW = window.LightweightCharts;
  const mount = document.getElementById("pcMount");
  if (!LW || !mount) { console.warn("Pro chart: library not loaded, the classic chart stays on"); return; }

  // ---------- styles ----------
  const css = `
#pcWrap{position:relative;display:flex;flex-direction:column;gap:8px}
#pcWrap.pcfs{position:fixed;inset:0;z-index:300;background:var(--bg);padding:max(10px,env(safe-area-inset-top,0px)) max(12px,env(safe-area-inset-right,0px)) max(10px,env(safe-area-inset-bottom,0px)) max(12px,env(safe-area-inset-left,0px))}
.pcbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.pcbar .grp{display:flex;gap:2px;padding:2px;border:1px solid var(--line);border-radius:9px;background:var(--panel2)}
.pcbar button,.pcbar select{font-family:var(--mono);font-size:12px;padding:5px 8px;border-radius:7px;border:1px solid transparent;background:transparent;color:var(--ink);cursor:pointer}
.pcbar .grp button.on{background:var(--panel);border-color:var(--accent);color:var(--accent)}
.pcbar>button,.pcbar>select{border-color:var(--line);background:var(--panel)}
.pcbar button:focus-visible,.pcbar input:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.pcsym{font-family:var(--mono);font-size:13px;font-weight:700;width:86px;padding:5px 8px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);text-transform:uppercase}
.pcsp{flex:1}
.pcmain{position:relative;height:520px;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.pcpane{position:relative;height:120px;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.pcfs .pcmain{flex:1;height:auto;min-height:200px}
.pcov{position:absolute;left:0;top:0;pointer-events:none;z-index:3}
.pcleg{position:absolute;left:10px;top:8px;z-index:4;font-family:var(--mono);font-size:12px;line-height:1.5;pointer-events:none;max-width:calc(100% - 90px);text-shadow:0 0 3px var(--bg)}
.pcleg .s{font-weight:700;font-size:13px;margin-right:6px}.pcleg .k{color:var(--dim)}.pcleg .n{color:var(--amber);display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pcpleg{position:absolute;left:10px;top:4px;z-index:4;font-family:var(--mono);font-size:11px;color:var(--dim);pointer-events:none}
.pcmenu{position:absolute;z-index:20;top:44px;right:0;width:min(320px,calc(100vw - 32px));max-height:70vh;overflow:auto;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--panel);box-shadow:0 10px 30px rgba(0,0,0,.35)}
.pcmenu h4{margin:8px 0 4px;font-family:var(--mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim)}
.pcmenu label{display:flex;gap:8px;align-items:center;padding:4px 2px;font-size:13px;cursor:pointer}
.pctools{display:flex;flex-wrap:wrap;gap:2px}
.pcstat{font-family:var(--mono);font-size:11.5px;color:var(--dim)}
.pcrp{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:6px 10px;border:1px solid var(--amber);border-radius:9px;font-family:var(--mono);font-size:12px}
.pcrp[hidden]{display:none}
@media (max-width:560px){.pcmain{height:420px}.pcpane{height:100px}.pcbar button,.pcbar select{padding:5px 6px}}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------- state ----------
  const TF = {
    "1m": { r: "5d", i: "1m", s: 60 }, "2m": { r: "5d", i: "2m", s: 120 }, "3m": { r: "5d", i: "1m", s: 180, aggM: 3 }, "5m": { r: "1mo", i: "5m", s: 300 }, "10m": { r: "1mo", i: "5m", s: 600, aggM: 10 },
    "15m": { r: "1mo", i: "15m", s: 900 }, "30m": { r: "1mo", i: "30m", s: 1800 }, "1h": { r: "1y", i: "60m", s: 3600 }, "2h": { r: "1y", i: "60m", s: 7200, aggM: 120 },
    "4h": { r: "2y", i: "60m", s: 14400, agg: 4 }, "D": { r: "2y", i: "1d", s: 86400 }, "W": { r: "2y", i: "1wk", s: 604800 }, "M": { r: "2y", i: "1wk", s: 2592000, aggMon: 1 }
  };
  const IND_DEF = [
    ["Price", [["vol", "Volume"], ["vwap", "VWAP"], ["vwapb", "VWAP ±1σ / ±2σ bands"], ["ema9", "EMA 9"], ["ema21", "EMA 21"], ["ema50", "EMA 50"], ["sma200", "SMA 200"], ["bb", "Bollinger 20, 2"]]],
    ["Levels", [["lv", "Key levels (prior day, pre-market)"], ["fib", "Auto Fibonacci (day swing)"], ["liq", "Liquidity levels (SOXL)"], ["tgt", "Sniper targets 1h–24h (SOXL)"], ["vp", "Volume profile (visible range)"]]],
    ["Context", [["sess", "Pre-market / after-hours shading"], ["news", "News and event markers"]]],
    ["Panes", [["rsi", "RSI 14"], ["macd", "MACD 12, 26, 9"]]]
  ];
  const DEF = { sym: "SOXL", tf: "5m", type: "candle", log: false, ind: { vol: 1, vwap: 1, vwapb: 1, ema9: 1, ema21: 1, lv: 1, fib: 0, liq: 1, tgt: 1, vp: 1, sess: 1, news: 1, rsi: 1, macd: 0 }, draw: {}, cmp: "" };
  let O = DEF;
  try { const s = JSON.parse(lsGet("soxx_pc") || "null"); if (s) O = { ...DEF, ...s, ind: { ...DEF.ind, ...(s.ind || {}) }, draw: s.draw || {} }; } catch (e) { }
  const save = () => { try { lsSet("soxx_pc", JSON.stringify(O)); } catch (e) { } };
  let B = [], BD = [], CB = [], loadedKey = "", loading = false, lastFetch = 0, lastDaily = 0, tool = null, pend = null, hover = null, sel = -1, rp = null, ind = {}, panes = {}, ovDirty = true, crossT = null;
  const S = {}; // series handles

  // ---------- markup ----------
  mount.innerHTML = `<div id="pcWrap">
  <div class="pcbar">
    <input class="pcsym" id="pcSym" list="pcSymL" value="${O.sym}" aria-label="Symbol" spellcheck="false"><datalist id="pcSymL"></datalist>
    <div class="grp" id="pcTf">${Object.keys(TF).map(k => `<button data-tf="${k}">${k}</button>`).join("")}</div>
    <select id="pcType" aria-label="Chart type"><option value="candle">Candles</option><option value="hollow">Hollow candles</option><option value="ha">Heikin Ashi</option><option value="bar">Bars</option><option value="line">Line</option><option value="area">Area</option></select>
    <button id="pcIndB" aria-haspopup="true">Indicators ▾</button>
    <button id="pcLog" title="Logarithmic price scale">Log</button>
    <span class="pcsp"></span>
    <input class="pcsym" id="pcCmp" placeholder="+ compare" aria-label="Compare symbol" style="width:96px;font-weight:500" spellcheck="false">
    <button id="pcRpB" title="Bar replay: click a bar to start from it">Replay</button>
    <button id="pcShot" title="Save a picture of the chart">Snapshot</button>
    <button id="pcFs" title="Full screen (Esc to leave)">⤢</button>
    <button id="pcClassic" title="Go back to the classic chart">Classic</button>
  </div>
  <div class="pcbar">
    <div class="grp pctools" id="pcTools">
      <button data-tool="" title="Pointer: select a drawing (Delete removes it)">↖ Select</button>
      <button data-tool="trend" title="Trend line: click two points">╱ Trend</button>
      <button data-tool="ray" title="Ray: click two points, extends to the right">→ Ray</button>
      <button data-tool="hline" title="Horizontal line: one click">— Level</button>
      <button data-tool="alert" title="Alert line: one click; alerts when the price crosses it">🔔 Alert</button>
      <button data-tool="vline" title="Vertical line: one click">│ Time</button>
      <button data-tool="xline" title="Extended line: click two points, it runs across the whole chart">⟋ Line</button>
      <button data-tool="chan" title="Parallel channel: click two points on one side; the other side snaps to the farthest price between them">▱ Channel</button>
      <button data-tool="arrow" title="Arrow: click the start, then the tip">➚ Arrow</button>
      <button data-tool="long" title="Long position: click the entry, then the target. The stop starts at half the distance (2:1)">▲ Long</button>
      <button data-tool="short" title="Short position: click the entry, then the target. The stop starts at half the distance (2:1)">▼ Short</button>
      <button data-tool="rect" title="Rectangle zone: click two corners">▭ Zone</button>
      <button data-tool="fibd" title="Fibonacci retracement: click the swing start, then the end">ƒ Fib</button>
      <button data-tool="measure" title="Measure: click two points">⇕ Measure</button>
    </div>
    <button id="pcDel" title="Delete the selected drawing">Delete</button>
    <button id="pcClr" title="Delete all drawings on this symbol">Clear all</button>
    <span class="pcstat" id="pcStat"></span>
  </div>
  <div class="pcrp" id="pcRp" hidden><b>Replay</b><span id="pcRpTxt">Click a bar to start</span><button id="pcRpPlay">▶ Play</button><button id="pcRpStep">Step ⏭</button>
    <select id="pcRpSpd"><option value="1000">1×</option><option value="400" selected>2.5×</option><option value="150">7×</option><option value="50">20×</option></select><button id="pcRpEnd">Exit replay</button></div>
  <div class="pcmain" id="pcMain"><canvas class="pcov" id="pcOv"></canvas><div class="pcleg" id="pcLeg"></div></div>
  <div class="pcpane" id="pcRsiP" hidden><div class="pcpleg" id="pcRsiL">RSI 14</div></div>
  <div class="pcpane" id="pcMacdP" hidden><div class="pcpleg" id="pcMacdL">MACD 12, 26, 9</div></div>
  <div class="pcmenu" id="pcMenu" hidden></div>
</div>`;
  const $p = id => document.getElementById(id);
  $p("pcSymL").innerHTML = [...new Set([FUND, ...HOLDINGS.map(h => h[0]), "SOXS", "SOXX", "SMH", "QQQ", "SPY", "NVDA", "BTC"])].map(s => `<option value="${s}">`).join("");

  // ---------- theme ----------
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim() || "#888";
  function theme() {
    return { bg: cv("--panel"), fg: cv("--ink"), dim: cv("--dim"), line: cv("--line"), up: cv("--up"), down: cv("--down"), acc: cv("--accent"), amber: cv("--amber"), violet: cv("--violet"), mute: cv("--mute") };
  }
  let T = theme();
  const alpha = (c, a) => { const m = /^#([0-9a-f]{6})$/i.exec(c); if (!m) return c; const n = parseInt(m[1], 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
  function chartOpts(main) {
    return {
      autoSize: true,
      layout: { background: { type: "solid", color: T.bg }, textColor: T.dim, fontFamily: "'JetBrains Mono',ui-monospace,monospace", fontSize: 11 },
      grid: { vertLines: { color: alpha(T.line, 0.5) || T.line }, horzLines: { color: alpha(T.line, 0.5) || T.line } },
      crosshair: { mode: LW.CrosshairMode.Normal },
      rightPriceScale: { borderColor: T.line, minimumWidth: 74 },
      timeScale: { borderColor: T.line, timeVisible: true, secondsVisible: false, rightOffset: 8, visible: main },
      handleScale: { axisPressedMouseMove: { time: true, price: true } }
    };
  }

  // ---------- charts ----------
  const chart = LW.createChart($p("pcMain"), chartOpts(true));
  function mkPane(id) { const c = LW.createChart($p(id), chartOpts(false)); return c; }
  panes.rsi = { el: $p("pcRsiP"), c: mkPane("pcRsiP") };
  panes.macd = { el: $p("pcMacdP"), c: mkPane("pcMacdP") };
  panes.rsi.s = panes.rsi.c.addLineSeries({ color: T.violet, lineWidth: 2, priceLineVisible: false });
  panes.rsi.hi = panes.rsi.s.createPriceLine({ price: 70, color: T.down, lineStyle: LW.LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
  panes.rsi.lo = panes.rsi.s.createPriceLine({ price: 30, color: T.up, lineStyle: LW.LineStyle.Dashed, lineWidth: 1, axisLabelVisible: false });
  panes.macd.h = panes.macd.c.addHistogramSeries({ priceLineVisible: false, lastValueVisible: false });
  panes.macd.m = panes.macd.c.addLineSeries({ color: T.acc, lineWidth: 2, priceLineVisible: false });
  panes.macd.g = panes.macd.c.addLineSeries({ color: T.amber, lineWidth: 1, priceLineVisible: false });
  // keep the panes in step with the main chart
  let syncing = false;
  const allCharts = () => [chart, panes.rsi.c, panes.macd.c];
  allCharts().forEach(c => c.timeScale().subscribeVisibleLogicalRangeChange(r => {
    if (syncing || !r) return; syncing = true; allCharts().forEach(o => { if (o !== c) o.timeScale().setVisibleLogicalRange(r); }); syncing = false; ovDirty = true;
  }));

  // ---------- math ----------
  const shift = ms => Math.floor(ms / 1000) - (isDST(ms) ? 4 : 5) * 3600;
  function ema(a, n) { const k = 2 / (n + 1), o = []; let e = NaN, c = 0; for (const x of a) { if (!isFinite(x)) { o.push(NaN); continue; } c++; e = isNaN(e) ? x : x * k + e * (1 - k); o.push(c >= n ? e : NaN); } return o; }
  function sma(a, n) { const o = []; let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; if (i >= n) s -= a[i - n]; o.push(i >= n - 1 ? s / n : NaN); } return o; }
  function sd(a, n, m) { const o = []; for (let i = 0; i < a.length; i++) { if (i < n - 1) { o.push(NaN); continue; } let s = 0; for (let j = i - n + 1; j <= i; j++) s += (a[j] - m[i]) ** 2; o.push(Math.sqrt(s / n)); } return o; }
  function rsi(c, n) { const o = []; let up = 0, dn = 0; for (let i = 0; i < c.length; i++) { if (!i) { o.push(NaN); continue; } const d = c[i] - c[i - 1]; if (i <= n) { up += Math.max(d, 0) / n; dn += Math.max(-d, 0) / n; o.push(i === n ? 100 - 100 / (1 + up / (dn || 1e-9)) : NaN); continue; } up = (up * (n - 1) + Math.max(d, 0)) / n; dn = (dn * (n - 1) + Math.max(-d, 0)) / n; o.push(100 - 100 / (1 + up / (dn || 1e-9))); } return o; }
  const intraday = () => TF[O.tf].s < 86400;
  function vwap(b) { // session-anchored (resets each ET day)
    const m = [], s1 = []; let day = "", pv = 0, vv = 0, p2 = 0;
    for (const x of b) { const d = etInfo(x.t).d; if (d !== day) { day = d; pv = vv = p2 = 0; } const tp = (x.h + x.l + x.c) / 3, w = x.v > 0 ? x.v : 1; pv += tp * w; vv += w; p2 += tp * tp * w; const mm = pv / vv; m.push(mm); s1.push(Math.sqrt(Math.max(0, p2 / vv - mm * mm))); }
    return { m, s1 };
  }
  function heikin(b) { const o = []; let po = NaN, pc = NaN; for (const x of b) { const c = (x.o + x.h + x.l + x.c) / 4, op = isNaN(po) ? (x.o + x.c) / 2 : (po + pc) / 2; o.push({ ...x, o: op, c, h: Math.max(x.h, op, c), l: Math.min(x.l, op, c) }); po = op; pc = c; } return o; }
  const ln = (b, a) => b.map((x, i) => ({ time: x.time, value: a[i] })).filter(p => isFinite(p.value));
  const lnW = (b, a) => b.map((x, i) => isFinite(a[i]) ? { time: x.time, value: a[i] } : { time: x.time }); // whitespace keeps panes aligned

  // ---------- data ----------
  function normBars(j, tf) {
    let b = (j && j.bars || []).filter(x => x[4] > 0).map(x => ({ t: x[0], o: x[1] ?? x[4], h: x[2] ?? x[4], l: x[3] ?? x[4], c: x[4], v: x[5] || 0 }));
    // aggM = N-minute bars from smaller ones (ET clock), aggMon = calendar months, agg = 4h blocks from 4:00 am ET
    const keyOf = TF[tf].aggMon ? e => e.d.slice(0, 7) : TF[tf].aggM ? e => e.d + "|" + Math.floor(e.min / TF[tf].aggM) : e => e.d + "|" + Math.floor(Math.max(0, e.min - 240) / 240);
    if (TF[tf].agg || TF[tf].aggM || TF[tf].aggMon) { const o = []; let g = null; for (const x of b) { const e = etInfo(x.t), k = keyOf(e); if (!g || g.k !== k) { g = { k, t: x.t, o: x.o, h: x.h, l: x.l, c: x.c, v: x.v }; o.push(g); } else { g.h = Math.max(g.h, x.h); g.l = Math.min(g.l, x.l); g.c = x.c; g.v += x.v; } } b = o; }
    const seen = new Set(), out = [];
    for (const x of b) { x.time = shift(x.t); if (seen.has(x.time)) continue; seen.add(x.time); out.push(x); }
    return out.sort((a, z) => a.time - z.time);
  }
  function demoBars(tf) {
    const s = TF[tf].s, n = 600, out = []; let p = (Q[O.sym] && Q[O.sym].c) || 98, t = Date.now() - n * s * 1000;
    for (let i = 0; i < n; i++) { const o = p; p *= 1 + (Math.random() - 0.495) * 0.004 * Math.sqrt(s / 60); out.push([t, o, Math.max(o, p) * 1.001, Math.min(o, p) * 0.999, p, Math.round(5e4 * (0.5 + Math.random()) * Math.sqrt(s / 60))]); t += s * 1000; }
    return { bars: out };
  }
  async function getJ(sym, tf) {
    if (demo) return demoBars(tf);
    const p = fredProxy(); if (!p) return null;
    try { const j = await (await fetch(`${p}/chart?t=${encodeURIComponent(ySym(sym))}&range=${TF[tf].r}&interval=${TF[tf].i}`)).json(); return j.status === "ok" ? j : null; } catch (e) { return null; }
  }
  async function load(force) {
    if (loading) return; const key = O.sym + "|" + O.tf; const now = Date.now();
    if (!force && key === loadedKey && now - lastFetch < (intraday() ? 60000 : 600000)) return;
    loading = true; const fresh = key !== loadedKey;
    if (fresh) stat(`Loading ${O.sym} ${O.tf}…`);
    const j = await getJ(O.sym, O.tf);
    if (j) {
      const nb = normBars(j, O.tf);
      if (nb.length) { if (fresh || !B.length) B = nb; else { const m = new Map(B.map(x => [x.time, x])); nb.forEach(x => m.set(x.time, x)); B = [...m.values()].sort((a, z) => a.time - z.time); } }
      loadedKey = key; lastFetch = now; stat("");
    } else stat(fredProxy() || demo ? `No data for ${O.sym} ${O.tf}` : "Add the Worker URL (API key button) to load charts");
    if (O.sym !== (BD.sym || "") || now - lastDaily > 3600000) { const d = O.tf === "D" ? j : await getJ(O.sym, "D"); if (d) { BD = normBars(d, "D"); BD.sym = O.sym; lastDaily = now; } }
    if (O.cmp) { const c = await getJ(O.cmp, O.tf); CB = c ? normBars(c, O.tf) : []; } else CB = [];
    loading = false;
    build(fresh);
  }
  // live price into the last bar (every second)
  function live() {
    if (rp || !B.length) return; const q = Q[O.sym]; const P = q && q.c; if (!(P > 0)) return;
    const now = Date.now(), L = B[B.length - 1], s = TF[O.tf].s;
    let same;
    if (s >= 86400) same = O.tf === "W" ? true : O.tf === "M" ? etInfo(L.t).d.slice(0, 7) === etInfo(now).d.slice(0, 7) : etInfo(L.t).d === etInfo(now).d;
    else same = Math.floor((now - L.t) / 1000) < s;
    if (same) { if (L.c === P) return; L.c = P; L.h = Math.max(L.h, P); L.l = Math.min(L.l, P); }
    else { if (s < 86400) { const t = L.t + Math.floor((now - L.t) / (s * 1000)) * s * 1000; B.push({ t, time: shift(t), o: P, h: P, l: P, c: P, v: 0 }); } else return; }
    update(); checkAlerts(P);
  }

  // ---------- build series ----------
  const mainOpts = () => ({ upColor: T.up, downColor: T.down, borderUpColor: T.up, borderDownColor: T.down, wickUpColor: T.up, wickDownColor: T.down, priceLineVisible: true });
  function mkMain() {
    if (S.main) chart.removeSeries(S.main);
    const t = O.type;
    S.main = t === "line" ? chart.addLineSeries({ color: T.acc, lineWidth: 2 }) :
      t === "area" ? chart.addAreaSeries({ lineColor: T.acc, topColor: alpha(T.acc, 0.35), bottomColor: alpha(T.acc, 0.02), lineWidth: 2 }) :
        t === "bar" ? chart.addBarSeries({ upColor: T.up, downColor: T.down, thinBars: false }) :
          chart.addCandlestickSeries(t === "hollow" ? { ...mainOpts(), upColor: "rgba(0,0,0,0)" } : mainOpts());
    S.mainType = t; S.lines = {}; S.plines = [];
  }
  function lineS(k, color, w, style) {
    if (!S.lines[k]) S.lines[k] = chart.addLineSeries({ color, lineWidth: w || 1, lineStyle: style || 0, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    return S.lines[k];
  }
  function dropLine(k) { if (S.lines[k]) { chart.removeSeries(S.lines[k]); delete S.lines[k]; } }
  function data() { return rp ? B.slice(0, rp.i + 1) : B; }
  function build(fresh) {
    if (!S.main || S.mainType !== O.type) { Object.values(S.lines || {}).forEach(s => chart.removeSeries(s)); if (S.vol) { chart.removeSeries(S.vol); S.vol = null; } if (S.cmp) { chart.removeSeries(S.cmp); S.cmp = null; } mkMain(); }
    update(true);
    if (fresh) { const n = data().length; chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - (intraday() ? 160 : 140)), to: n + 8 }); }
  }
  function update(full) {
    const b = data(); if (!b.length || !S.main) { ovDirty = true; return; }
    const c = b.map(x => x.c);
    const disp = O.type === "ha" ? heikin(b) : b;
    if (O.type === "line" || O.type === "area") S.main.setData(b.map(x => ({ time: x.time, value: x.c })));
    else S.main.setData(disp.map(x => ({ time: x.time, open: x.o, high: x.h, low: x.l, close: x.c })));
    // volume
    if (O.ind.vol) {
      if (!S.vol) { S.vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "vol", priceLineVisible: false, lastValueVisible: false }); chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } }); }
      S.vol.setData(b.map(x => ({ time: x.time, value: x.v, color: x.c >= x.o ? alpha(T.up, 0.35) : alpha(T.down, 0.35) })));
    } else if (S.vol) { chart.removeSeries(S.vol); S.vol = null; }
    // overlays
    ind = { c };
    const vw = intraday() && (O.ind.vwap || O.ind.vwapb) ? vwap(b) : null; ind.vw = vw;
    // VWAP and bands are drawn on the overlay (one line per session; the engine joins lines across gaps)
    [["ema9", 9, T.acc], ["ema21", 21, T.violet], ["ema50", 50, "#22c3e6"]].forEach(([k, n, col]) => { if (O.ind[k]) { const e = ema(c, n); ind[k] = e; lineS(k, col, 2).setData(ln(b, e)); } else dropLine(k); });
    if (O.ind.sma200) { const s2 = sma(c, 200); ind.sma200 = s2; lineS("sma200", "#e05cc7", 2).setData(ln(b, s2)); } else dropLine("sma200");
    if (O.ind.bb) { const m = sma(c, 20), d = sd(c, 20, m); ind.bb = { m, d }; lineS("bbm", alpha(T.dim, 0.7), 1, 2).setData(ln(b, m)); lineS("bbu", T.dim, 1).setData(ln(b, m.map((x, i) => x + 2 * d[i]))); lineS("bbl", T.dim, 1).setData(ln(b, m.map((x, i) => x - 2 * d[i]))); } else ["bbm", "bbu", "bbl"].forEach(dropLine);
    // compare
    if (O.cmp && CB.length) {
      if (!S.cmp) S.cmp = chart.addLineSeries({ color: "#e05cc7", lineWidth: 2, priceLineVisible: false, title: O.cmp });
      const t0 = b[0].time; S.cmp.setData(CB.filter(x => x.time >= t0 && x.time <= b[b.length - 1].time).map(x => ({ time: x.time, value: x.c })));
    } else if (S.cmp) { chart.removeSeries(S.cmp); S.cmp = null; }
    chart.priceScale("right").applyOptions({ mode: O.cmp && CB.length ? LW.PriceScaleMode.Percentage : O.log ? LW.PriceScaleMode.Logarithmic : LW.PriceScaleMode.Normal });
    // panes
    panes.rsi.el.hidden = !O.ind.rsi; panes.macd.el.hidden = !O.ind.macd;
    if (O.ind.rsi) { ind.rsi = rsi(c, 14); panes.rsi.s.setData(lnW(b, ind.rsi)); }
    if (O.ind.macd) { const e12 = ema(c, 12), e26 = ema(c, 26), m = e12.map((x, i) => x - e26[i]), g = ema(m, 9), h = m.map((x, i) => x - g[i]); ind.macd = { m, g, h }; panes.macd.m.setData(lnW(b, m)); panes.macd.g.setData(lnW(b, g)); panes.macd.h.setData(b.map((x, i) => isFinite(h[i]) ? { time: x.time, value: h[i], color: h[i] >= 0 ? alpha(T.up, 0.6) : alpha(T.down, 0.6) } : { time: x.time })); }
    // markers: strong news on intraday charts
    const mk = [];
    if (O.ind.news && intraday() && typeof FRESH !== "undefined") {
      const t0 = b[0].t, rel = n => n.syms && (n.syms.includes(O.sym) || (O.sym === FUND && n.syms.length));
      FRESH.filter(n => Math.abs(n.s || 0) >= 0.35 && rel(n) && n.t * 1000 >= t0).slice(0, 40).forEach(n => { const i = idxAt(n.t * 1000); if (i >= 0) mk.push({ time: b[Math.min(i, b.length - 1)].time, position: n.s > 0 ? "belowBar" : "aboveBar", color: n.s > 0 ? T.up : T.down, shape: "circle", text: "N" }); });
    }
    mk.sort((a, z) => a.time - z.time); try { S.main.setMarkers(mk); } catch (e) { }
    priceLines(); legend(null); ovDirty = true;
  }
  function idxAt(ms) { const b = data(); let lo = 0, hi = b.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (b[m].t <= ms) { k = m; lo = m + 1; } else hi = m - 1; } return k; }

  // ---------- price lines: levels, fib, liquidity, targets, user lines ----------
  function priceLines() {
    (S.plines || []).forEach(l => { try { S.main.removePriceLine(l); } catch (e) { } }); S.plines = [];
    const add = (price, color, title, style, w) => { if (isFinite(price) && price > 0) S.plines.push(S.main.createPriceLine({ price, color, title, lineStyle: style ?? LW.LineStyle.Dashed, lineWidth: w || 1, axisLabelVisible: true })); };
    const b = data(); if (!b.length) return; const last = b[b.length - 1], today = etInfo(last.t).d;
    if (O.ind.lv && intraday()) {
      const pd = BD.filter(x => etInfo(x.t).d < today).pop(); if (pd) { add(pd.h, T.dim, "PDH"); add(pd.l, T.dim, "PDL"); add(pd.c, T.mute, "Prev close", LW.LineStyle.Dotted); }
      const pm = b.filter(x => { const e = etInfo(x.t); return e.d === today && e.min >= 240 && e.min < 570; }); if (pm.length) { add(Math.max(...pm.map(x => x.h)), T.amber, "PM high", LW.LineStyle.SparseDotted); add(Math.min(...pm.map(x => x.l)), T.amber, "PM low", LW.LineStyle.SparseDotted); }
    }
    if (ind.vw && O.ind.vwap) add(ind.vw.m[ind.vw.m.length - 1], T.amber, "VWAP", LW.LineStyle.Solid, 1);
    if (O.ind.fib) {
      const day = b.filter(x => intraday() ? etInfo(x.t).d === today : true).slice(intraday() ? 0 : -60);
      if (day.length > 4) { let H = -Infinity, L = Infinity, iH = 0, iL = 0; day.forEach((x, i) => { if (x.h > H) { H = x.h; iH = i; } if (x.l < L) { L = x.l; iL = i; } }); const up = iL < iH, R = H - L;
        [0.236, 0.382, 0.5, 0.618, 0.786].forEach(r => add(up ? H - R * r : L + R * r, alpha(T.violet, 0.8), `Fib ${(r * 100).toFixed(1)}`, LW.LineStyle.Dotted)); }
    }
    if (O.sym === FUND && O.ind.liq && !rp) { try { const lv = soxlLevels(); if (lv) [...lv.levels].sort((a, z) => z.score - a.score).slice(0, 6).forEach(l => add(l.price, l.dir > 0 ? alpha(T.down, 0.7) : alpha(T.up, 0.7), l.labels[0] + (l.pool ? " · pool" : ""), LW.LineStyle.LargeDashed)); } catch (e) { } }
    if (O.sym === FUND && O.ind.tgt && !rp) { try { const R = mhRead(); (R || []).forEach(r => { if (Math.abs(r.p - 0.5) >= 0.03) add(r.tgt, r.p > 0.5 ? T.up : T.down, `${r.h}h target ${Math.round(Math.max(r.p, 1 - r.p) * 100)}%`, LW.LineStyle.Dashed, 2); }); } catch (e) { } }
    drawings().forEach(d => { if (d.type === "hline" || d.type === "alert") add(d.p1.p, d.type === "alert" ? T.amber : T.acc, d.type === "alert" ? "🔔 " + fmtPx(d.p1.p) : "", LW.LineStyle.Solid, sel >= 0 && drawings()[sel] === d ? 3 : 1); });
  }

  // ---------- legend ----------
  const fv = v => !isFinite(v) ? "--" : v >= 1e9 ? (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : String(Math.round(v));
  const fp = v => isFinite(v) ? (v >= 1000 ? v.toFixed(1) : v >= 1 ? v.toFixed(2) : v.toPrecision(3)) : "--";
  function legend(i) {
    const b = data(); if (!b.length) { $p("pcLeg").innerHTML = `<span class="s">${esc(O.sym)}</span>`; return; }
    if (i == null || i < 0 || i >= b.length) i = b.length - 1;
    const x = b[i], pc = i ? b[i - 1].c : x.o, ch = x.c / pc - 1, col = ch >= 0 ? "up" : "down";
    let h = `<span class="s">${esc(O.sym)}</span><span class="k">${O.tf}${rp ? " · replay" : ""}</span> <span class="k">O</span> ${fp(x.o)} <span class="k">H</span> ${fp(x.h)} <span class="k">L</span> ${fp(x.l)} <span class="k">C</span> <span class="${col}">${fp(x.c)} ${fmtPct(ch)}</span> <span class="k">Vol</span> ${fv(x.v)}`;
    const v = [];
    if (ind.vw && O.ind.vwap) v.push(`<span style="color:${T.amber}">VWAP ${fp(ind.vw.m[i])}</span>`);
    [["ema9", "EMA9", T.acc], ["ema21", "EMA21", T.violet], ["ema50", "EMA50", "#22c3e6"], ["sma200", "SMA200", "#e05cc7"]].forEach(([k, n, c]) => { if (ind[k] && isFinite(ind[k][i])) v.push(`<span style="color:${c}">${n} ${fp(ind[k][i])}</span>`); });
    if (ind.bb && isFinite(ind.bb.m[i])) v.push(`<span class="k">BB ${fp(ind.bb.m[i] - 2 * ind.bb.d[i])}–${fp(ind.bb.m[i] + 2 * ind.bb.d[i])}</span>`);
    if (v.length) h += "<br>" + v.join(" ");
    const e = etInfo(x.t); if (intraday()) h += ` <span class="k">${e.d.slice(5)} ${String(Math.floor(e.min / 60)).padStart(2, "0")}:${String(e.min % 60).padStart(2, "0")} ET</span>`;
    if (O.ind.news && typeof FRESH !== "undefined" && intraday() && i < b.length) { const t1 = x.t, t2 = (b[i + 1] ? b[i + 1].t : t1 + TF[O.tf].s * 1000); const n = FRESH.find(n => n.t * 1000 >= t1 && n.t * 1000 < t2 && Math.abs(n.s || 0) >= 0.35 && n.syms && (n.syms.includes(O.sym) || O.sym === FUND)); if (n) h += `<span class="n">📰 ${esc(n.h.slice(0, 120))}</span>`; }
    $p("pcLeg").innerHTML = h;
    if (O.ind.rsi && ind.rsi) $p("pcRsiL").textContent = `RSI 14  ${fp(ind.rsi[i])}`;
    if (O.ind.macd && ind.macd) $p("pcMacdL").textContent = `MACD 12, 26, 9  ${fp(ind.macd.m[i])}  signal ${fp(ind.macd.g[i])}  hist ${fp(ind.macd.h[i])}`;
  }

  // ---------- drawings ----------
  const drawings = () => O.draw[O.sym] || (O.draw[O.sym] = []);
  const barMs = () => TF[O.tf].s * 1000;
  function tToL(ms) { const b = data(); if (!b.length) return NaN; const k = idxAt(ms); if (k < 0) return (ms - b[0].t) / barMs(); if (k === b.length - 1) return k + (ms - b[k].t) / barMs(); const f = (ms - b[k].t) / Math.max(1, b[k + 1].t - b[k].t); return k + Math.min(1, f); }
  function lToT(l) { const b = data(); if (!b.length) return NaN; const k = Math.floor(l); if (k < 0) return b[0].t + l * barMs(); if (k >= b.length - 1) return b[b.length - 1].t + (l - (b.length - 1)) * barMs(); return b[k].t + (l - k) * (b[k + 1].t - b[k].t); }
  // logicalToCoordinate is only exact for whole bars (fractions past the last bar return 0): interpolate ourselves
  const X = ms => { const L = tToL(ms); if (!isFinite(L)) return null; const ts = chart.timeScale(), f = Math.floor(L), x = ts.logicalToCoordinate(f); return x == null ? null : x + (L - f) * (ts.options().barSpacing || 6); };
  const Y = p => S.main ? S.main.priceToCoordinate(p) : null;
  function ptFrom(param) { if (!param.point || !S.main) return null; const l = chart.timeScale().coordinateToLogical(param.point.x), p = S.main.coordinateToPrice(param.point.y); if (l == null || p == null) return null; return { t: lToT(Math.round(l)), p }; }
  const ONE = { hline: 1, alert: 1, vline: 1 };

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
  onPlotClick($p("pcMain"), chart, param => {
    if (rp && rp.pick) { if (param.logical != null) { rp.i = Math.max(20, Math.min(B.length - 2, Math.round(param.logical))); rp.pick = false; rpTxt(); stat(""); update(); } return; }
    const pt = ptFrom(param); if (!pt) return;
    if (tool) {
      if (ONE[tool]) { drawings().push({ type: tool, p1: pt, p2: pt, hit: null }); finish(); return; }
      if (!pend) { pend = { type: tool, p1: pt, p2: pt }; ovDirty = true; return; }
      pend.p2 = pt; if (tool === "chan") chanFit(pend); if (tool !== "measure") drawings().push(pend); else lastMeasure = pend; pend = null; finish(); return;
    }
    sel = hitTest(param.point.x, param.point.y); priceLines(); ovDirty = true; stat(sel >= 0 ? "Drawing selected · press Delete to remove" : "");
  });
  let lastMeasure = null;
  // channel: offset (in price at the line) that reaches the farthest high or low between the two points, on the other side
  function chanFit(d) { const b = data(), a = idxAt(Math.min(d.p1.t, d.p2.t)), z = idxAt(Math.max(d.p1.t, d.p2.t)); if (a < 0 || z <= a) { d.off = (d.p2.p - d.p1.p) * 0.5 || d.p1.p * 0.01; return; }
    const lineAt = t => d.p1.p + (d.p2.p - d.p1.p) * (t - d.p1.t) / ((d.p2.t - d.p1.t) || 1); let up = 0, dn = 0;
    for (let i = a; i <= z; i++) { const L = lineAt(b[i].t); up = Math.max(up, b[i].h - L); dn = Math.max(dn, L - b[i].l); }
    d.off = up >= dn ? up : -dn; }
  function finish() { save(); priceLines(); ovDirty = true; if (tool === "measure") return; setTool(null); }
  chart.subscribeCrosshairMove(param => {
    hover = param.point ? ptFrom(param) : null; if (pend && hover) { pend.p2 = hover; ovDirty = true; }
    legend(param.logical != null ? Math.round(param.logical) : null);
    // pane crosshair sync
    try { if (param.time != null) { const b = data(), i = Math.round(param.logical); if (b[i]) { if (O.ind.rsi && ind.rsi && isFinite(ind.rsi[i])) panes.rsi.c.setCrosshairPosition(ind.rsi[i], param.time, panes.rsi.s); if (O.ind.macd && ind.macd && isFinite(ind.macd.m[i])) panes.macd.c.setCrosshairPosition(ind.macd.m[i], param.time, panes.macd.m); } }
    else { panes.rsi.c.clearCrosshairPosition(); panes.macd.c.clearCrosshairPosition(); } } catch (e) { }
  });
  function segDist(px, py, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy; let t = L ? ((px - x1) * dx + (py - y1) * dy) / L : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)); }
  function hitTest(px, py) {
    const D = drawings(); let best = -1, bd = 7;
    D.forEach((d, i) => {
      const x1 = X(d.p1.t), y1 = Y(d.p1.p), x2 = X(d.p2.t), y2 = Y(d.p2.p); let dist = Infinity;
      if (d.type === "hline" || d.type === "alert") dist = Math.abs(py - y1);
      else if (d.type === "vline") dist = Math.abs(px - x1);
      else if (x1 == null || x2 == null || y1 == null || y2 == null) return;
      else if (d.type === "trend" || d.type === "arrow") dist = segDist(px, py, x1, y1, x2, y2);
      else if (d.type === "xline" && x2 !== x1) { const k = 4000; dist = segDist(px, py, x1 - (x2 - x1) * k, y1 - (y2 - y1) * k, x2 + (x2 - x1) * k, y2 + (y2 - y1) * k); }
      else if (d.type === "chan") { const o1 = Y(d.p1.p + (d.off || 0)), o2 = Y(d.p2.p + (d.off || 0)); dist = Math.min(segDist(px, py, x1, y1, x2, y2), o1 != null && o2 != null ? segDist(px, py, x1, o1, x2, o2) : Infinity); }
      else if (d.type === "long" || d.type === "short") { const st = Y(posStop(d)), inX = px >= Math.min(x1, x2) && px <= Math.max(x1, x2), ys = [y1, y2, st].filter(v => v != null); dist = inX && py >= Math.min(...ys) && py <= Math.max(...ys) ? 3 : Infinity; }
      else if (d.type === "ray") { const k = 4000; const ex = x2 + (x2 - x1) * k, ey = y2 + (y2 - y1) * k; dist = segDist(px, py, x1, y1, ex, ey); }
      else if (d.type === "rect") { const inX = px >= Math.min(x1, x2) && px <= Math.max(x1, x2), inY = py >= Math.min(y1, y2) && py <= Math.max(y1, y2); dist = inX && inY ? 3 : Infinity; }
      else if (d.type === "fibd") { if (px >= Math.min(x1, x2) - 4) FIBS.forEach(r => { const y = Y(d.p2.p + (d.p1.p - d.p2.p) * r); if (y != null) dist = Math.min(dist, Math.abs(py - y)); }); }
      if (dist < bd) { bd = dist; best = i; }
    });
    return best;
  }
  const posStop = d => d.stop != null ? d.stop : d.p1.p - (d.p2.p - d.p1.p) / 2;
  const FIBS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
  function del() { if (sel < 0) return; drawings().splice(sel, 1); sel = -1; save(); priceLines(); ovDirty = true; stat(""); }
  function setTool(t) { tool = t || null; pend = null; document.querySelectorAll("#pcTools [data-tool]").forEach(b => b.classList.toggle("on", (b.dataset.tool || null) === tool)); stat(tool ? ({ trend: "Click the start, then the end", ray: "Click two points", hline: "Click a price", alert: "Click a price: you get an alert when SOXL crosses it", vline: "Click a time", rect: "Click two corners", fibd: "Click the swing start, then the swing end", measure: "Click two points to measure", xline: "Click two points", chan: "Click two points on one side of the channel", arrow: "Click the start, then the tip", long: "Click the entry, then the target", short: "Click the entry, then the target" }[tool] || "") + " · Esc to cancel" : ""); }
  // alerts on alert lines
  let lastP = NaN;
  function checkAlerts(P) {
    if (isFinite(lastP)) drawings().forEach(d => { if (d.type !== "alert") return; const L = d.p1.p; if ((lastP < L && P >= L) || (lastP > L && P <= L)) { try { alert1(`pc:${O.sym}:${L.toFixed(4)}:${etDate()}`, 3600000, `🔔 $${O.sym} crossed ${P >= L ? "above" : "below"} your line ${fmtPx(L)} → ${fmtPx(P)}`, O.sym, true); } catch (e) { } } });
    lastP = P;
  }

  // ---------- overlay canvas: drawings, session shading, volume profile, events ----------
  const ov = $p("pcOv");
  function drawOv() {
    if (!ovDirty) return; ovDirty = false;
    const main = $p("pcMain"), w = chart.timeScale().width(), h = main.clientHeight - chart.timeScale().height(), dpr = window.devicePixelRatio || 1;
    if (!(w > 0 && h > 0)) return;
    if (ov.width !== Math.round(w * dpr) || ov.height !== Math.round(h * dpr)) { ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr); ov.style.width = w + "px"; ov.style.height = h + "px"; }
    const g = ov.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const b = data(); if (!b.length || !S.main) return;
    const ts = chart.timeScale(), vr = ts.getVisibleLogicalRange(); if (!vr) return;
    const bs = ts.options().barSpacing || 6, i0 = Math.max(0, Math.floor(vr.from)), i1 = Math.min(b.length - 1, Math.ceil(vr.to));
    // session shading
    if (O.ind.sess && intraday() && TF[O.tf].s <= 3600) {
      g.fillStyle = alpha(T.amber, 0.06);
      for (let i = i0; i <= i1; i++) { const e = etInfo(b[i].t); if (e.min < 570 || e.min >= 960) { const x = ts.logicalToCoordinate(i); if (x != null) g.fillRect(x - bs / 2, 0, bs, h); } }
    }
    // session VWAP with ±1σ / ±2σ bands
    if (ind.vw && (O.ind.vwap || O.ind.vwapb)) {
      const vw = ind.vw, lines = [];
      if (O.ind.vwapb) [[2, 0.3], [1, 0.5], [-1, 0.5], [-2, 0.3]].forEach(([m, a]) => lines.push({ m, a, w: 1, dash: [4, 3] }));
      if (O.ind.vwap) lines.push({ m: 0, a: 1, w: 2, dash: [] });
      const s0 = Math.max(0, i0 - 1);
      lines.forEach(L => {
        g.strokeStyle = alpha(T.amber, L.a); g.lineWidth = L.w; g.setLineDash(L.dash); g.beginPath(); let on = false, day = "";
        for (let i = s0; i <= i1; i++) { const d = etInfo(b[i].t).d, v = vw.m[i] + L.m * vw.s1[i], x = ts.logicalToCoordinate(i), y = Y(v); if (x == null || y == null || !isFinite(v)) { on = false; continue; } if (!on || d !== day) { g.moveTo(x, y); on = true; day = d; } else g.lineTo(x, y); }
        g.stroke(); g.setLineDash([]);
      });
    }
    // volume profile of the visible range
    if (O.ind.vp && i1 > i0 + 5) {
      let lo = Infinity, hi = -Infinity; for (let i = i0; i <= i1; i++) { lo = Math.min(lo, b[i].l); hi = Math.max(hi, b[i].h); }
      const N = 40, st = (hi - lo) / N, vol = new Array(N).fill(0), up = new Array(N).fill(0);
      if (st > 0) {
        for (let i = i0; i <= i1; i++) { const x = b[i], a = Math.max(0, Math.min(N - 1, Math.floor((x.l - lo) / st))), z = Math.max(0, Math.min(N - 1, Math.floor((x.h - lo) / st))), v = (x.v || 1) / (z - a + 1); for (let k = a; k <= z; k++) { vol[k] += v; if (x.c >= x.o) up[k] += v; } }
        const mx = Math.max(...vol), W = Math.min(160, w * 0.22); let poc = vol.indexOf(mx);
        for (let k = 0; k < N; k++) { const yA = Y(lo + (k + 1) * st), yB = Y(lo + k * st); if (yA == null || yB == null) continue; const L = vol[k] / mx * W, hh = Math.max(1, yB - yA - 1), U = up[k] / (vol[k] || 1) * L;
          g.fillStyle = alpha(T.up, k === poc ? 0.45 : 0.22); g.fillRect(w - L, yA, U, hh); g.fillStyle = alpha(T.down, k === poc ? 0.45 : 0.22); g.fillRect(w - L + U, yA, L - U, hh); }
        const yp = Y(lo + (poc + 0.5) * st); if (yp != null) { g.strokeStyle = alpha(T.amber, 0.8); g.setLineDash([2, 3]); g.beginPath(); g.moveTo(w - W - 20, yp); g.lineTo(w, yp); g.stroke(); g.setLineDash([]); g.fillStyle = T.amber; g.font = "10px 'JetBrains Mono',monospace"; g.fillText("POC", w - W - 18, yp - 3); }
      }
    }
    // upcoming events (earnings, macro) as vertical lines
    if (O.ind.news) {
      const ev = [];
      try { [...(EARN || []), ...(BIGEARN || [])].filter(e => e.s === O.sym || (O.sym === FUND && ["NVDA", "AVGO", "AMD", "MU", "TSM", "MSFT", "GOOGL", "META", "AMZN"].includes(e.s))).forEach(e => { const m = e.h === "bmo" ? 570 : e.h === "amc" ? 960 : 720; const [y, mo, d] = e.d.split("-").map(Number); ev.push({ t: Date.UTC(y, mo - 1, d, 0, 0) + (m + (isDST(Date.UTC(y, mo - 1, d)) ? 240 : 300)) * 60000, lab: e.s + " earnings", c: T.violet }); }); } catch (e) { }
      try { if (intraday()) macroState().L.filter(e => e.i >= 3 && e.k !== "holiday" && e.k !== "earn").forEach(e => ev.push({ t: e.ms, lab: e.n, c: T.down })); } catch (e) { }
      g.font = "10px 'JetBrains Mono',monospace";
      ev.forEach(e => { const x = X(e.t); if (x == null || x < 0 || x > w) return; g.strokeStyle = alpha(e.c, 0.7); g.setLineDash([4, 4]); g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); g.setLineDash([]); g.fillStyle = e.c; g.save(); g.translate(x + 3, 60); g.rotate(Math.PI / 2); g.fillText(e.lab, 0, 0); g.restore(); });
    }
    // drawings
    const D = drawings().slice(); if (pend) D.push(pend); if (lastMeasure) D.push(lastMeasure);
    D.forEach((d, i) => {
      const isSel = i === sel && d !== pend, col = d.type === "measure" ? T.amber : isSel ? T.amber : T.acc;
      const x1 = X(d.p1.t), y1 = Y(d.p1.p), x2 = X(d.p2.t), y2 = Y(d.p2.p);
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = isSel ? 2.5 : 1.5;
      if (d.type === "vline") { if (x1 == null) return; g.beginPath(); g.moveTo(x1, 0); g.lineTo(x1, h); g.stroke(); return; }
      if (d.type === "hline" || d.type === "alert") return; // drawn as price lines
      if (x1 == null || x2 == null || y1 == null || y2 == null) return;
      if (d.type === "trend" || d.type === "ray") { g.beginPath(); g.moveTo(x1, y1); let ex = x2, ey = y2; if (d.type === "ray" && x2 !== x1) { const k = (w - x1) / (x2 - x1); if (k > 1) { ex = x1 + (x2 - x1) * k; ey = y1 + (y2 - y1) * k; } } g.lineTo(ex, ey); g.stroke(); [[x1, y1], [x2, y2]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }); }
      else if (d.type === "xline") { if (x2 === x1) return; const k = 4000; g.beginPath(); g.moveTo(x1 - (x2 - x1) * k, y1 - (y2 - y1) * k); g.lineTo(x2 + (x2 - x1) * k, y2 + (y2 - y1) * k); g.stroke(); [[x1, y1], [x2, y2]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }); }
      else if (d.type === "arrow") { g.lineWidth = isSel ? 3 : 2.2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); const an = Math.atan2(y2 - y1, x2 - x1), L = 12; g.beginPath(); g.moveTo(x2, y2); g.lineTo(x2 - L * Math.cos(an - 0.45), y2 - L * Math.sin(an - 0.45)); g.lineTo(x2 - L * Math.cos(an + 0.45), y2 - L * Math.sin(an + 0.45)); g.closePath(); g.fill(); }
      else if (d.type === "chan") { const off = d === pend ? 0 : (d.off || 0), o1 = Y(d.p1.p + off), o2 = Y(d.p2.p + off); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        if (o1 != null && o2 != null && off) { g.beginPath(); g.moveTo(x1, o1); g.lineTo(x2, o2); g.stroke(); g.fillStyle = alpha(T.acc, 0.1); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x2, o2); g.lineTo(x1, o1); g.closePath(); g.fill();
          const m1 = Y(d.p1.p + off / 2), m2 = Y(d.p2.p + off / 2); if (m1 != null && m2 != null) { g.setLineDash([4, 4]); g.globalAlpha = 0.6; g.beginPath(); g.moveTo(x1, m1); g.lineTo(x2, m2); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; } } }
      else if (d.type === "long" || d.type === "short") {
        const stop = posStop(d), ys = Y(stop), xl = Math.min(x1, x2), xr = Math.max(x1, x2, x1 + 60), wd = xr - xl; if (ys == null) return;
        const good = (d.type === "long") === (d.p2.p > d.p1.p);
        g.fillStyle = alpha(T.up, 0.16); g.fillRect(xl, Math.min(y1, y2), wd, Math.abs(y2 - y1)); g.fillStyle = alpha(T.down, 0.16); g.fillRect(xl, Math.min(y1, ys), wd, Math.abs(ys - y1));
        g.strokeStyle = isSel ? T.amber : T.dim; g.lineWidth = 1; g.beginPath(); g.moveTo(xl, y1); g.lineTo(xr, y1); g.stroke();
        const rew = Math.abs(d.p2.p - d.p1.p), risk = Math.abs(d.p1.p - stop), rr = risk ? rew / risk : NaN; g.font = "11px 'JetBrains Mono',monospace";
        const lab = (y, t, c) => { const tw = g.measureText(t).width; g.fillStyle = c; g.fillRect(xl + 2, y - 8, tw + 8, 16); g.fillStyle = "#fff"; g.fillText(t, xl + 6, y + 4); };
        lab(y2 + (y2 < y1 ? 10 : -10), `Target ${fp(d.p2.p)} (${((d.p2.p / d.p1.p - 1) * 100).toFixed(2)}%)`, T.up);
        lab(ys + (ys > y1 ? -10 : 10), `Stop ${fp(stop)} (${((stop / d.p1.p - 1) * 100).toFixed(2)}%)`, T.down);
        lab(y1, `${d.type === "long" ? "Long" : "Short"} ${fp(d.p1.p)} · R:R ${isFinite(rr) ? rr.toFixed(2) : "--"}${good ? "" : " · target on the wrong side"}`, isSel ? T.amber : T.acc);
      }
      else if (d.type === "rect") { g.fillStyle = alpha(T.acc, 0.12); g.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); g.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); }
      else if (d.type === "fibd") { const R = d.p1.p - d.p2.p; g.font = "10px 'JetBrains Mono',monospace"; FIBS.forEach(r => { const p = d.p2.p + R * r, y = Y(p); if (y == null) return; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(Math.min(x1, x2), y); g.lineTo(w, y); g.stroke(); g.fillText(`${(r * 100).toFixed(1)}%  ${fp(p)}`, Math.min(x1, x2) + 4, y - 3); g.globalAlpha = 1; }); }
      else if (d.type === "measure") {
        const ch = d.p2.p / d.p1.p - 1, bars = Math.round(tToL(d.p2.t) - tToL(d.p1.t)), c2 = ch >= 0 ? T.up : T.down;
        g.fillStyle = alpha(c2, 0.14); g.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1)); g.strokeStyle = c2; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
        const txt = `${ch >= 0 ? "+" : ""}${(d.p2.p - d.p1.p).toFixed(2)} (${(ch * 100).toFixed(2)}%) · ${bars} bars`; g.font = "12px 'JetBrains Mono',monospace"; const tw = g.measureText(txt).width;
        const bx = Math.min(Math.max(4, x2 - tw / 2 - 6), w - tw - 16), by = Math.max(4, Math.min(h - 26, (y2 < y1 ? y2 - 28 : y2 + 6)));
        g.fillStyle = c2; g.fillRect(bx, by, tw + 12, 20); g.fillStyle = "#fff"; g.fillText(txt, bx + 6, by + 14);
      }
    });
  }
  function loop() { try { drawOv(); } catch (e) { } requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
  new ResizeObserver(() => { ovDirty = true; }).observe($p("pcMain"));
  chart.timeScale().subscribeVisibleTimeRangeChange(() => { ovDirty = true; });
  // price-axis drag changes Y without a time-range event: redraw on pointer moves too
  $p("pcMain").addEventListener("pointermove", () => { ovDirty = true; });
  $p("pcMain").addEventListener("wheel", () => { ovDirty = true; }, { passive: true });

  // ---------- replay ----------
  let rpTimer = null;
  function rpTxt() { $p("pcRpTxt").textContent = !rp ? "" : rp.pick ? "Click a bar to start from it" : `Bar ${rp.i + 1} of ${B.length} · ${new Date(B[rp.i].t).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET`; }
  function rpStep() { if (!rp || rp.pick) return; if (rp.i >= B.length - 1) { rpStop(); return; } rp.i++; rpTxt(); update(); }
  function rpStop() { clearInterval(rpTimer); rpTimer = null; $p("pcRpPlay").textContent = "▶ Play"; }
  $p("pcRpB").onclick = () => { rp = { pick: true, i: B.length - 1 }; $p("pcRp").hidden = false; rpTxt(); setTool(null); stat("Replay: click the bar to start from"); };
  $p("pcRpPlay").onclick = () => { if (!rp || rp.pick) return; if (rpTimer) { rpStop(); return; } $p("pcRpPlay").textContent = "⏸ Pause"; rpTimer = setInterval(rpStep, +$p("pcRpSpd").value); };
  $p("pcRpSpd").onchange = () => { if (rpTimer) { rpStop(); $p("pcRpPlay").click(); } };
  $p("pcRpStep").onclick = rpStep;
  $p("pcRpEnd").onclick = () => { rpStop(); rp = null; $p("pcRp").hidden = true; update(true); stat(""); };

  // ---------- controls ----------
  function stat(t) { $p("pcStat").textContent = t || ""; }
  function syncUi() {
    document.querySelectorAll("#pcTf [data-tf]").forEach(b => b.classList.toggle("on", b.dataset.tf === O.tf));
    $p("pcType").value = O.type; $p("pcLog").classList.toggle("on", !!O.log); $p("pcSym").value = O.sym; $p("pcCmp").value = O.cmp || "";
    chart.applyOptions({ timeScale: { timeVisible: intraday() } });
  }
  const okSym = s => /^\^?[A-Z][A-Z0-9.\-]{0,8}$/.test(s);
  function setSym(s) { s = (s || "").trim().toUpperCase(); if (!okSym(s) || s === O.sym) { syncUi(); return; } O.sym = s; sel = -1; lastMeasure = null; save(); syncUi(); B = []; update(); load(true); }
  $p("pcSym").addEventListener("change", e => setSym(e.target.value));
  $p("pcSym").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); setSym(e.target.value); e.target.blur(); } });
  $p("pcCmp").addEventListener("change", e => { const s = e.target.value.trim().toUpperCase(); O.cmp = okSym(s) && s !== O.sym ? s : ""; save(); syncUi(); load(true); });
  $p("pcTf").addEventListener("click", e => { const b = e.target.closest("[data-tf]"); if (!b || b.dataset.tf === O.tf) return; O.tf = b.dataset.tf; save(); syncUi(); B = []; lastMeasure = null; update(); load(true); });
  $p("pcType").onchange = e => { O.type = e.target.value; save(); build(false); };
  $p("pcLog").onclick = () => { O.log = !O.log; save(); syncUi(); update(); };
  $p("pcTools").addEventListener("click", e => { const b = e.target.closest("[data-tool]"); if (!b) return; setTool(b.dataset.tool || null); if (!b.dataset.tool) lastMeasure = null, ovDirty = true; });
  $p("pcDel").onclick = del;
  $p("pcClr").onclick = () => { if ($p("pcClr").dataset.arm) { O.draw[O.sym] = []; sel = -1; lastMeasure = null; save(); priceLines(); ovDirty = true; $p("pcClr").textContent = "Clear all"; delete $p("pcClr").dataset.arm; stat("All drawings deleted"); } else { $p("pcClr").dataset.arm = 1; $p("pcClr").textContent = "Select again to confirm"; setTimeout(() => { if ($p("pcClr")) { $p("pcClr").textContent = "Clear all"; delete $p("pcClr").dataset.arm; } }, 3000); } };
  document.addEventListener("keydown", e => {
    if (!$p("pcWrap") || e.target.closest && e.target.closest("input,select,textarea")) return;
    if (e.key === "Escape") { if (tool || pend) { setTool(null); ovDirty = true; } else if (lastMeasure) { lastMeasure = null; ovDirty = true; } else if ($p("pcWrap").classList.contains("pcfs")) fsToggle(); }
    if ((e.key === "Delete" || e.key === "Backspace") && sel >= 0) { e.preventDefault(); del(); }
  });
  // indicator menu
  function menu() {
    const m = $p("pcMenu");
    m.innerHTML = IND_DEF.map(([g, L]) => `<h4>${g}</h4>` + L.map(([k, n]) => `<label><input type="checkbox" data-ind="${k}" ${O.ind[k] ? "checked" : ""}> ${n}</label>`).join("")).join("") + `<h4>Data</h4><div class="pcstat">Prices: Yahoo Finance through your Worker, with pre-market and after-hours. Live ticks from the page feed.</div>`;
  }
  $p("pcIndB").onclick = e => { e.stopPropagation(); const m = $p("pcMenu"); m.hidden = !m.hidden; if (!m.hidden) menu(); };
  $p("pcMenu").addEventListener("change", e => { const i = e.target.closest("[data-ind]"); if (!i) return; O.ind[i.dataset.ind] = i.checked ? 1 : 0; save(); update(); });
  document.addEventListener("click", e => { const m = $p("pcMenu"); if (m && !m.hidden && !e.target.closest("#pcMenu") && !e.target.closest("#pcIndB")) m.hidden = true; });
  // fullscreen (CSS overlay so it also works where the Fullscreen API is blocked)
  let home = null;
  function fsToggle() {
    const w = $p("pcWrap"), on = !w.classList.contains("pcfs");
    if (on) { home = w.parentNode; document.body.appendChild(w); w.classList.add("pcfs"); document.body.style.overflow = "hidden"; try { w.requestFullscreen && w.requestFullscreen().catch(() => { }); } catch (e) { } }
    else { w.classList.remove("pcfs"); (home || mount).appendChild(w); document.body.style.overflow = ""; try { document.fullscreenElement && document.exitFullscreen(); } catch (e) { } }
    $p("pcFs").textContent = on ? "✕" : "⤢"; ovDirty = true;
  }
  $p("pcFs").onclick = fsToggle;
  document.addEventListener("fullscreenchange", () => { const w = $p("pcWrap"); if (!document.fullscreenElement && w.classList.contains("pcfs")) fsToggle(); });
  // snapshot
  $p("pcShot").onclick = () => {
    try {
      const c = chart.takeScreenshot(), g = c.getContext("2d"), dpr = c.width / $p("pcMain").clientWidth;
      g.drawImage(ov, 0, 0, ov.width, ov.height, 0, 0, ov.width / (window.devicePixelRatio || 1) * dpr, ov.height / (window.devicePixelRatio || 1) * dpr);
      const b = data(), x = b[b.length - 1]; g.font = `${Math.round(13 * dpr)}px 'JetBrains Mono',monospace`; g.fillStyle = T.fg;
      g.fillText(`${O.sym} · ${O.tf} · ${x ? fp(x.c) : ""} · SOXX Sniper`, 10 * dpr, 22 * dpr); g.font = `${Math.round(12 * dpr)}px 'JetBrains Mono',monospace`; g.globalAlpha = 0.75; const wm = "SOXX Sniper · live SOXL war room"; g.fillText(wm, c.width - g.measureText(wm).width - 12 * dpr, c.height - 34 * dpr); g.globalAlpha = 1;
      try { c.toBlob(bl => { try { navigator.clipboard.write([new ClipboardItem({ "image/png": bl })]); stat("Saved, and copied: paste it into your post on X"); } catch (e) { } }, "image/png"); } catch (e) { }
      c.toBlob(bl => { const a = document.createElement("a"); a.href = URL.createObjectURL(bl); a.download = `${O.sym}-${O.tf}-${etDate()}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }, "image/png");
    } catch (e) { stat("Snapshot failed"); }
  };
  // classic chart toggle
  const card = document.getElementById("taCard");
  function classic(on) { card.classList.toggle("pc-on", !on); $p("pcWrap").hidden = on; const cb = document.getElementById("pcBack"); if (cb) cb.hidden = !on; try { lsSet("soxx_pc_classic", on ? "1" : ""); } catch (e) { } if (!on) { ovDirty = true; load(true); } }
  $p("pcClassic").onclick = () => classic(true);
  const back = document.createElement("button"); back.id = "pcBack"; back.textContent = "Pro chart"; back.hidden = true; back.onclick = () => classic(false);
  const ctl = document.getElementById("taCtl"); if (ctl && ctl.parentNode) ctl.parentNode.insertBefore(back, ctl);
  // theme changes
  new MutationObserver(() => { T = theme(); allCharts().forEach((c, i) => c.applyOptions(chartOpts(i === 0))); panes.rsi.s.applyOptions({ color: T.violet }); panes.macd.m.applyOptions({ color: T.acc }); panes.macd.g.applyOptions({ color: T.amber }); S.mainType = null; build(false); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { T = theme(); allCharts().forEach((c, i) => c.applyOptions(chartOpts(i === 0))); S.mainType = null; build(false); });

  // stock pages: open the pro chart full screen for that stock
  window.pcOpen = function (sym) { const s = (sym || "").toUpperCase(); if (lsGet("soxx_pc_classic")) classic(false); if (okSym(s) && s !== O.sym) { O.sym = s; save(); syncUi(); B = []; update(); load(true); } if (!$p("pcWrap").classList.contains("pcfs")) fsToggle(); };

  // stock pages: put the same pro chart inside the stock page (all tools, indicators and drawings), and back
  let dockPrev = null;
  window.pcDock = function (el, sym) {
    const w = $p("pcWrap"), s = (sym || "").toUpperCase(); if (!el || !w || !okSym(s)) return false;
    if (lsGet("soxx_pc_classic")) classic(false);
    if (w.classList.contains("pcfs")) fsToggle();
    if (w.parentNode !== el) el.appendChild(w);
    if (dockPrev == null) dockPrev = O.sym;
    if (s !== O.sym) { O.sym = s; syncUi(); B = []; update(); load(true); } else { ovDirty = true; }
    return true;
  };
  window.pcUndock = function () {
    const w = $p("pcWrap"); if (!w) return; if (w.classList.contains("pcfs")) fsToggle();
    if (w.parentNode !== mount) mount.appendChild(w);
    if (dockPrev != null && dockPrev !== O.sym) { O.sym = dockPrev; syncUi(); B = []; update(); load(true); }
    dockPrev = null; save(); ovDirty = true;
  };

  // ---------- start ----------
  syncUi(); card.classList.add("pc-on");
  if (lsGet("soxx_pc_classic")) classic(true);
  load(true);
  setInterval(() => { if ($p("pcWrap").hidden) return; try { live(); } catch (e) { } }, 1000);
  setInterval(() => { if ($p("pcWrap").hidden || rp) return; load(false).catch(() => { }); }, 15000);
  setInterval(() => { if (!$p("pcWrap").hidden && !rp) try { priceLines(); } catch (e) { } }, 30000);
  window.PC = { O, load, chart };
})();
