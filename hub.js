/* Knowledge hub · one memory of every test on every site (same file in SOXX Sniper, Cohort Sniper and LETF Sniper; they share
   this browser's storage, so all three feed the same hub).
   1. Findings: every engine reports what it tested — engine, market, rule, horizon, trades, result, z, and whether the result is
      out of sample (walk-forward / unseen data / scored live) or in sample (fitted and scored on the same data).
      Sources: trade planner (unseen 40%), P/B ranges (in sample), Markov (walk-forward), Kalman and Dirac (walk-forward),
      roll-over (unseen half), rhythm waves (walk-forward), the signal web's live-scored nodes, and the server backtests
      (Cohort Sniper's 40-day cohort-gap backtest and the Outlook systems).
   2. Judgement across everything at once:
      - per engine: pooled evidence (Stouffer z = Σz / √k over its out-of-sample findings), share of markets where it worked
      - false discoveries: with hundreds of tests, some pass by luck. Benjamini–Hochberg at a 10% false-discovery rate keeps
        only findings that survive the number of tests made. Only those are "proven".
   3. Test, test, test: a runner works through a queue of extra tests in quiet moments (one every 90 s), so each engine is
      tried on more markets than the pages show (each site adds its own tasks with Hub.task).
   4. Back into the signal web: hub.cons per market = the live signals of each engine weighted by that engine's proven
      evidence (engines that never prove anything weigh almost nothing). The web learns hub.cons like any other signal.
   API: Hub.report(f | [f]) · Hub.task(name, fn) · Hub.html() · Hub.summary() · Hub.mount(el) · Hub.findings() */
