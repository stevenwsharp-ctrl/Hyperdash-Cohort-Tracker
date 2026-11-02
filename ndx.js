/* Nasdaq-100 panel · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   The Nasdaq 100 as its own market: the Hyperliquid perp (xyz:XYZ100, trades every hour) with the cash index's futures and
   QQQ next to it (SOXX Sniper), and every engine of the sites run on it:
   - cohorts: smart money vs fools bias on the perp (Cohort Sniper's data: latest.json) and the gap's trend
   - trapped traders (trapped.js), when its holders are in the data job (top setups)
   - the Outlook's six systems with 24 h / 48 h / 7 d targets (Cohort Sniper only: it needs the full market table)
   - trade planner per time frame (planner.js), Markov memory (markov.js), Kalman trend and Dirac mass (matrix.js),
     the 4 pm roll-over test and funding carry (rollover.js)
   - SOXX Sniper only: semis vs the Nasdaq today (SOXX vs QQQ, SOXL perp vs the Nasdaq perp): semis leading or lagging.
   Signals go to the spider web under the asset "XYZ100" (the perp's name), so the web learns the Nasdaq as its own market.
   Requests: 3 candle requests every 30 minutes (15 m, 1 h, 1 day); prices come from what each site already loads. */
(function () {
  "use strict";
  if (window.NDXPANEL) return; window.NDXPANEL = 1;
  const COIN = "XYZ:XYZ100", HLC = "xyz:XYZ100", A = "XYZ100", RAW = "https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/data/";
  const soxx = !!document.getElementById("stanceCard"), tabs = document.querySelector(".tabs"); if (!soxx && !tabs) return;
  const card = document.createElement(soxx ? "section" : "div"); card.className = "card"; card.id = "ndxCard"; card.style.margin = soxx ? "0 0 12px" : "10px 0";
  if (soxx) document.getElementById("stanceCard").after(card); else tabs.after(card);
  const st = document.createElement("style");
  st.textContent = `#ndxCard{padding:10px 14px}#ndxCard summary{cursor:pointer;list-style:none}#ndxCard summary::-webkit-details-marker{display:none}#ndxCard .nh{display:flex;flex-wrap:wrap;gap:4px 16px;align-items:baseline}
    #ndxCard .nt{font:600 17px var(--sans,system-ui)}#ndxCard .np{font:600 17px var(--mono,monospace)}#ndxCard .nm{font:12px var(--mono,monospace);color:var(--dim,var(--faint,#888))}
    #ndxCard .ng{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;margin-top:8px}#ndxCard .nb{border:1px solid var(--line);border-radius:10px;padding:7px 10px;font-size:12.5px;min-width:0}
    #ndxCard .nb b.h{display:block;font-size:12px;margin-bottom:3px}#ndxCard table{width:100%;border-collapse:collapse;font:11.5px var(--mono,monospace)}#ndxCard th,#ndxCard td{padding:2px 5px;border-bottom:1px solid var(--line);text-align:right}
    #ndxCard th{color:var(--dim,var(--faint,#888));font-weight:600}#ndxCard .L{color:var(--up,var(--bull,#19d38a))}#ndxCard .S{color:var(--down,var(--bear,#ff4d5e))}#ndxCard .note{font-size:11.5px;color:var(--dim,var(--faint,#888));margin:3px 0;max-width:none}
    #ndxCard .bias{display:flex;height:9px;border-radius:5px;overflow:hidden;background:var(--line);margin:3px 0 5px}`;
  document.head.appendChild(st);
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const c1 = v => Math.max(-1, Math.min(1, v)), pc = (v, d) => v == null || !isFinite(v) ? "–" : (v >= 0 ? "+" : "") + (v * 100).toFixed(d == null ? 2 : d) + "%";
  const fx = v => v == null || !isFinite(v) ? "–" : v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v.toFixed(2), U = v => v == null ? "–" : v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : "$" + (v / 1e3).toFixed(0) + "K";
  const post = b => fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => { if (r.status === 429) throw new Error("429"); return r.json(); });
  let B = {}, bT = 0, LT = null, ltT = 0, X = {}, xT = 0, QQ = null, qT = 0;
  async function loadBars() { if (Date.now() - bT < 30 * 6e4) return; bT = Date.now();
    const get = async (iv, days) => { try { const k = await post({ type: "candleSnapshot", req: { coin: HLC, interval: iv, startTime: Date.now() - days * 864e5, endTime: Date.now() } }); return Array.isArray(k) && k.length ? k.map(b => [b.t, +b.o, +b.h, +b.l, +b.c, +b.v]) : null; } catch (e) { return null; } };
    const m15 = await get("15m", 50), h1 = await get("1h", 200), d1 = await get("1d", 730); if (h1) B = { "15m": m15, "1h": h1, "4h": window.Planner ? Planner.agg(h1, 144e5) : null, "1d": d1 }; else bT = Date.now() - 25 * 6e4; }
  async function loadCohort() {   // SOXX Sniper fetches Cohort Sniper's files; Cohort Sniper uses its own globals
    if (soxx && Date.now() - ltT > 10 * 6e4) { ltT = Date.now(); try { const r = await fetch(RAW + "latest.json?t=" + Math.floor(Date.now() / 3e5)); if (r.ok) LT = await r.json(); } catch (e) { } }
    if (soxx && typeof fredProxy === "function" && fredProxy() && Date.now() - qT > 5 * 6e4) { qT = Date.now(); try { const j = await (await fetch(`${fredProxy()}/chart?t=QQQ&range=1d&interval=5m`)).json(); if (j.status === "ok" && j.meta) { const b = (j.bars || []).filter(x => x[4] != null); QQ = { px: b.length ? b[b.length - 1][4] : j.meta.price, prev: j.meta.prevClose }; } } catch (e) { } } }
  const latest = () => soxx ? LT : (typeof DATA !== "undefined" ? DATA : null);
  function cohorts() {
    const D = latest(); if (!D || !D.m || !D.m[COIN] || !D.pnl) return null; const P = D.pnl, m = D.m[COIN];
    const ag = ids => { let L = 0, S = 0, lt = 0, st = 0; ids.forEach(id => { const i = P.findIndex(c => c.id === id); if (i >= 0 && m.p[i]) { const r = m.p[i]; lt += r[0]; st += r[1]; L += r[2]; S += r[3]; } }); const n = L + S, tc = lt + st, bd = n ? (L - S) / n : 0, bc = tc ? (lt - st) / tc : 0; return { L, S, n, b: tc ? 0.6 * bd + 0.4 * bc : bd, traders: tc }; };
    const sm = ag(["extremely_profitable", "very_profitable"]), fo = ag(["unprofitable", "very_unprofitable", "rekt"]); return { sm, fo, gap: (sm.b - fo.b) / 2, tr: D.tr && D.tr[COIN] };
  }
  function ctx() { if (soxx) { const p = (window.PERPCTX || {})[A]; return p ? { px: p.px, ch: p.d != null ? p.d * 100 : null, f: p.f } : null; } try { return ctxOf(COIN); } catch (e) { return null; } }
  function engines(px, f) {
    if (Date.now() - xT < 10 * 6e4 && X.px) return X; xT = Date.now(); const h1 = B["1h"]; const o = { px };
    try { if (window.Planner && h1) o.P = Planner.run(A, B); } catch (e) { console.warn("ndx planner", e); }
    try { if (window.Markov && h1) o.M = Markov.analyze(h1); } catch (e) { }
    try { if (window.Matrix && h1) { o.K = Matrix.kalman(h1); o.D = Matrix.dirac(h1); } } catch (e) { }
    try { if (window.Rollover && h1) o.R = Rollover.analyze(h1); } catch (e) { }
    try { if (window.Hub) { const H = Hub.from; Hub.report([].concat(H.planner(o.P, A), H.markov(o.M, A), H.kd(o.K, o.D, A), H.roll(o.R, A))); } } catch (e) { }
    return X = o;
  }
  function trapped(px) { try { const SP = soxx ? (window.TRAPDATA || {}).SP : (typeof SPEC !== "undefined" ? SPEC : null), LV = soxx ? (window.TRAPDATA || {}).LV : (typeof LEVELS !== "undefined" ? LEVELS : null); const h = SP && SP.m && SP.m[COIN] && SP.m[COIN].holders; return h && window.Trapped ? Trapped.analyze(h, LV && LV.m && LV.m[COIN] && LV.m[COIN].h, px) : null; } catch (e) { return null; } }
  function outlook() { try { const O = window.csOutlook && csOutlook(); if (!O) return null; return [24, 48, 168].map(h => { const x = (O.all[h] || []).find(x => x.r.coin === COIN); return x ? { h, x } : null; }).filter(Boolean); } catch (e) { return null; } }
  let open = lsG("ndx_open", true);
  async function tick() {
    if (document.hidden && card.innerHTML) return;
    await Promise.all([loadBars(), loadCohort()]);
    const c = ctx(), px = c && c.px || (B["1h"] && B["1h"][B["1h"].length - 1][4]); if (!px) { card.innerHTML = `<div class="note">Nasdaq 100: loading the perp…</div>`; return; }
    const C = cohorts(), T = trapped(px), E = engines(px, c && c.f), O = soxx ? null : outlook(), I = [];
    // signals for the web, asset XYZ100
    if (E.P) Planner.signals(E.P).forEach(x => I.push(x)); if (T) Trapped.signals(T).forEach(x => I.push(x)); if (E.M) Markov.signals(E.M).forEach(x => I.push(x));
    if (E.K || E.D) Matrix.signals({ K: E.K, D: E.D }).forEach(x => I.push(x)); if (E.R) Rollover.signals(E.R, c && c.f).forEach(x => I.push(x));
    if (C && Math.abs(C.gap) >= 0.1) I.push(["ndx.gap", c1(C.gap * 1.5), "Nasdaq 100 · smart money vs fools on the perp"]);
    try { if (window.Web) I.forEach(([id, v, lab]) => { if (v && isFinite(v)) Web.emit(id, A, c1(v), lab); }); } catch (e) { }
    window.NDX = { at: Date.now(), px, C, T, E, I };
    // semis vs Nasdaq (SOXX Sniper)
    let rel = ""; if (soxx) { const S = window.STANCE && STANCE.T || {}, nq = S.nq, q = QQ && QQ.prev ? QQ.px / QQ.prev - 1 : null, sx = typeof Q === "object" && Q.SOXX && Q.SOXX.pc > 0 && Q.SOXX.c > 0 ? Q.SOXX.c / Q.SOXX.pc - 1 : null, pp = window.PERPCTX || {};
      const g = sx != null && q != null ? sx - q : pp.SOXL && pp.XYZ100 && pp.SOXL.d != null && pp.XYZ100.d != null ? pp.SOXL.d / 3 - pp.XYZ100.d : null;
      if (g != null && Math.abs(g) >= 0.003) try { window.Web && Web.emit("ndx.semirel", "SOXL", c1(g / 0.02), "Nasdaq 100 · semis vs the Nasdaq today (leading +)"); } catch (e) { }
      rel = `<div class="nb"><b class="h">Semis vs the Nasdaq</b>QQQ ${QQ ? `${fx(QQ.px)} <span class="${q >= 0 ? "L" : "S"}">${pc(q)}</span>` : "–"} · NQ futures ${nq ? `${fx(nq.px)} <span class="${nq.d >= 0 ? "L" : "S"}">${pc(nq.d)}</span>` : "–"} · SOXX ${sx != null ? `<span class="${sx >= 0 ? "L" : "S"}">${pc(sx)}</span>` : "–"}
        <div>Semis ${g == null ? "–" : `<b class="${g > 0 ? "L" : "S"}">${g > 0 ? "lead" : "lag"} by ${pc(Math.abs(g)).replace("+", "")}</b>`} today. ${g == null ? "" : g > 0 ? "Chips are pulling the Nasdaq: risk appetite is in the AI trade." : "Chips trail the Nasdaq: money is rotating out of the AI trade, or into the defensive megacaps."}</div></div>`; }
    const coh = C ? `<div class="nb"><b class="h">Cohorts on the perp</b>Smart money <b class="${C.sm.b >= 0 ? "L" : "S"}">${pc(C.sm.b, 0)}</b> (${U(C.sm.n)}) · fools <b class="${C.fo.b >= 0 ? "L" : "S"}">${pc(C.fo.b, 0)}</b> (${U(C.fo.n)})
      <div class="bias"><i style="width:${(C.sm.b + 1) * 50}%;background:var(--up,var(--bull,#19d38a))"></i></div><div>Gap <b class="${C.gap >= 0 ? "L" : "S"}">${(C.gap * 100).toFixed(0)}</b> → smart ${C.gap >= 0 ? "long" : "short"}${C.tr ? ` · gap change: ${["4h", "24h", "7d"].filter(k => C.tr[k]).map(k => `${k} ${C.tr[k][0] > 0 ? "+" : ""}${C.tr[k][0]}`).join(", ")}` : ""}.</div>
      <div class="note">On the 40-day backtest, the cohort gap was the one ranking system that held up (strongest over 7 days).</div></div>` : `<div class="nb"><b class="h">Cohorts on the perp</b><div class="note">Loading Cohort Sniper's data…</div></div>`;
    const tr = T ? `<div class="nb"><b class="h">Trapped traders (top holders)</b>Longs <b class="L">${U(T.L.usd)}</b> ${pc(T.L.depW, 1).replace("+", "")} under · shorts <b class="S">${U(T.S.usd)}</b> ${pc(T.S.depW, 1).replace("+", "")} under<div>Past their usual stop: longs ${U(T.L.past)}, shorts ${U(T.S.past)} · near liquidation (10%): ${U(T.L.liq10)} / ${U(T.S.liq10)}</div><div>Pressure <b class="${T.P > 0.05 ? "L" : T.P < -0.05 ? "S" : ""}">${T.P >= 0 ? "+" : ""}${T.P.toFixed(2)}</b> ${T.P > 0.05 ? "squeeze risk up" : T.P < -0.05 ? "flush risk down" : "balanced"}</div></div>` : "";
    const ol = O && O.length ? `<div class="nb"><b class="h">Outlook · six systems</b><table><thead><tr><th style="text-align:left">Horizon</th><th>Lean</th><th>Agree</th><th>Target</th><th>Wrong if</th></tr></thead><tbody>${O.map(({ h, x }) => { const s = x.s.cons, d = Math.sign(s) || 1, m = 0.5 + Math.min(1, Math.abs(s)); return `<tr><td style="text-align:left">${h === 168 ? "7 days" : h + " h"}</td><td class="${s > 0.06 ? "L" : s < -0.06 ? "S" : ""}">${Math.abs(s) < 0.06 ? "no lean" : (s > 0 ? "long " : "short ") + Math.abs(s).toFixed(2)}</td><td>${x.ag}/${x.n}</td><td>${fx(x.px * Math.exp(d * x.sH * m))}</td><td>${fx(x.px * Math.exp(-d * x.sH * 0.75))}</td></tr>`; }).join("")}</tbody></table></div>` : "";
    const M = E.M, K = E.K, D = E.D, R = E.R;
    const path = `<div class="nb"><b class="h">Path and physics (hourly, 200 days)</b>${M ? `Markov: ${M.verdict}; forgets its state in ~${M.mix} h.` : ""} ${K ? `Kalman trend t ${K.t.toFixed(1)}${K.pass ? " (tested, live)" : " (not proven)"}.` : ""} ${D ? `Dirac mass ${D.aNow.toFixed(2)} vs ${D.aAll.toFixed(2)} (${D.aNow < D.aAll - 0.04 ? "light: moves run" : D.aNow > D.aAll + 0.04 ? "heavy: chop" : "normal"}), speed ${Math.round(D.beta * 100)}% of its limit.` : ""} ${R ? `4 pm roll-over: ${R.dir > 0 ? "the day's side continues (tested)" : R.dir < 0 ? "the day's side reverses (tested)" : "no proven edge"}.` : ""}${c && c.f != null ? ` Funding ${(c.f * 24 * 365 * 100).toFixed(1)}%/yr (${c.f > 0 ? "longs pay" : "shorts pay"}).` : ""}</div>`;
    const sig = I.length ? `<div class="note">To the spider web (asset XYZ100): ${I.map(([id, v, lab]) => `<span class="${v > 0 ? "L" : "S"}">${lab.split(" · ").slice(-1)[0]} ${v > 0 ? "▲" : "▼"}${Math.abs(v).toFixed(2)}</span>`).join(" · ")}</div>` : "";
    card.innerHTML = `<details ${open ? "open" : ""}><summary><div class="nh"><span class="nt">Nasdaq 100</span><span class="np">${fx(px)}</span><span class="nm"><span class="${(c && c.ch) >= 0 ? "L" : "S"}">${c && c.ch != null ? pc(c.ch / 100) : ""}</span> 24 h · Hyperliquid perp (xyz:XYZ100), every hour of every day${C ? ` · smart money <b class="${C.gap >= 0 ? "L" : "S"}">${C.gap >= 0 ? "long" : "short"}</b>` : ""}${O && O[1] ? ` · 48 h lean <b class="${O[1].x.s.cons > 0 ? "L" : "S"}">${O[1].x.s.cons > 0 ? "long" : "short"}</b>` : ""} ▾</span></div></summary>
      <div class="ng">${rel}${coh}${ol}${tr}${path}</div>
      ${E.P ? `<div class="nb" style="margin-top:10px"><b class="h">Trade planner · one plan per time frame, 14 days at most</b>${Planner.html(E.P, { px: fx })}</div>` : ""}${sig}</details>`;
    card.querySelector("details").ontoggle = e => { open = e.target.open; lsS("ndx_open", open); };
  }
  setTimeout(tick, soxx ? 14000 : 9000); setInterval(tick, 60000);
  if (soxx && window.Hub) Hub.card(card, "hubCard");   // the knowledge hub sits right under the Nasdaq panel on SOXX Sniper
})();
