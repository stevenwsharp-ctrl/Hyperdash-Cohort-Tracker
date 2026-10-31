/* Cohort Sniper · Crowd psychology, macro links, coupling and coordination in the signal web.
   For the top markets, behavioral readings become nodes in the signal web (which learns what each is worth):
     Psychology
     - News, rational or not: 7 days of headlines tied to markets (news.json) and the price history (history.json):
       the first hour after a headline, then the next 4 hours. Continuation = under-reaction (slow digestion);
       reversal = over-reaction (emotion, then correction). Live: a fresh headline gets the learned follow-through.
     - Big move with no news: order flow and emotion, not information; tends to snap back.
     - Fools' herd: the losing cohorts crowd one side by trader count (many small accounts) — usually late.
     - Trapped holders (disposition effect): underwater longs are supply near breakeven; underwater shorts are squeeze fuel.
     Macro: the 10Y yield, the euro (dollar), gold, oil, Bitcoin, the S&P 500 and the VIX, as nodes on every market.
     Coupling (Ent, link.js): hourly bars from history.json; stretch vs coupled markets, leaders, cohesion.
     Coordination (Sync, link.js):
     - cohort sweep: the smart cohorts shift the same way in most markets at once (one macro decision) vs one market alone,
     - wallet bursts, linked wallets and leaders among the best and worst holders of the starred markets (their fills).
   Uses: ROWS, HIST, NEWS, NEWS_BY, SPEC, ctxOf, CONTEXT, parse, esc, Web, VIEW, Ent, Sync, csTrades. */
