/* Cohort Sniper · Outlook tab: the best longs and shorts for the next 24 hours, 48 hours and 7 days.
   Six ranking systems, each a different way of seeing the market, each giving every market a score from −1 (short) to +1 (long):
   1. Smart money   — the cohort gap: profitable traders vs losing traders (the site's core setup score).
   2. Signal web    — the spider web's learned forecast (P(up) over 24 h; shrunk for 48 h and 7 d, which it has not learned).
   3. Momentum      — the move over twice the horizon, in units of the market's own volatility (trends tend to persist).
   4. Positioning   — trapped traders (squeeze / flush fuel), funding carry (the paid side), and crowd lean (fade the crowded side).
   5. Reversion     — the stretch from the horizon's average price, in volatility units (big stretches tend to snap back).
   6. Fresh flow    — how the cohort gap changed over the last 24 h (or 7 d): smart money adding vs fools adding.
   Consensus = the six blended, each weighted by its own track record on that horizon (refined as results come in),
   then scaled by agreement (one loud system alone counts for less); the consensus lists need 2+ systems on the same side.
   Price targets: the horizon's expected range from each market's own volatility (σ × √days), scaled by the conviction;
   the "wrong if" price is ¾ σ the other way. Targets are ranges for planning, not promises.
   Track record: every 2 hours the top 3 longs and top 3 shorts of each system and horizon are saved in this browser; when the
   horizon ends they are scored (long return minus short return). The record sets the consensus weights.
   Backtest: scripts/outlookbt.mjs tests five systems (all but the web) on the 40-day hourly panel every week; its t-stats are
   the prior weights, and its 6,000 past moments are replayed into the spider web once (Web.ingest).
   Spider web: the live web is drawn on this page; the consensus and the five testable scores for 24 h go into it.
   Uses: ROWS, HIST, LIVE / ctxOf, SPEC, LEVELS, parse, esc, price, usd, gotoCoin, VIEW, Web, Trapped, csRhythm. */