(function () {
  "use strict";
  if (window.Hub) return;
  const K = "hub_v1", c1 = v => Math.max(-1, Math.min(1, v));
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  let F = lsG(K, {}), dirty = false, sT = 0; const SITE = /letf/i.test(document.title) ? "LETF" : document.getElementById("stanceCard") || /SOXX/i.test(document.title) ? "SOXX" : "Cohort";
  const save = () => { if (!dirty || Date.now() - sT < 15e3) return; sT = Date.now(); dirty = false; const L = Object.values(F).sort((a, b) => b.at - a.at).slice(0, 2500); F = Object.fromEntries(L.map(f => [f.key, f])); lsS(K, F); };
  setInterval(() => { dirty = dirty || false; save(); }, 20e3);
  function report(x) { (Array.isArray(x) ? x : [x]).forEach(f => { if (!f || !f.eng || f.z == null || !isFinite(f.z)) return; const key = [f.eng, f.mkt || "*", f.rule || "", f.h || ""].join("|"), o = F[key];
      F[key] = { key, eng: f.eng, mkt: f.mkt || "*", rule: f.rule || "", h: f.h || "", n: f.n || 0, m: f.m != null && isFinite(f.m) ? f.m : null, unit: f.unit || "", z: Math.max(-12, Math.min(12, f.z)), oos: !!f.oos, site: f.site || SITE, at: Date.now(), first: o ? o.first : Date.now(), seen: (o ? o.seen : 0) + 1, note: f.note || "" }; });
    dirty = true; save(); }
  // ---------- statistics ----------
  const Phi = z => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2), p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };
  const pOf = z => 1 - Phi(z);   // one-sided: does it work?
  function bh(L, q) { const S = L.map(f => ({ f, p: pOf(f.z) })).sort((a, b) => a.p - b.p), m = S.length; let k = -1; S.forEach((x, i) => { if (x.p <= (i + 1) / m * q) k = i; }); const ok = new Set(S.slice(0, k + 1).map(x => x.f.key)); return ok; }
  function summary() {
    const now = Date.now(), L = Object.values(F).filter(f => now - f.at < 14 * 864e5), oos = L.filter(f => f.oos), proven = bh(oos, 0.1), E = {};
    L.forEach(f => { const e = E[f.eng] = E[f.eng] || { eng: f.eng, n: 0, oos: 0, z: 0, pos: 0, mk: new Set(), proven: 0, best: null, sites: new Set() }; e.n++; e.mk.add(f.mkt); e.sites.add(f.site);
      if (f.oos) { e.oos++; e.z += f.z; if (f.z > 0) e.pos++; } if (proven.has(f.key)) { e.proven++; if (!e.best || f.z > e.best.z) e.best = f; } });
    const eng = Object.values(E).map(e => ({ ...e, mk: e.mk.size, sites: [...e.sites], zs: e.oos ? e.z / Math.sqrt(e.oos) : null, posR: e.oos ? e.pos / e.oos : null })).sort((a, b) => (b.zs ?? -99) - (a.zs ?? -99));
    eng.forEach(e => { e.w = e.zs == null ? 0.3 : Math.max(0.05, Math.min(3, e.zs / 2)) * (e.proven ? 1 : 0.5); e.verdict = e.zs == null ? "in sample only" : e.zs >= 3 && e.proven ? "works" : e.zs >= 1.5 ? "promising" : e.zs <= -1.5 ? "works in reverse / hurts" : "noise so far"; });
    return { n: L.length, oos: oos.length, proven: L.filter(f => proven.has(f.key)).sort((a, b) => b.z - a.z), eng, markets: new Set(L.map(f => f.mkt)).size, provenSet: proven };
  }
  // ---------- test runner ----------
  const Q = []; let ran = 0, lastTask = "", busy = false;
  function task(name, fn) { if (!Q.some(t => t.name === name)) Q.push({ name, fn, at: 0 }); }
  async function runOne() { if (busy || document.hidden || !Q.length) return; busy = true; Q.sort((a, b) => a.at - b.at); const t = Q[0]; t.at = Date.now();
    try { const r = await t.fn(); if (r) report(r); ran++; lastTask = t.name; } catch (e) { lastTask = t.name + " (failed)"; } busy = false; }
  setInterval(runOne, 90e3); setTimeout(runOne, 45e3);
  // ---------- live: engine-weighted consensus per market, back into the web ----------
  const ENG_OF = id => /^mk\./.test(id) ? "markov" : /^(dirac\.)/.test(id) ? "dirac" : /^mx\.kalman/.test(id) ? "kalman" : /^(day\.|carry\.)/.test(id) ? "rollover" : /^pb\./.test(id) ? "pb" : /^plan\./.test(id) ? "planner" : /^ol\./.test(id) ? "outlook" : /^rhy\.(wave|resonance)/.test(id) ? "rhythm" : null;
  const LIVE = {}; let hooked = false;
  function hook() { if (hooked || !window.Web || !Web.emit) return; hooked = true; const orig = Web.emit; Web.emit = function (id, a, v, lab) { try { if (ENG_OF(id) && a && isFinite(v)) (LIVE[a] = LIVE[a] || {})[id] = { v, t: Date.now() }; } catch (e) { } return orig.apply(this, arguments); }; }
  function cons() { if (!window.Web) return []; const S = summary(), W = Object.fromEntries(S.eng.map(e => [e.eng, e.w])), out = [];
    for (const [a, M] of Object.entries(LIVE)) { let s = 0, w = 0; for (const [id, x] of Object.entries(M)) { if (Date.now() - x.t > 30 * 6e4) { delete M[id]; continue; } const e = ENG_OF(id), ww = W[e] != null ? W[e] : 0.3; s += x.v * ww; w += ww; }
      if (w > 0) { const v = c1(s / Math.max(1, w)); if (Math.abs(v) >= 0.05) { out.push([a, v]); try { Web.emit("hub.cons", a, v, "Knowledge hub · engines weighted by their proven record"); } catch (e) { } } } }
    return out.sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])); }
  let CONS = []; setInterval(() => { hook(); CONS = cons(); }, 5 * 6e4); setTimeout(() => { hook(); }, 1000); setTimeout(() => { CONS = cons(); }, 60e3);
  // ---------- picture ----------
  const ENGN = { planner: "Trade planner", pb: "P/B ranges", markov: "Markov memory", kalman: "Kalman trend", dirac: "Dirac spin / speed", rollover: "4 pm roll-over", rhythm: "Rhythm waves", web: "Signal web nodes", "cohort-gap": "Cohort gap (server)", "cohort-cond": "Cohort conditions (server)", outlook: "Outlook systems (server)" };
  function html() {
    const S = summary(), f2 = v => v == null || !isFinite(v) ? "–" : v.toFixed(1), col = v => v == null ? "" : v >= 1.5 ? "L" : v <= -1.5 ? "S" : "";
    const bar = e => { const w = Math.min(100, Math.abs(e.zs || 0) / 6 * 100); return `<span style="display:inline-block;width:70px;height:7px;background:var(--line);border-radius:4px;vertical-align:middle;position:relative"><i style="position:absolute;${(e.zs || 0) >= 0 ? "left:50%" : "right:50%"};top:0;height:7px;width:${w / 2}%;background:var(--${(e.zs || 0) >= 0 ? "up,var(--bull" : "down,var(--bear"},#888));border-radius:4px"></i></span>`; };
    const fm = f => `${ENGN[f.eng] || f.eng} · <b>${f.mkt === "*" ? "all markets" : f.mkt}</b>${f.rule ? " · " + f.rule : ""}${f.h ? " · " + f.h : ""}`;
    return `<div class="note" style="max-width:none">${S.n} test results from ${S.markets} markets on ${[...new Set(Object.values(F).map(f => f.site))].join(", ") || SITE}; ${S.oos} out of sample. <b>${S.proven.length}</b> survive the false-discovery check (Benjamini–Hochberg, 10%). Test runner: ${ran} extra tests this visit${lastTask ? ", last: " + lastTask : ""}, ${Q.length} in the queue.</div>
      <table class="tr"><thead><tr><th style="text-align:left">Engine</th><th>results</th><th>markets</th><th title="Stouffer z over out-of-sample results: + = works">pooled z</th><th></th><th title="Share of out-of-sample results that were positive">worked</th><th title="Results that survive the false-discovery check">proven</th><th title="Weight in the hub consensus">weight</th><th style="text-align:left">Verdict</th></tr></thead><tbody>${S.eng.map(e => `<tr><td style="text-align:left">${ENGN[e.eng] || e.eng}</td><td>${e.n}</td><td>${e.mk}</td><td class="${col(e.zs)}">${f2(e.zs)}</td><td>${bar(e)}</td><td>${e.posR != null ? Math.round(e.posR * 100) + "%" : "–"}</td><td>${e.proven}</td><td>${e.w.toFixed(2)}</td><td style="text-align:left">${e.verdict}</td></tr>`).join("") || `<tr><td colspan="9" style="text-align:center">The hub fills as the engines run (a few minutes).</td></tr>`}</tbody></table>
      ${S.proven.length ? `<div class="label" style="margin-top:8px">Proven now (after the false-discovery check)</div><table class="tr"><tbody>${S.proven.slice(0, 12).map(f => `<tr><td style="text-align:left">${fm(f)}</td><td>${f.n} ${f.n === 1 ? "test" : "trades"}</td><td>${f.m != null ? (f.m >= 0 ? "+" : "") + (f.unit === "%" ? (f.m * 100).toFixed(2) + "%" : f.m.toFixed(2) + (f.unit ? " " + f.unit : "")) : ""}</td><td class="L">z ${f2(f.z)}</td></tr>`).join("")}</tbody></table>` : ""}
      ${CONS.length ? `<div class="note" style="max-width:none;margin-top:6px">Hub consensus now (to the web as hub.cons): ${CONS.slice(0, 10).map(([a, v]) => `<span class="${v > 0 ? "L" : "S"}">${a} ${v > 0 ? "▲" : "▼"}${Math.abs(v).toFixed(2)}</span>`).join(" · ")}</div>` : ""}
      <div class="note" style="max-width:none">Every engine on all three sites reports its tests here. Out-of-sample results (walk-forward, unseen data, live scoring) count as evidence; in-sample fits are shown but never "proven". With hundreds of tests some pass by luck, so a result is proven only if it survives the false-discovery check across all of them. Engines that prove themselves weigh more in the hub consensus; engines that never do fade to almost nothing.</div>`;
  }
  const mounts = []; function mount(el) { if (!el) return; for (let i = mounts.length - 1; i >= 0; i--) if (!mounts[i].isConnected || mounts[i] === el) mounts.splice(i, 1); mounts.push(el); el.innerHTML = html(); }
  setInterval(() => { if (document.hidden) return; mounts.forEach(el => { if (el.isConnected && el.offsetParent !== null) el.innerHTML = html(); }); }, 60e3);
  // ---------- collectors from the engines' outputs (each site calls them with what it computed) ----------
  const fromPlanner = (P, mkt) => !P ? [] : Object.entries(P.tf).filter(([, x]) => x.best).map(([tf, x]) => ({ eng: "planner", mkt, rule: `${x.best.k}/${x.best.sm}/${x.best.tR}R/${x.best.fil}`, h: tf, n: x.best.te.n, m: x.best.te.m, unit: "R", z: x.best.te.n >= 5 ? x.best.te.t : 0, oos: true }));
  const fromPB = (A, mkt, tf) => !A ? [] : Object.entries(A.S).filter(([, s]) => s.n >= 8).map(([k, s]) => ({ eng: "pb", mkt, rule: k, h: tf, n: s.n, m: s.avgR, unit: "R", z: s.t, oos: true })) /* fixed rules (not fitted): a back-test over history is out of sample */;
  const fromMarkov = (M, mkt) => M && M.best ? [{ eng: "markov", mkt, rule: `order ${M.best.k}`, h: M.best.h + "h", n: M.best.calls, m: M.best.hit, unit: "hit", z: M.best.z, oos: true }] : [];
  const fromKD = (K, D, mkt) => [].concat(K && K.W ? [{ eng: "kalman", mkt, rule: K.W.sign < 0 ? "reversed" : "trend", h: "4h", n: K.W.n, z: K.W.z, oos: true }] : [],
    D && D.Ws ? [{ eng: "dirac", mkt, rule: "spin", h: "4h", n: D.Ws.n, z: D.Ws.z, oos: true }] : [], D && D.Wg && D.Wg.n >= 60 ? [{ eng: "dirac", mkt, rule: "speed limit", h: "4h", n: D.Wg.n, z: D.Wg.z, oos: true }] : []);
  const fromRoll = (R, mkt) => R && R.unseen && R.unseen.n >= 8 ? [{ eng: "rollover", mkt, rule: Math.sign(R.learn.z || 1) > 0 ? "continuation" : "reversal", h: "24h", n: R.unseen.n, m: R.unseen.hit, unit: "hit", z: Math.sign(R.learn.z || 1) * R.unseen.z, oos: true }] : [];
  const fromRhythm = (RH, mkt) => RH && RH.freq && RH.freq.runs >= 10 ? [{ eng: "rhythm", mkt, rule: "wave projection", h: RH.freq.q + " bars", n: RH.freq.runs, m: RH.freq.hit, unit: "hit", z: (RH.freq.hit - 0.5) * 2 * Math.sqrt(RH.freq.runs), oos: true }] : [];
  function fromWeb() { if (!window.Web) return []; try { const N = Web.nodes(); return Object.values(N).filter(o => o.n >= 40 && o.z != null && isFinite(o.z)).map(o => ({ eng: "web", mkt: "*", rule: o.label || o.id, h: "4h", n: o.n, m: o.hitR, unit: "hit", z: o.z, oos: true })); } catch (e) { return []; } }
  async function fromServer() { const B = "https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/backtest/", out = [];
    try { const b = await (await fetch(B + "backtest.json?t=" + Math.floor(Date.now() / 36e5))).json();
      (b.thresholds || []).forEach(x => ["r4", "r24", "r72"].forEach(k => { const t = x.test && x.test[k]; if (t && t.n >= 30) out.push({ eng: "cohort-gap", mkt: "*", rule: "score ≥ " + x.th, h: k.slice(1) + "h", n: t.n, m: t.avg / 100, unit: "%", z: t.t, oos: true, site: "Cohort" }); }));
      (b.conditions || []).forEach(c => { const t = c.test && c.test.yes; if (t && t.n >= 20) out.push({ eng: "cohort-cond", mkt: "*", rule: c.label, h: "24h", n: t.n, m: t.avg / 100, unit: "%", z: t.t, oos: true, site: "Cohort" }); }); } catch (e) { }
    try { const o = await (await fetch(B + "outlook_bt.json?t=" + Math.floor(Date.now() / 36e5))).json(); for (const [h, X] of Object.entries(o.hz || {})) for (const [k, r] of Object.entries(X.res || {})) if (r && r.n >= 5) out.push({ eng: "outlook", mkt: "*", rule: k, h: (h === "168" ? "7d" : h + "h"), n: r.n, m: r.m, unit: "%", z: r.t, oos: true, site: "Cohort" }) /* fixed formulas, not fitted to this data */; } catch (e) { }
    return out; }
  task("server backtests", fromServer); task("signal web nodes", async () => fromWeb());
  // a card on a page: after an anchor element
  function card(anchor, id) { if (!anchor || document.getElementById(id)) return null; const c = document.createElement("section"); c.className = "card"; c.id = id; c.style.margin = "0 0 12px";
    c.innerHTML = `<details open><summary class="label" style="cursor:pointer">🧠 Knowledge hub · every test from SOXX Sniper, Cohort Sniper and LETF Sniper in one place, judged together</summary><div class="hubBody" style="margin-top:6px"></div></details>`;
    const st = document.createElement("style"); st.textContent = `#${id} table{width:100%;border-collapse:collapse;font:12px var(--mono,monospace)}#${id} th,#${id} td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right}#${id} th{color:var(--dim,var(--faint,#888));font-weight:600}#${id} .L{color:var(--up,var(--bull,#19d38a))}#${id} .S{color:var(--down,var(--bear,#ff4d5e))}#${id} .note{font-size:11.5px;color:var(--dim,var(--faint,#888));margin:4px 0}`;
    document.head.appendChild(st); anchor.after(c); mount(c.querySelector(".hubBody")); return c; }
  // engines on any market's hourly bars [[t,o,h,l,c,v]]: the standard battery used by the test runner on every site
  function battery(B, mkt, o) { o = o || {}; const out = [];
    try { if (window.Markov) out.push(...fromMarkov(Markov.analyze(B), mkt)); } catch (e) { }
    try { if (window.Matrix) out.push(...fromKD(Matrix.kalman(B), Matrix.dirac(B), mkt)); } catch (e) { }
    try { if (window.Rollover && !o.daily) out.push(...fromRoll(Rollover.analyze(B), mkt)); } catch (e) { }
    try { if (window.PB) out.push(...fromPB(PB.analyze(B, { tf: o.daily ? "1d" : "1h" }), mkt, o.daily ? "1d" : "1h")); } catch (e) { }
    try { if (window.Rhythm && !o.daily) out.push(...fromRhythm(Rhythm.analyze(B, { win: 400 }), mkt)); } catch (e) { }
    try { if (window.Planner) out.push(...fromPlanner(Planner.run("hubtest:" + mkt, o.daily ? { "1d": B } : { "1h": B, "4h": Planner.agg(B, 144e5) }), mkt)); } catch (e) { }
    return out; }
  window.Hub = { report, task, html, mount, card, battery, summary, findings: () => Object.values(F), bh, pOf, from: { planner: fromPlanner, pb: fromPB, markov: fromMarkov, kd: fromKD, roll: fromRoll, rhythm: fromRhythm, web: fromWeb } };
})();