(function () {
  "use strict";
  const c1 = v => Math.max(-1, Math.min(1, v));
  // ---- price at time t from history.json (5 min for 2h, 15 min to 26h, then hourly): interpolate across gaps up to 75 min ----
  let TI = null, TIk = null;
  const times = () => { const S = HIST && HIST.snapshots || []; const k = S.length + "|" + (S.length ? S[S.length - 1].t : ""); if (k !== TIk) { TI = S.map(s => Date.parse(s.t)); TIk = k; } return TI; };
  function pxAt(coin, t, f) {
    const S = HIST && HIST.snapshots || [], T = times(); if (!S.length) return null; f = f == null ? 2 : f;
    let lo = 0, hi = T.length - 1; if (t < T[0] || t > T[hi] + 10 * 6e4) return null;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T[m] <= t) lo = m; else hi = m - 1; }
    const v = i => { const x = S[i] && S[i].d && S[i].d[coin]; return x && x[f] != null && (f !== 2 || x[f] > 0) ? x[f] : null; };
    const a = v(lo); if (lo === T.length - 1) return t - T[lo] <= 10 * 6e4 ? a : null;
    const b = v(lo + 1); if (a == null || b == null || T[lo + 1] - T[lo] > 75 * 6e4) return t - T[lo] <= 6e5 ? a : null;
    return a + (b - a) * (t - T[lo]) / (T[lo + 1] - T[lo]);
  }
  // ---- the news study ----
  let ST = null, stT = 0;
  function study() {
    if (ST && Date.now() - stT < 10 * 6e4) return ST;
    const N = (NEWS && NEWS.items) || []; if (!times().length || !N.length) return ST;
    const R = { n: 0, cont: 0, big: { n: 0, cont: 0 }, ign: 0, rows: [] }, seen = new Set();
    for (const n of N) { if (!n.c || !n.c.length || !n.t) continue; const coin = n.c[0], k = coin + Math.floor(n.t / 36e5); if (seen.has(k)) continue; seen.add(k);
      const p0 = pxAt(coin, n.t), p1 = pxAt(coin, n.t + 36e5), p5 = pxAt(coin, n.t + 5 * 36e5); if (!p0 || !p1) continue;
      const r1 = p1 / p0 - 1, r2 = p5 ? p5 / p1 - 1 : null, row = { t: n.t, coin, h: n.h, url: n.url, b: !!n.b, r1, r2 };
      if (Math.abs(r1) < 0.004) { R.ign++; row.v = "ignored or priced in"; }
      else if (r2 != null) { R.n++; const c = Math.sign(r2) === Math.sign(r1); if (c) R.cont++; if (Math.abs(r1) >= 0.015) { R.big.n++; if (c) R.big.cont++; } row.v = c ? "continued: under-reaction" : "reversed: over-reaction"; }
      else row.v = "waiting";
      R.rows.push(row); }
    R.contR = R.n ? R.cont / R.n : null; R.bigR = R.big.n ? R.big.cont / R.big.n : null; R.rows.sort((a, b) => b.t - a.t);
    ST = R; stT = Date.now(); return R;
  }
  // ---- coupling map from history.json, hourly bars ----
  let E = null, eT = 0;
  const MACRO = ["XYZ:SP500", "XYZ:XYZ100", "PARA:10Y", "XYZ:EUR", "XYZ:JPY", "XYZ:GOLD", "XYZ:CL", "BTC", "ETH"];
  function ent() {
    if (E && Date.now() - eT < 10 * 6e4) return E; const T = times(); if (T.length < 30) return E;
    const last = (HIST.snapshots[HIST.snapshots.length - 1] || {}).d || {};
    const coins = [...new Set(ROWS.slice().sort((a, b) => b.rating - a.rating).slice(0, 35).map(r => r.coin).concat(MACRO, Object.keys(last).filter(c => window.Tax && Tax.tag(c).known)))];
    const t1 = Math.floor(T[T.length - 1] / 36e5) * 36e5, t0 = Math.max(T[0], t1 - 7 * 864e5), S = {};
    coins.forEach(c => { const a = []; for (let t = Math.ceil(t0 / 36e5) * 36e5; t <= t1; t += 36e5) { const p = pxAt(c, t); if (p) a.push([t, p]); } if (a.length >= 40) S[c] = a; });
    E = Ent.analyze(S, { bar: 36e5, short: 12, k: 3, maxLag: 2, minN: 40, tag: window.Tax ? Tax.tag : null }); eT = Date.now(); return E;
  }
  // ---- coordination among the best and worst holders of the starred markets ----
  let Y = null, yT = 0;
  function syn() {
    if (Y && Date.now() - yT < 5 * 6e4) return Y; if (!window.csTrades) return Y;
    const T = csTrades().filter(x => !x.mm); if (T.length < 20) { Y = null; return Y; }
    Y = Sync.analyze(T, { win: 15 * 6e4, minW: 3, px: (t, c) => pxAt(c, t) }); yT = Date.now(); return Y;
  }
  // ---- cohort sweep: smart-cohort bias change over ~1h in every market ----
  function sweep() {
    const now = times().length ? times()[times().length - 1] : 0; if (!now) return null; const ch = {};
    ROWS.forEach(r => { const a = pxAt(r.coin, now, 0), b = pxAt(r.coin, now - 36e5, 0); if (a != null && b != null) ch[r.coin] = a - b; });
    const v = Object.values(ch).sort((x, y) => x - y); if (v.length < 20) return null;
    const med = v[v.length >> 1], up = v.filter(x => x >= 5).length / v.length, dn = v.filter(x => x <= -5).length / v.length;
    return { ch, med, up, dn, n: v.length };
  }
  // ---- rhythm (rhythm.js): hourly bars, 60 days, for the starred markets and the 12 top setups; 2 markets per minute ----
  const RHY = {}; let rhyBusy = false;
  async function rhyLoad() {
    if (rhyBusy || !window.Rhythm || document.hidden) return; rhyBusy = true;
    try { let st = []; try { st = JSON.parse(localStorage.getItem("cs_stars") || "[]"); } catch (e) { }
      const want = [...new Set(st.concat(ROWS.slice().sort((a, b) => b.rating - a.rating).slice(0, 12).map(r => r.coin)))];
      const due = want.filter(c => !RHY[c] || Date.now() - RHY[c].t > 30 * 6e4).sort((a, b) => ((RHY[a] || {}).t || 0) - ((RHY[b] || {}).t || 0)).slice(0, 2);
      for (const c of due) { try { const r = await fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "candleSnapshot", req: { coin: hlName(c), interval: "1h", startTime: Date.now() - 60 * 864e5, endTime: Date.now() } }) });
          if (r.status === 429) break; const k = r.ok ? await r.json() : null; if (Array.isArray(k) && k.length >= 80) RHY[c] = { t: Date.now(), R: Rhythm.analyze(k.map(b => [b.t, +b.o, +b.h, +b.l, +b.c]), { win: 400 }) }; else RHY[c] = { t: Date.now(), R: null }; } catch (e) { }
        await new Promise(r => setTimeout(r, 1500)); }
    } catch (e) { } rhyBusy = false;
  }
  window.csRhythm = () => RHY;
  let lastT = 0;
  function feed() {
    if (!window.Web || !ROWS || !ROWS.length || Date.now() - lastT < 60000) return; lastT = Date.now();
    const R = study(), now = Date.now();
    try { ent(); } catch (e) { console.warn("ent", e); } try { syn(); } catch (e) { console.warn("sync", e); }
    const SW = sweep();
    const g = c => { const x = ctxOf(c); return x && x.ch != null ? x.ch : null; };
    const mac = [["mkt.us10y", "PARA:10Y", 3, "Rates · US 10Y yield 24h"], ["mkt.eur", "XYZ:EUR", 1, "Currencies · euro 24h (dollar weaker +)"], ["mkt.gold", "XYZ:GOLD", 3, "Commodities · gold 24h"],
      ["mkt.oil", "XYZ:CL", 5, "Commodities · oil 24h"], ["mkt.btc", "BTC", 6, "Crypto · Bitcoin 24h"], ["mkt.sp500", "XYZ:SP500", 2, "Stocks · S&P 500 24h"]].map(([id, c, sc, lab]) => [id, g(c), sc, lab]).filter(x => x[1] != null);
    const vix = CONTEXT && CONTEXT.vix ? CONTEXT.vix : null;
    const out = [], lnk = [];
    ROWS.slice().sort((a, b) => b.rating - a.rating).slice(0, 80).forEach(r => {
      const a = r.sym || parse(r.coin).sym, L = [];
      // fresh news and its learned follow-through
      const fn = (NEWS_BY[r.coin] || []).filter(n => now - n.t < 4 * 36e5 && now - n.t > 36e5).sort((x, y) => (y.b ? 1 : 0) - (x.b ? 1 : 0) || y.t - x.t)[0];
      if (fn && R && R.n >= 15) { const p0 = pxAt(r.coin, fn.t), v = (ctxOf(r.coin) || {}).px; if (p0 && v) { const m = v / p0 - 1; if (Math.abs(m) >= 0.005) L.push(["psy.news-follow", Math.sign(m) * (R.contR - 0.5) * 4, "Psychology · fresh headline, learned follow-through"]); } }
      // big 1h move with no news
      { const v = (ctxOf(r.coin) || {}).px, w = pxAt(r.coin, now - 36e5);
        if (v && w && !(NEWS_BY[r.coin] || []).some(n => now - n.t < 90 * 6e4)) { const m = v / w - 1, ch = r.ctx && r.ctx.ch != null ? Math.max(0.002, Math.abs(r.ctx.ch) / 100 / 4.9) : 0.01;   // normal 1h ≈ 24h move ÷ √24
          if (Math.abs(m) / ch >= 2.5) L.push(["psy.no-news-move", -Math.sign(m) * Math.min(1, (Math.abs(m) / ch - 2) / 3), "Psychology · big move with no news (snap-back)"]); } }
      // fools' herd by trader count
      if (r.fo && isFinite(r.fo.bc) && Math.abs(r.fo.bc) >= 0.4 && r.fo.traders >= 30) L.push(["psy.fools-herd", -r.fo.bc, "Psychology · losing traders herding (contrarian)"]);
      // trapped holders among the top 30 holders
      const X = SPEC && SPEC.m && SPEC.m[r.coin]; if (X && X.holders) { let tl = 0, ts = 0, tot = 0; X.holders.forEach(h => { if (h.miss) return; tot += h.n; if (h.u < 0) { if (h.sd > 0) tl += h.n; else ts += h.n; } });
        if (tot && (tl + ts) / tot >= 0.15) L.push(["psy.trapped", (ts - tl) / tot * 2, "Psychology · trapped holders (shorts = squeeze fuel, longs = supply)"]); }
      // macro links
      mac.forEach(([id, ch, sc, lab]) => L.push([id, c1(ch / sc), lab]));
      if (vix && vix.ch != null) L.push(["mkt.vix", c1(vix.ch / 10), "Volatility · VIX change (fear +)"]);
      // coupling
      const s = Ent.signals(E, r.coin); if (s) { if (s.catchup) L.push(["ent.catchup", s.catchup, "Coupling · stretch vs coupled markets closes"]); if (s.lead) L.push(["ent.lead", s.lead, "Coupling · a leading market already moved"]); if (s.peer) L.push(["ent.peer", s.peer, "Peers · ahead of or behind comparable companies"]); }
      // its group tide: the industry and size group moves (sector rotation, style flows)
      if (E && E.G && window.Tax) { const t = E.G.TG[r.coin] || Tax.tag(r.coin), gi = E.G.by.ind.find(g => g.g === t.ind && g.ms.length >= 3), gc = E.G.by.cap.find(g => g.g === t.cap && g.ms.length >= 4);
        if (gi && isFinite(gi.mk)) L.push(["grp.industry", c1(gi.mk / 0.03), "Groups · its industry's last 3h (" + t.ind + ")"]); if (gc && isFinite(gc.mk)) L.push(["grp.size", c1(gc.mk / 0.03), "Groups · its size group's last 3h (" + t.cap + ")"]); }
      // coordination: cohort sweep and wallets
      if (SW && SW.ch[r.coin] != null) { if (Math.max(SW.up, SW.dn) >= 0.35) L.push(["sync.sweep", c1(SW.med / 15), "Coordination · smart cohorts shift together in most markets"]);
        const id = SW.ch[r.coin] - SW.med; if (Math.abs(id) >= 8) L.push(["sync.idio", c1(id / 25), "Coordination · smart cohort moves in this market alone"]); }
      const lv = Y && Sync.live(Y, r.coin, 2 * 36e5);
      if (lv) { if (lv.best) L.push(["sync.best", lv.best, "Coordination · best holders moved together"]); if (lv.worst) L.push(["sync.worst", lv.worst, "Coordination · worst holders moved together"]); if (lv.leader) L.push(["sync.leader", lv.leader, "Coordination · a leader wallet moved first"]); }
      // rhythm
      const RH = RHY[r.coin] && RHY[r.coin].R; if (RH) [["trend", "Rhythm · path memory (trend or snap-back)"], ["hour", "Rhythm · this hour of the day, history"], ["cycle", "Rhythm · repeating cycle"], ["fib", "Rhythm · Fibonacci level (back-tested)"], ["home", "Rhythm · pull back home (vs chance)"], ["flow", "Rhythm · poetry in motion (smooth trend)"]].forEach(([k, lab]) => { const v = RH.sig[k]; if (v) L.push(["rhy." + k, v, lab]); });
      L.forEach(([id, v, lab]) => { if (isFinite(v) && v) Web.emit(id, a, c1(v), lab); });
      const ps = L.filter(x => /^psy\./.test(x[0]) && Math.abs(x[1]) >= 0.2); if (ps.length) out.push({ r, ps });
      const ls = L.filter(x => /^(ent|sync)\./.test(x[0]) && Math.abs(x[1]) >= 0.2); if (ls.length) lnk.push({ r, ps: ls, why: [].concat(s ? s.why : [], lv ? lv.why : []) });
    });
    window.CROWD = { R, out, lnk, E, Y, SW };
    if (VIEW === "web") renderPsy();
  }
  const sym = c => { try { return parse(c).sym; } catch (e) { return c; } };
  function renderPsy() {
    const sec = document.getElementById("v-web"); if (!sec) return;
    let el = document.getElementById("webPsy"); if (!el) { el = document.createElement("div"); el.id = "webPsy"; sec.appendChild(el); }
    const C = window.CROWD, R = C && C.R; if (!C) { el.innerHTML = ""; return; }
    const pc = v => v == null ? "–" : (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%", sum = o => o.ps.reduce((a, x) => a + x[1], 0);
    const lean = o => `<td class="${sum(o) >= 0 ? "L" : "S"}">${sum(o) >= 0 ? "▲" : "▼"} ${Math.abs(sum(o)).toFixed(2)}</td>`;
    const SW = C.SW;
    el.innerHTML = `<h3>Crowd psychology · rational vs irrational</h3>
      <div class="info">${R && R.n ? `<b>News study</b> (${R.n} headlines tied to markets, last 7 days): after the first hour the move <b>continued ${Math.round(R.contR * 100)}%</b> and reversed ${100 - Math.round(R.contR * 100)}% of the time over the next 4 hours${R.bigR != null ? `; after big first reactions (1.5%+) it continued ${Math.round(R.bigR * 100)}% of ${R.big.n}` : ""}. ${R.ign} headlines moved price less than 0.4%: ignored, or already priced in. Continuation = the market under-reacts (rational but slow); reversal = it over-reacts (emotion first, then correction). The signal web uses this for every fresh headline.` : "The news study needs headlines tied to markets and the price history; it fills in as both load."}</div>
      ${C.out.length ? `<div class="card" style="padding:6px 10px;overflow-x:auto"><table class="tr"><thead><tr><th style="text-align:left">Market</th><th style="text-align:left">Crowd pattern now</th><th>Lean</th></tr></thead><tbody>${C.out.slice(0, 15).map(o => `<tr><td style="text-align:left"><a href="#" data-goto="${esc(o.r.coin)}">${esc(o.r.sym)}</a></td><td style="text-align:left">${o.ps.map(x => esc(x[2].replace("Psychology · ", ""))).join(" · ")}</td>${lean(o)}</tr>`).join("")}</tbody></table></div>` : ""}
      ${R && R.rows.length ? `<div class="card" style="padding:6px 10px;overflow-x:auto;margin-top:8px"><table class="tr"><thead><tr><th style="text-align:left">When</th><th style="text-align:left">Market</th><th style="text-align:left">Headline</th><th>First hour</th><th>Next 4h</th><th style="text-align:left">Verdict</th></tr></thead><tbody>${R.rows.slice(0, 12).map(x => `<tr><td style="text-align:left">${new Date(x.t).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</td><td style="text-align:left">${esc(sym(x.coin))}</td><td style="text-align:left;white-space:normal"><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc((x.h || "").slice(0, 90))}</a>${x.b ? " <b>big</b>" : ""}</td><td class="${x.r1 >= 0 ? "L" : "S"}">${pc(x.r1)}</td><td class="${(x.r2 || 0) >= 0 ? "L" : "S"}">${pc(x.r2)}</td><td style="text-align:left">${x.v}</td></tr>`).join("")}</tbody></table></div>` : ""}
      <div class="note" style="max-width:none;margin-top:6px">Why crowds act this way: people under-react to slow, complex news (it takes time to digest) and over-react to vivid, dramatic news. They hold losers to avoid the pain of a loss (disposition effect), so old buyers sell at breakeven. Losses hurt about twice as much as gains feel good, so panics end in capitulation. Many small traders on one side (herding) are usually late. Each pattern is a node in the signal web: the web, not this text, decides how much it is worth, from what price did after it.</div>
      <h3 style="margin-top:14px">Links · coupling and coordination</h3>
      ${SW ? `<div class="info"><b>Cohort sweep (last hour)</b>: the smart cohorts' bias rose 5+ points in ${Math.round(SW.up * 100)}% of ${SW.n} markets and fell in ${Math.round(SW.dn * 100)}% (median ${SW.med >= 0 ? "+" : ""}${SW.med.toFixed(1)} pts). ${Math.max(SW.up, SW.dn) >= 0.35 ? `<b>A sweep</b>: the best traders changed their risk across the board at once — a macro decision (rates, dollar, risk appetite), not a view on one name.` : "No sweep: the smart cohorts act market by market."}</div>` : ""}
      ${C.lnk.length ? `<div class="card" style="padding:6px 10px;overflow-x:auto"><table class="tr"><thead><tr><th style="text-align:left">Market</th><th style="text-align:left">Link signal now</th><th>Lean</th></tr></thead><tbody>${C.lnk.slice(0, 15).map(o => `<tr><td style="text-align:left"><a href="#" data-goto="${esc(o.r.coin)}">${esc(o.r.sym)}</a></td><td style="text-align:left;white-space:normal">${o.ps.map(x => esc(x[2].replace(/^(Coupling|Coordination) · /, ""))).join(" · ")}${o.why.length ? `<div class="note" style="margin:2px 0 0">${esc(o.why.slice(0, 2).join(" · "))}</div>` : ""}</td>${lean(o)}</tr>`).join("")}</tbody></table></div>` : ""}
      <div class="wl2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px"><div class="card" style="padding:6px 10px;overflow-x:auto"><b>Coupling map ("entanglement")</b>${Ent.html(C.E, sym)}</div>
      <div class="card" style="padding:6px 10px;overflow-x:auto"><b>Coordination · best and worst holders of your starred markets</b>${Sync.html(C.Y, { showC: true, usd: v => "$" + (v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : (v / 1e3).toFixed(1) + "K") })}${!C.Y ? `<div class="note">Star a few markets: the study uses their holders' fills.</div>` : ""}</div></div>
      <div class="card" style="padding:6px 10px;overflow-x:auto;margin-top:8px"><b>Markets, sectors, industries, size and age · what moves together and what does not</b>${Ent.groupHtml(C.E, sym)}</div>
      ${(() => { const E = Object.entries(RHY).filter(([, v]) => v.R).map(([c, v]) => ({ c, R: v.R })); if (!E.length) return `<h3 style="margin-top:14px">Rhythm · randomness, regularity, Fibonacci, music and flow</h3><div class="note">Loading hourly bars for your starred markets and the top setups (2 markets a minute).</div>`;
        const sum = R => Object.values(R.sig).reduce((a, v) => a + (v || 0), 0), pick = (localStorage.getItem("cs_rhy_pick") && E.find(x => x.c === localStorage.getItem("cs_rhy_pick"))) || E[0];
        return `<h3 style="margin-top:14px">Rhythm · randomness, regularity, Fibonacci, music and flow</h3><div class="card" style="padding:6px 10px;overflow-x:auto"><table class="tr"><thead><tr><th style="text-align:left">Market</th><th style="text-align:left">Randomness</th><th style="text-align:left">Flow</th><th style="text-align:left">Fibonacci</th><th style="text-align:left">Music</th><th>Lean</th></tr></thead><tbody>${E.map(({ c, R }) => `<tr data-rhy="${esc(c)}" style="cursor:pointer${c === pick.c ? ";background:var(--hover,rgba(127,127,127,.08))" : ""}"><td style="text-align:left">${esc(sym(c))}</td><td style="text-align:left">${esc(R.rand.label.split(":")[0])}</td><td style="text-align:left">${esc(R.flow.label.split(":")[0])}${R.flow.dir ? (R.flow.dir > 0 ? " ▲" : " ▼") : ""}</td><td style="text-align:left">${R.fib ? `${R.fib.x != null ? Math.round(R.fib.x * 100) + "%" : "–"}${R.fib.near ? " at " + (R.fib.near.L * 100).toFixed(1) : ""}${R.fib.edge != null ? (R.fib.edge >= 0.08 ? " · works here" : " · no edge") : ""}` : "–"}</td><td style="text-align:left">${R.music ? (R.music.tension ? "squeeze · " : "") + (R.music.zHome != null ? R.music.zHome.toFixed(1) + "σ from home" : "") : "–"}</td><td class="${sum(R) >= 0 ? "L" : "S"}">${sum(R) ? (sum(R) > 0 ? "▲ " : "▼ ") + Math.abs(sum(R)).toFixed(2) : "–"}</td></tr>`).join("")}</tbody></table></div>
          <div class="card" style="padding:6px 10px;overflow-x:auto;margin-top:8px"><b>${esc(sym(pick.c))}</b> (select a row)${Rhythm.html(pick.R, { px: v => price(v) })}</div>`; })()}
      <div class="note" style="max-width:none;margin-top:6px">"Entanglement" is a metaphor: in physics, measuring one entangled particle tells you the other's state. Coupled markets share drivers (rates, the dollar, AI spend, crypto risk appetite), so a move in one says something about the other — a statistical link that can break. When a tight link breaks, that is news too: the name now trades on its own story.</div>`;
  }
  document.addEventListener("click", e => { if (e.target.closest(".tab[data-tab='web']")) setTimeout(renderPsy, 50); const rr = e.target.closest("[data-rhy]"); if (rr) { try { localStorage.setItem("cs_rhy_pick", rr.dataset.rhy); } catch (x) { } renderPsy(); } });
  setTimeout(feed, 25000); setInterval(feed, 60000);
  setTimeout(rhyLoad, 40000); setInterval(rhyLoad, 60000);
})();