(function () {
  "use strict";
  const tabs = document.querySelector(".tabs"), first = document.querySelector('.tab[data-tab="setups"]'), anchor = document.getElementById("v-setups"); if (!tabs || !first || !anchor) return;
  const btn = document.createElement("button"); btn.className = "tab"; btn.dataset.tab = "outlook"; btn.textContent = "🎯 Outlook"; first.after(btn);
  const sec = document.createElement("section"); sec.id = "v-outlook"; sec.hidden = true; anchor.after(sec);
  const st = document.createElement("style");
  st.textContent = `#v-outlook .olh{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0 8px}#v-outlook .olh button{font:13px var(--mono);padding:5px 12px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--dim,#999);cursor:pointer}
    #v-outlook .olh button.on{color:var(--ink,#eee);border-color:var(--accent,#4da3ff);background:color-mix(in srgb,var(--accent,#4da3ff) 14%,transparent)}
    #v-outlook .olg{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:10px}#v-outlook .ol2{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:900px){#v-outlook .ol2{grid-template-columns:1fr}}
    #v-outlook table{width:100%;border-collapse:collapse;font:12px var(--mono)}#v-outlook th,#v-outlook td{padding:3px 5px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}#v-outlook th{color:var(--faint,#888);font-weight:600}
    #v-outlook .L{color:var(--bull,#19d38a)}#v-outlook .S{color:var(--bear,#ff4d5e)}#v-outlook .cell{display:inline-block;width:13px;height:13px;border-radius:3px;margin:0 1px;vertical-align:middle}
    #v-outlook .sysn{font-weight:700}#v-outlook .tr{font-size:11px;color:var(--faint,#888)}#v-outlook .bar{display:inline-block;height:6px;border-radius:3px;vertical-align:middle}`;
  document.head.appendChild(st);
  const HZ = [[24, "Next 24 hours"], [48, "Next 48 hours"], [168, "Next 7 days"]], SYS = [["smart", "Smart money"], ["web", "Signal web"], ["mom", "Momentum"], ["pos", "Positioning"], ["rev", "Reversion"], ["flow", "Fresh flow"]];
  const HOW = { smart: "Profitable cohorts vs losing cohorts: who holds which side, and how firmly.", web: "The spider web's learned forecast from every signal on both sites (24 h; 48 h and 7 d shrunk).", mom: "The move over 2× the horizon in units of the market's own volatility.", pos: "Trapped traders' pain, the side funding pays, and fading the crowded side.", rev: "Stretch from the average price of the last horizon, in volatility units: big stretches snap back.", flow: "Change of the cohort gap over the last day (week for 7 d): smart money adding vs fools adding." };
  const c1 = v => Math.max(-1, Math.min(1, v)), lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  let H = lsG("cs_ol_h", 24);
  // ---------- price series from history (every ~30 min) and hourly bars (rhythm loader) ----------
  function series(coin) {
    const out = []; const S = HIST && HIST.snapshots; if (S) S.forEach(s => { const v = s.d && s.d[coin]; if (v && v[2] > 0) out.push([Date.parse(s.t), v[2]]); });
    const R = typeof window.csRhythm === "function" ? csRhythm() : null, K = R && R[coin] && R[coin].K; if (K && K.length > out.length) return K.map(b => [b[0], b[4]]);
    return out;
  }
  function vol(sr) { if (sr.length < 20) return null; const r = [], dt = []; for (let i = 1; i < sr.length; i++) { if (sr[i][1] > 0 && sr[i - 1][1] > 0) { r.push(Math.log(sr[i][1] / sr[i - 1][1])); dt.push(sr[i][0] - sr[i - 1][0]); } }
    const m = r.reduce((s, v) => s + v, 0) / r.length, sd = Math.sqrt(r.reduce((s, v) => s + (v - m) ** 2, 0) / (r.length - 1)), mdt = dt.slice().sort((a, b) => a - b)[dt.length >> 1] || 36e5; return sd * Math.sqrt(864e5 / mdt); }
  const pxAgo = (sr, ms) => { const t = Date.now() - ms; let best = null; for (const p of sr) { if (p[0] <= t) best = p; else break; } return best && Date.now() - ms - best[0] < Math.max(2 * 36e5, ms * 0.25) ? best[1] : null; };
  const meanSince = (sr, ms) => { const t = Date.now() - ms, a = sr.filter(p => p[0] >= t); return a.length >= 4 ? a.reduce((s, p) => s + p[1], 0) / a.length : null; };
  function crowd(coin) { const S = HIST && HIST.snapshots, v = S && S.length && S[S.length - 1].d[coin]; return v && v[8] != null && v[9] != null && v[8] + v[9] > 0 ? (v[8] - v[9]) / (v[8] + v[9]) : null; }
  // ---------- the six systems ----------
  function score(r, h) {
    const px = r.ctx && r.ctx.px, sym = r.sym || parse(r.coin).sym, sr = series(r.coin), sd = vol(sr) || (r.ctx && r.ctx.ch != null ? Math.max(0.01, Math.abs(r.ctx.ch) / 100) : 0.04), sH = sd * Math.sqrt(h / 24), o = {};
    o.smart = c1(Math.sign(r.gap || r.dir) * (r.score || 0) / 100 * 1.2) * (h === 24 ? 0.85 : 1);
    try { const F = window.Web && Web.forecast(sym, 24); o.web = F ? c1((F.p - 0.5) * 4 * (h === 24 ? 1 : h === 48 ? 0.7 : 0.4) * (F.ready ? 1 : 0.5)) : null; } catch (e) { o.web = null; }
    const L = Math.min(2 * h, 24 * 60) * 36e5, p0 = pxAgo(sr, L); o.mom = p0 && px ? c1(Math.log(px / p0) / (sd * Math.sqrt(L / 864e5)) / 2) : null;
    let tp = 0; try { const X = SPEC && SPEC.m && SPEC.m[r.coin]; if (X && X.holders && window.Trapped) { const T = Trapped.analyze(X.holders, LEVELS && LEVELS.m && LEVELS.m[r.coin] && LEVELS.m[r.coin].h, px); if (T) tp = c1(T.P); } } catch (e) { }
    const f = r.ctx && r.ctx.f, carry = f != null ? c1(-f * 24 * 365 / 0.5) : 0, cr = crowd(r.coin), wc = h === 24 ? 0.15 : h === 48 ? 0.25 : 0.4;
    o.pos = c1((1 - wc - 0.2) * tp + wc * carry + 0.2 * (cr != null ? -cr : 0));
    const mu = meanSince(sr, h * 36e5), z = mu && px ? Math.log(px / mu) / sH : null; o.rev = z == null ? null : Math.abs(z) < 0.75 ? 0 : c1(-z / 2);
    const k = h >= 168 && r.tr && r.tr["7d"] ? "7d" : "24h", tv = r.tr && r.tr[k]; o.flow = tv ? c1(tv[0] / (k === "7d" ? 40 : 25)) : null;
    return { o, px, sd, sH };
  }
  // ---------- track record (browser ledger) ----------
  const LK = "cs_outlook_v1";
  const histPx = (coin, t) => { const S = HIST && HIST.snapshots; if (!S) return null; let b = null, bd = Infinity; for (const s of S) { const d = Math.abs(Date.parse(s.t) - t); if (d < bd && s.d[coin]) { bd = d; b = s.d[coin][2]; } } return bd <= 90 * 6e4 ? b : null; };
  function limOf(x, d) { return x.px * Math.exp(-d * 0.25 * x.sH); }   // limit entry: ¼ σ of the horizon better than now, alive for the first quarter of the horizon
  function ledger(all) {
    const L = lsG(LK, []), now = Date.now();
    // score finished entries
    // limit orders: watch the live price during the first quarter of the horizon; a pick counts only once its limit is touched
    L.forEach(e => { if (e.sp != null || now > e.t + e.h * 36e5 / 4) return; [[e.L, 1], [e.S, -1]].forEach(([A, d]) => A.forEach(x => { if (x[2] == null || x[3]) return; const q = (ctxOf(x[0]) || {}).px; if (q && (d > 0 ? q <= x[2] : q >= x[2])) x[3] = 1; })); });
    L.forEach(e => { if (e.sp != null || now < e.t + e.h * 36e5) return; const late = now - (e.t + e.h * 36e5);
      const pxE = c => late < 3 * 36e5 ? ((ctxOf(c) || {}).px || null) : histPx(c, e.t + e.h * 36e5), touched = (c, lim, d) => { const S = HIST && HIST.snapshots; if (!S) return false; const t1 = e.t + e.h * 36e5 / 4; return S.some(x => { const t = Date.parse(x.t), v = x.d[c]; return t >= e.t && t <= t1 && v && v[2] > 0 && (d > 0 ? v[2] <= lim : v[2] >= lim); }); }, ret = ([c, p, lim, f], d) => { if (lim != null && !f && !touched(c, lim, d)) return null; const q = pxE(c), en = lim != null ? lim : p; return q && en ? Math.log(q / en) : null; };   // exit at market at the horizon's end
      const all = e.L.concat(e.S); e.fills = e.L.filter(x => x[2] == null || x[3] || touched(x[0], x[2], 1)).length + e.S.filter(x => x[2] == null || x[3] || touched(x[0], x[2], -1)).length; e.orders = all.length;
      const lr = e.L.map(x => ret(x, 1)).filter(v => v != null), sr = e.S.map(x => ret(x, -1)).filter(v => v != null); if (!lr.length && !sr.length) { e.sp = 0; e.dead = 1; return; }   /* no limit filled (or no price): not counted */
      const m = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0; e.sp = m(lr) - m(sr); e.lr = m(lr); e.sr = m(sr); });
    // save new picks every 2 hours per horizon
    for (const [h] of HZ) { const lastT = Math.max(0, ...L.filter(e => e.h === h).map(e => e.t)); if (now - lastT < 2 * 36e5) continue; const A = all[h]; if (!A) continue;
      for (const k of SYS.map(s => s[0]).concat(["cons"])) { const v = A.filter(x => x.s[k] != null), Lg = v.filter(x => x.s[k] > 0.1).sort((a, b) => b.s[k] - a.s[k]).slice(0, 3), Sh = v.filter(x => x.s[k] < -0.1).sort((a, b) => a.s[k] - b.s[k]).slice(0, 3);
        if (Lg.length || Sh.length) L.push({ h, k, t: now, L: Lg.map(x => [x.r.coin, x.px, limOf(x, 1), 0]), S: Sh.map(x => [x.r.coin, x.px, limOf(x, -1), 0]) }); } }
    const keep = L.filter(e => now - e.t < 60 * 864e5).slice(-1500); lsS(LK, keep); return keep;
  }
  function record(L, h, k) { const all = L.filter(e => e.h === h && e.k === k && e.sp != null), d = all.filter(e => !e.dead); if (!d.length) return null; const m = d.reduce((s, e) => s + e.sp, 0) / d.length, o = all.reduce((s, e) => s + (e.orders || 0), 0), f = all.reduce((s, e) => s + (e.fills || 0), 0); return { n: d.length, m, hit: d.filter(e => e.sp > 0).length / d.length, fill: o ? f / o : null }; }
  const weight = (L, h, k) => { const R = record(L, h, k); return !R || R.n < 8 ? 1 : Math.max(0.25, Math.min(2.5, 1 + R.m * 25 * Math.min(1, R.n / 30))); };   // +4%/pick avg spread → 2×
  // ---------- 40-day backtest (scripts/outlookbt.mjs, weekly on the backtest branch) and the web's history lessons ----------
  const BTU = "https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/backtest/";
  let BT = null, btT = 0, lessonsDone = false;
  async function loadBT() { if (BT && Date.now() - btT < 6 * 36e5) return; btT = Date.now();
    try { const r = await fetch(BTU + "outlook_bt.json?t=" + Math.floor(Date.now() / 36e5)); if (r.ok) BT = await r.json(); } catch (e) { }
    // replay the 40 days into the spider web once per new file (the web skips what it has already learned)
    if (!lessonsDone && window.Web && BT) { lessonsDone = true; try { const seen = (Web.data().hist || {})["outlookbt"]; if (!seen || Date.parse(BT.t) > seen.at) { const j = await (await fetch(BTU + "outlook_lessons.json?t=" + Date.parse(BT.t))).json(); const n = Web.ingest("outlookbt", j.items || [], "Outlook backtest · 40 days, 40 most traded markets"); if (n) console.info("outlook: web learned", n, "past moments"); } } catch (e) { console.warn("outlook lessons", e); } } }
  const btRes = (h, k) => BT && BT.hz && BT.hz[h] && BT.hz[h].res && BT.hz[h].res[k] || null;
  const btW = (h, k) => { const R = btRes(h, k); return R ? Math.max(0.2, Math.min(3, R.t)) : 1; };   // the backtest's t-stat as a prior weight (the web itself has no history to test: 1)
  // ---------- build ----------
  let LAST = null;
  function build() {
    const rows = (ROWS || []).filter(r => r.ctx && r.ctx.px > 0 && (r.ctx.v || 0) >= 1e6), all = {}, L0 = lsG(LK, []);
    for (const [h] of HZ) { const W = Object.fromEntries(SYS.map(([k]) => [k, weight(L0, h, k) * btW(h, k)]));
      all[h] = rows.map(r => { const { o, px, sd, sH } = score(r, h); let s = 0, w = 0, ag = 0, n = 0; SYS.forEach(([k]) => { if (o[k] == null) return; s += o[k] * W[k]; w += W[k]; n++; });
        const raw = w ? s / w : 0; let agW = 0; SYS.forEach(([k]) => { if (o[k] != null && Math.sign(o[k]) === Math.sign(raw) && Math.abs(o[k]) >= 0.1) { ag++; agW += W[k]; } });
        const cons = raw * (0.4 + 0.6 * (w ? agW / w : 0));   // agreement matters, counted by weight: one loud weak system alone counts for less
        return { r, px, sd, sH, s: { ...o, cons }, ag, n }; }); all[h].W = W; }
    const L = ledger(all); LAST = { all, L, at: Date.now() }; window.csOutlook = () => LAST;
    // the web learns the 24 h consensus and the three new lenses
    try { if (window.Web) all[24].forEach(x => { const a = x.r.sym || parse(x.r.coin).sym; [["ol.cons", x.s.cons, "Outlook · 24 h consensus of six systems"], ["ol.smart", x.s.smart, "Outlook · smart money (cohort gap)"], ["ol.mom", x.s.mom, "Outlook · momentum (vol units)"], ["ol.rev", x.s.rev, "Outlook · reversion stretch"], ["ol.pos", x.s.pos, "Outlook · positioning (trapped, carry, crowd)"], ["ol.flow", x.s.flow, "Outlook · fresh flow (gap change)"]].forEach(([id, v, lab]) => { if (v != null && Math.abs(v) >= 0.1) Web.emit(id, a, v, lab); }); }); } catch (e) { }
    return LAST;
  }
  // ---------- draw ----------
  const tgt = (x, s, h) => { const d = Math.sign(s) || 1, m = 0.5 + Math.min(1, Math.abs(s)); return { t: x.px * Math.exp(d * x.sH * m), w: x.px * Math.exp(-d * x.sH * 0.75), pct: Math.exp(d * x.sH * m) - 1 }; };
  const col = v => v == null ? "var(--line)" : v > 0 ? `color-mix(in srgb,var(--bull,#19d38a) ${Math.round(25 + 75 * Math.min(1, Math.abs(v)))}%,transparent)` : `color-mix(in srgb,var(--bear,#ff4d5e) ${Math.round(25 + 75 * Math.min(1, Math.abs(v)))}%,transparent)`;
  const pc = v => (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%", nm = x => `<a href="#" data-olgo="${esc(x.r.coin)}">${esc(x.r.sym || parse(x.r.coin).sym)}</a>`;
  const btTxt = (R, k) => k === "web" ? "Backtest: the web has no 40-day history to test (it learns live and from replays)." : R ? `Backtest 40 d: <b class="${R.m > 0 ? "L" : "S"}">${pc(R.m)}</b> long−short per pick, ${Math.round(R.hit * 100)}% right, t ${R.t.toFixed(1)}${R.learnM != null ? ` (first 60% ${pc(R.learnM)}, last 40% ${pc(R.unseenM)})` : ""}` : "Backtest: loading…";
  const recTxt = R => R ? `${R.n} scored · ${Math.round(R.hit * 100)}% right · ${pc(R.m)} long−short per pick${R.fill != null ? ` · ${Math.round(R.fill * 100)}% of limit orders filled` : ""}` : "no scored picks yet";
  function draw() {
    if (VIEW !== "outlook") return; if (!BT) loadBT().then(() => { LAST = null; if (VIEW === "outlook") draw(); }); const B = LAST && Date.now() - LAST.at < 55e3 ? LAST : build(), A = B.all[H] || [], W = A.W || {}, L = B.L;
    const best = (k, d) => A.filter(x => x.s[k] != null && x.s[k] * d > (k === "cons" ? 0.06 : 0.1) && (k !== "cons" || x.ag >= 2)).sort((a, b) => d * (b.s[k] - a.s[k])).slice(0, k === "cons" ? 10 : 5);
    const consRow = (x, d) => { const T = tgt(x, x.s.cons, H); return `<tr><td style="text-align:left">${nm(x)}</td><td>${price(x.px)}</td><td title="Limit ${d > 0 ? "buy" : "sell"}: the pick counts only once price touches it (first quarter of the horizon)">${price(limOf(x, d))}</td><td class="${d > 0 ? "L" : "S"}"><b>${price(T.t)}</b> <span class="tr">${pc(T.pct)}</span></td><td class="tr">${price(T.w)}</td><td style="text-align:left">${SYS.map(([k, n]) => `<span class="cell" title="${n}: ${x.s[k] == null ? "no data" : x.s[k].toFixed(2)}" style="background:${col(x.s[k])}"></span>`).join("")}</td><td>${x.ag}/${x.n}</td><td class="${d > 0 ? "L" : "S"}">${x.s.cons.toFixed(2)}</td></tr>`; };
    const consT = d => `<table><thead><tr><th style="text-align:left">${d > 0 ? "Best longs" : "Best shorts"}</th><th>Price</th><th title="Entry is a limit order; the pick counts only once price touches it">Limit entry</th><th title="Limit exit">Target</th><th title="The idea is wrong if price gets here first (¾ σ the other way): exit at market">Wrong if</th><th style="text-align:left" title="${SYS.map(s => s[1]).join(" · ")}">6 systems</th><th title="Systems that agree">Agree</th><th>Score</th></tr></thead><tbody>${best("cons", d).map(x => consRow(x, d)).join("") || `<tr><td colspan="8" style="text-align:center;color:var(--faint)">nothing clear</td></tr>`}</tbody></table>`;
    const breadth = SYS.map(([k, n]) => { const v = A.filter(x => x.s[k] != null && Math.abs(x.s[k]) >= 0.1), up = v.filter(x => x.s[k] > 0).length; return { n, up, dn: v.length - up }; });
    const sysCard = ([k, n]) => { const R = record(L, H, k), mini = (x, d) => { const T = tgt(x, x.s[k], H); return `<tr><td style="text-align:left">${nm(x)}</td><td><span class="bar" style="width:${Math.round(Math.abs(x.s[k]) * 50)}px;background:${col(x.s[k])}"></span> ${x.s[k].toFixed(2)}</td><td>${price(x.px)}</td><td class="${d > 0 ? "L" : "S"}">${price(T.t)} <span class="tr">${pc(T.pct)}</span></td></tr>`; };
      return `<div class="card" style="padding:8px 10px"><div><span class="sysn">${n}</span> <span class="tr">weight ${(W[k] || 1).toFixed(2)}</span></div><div class="tr" style="margin:2px 0 4px">${HOW[k]}</div><div class="tr">Track record (${H === 168 ? "7 d" : H + " h"}): ${recTxt(R)}</div><div class="tr">${btTxt(btRes(H, k), k)}</div>
        <table><thead><tr><th style="text-align:left" class="L">Long</th><th>score</th><th>price</th><th>target</th></tr></thead><tbody>${best(k, 1).map(x => mini(x, 1)).join("") || `<tr><td colspan="4" class="tr" style="text-align:center">none</td></tr>`}</tbody></table>
        <table style="margin-top:4px"><thead><tr><th style="text-align:left" class="S">Short</th><th>score</th><th>price</th><th>target</th></tr></thead><tbody>${best(k, -1).map(x => mini(x, -1)).join("") || `<tr><td colspan="4" class="tr" style="text-align:center">none</td></tr>`}</tbody></table></div>`; };
    const RC = record(L, H, "cons");
    sec.innerHTML = `<div class="olh">${HZ.map(([h, l]) => `<button data-olh="${h}" class="${h === H ? "on" : ""}">${l}</button>`).join("")}<span class="tr">${A.length} markets with $1M+ daily volume · refreshed ${new Date(B.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>
      <div class="card" style="padding:8px 10px;margin-bottom:10px"><b>Consensus · ${HZ.find(z => z[0] === H)[1].toLowerCase()}</b> <span class="tr">six systems blended, weighted by the 40-day backtest × their live track record, and by how many agree (2+ needed) · live record: ${recTxt(RC)}</span>${BT && btRes(H, "cons") ? `<div class="tr">Backtest weights now: ${SYS.map(([k, n]) => `${n} ${(W[k] || 0).toFixed(2)}`).join(" · ")}. 40-day consensus on the unseen last 40%: ${pc(btRes(H, "cons").m)} per pick (equal weights: ${pc(btRes(H, "consEq").m)}).</div>` : ""}
        <div class="ol2" style="margin-top:6px"><div>${consT(1)}</div><div>${consT(-1)}</div></div>
        <div class="tr" style="margin-top:6px">Entry = a limit order ¼ σ better than now, alive for the first quarter of the horizon: a pick counts only once price touches it. Target (a limit exit) = the ${H === 168 ? "7-day" : H + "-hour"} expected range from the market's own volatility (σ × √days), larger when conviction is higher. "Wrong if" = ¾ σ the other way. Cells: the six systems in order (${SYS.map(s => s[1]).join(", ")}), green long, red short, brighter = stronger.</div></div>
      <div class="card" style="padding:8px 10px;margin-bottom:10px"><b>Breadth</b> <span class="tr">how many markets each system leans long vs short</span>
        <svg viewBox="0 0 600 ${breadth.length * 22 + 6}" style="width:100%;max-width:720px;display:block;margin-top:4px">${breadth.map((b, i) => { const t = Math.max(1, b.up + b.dn), wL = b.up / t * 300, wS = b.dn / t * 300, y = 4 + i * 22; return `<text x="0" y="${y + 13}" font-size="12" fill="currentColor" opacity=".75">${b.n}</text><rect x="${410 - wS * 0.6}" y="${y + 2}" width="${wS * 0.6}" height="14" rx="3" fill="var(--bear,#ff4d5e)" opacity=".8"/><rect x="410" y="${y + 2}" width="${wL * 0.6}" height="14" rx="3" fill="var(--bull,#19d38a)" opacity=".8"/><text x="${404 - wS * 0.6}" y="${y + 13}" font-size="11" text-anchor="end" fill="currentColor" opacity=".7">${b.dn}</text><text x="${416 + wL * 0.6}" y="${y + 13}" font-size="11" fill="currentColor" opacity=".7">${b.up}</text>`; }).join("")}<line x1="410" x2="410" y1="0" y2="${breadth.length * 22 + 6}" stroke="currentColor" opacity=".3"/></svg></div>
      <div class="olg">${SYS.map(sysCard).join("")}</div>
      <div class="card" style="padding:8px 10px;margin-top:10px"><b>🕸 Spider web</b> <span class="tr">every signal on both sites and how they link; the Outlook's 24 h consensus, momentum, reversion and positioning now feed it too</span><div id="olWeb" style="margin-top:6px"></div></div>
      <div class="info" style="margin-top:10px">Six different lenses on the same markets: when most agree, the idea is stronger; when they split, it is a coin flip. Every 2 hours each system's top 3 longs and shorts per horizon are saved in this browser and scored when the horizon ends; systems that earn more get more weight in the consensus, systems that lose get less. Targets are planning ranges from volatility, not forecasts of an exact price.</div>`;
    try { if (window.Web) Web.render(document.getElementById("olWeb"), { h: 440, working: true }); } catch (e) { }
  }
  btn.onclick = () => { VIEW = "outlook"; document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === btn)); document.querySelectorAll("section[id^='v-']").forEach(s => s.hidden = s.id !== "v-outlook"); draw(); };
  document.querySelectorAll(".tab").forEach(b => { if (b !== btn) b.addEventListener("click", () => { sec.hidden = true; }); });
  sec.addEventListener("click", e => { const h = e.target.closest("[data-olh]"); if (h) { H = +h.dataset.olh; lsS("cs_ol_h", H); draw(); return; } const g = e.target.closest("[data-olgo]"); if (g) { e.preventDefault(); if (typeof gotoCoin === "function") gotoCoin(g.dataset.olgo); } });
  setTimeout(loadBT, 30000);
  setInterval(() => { if (!document.hidden) { loadBT(); if (VIEW === "outlook") draw(); else if (ROWS && ROWS.length && (!LAST || Date.now() - LAST.at > 10 * 6e4)) build(); } }, 60000);
})();
