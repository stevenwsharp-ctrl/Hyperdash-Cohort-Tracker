/* Agreement layer · the same file on SOXX Sniper, Cohort Sniper and LETF Sniper.
   One source of truth for every setup, so the three sites can never disagree on the same thing:
   - multi-day setups (24 h / 48 h / 7 d) come from ONE file, lab.json (Cohort Sniper's daily bet lab on every liquid market),
     computed on the market itself (or its perp) and converted to any fund on it through the fund's leverage:
     a 3× fund moves 3× the index, an inverse fund flips the side (SOXL and SOXS always show the same bet, seen from the two sides)
   - every site also publishes its own live reads (SOXX Sniper's read and planner, Cohort Sniper's Outlook and cohort gap,
     LETF Sniper's level-to-level setup) into this browser's shared storage; the agreement table shows them side by side,
     labeled by horizon, so a difference is visible and explained (a 1-hour read and a 7-day read can point different ways)
   API: Agree.publish(src, key, rec) · Agree.html(u, { L, px, s }) · Agree.table(u, list) · Agree.lab() */
(function () {
  "use strict";
  if (window.Agree) return;
  const RAW = "https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/lab/lab.json", KS = "xs_reads_v1";
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  let LAB = lsG("lab_cache_v2", null), lT = 0;
  async function load() { if (LAB && Date.now() - lT < 30 * 6e4 && Date.now() - Date.parse(LAB.t) < 30 * 36e5) return LAB; lT = Date.now();
    try { const r = await fetch(RAW + "?t=" + Math.floor(Date.now() / 18e5)); if (r.ok) { LAB = await r.json(); try { const small = { ...LAB, prof: Object.fromEntries(Object.entries(LAB.prof).map(([k, p]) => [k, { s: p.s, px: p.px, setups: p.setups, ex: p.ex, ind: p.ind, cls: p.cls, stage: p.stage, athD: p.athD, relZ: p.relZ, grp: p.grp, ageHL: p.ageHL, yr: p.yr, cap: p.cap, r30: p.r30, grpR30: p.grpR30, beta: p.beta }])) }; lsS("lab_cache_v2", small); } catch (e) { } } } catch (e) { }
    return LAB; }
  load(); setInterval(load, 30 * 6e4);
  // which lab market stands for an underlying, and its leverage to that underlying
  const BASE = { SOXX: ["XYZ:SOXL", 3], SOX: ["XYZ:SOXL", 3], SMH: ["XYZ:SOXL", 3], QQQ: ["XYZ:XYZ100", 1], NDX: ["XYZ:XYZ100", 1], SPY: ["XYZ:SP500", 1], "BTC.X": ["BTC", 1], "ETH.X": ["ETH", 1], "SOL.X": ["SOL", 1], "XRP.X": ["XRP", 1], GLD: ["XYZ:GOLD", 1], SLV: ["XYZ:SILVER", 1], USO: ["XYZ:CL", 1] };
  function baseOf(u) { if (!LAB || !u) return null; const b = BASE[u]; if (b && LAB.prof[b[0]]) return { k: b[0], Lb: b[1] }; for (const v of ["XYZ:", "", "IO:", "CASH:", "FLX:", "KM:", "VNTL:"]) if (LAB.prof[v + u]) return { k: v + u, Lb: 1 }; return null; }
  const HZ = [[1, "24 h"], [2, "48 h"], [7, "7 days"]];
  // the lab's setups converted to an instrument with leverage L on underlying u, priced at px
  function setups(u, L, px) { const b = baseOf(u); if (!b) return null; const P = LAB.prof[b.k], k = (L || 1) / b.Lb, map = p => p == null || !px ? null : px * (1 + k * (p / P.px - 1)), out = {};
    for (const [h] of HZ) { const S = P.setups && P.setups[h]; out[h] = !S || !S.side ? { side: 0 } : { side: S.side * Math.sign(k), lean: S.lean, lim: map(S.lim), tgt: map(S.tgt), wrong: map(S.wrong), dd50: map(S.dd50), dd90: map(S.dd90), up50: map(S.up50), up90: map(S.up90), winStop: map(S.winStop), why: S.why }; }
    return { base: b.k, P, out, asOf: LAB.asOf }; }
  const WHY = { "stage": "trend stage", "rs-peer": "leads its peers", "laggard": "peer catch-up", "group-mom": "industry rotation", "new-listing": "young listing", "ath": "life cycle / highs", "pump-fade": "fade the extreme", "beta-tide": "beta to the tide", "vol-squeeze": "coiled spring", "young-small": "young and small" };
  function html(u, o) {
    o = o || {}; const S = setups(u, o.L, o.px), fx = o.fx || (v => v == null ? "–" : v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v >= 10 ? v.toFixed(2) : v.toPrecision(4)), nm = o.s || u, ir = intraRows(u, o.L, o.px, fx);
    if (!S && ir) return `<div style="overflow-x:auto"><table class="tr"><thead><tr><th style="text-align:left">${nm}</th><th>Setup</th><th>Limit entry</th><th>Target</th><th>Wrong if</th><th>Typical drawdown · worst 10%</th><th>Typical best · top 10%</th><th style="text-align:left">Why</th></tr></thead><tbody>${ir}</tbody></table></div><div class="note" style="max-width:none">Intraday setups from this market's own 5-minute bars (the daily lab has no market for ${u}, so no 24 h to 7 day setups).</div>`;
    if (!S) return `<div class="note">No shared setup for ${nm} yet (the daily bet lab covers liquid Hyperliquid markets; ${u} has no market there, or the lab has not run).</div>`;
    const sd = v => v > 0 ? `<b class="L">LONG</b>` : v < 0 ? `<b class="S">SHORT</b>` : `<span style="color:var(--dim,#888)">no setup</span>`;
    return `<div style="overflow-x:auto"><table class="tr"><thead><tr><th style="text-align:left">${nm}</th><th>Setup</th><th title="Entry is a limit order: the bet starts only when price touches it">Limit entry</th><th title="Limit exit">Target</th><th title="Exit at market if price gets here first">Wrong if</th><th title="Held with NO stop and NO target, from this market's own last 250 days: the typical worst point (half the time it gets this far against you), and the worst 10%">Typical drawdown · worst 10%</th><th title="Held with no stop and no target: the typical best point on the way, and the top 10%">Typical best · top 10%</th><th style="text-align:left">Why (ideas that held up on this market)</th></tr></thead><tbody>${intraRows(u, o.L, o.px, fx)}${HZ.map(([h, l]) => { const x = S.out[h]; return `<tr><td style="text-align:left">${l}</td><td>${sd(x.side)}${x.lean ? ` <span style="color:var(--dim,#888)">${Math.abs(x.lean).toFixed(2)}</span>` : ""}</td><td>${x.side ? fx(x.lim) : "–"}</td><td class="${x.side > 0 ? "L" : "S"}">${x.side ? fx(x.tgt) : "–"}</td><td>${x.side ? fx(x.wrong) : "–"}</td><td class="S">${x.side && x.dd50 ? `${fx(x.dd50)} · ${fx(x.dd90)}` : "–"}</td><td class="L">${x.side && x.up50 ? `${fx(x.up50)} · ${fx(x.up90)}` : "–"}</td><td style="text-align:left">${x.side ? (x.why || []).map(w => WHY[w] || w).join(", ") : ""}</td></tr>`; }).join("")}</tbody></table></div>
      <div class="note" style="max-width:none">Drawdown and best point: what holding with no stop and no target usually does on the way (this market, last 250 days, this side, this horizon). A stop inside the typical drawdown gets hit by normal noise; ${(() => { const x = S.out[7] && S.out[7].side ? S.out[7] : S.out[2] && S.out[2].side ? S.out[2] : null; return x && x.winStop ? `80% of winning holds never went past ${fx(x.winStop)} (${x === S.out[7] ? "7 days" : "48 h"}), a stop beyond that rarely kills a winner; ` : ""; })()}profit past the typical best point is rare, so a limit target near it gets filled more often.</div>
      <div class="note" style="max-width:none">15 min to end of day: five intraday ideas tested on this market's own 5-minute bars of the last ~12 days (refreshed every 5 minutes); 24 h to 7 days: the daily bet lab. Same numbers on all three sites: from the daily bet lab (as of ${S.asOf}) on ${S.base.split(":").pop()}${S.base.split(":").pop() !== u ? `, converted to ${nm} through its leverage (${o.L > 0 ? "+" : ""}${o.L || 1}×${S.base === "XYZ:SOXL" ? " vs SOXX; the SOXL perp is 3×" : ""})` : ""}.${S.P.stage ? ` Life cycle: stage ${S.P.stage}${S.P.athD != null ? `, ${(S.P.athD * 100).toFixed(0)}% from its all-time high` : ""}${S.P.relZ != null ? `, ${S.P.relZ > 0 ? "ahead of" : "behind"} its ${S.P.grp || "peers"} by ${Math.abs(S.P.relZ).toFixed(1)}σ (30 days)` : ""}.` : ""}</div>`;
  }
  // live reads published by each site
  function publish(src, key, rec) { const R = lsG(KS, {}); (R[key] = R[key] || {})[src] = { ...rec, at: Date.now() }; lsS(KS, R); }
  function reads(key) { const R = lsG(KS, {})[key] || {}; return Object.entries(R).filter(([, r]) => Date.now() - r.at < 6 * 36e5); }
  function table(u, rows) {   // rows: [[label, key, L]] — every published read for these keys, side shown for each instrument
    const all = []; rows.forEach(([lab, key, L]) => reads(key).forEach(([src, r]) => all.push({ lab, src, side: Math.sign(r.side || 0) * Math.sign(L || 1), h: r.h, txt: r.txt, ago: Math.round((Date.now() - r.at) / 6e4) })));
    if (!all.length) return "";
    const up = all.filter(x => x.side > 0).length, dn = all.filter(x => x.side < 0).length;
    return `<table class="tr" style="margin-top:6px"><thead><tr><th style="text-align:left">Live read (all sites)</th><th style="text-align:left">Site</th><th>Horizon</th><th>Side for ${rows[0][0]}</th><th style="text-align:left">Detail</th></tr></thead><tbody>${all.map(x => `<tr><td style="text-align:left">${x.lab}</td><td style="text-align:left">${x.src}</td><td>${x.h || "–"}</td><td>${x.side > 0 ? '<b class="L">long</b>' : x.side < 0 ? '<b class="S">short</b>' : "wait"}</td><td style="text-align:left;font-size:11px">${x.txt || ""} <span style="color:var(--dim,#888)">${x.ago} min ago</span></td></tr>`).join("")}</tbody></table>
      <div class="note" style="max-width:none">${up} reads long, ${dn} short (each converted to ${rows[0][0]}). Reads with different horizons can disagree and both be right: a 1-hour level read can say short inside a 7-day long.</div>`;
  }
  // ---------- intraday setups: 15 m, 30 m, 1 h, 4 h and until the end of the day ----------
  // Computed in the browser from 5-minute bars of the same base market the lab uses (Hyperliquid perp, else the Worker's chart),
  // with the same code on all three sites and shared through this browser's storage, so every site shows the same numbers.
  // Five intraday ideas are tested on this market's own last ~12 days (first half vs second half), with the same rules as the
  // lab: limit entry 1/4 σ of the horizon better (alive the first quarter of it), exit at market at the end, costs included;
  // only ideas that held up vote. Excursions with no stop and no target come from plain longs and shorts over the same days.
  const IH = [["15m", 3], ["30m", 6], ["1h", 12], ["4h", 48], ["eod", 0]], IHN = { "15m": "15 min", "30m": "30 min", "1h": "1 hour", "4h": "4 hours", eod: "to end of day" };
  const IDEA = { mom: "momentum (last move continues)", rev: "stretch from VWAP snaps back", trend: "EMA 9/21 trend", rsi: "RSI extreme fades", brk: "day high / low breakout" };
  const etf = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "numeric", hourCycle: "h23" });
  const etOf = t => { const p = Object.fromEntries(etf.formatToParts(new Date(t)).map(x => [x.type, x.value])); return { d: p.year + p.month + p.day, m: (+p.hour % 24) * 60 + +p.minute }; };
  function intraCalc(B, kind) {
    const n = B.length; if (n < 600) return null; const c = B.map(b => b[4]), E = B.map(b => etOf(b[0])), sess = kind === "crypto" ? 1440 : 960;
    const r = c.map((v, i) => i ? Math.log(v / c[i - 1]) : 0), sdb = (() => { const a = r.slice(-1500), m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) || 0.002; })();
    const e9 = [], e21 = [], rsi = [], vw = [], dh = [], dl = []; let a9 = c[0], a21 = c[0], up = 0, dn = 0, pv = 0, vv = 0, hi = -Infinity, lo = Infinity;
    for (let i = 0; i < n; i++) { a9 += (c[i] - a9) * 0.2; a21 += (c[i] - a21) * 2 / 22; e9.push(a9); e21.push(a21); const d = i ? c[i] - c[i - 1] : 0; up += (Math.max(0, d) - up) / 14; dn += (Math.max(0, -d) - dn) / 14; rsi.push(dn ? 100 - 100 / (1 + up / dn) : 50);
      if (!i || E[i].d !== E[i - 1].d) { pv = 0; vv = 0; hi = -Infinity; lo = Infinity; } const tp = (B[i][2] + B[i][3] + c[i]) / 3, v = B[i][5] || 1; pv += tp * v; vv += v; vw.push(pv / vv); dh.push(hi); dl.push(lo); hi = Math.max(hi, B[i][2]); lo = Math.min(lo, B[i][3]); }
    const sc = i => { const o = {}; o.mom = i >= 6 ? Math.max(-1, Math.min(1, Math.log(c[i] / c[i - 6]) / (sdb * Math.sqrt(6)) / 2)) : 0; o.rev = Math.max(-1, Math.min(1, -Math.log(c[i] / vw[i]) / (sdb * 6))); o.rev = Math.abs(o.rev) < 0.3 ? 0 : o.rev;
      o.trend = i >= 3 ? (e9[i] > e21[i] && e21[i] > e21[i - 3] ? 0.6 : e9[i] < e21[i] && e21[i] < e21[i - 3] ? -0.6 : 0) : 0; o.rsi = rsi[i] >= 75 ? -0.6 : rsi[i] <= 25 ? 0.6 : 0; o.brk = dh[i] > -Infinity && c[i] > dh[i] ? 0.6 : dl[i] < Infinity && c[i] < dl[i] ? -0.6 : 0; return o; };
    const endOf = (i, H) => { if (H) return i + H < n ? i + H : -1; let j = i; while (j + 1 < n && E[j + 1].d === E[i].d && E[j + 1].m < sess) j++; return j - i >= 2 && j < n - 1 ? j : -1; };
    const trade = (i, side, H, e, plain) => { const sH = sdb * Math.sqrt(Math.max(1, e - i)), lp = plain ? c[i] : c[i] * Math.exp(-side * 0.25 * sH), w = plain ? 0 : Math.max(1, Math.floor((e - i) / 4)); let k = plain ? i : -1;
      if (!plain) for (let q = i + 1; q <= Math.min(e, i + w); q++) if (side > 0 ? B[q][3] <= lp : B[q][2] >= lp) { k = q; break; } if (k < 0) return null; let mae = 0, mfe = 0;
      for (let q = k + (plain ? 1 : 0); q <= e; q++) { mae = Math.min(mae, side > 0 ? B[q][3] / lp - 1 : 1 - B[q][2] / lp); mfe = Math.max(mfe, side > 0 ? B[q][2] / lp - 1 : 1 - B[q][3] / lp); }
      return { r: side * Math.log(c[e] / lp) - 0.001, mae, mfe }; };
    const S = sc(n - 1), out = {}, q = (a, p) => { if (!a.length) return null; const z = a.slice().sort((x, y) => x - y); return z[Math.floor(p * (z.length - 1))]; };
    for (const [key, H] of IH) { const step = Math.max(1, Math.floor((H || 24) / 2)), R = {}, X = { 1: [], [-1]: [] }, LEN = [];
      for (let i = 30; i < n - 1; i += step) { const e = endOf(i, H); if (e < 0) continue; const o = sc(i);
        LEN.push(e - i); for (const k in IDEA) { if (Math.abs(o[k]) < 0.3) continue; const t = trade(i, Math.sign(o[k]), H, e); if (!t) continue; (R[k] = R[k] || []).push(t.r); }
        if (i % (step * 2) === 0) for (const sd of [1, -1]) { const t = trade(i, sd, H, e, true); if (t) X[sd].push(t); } }
      const ov = LEN.length ? Math.min(1, step / (LEN.reduce((x, y) => x + y, 0) / LEN.length)) : 1;   /* overlapping holds are not independent: count them as fewer */
      const W = {}; for (const k in IDEA) { const a = R[k] || []; if (a.length < 20) { W[k] = 0; continue; } const m = x => x.reduce((s, v) => s + v, 0) / x.length, h2 = Math.floor(a.length / 2), sd = Math.sqrt(a.reduce((s, v) => s + (v - m(a)) ** 2, 0) / a.length) || 1, t = m(a) / sd * Math.sqrt(a.length * ov);
        W[k] = t >= 1.65 && m(a.slice(h2)) > 0 ? Math.min(3, t) : 0; }   /* 25 tests per market: a higher bar */
      const tw = Object.values(W).reduce((x, y) => x + y, 0); let lean = 0; for (const k in IDEA) lean += (S[k] || 0) * W[k]; lean = tw ? lean / Math.max(tw, 1.5) : 0;
      const ex = sd => { const a = X[sd]; return a.length >= 15 ? { mae50: q(a.map(x => x.mae), 0.5), mae90: q(a.map(x => x.mae), 0.1), mfe50: q(a.map(x => x.mfe), 0.5), mfe90: q(a.map(x => x.mfe), 0.9) } : null; };
      const eLast = H ? H : Math.max(2, (() => { let j = n - 1; const d = E[n - 1].d; let k2 = 0; for (let m = E[n - 1].m; m < sess; m += 5) k2++; return k2; })()), side = Math.sign(lean), sH = sdb * Math.sqrt(eLast), px = c[n - 1];
      if (!side || Math.abs(lean) < 0.05 || (!H && etOf(Date.now()).m >= sess - 10)) { out[key] = { side: 0, W }; continue; }
      const xe = ex(side), mp = v => v == null ? null : px * (1 + v * side);
      out[key] = { side, lean, W, lim: px * Math.exp(-side * 0.25 * sH), tgt: px * Math.exp(side * (0.5 + Math.min(1, Math.abs(lean) * 2)) * sH), wrong: px * Math.exp(-side * 0.75 * sH), dd50: xe && mp(xe.mae50), dd90: xe && mp(xe.mae90), up50: xe && mp(xe.mfe50), up90: xe && mp(xe.mfe90), why: Object.keys(IDEA).filter(k => W[k] && Math.sign(S[k]) === side).map(k => IDEA[k]) }; }
    return { px: c[n - 1], at: B[n - 1][0], out };
  }
  const KI = "intra_v1", hlOf = k => k.includes(":") ? k.split(":")[0].toLowerCase() + ":" + k.split(":")[1] : k;
  async function intra(u) {   // → { base, px, out } for the base market of underlying u (cached 5 minutes, shared by the three sites)
    const b = baseOf(u), key = b ? b.k : "Y:" + u, C = lsG(KI, {}), hit = C[key]; if (hit && Date.now() - hit.t < 5 * 6e4) return { ...hit.v, base: key, Lb: b ? b.Lb : 1 };
    let B = null, kind = "stock";
    try { if (b) { const r = await fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "candleSnapshot", req: { coin: hlOf(b.k), interval: "5m", startTime: Date.now() - 12 * 864e5, endTime: Date.now() } }) }); const k = r.ok ? await r.json() : null; if (Array.isArray(k)) B = k.map(x => [x.t, +x.o, +x.h, +x.l, +x.c, +x.v]); kind = LAB && LAB.prof[b.k] && LAB.prof[b.k].cls === "Crypto" ? "crypto" : "stock"; }
      if (!B || B.length < 600) { const p = (localStorage.getItem("soxx_fred_proxy") || "").trim().replace(/\/+$/, ""); if (p) { const j = await (await fetch(`${p}/chart?t=${encodeURIComponent(/\.X$/.test(u) ? u.replace(/\.X$/, "-USD") : u)}&range=1mo&interval=5m`)).json(); if (j.status === "ok") { B = j.bars.filter(x => x[4] != null && x[2] != null && x[3] != null).map(x => [x[0], x[1], x[2], x[3], x[4], x[5] || 0]); kind = /\.X$/.test(u) ? "crypto" : "stock"; } } } } catch (e) { }
    const v = B ? intraCalc(B, kind) : null; if (v) { C[key] = { t: Date.now(), v }; for (const k in C) if (Date.now() - C[k].t > 36e5) delete C[k]; lsS(KI, C); } return v ? { ...v, base: key, Lb: b ? b.Lb : 1 } : null; }
  function intraRows(u, L, px, fx) { const C = lsG(KI, {}), b = baseOf(u), key = b ? b.k : "Y:" + u, hit = C[key]; if (!hit) return ""; const v = hit.v, k = (L || 1) / (b ? b.Lb : 1), map = p => p == null || !px ? null : px * (1 + k * (p / v.px - 1));
    const sd = x => x > 0 ? `<b class="L">LONG</b>` : x < 0 ? `<b class="S">SHORT</b>` : `<span style="color:var(--dim,#888)">no setup</span>`;
    return IH.map(([h]) => { const x = v.out[h] || { side: 0 }, s2 = x.side * Math.sign(k); return `<tr><td style="text-align:left">${IHN[h]}</td><td>${sd(s2)}${x.lean ? ` <span style="color:var(--dim,#888)">${Math.abs(x.lean).toFixed(2)}</span>` : ""}</td><td>${x.side ? fx(map(x.lim)) : "–"}</td><td class="${s2 > 0 ? "L" : "S"}">${x.side ? fx(map(x.tgt)) : "–"}</td><td>${x.side ? fx(map(x.wrong)) : "–"}</td><td class="S">${x.side && x.dd50 ? `${fx(map(x.dd50))} · ${fx(map(x.dd90))}` : "–"}</td><td class="L">${x.side && x.up50 ? `${fx(map(x.up50))} · ${fx(map(x.up90))}` : "–"}</td><td style="text-align:left">${x.side ? (x.why || []).join(", ") : ""}</td></tr>`; }).join(""); }
  // self-refreshing blocks: <div data-agu="SOXX" data-agl="3" data-agpx="78.1" data-ags="SOXL"> on any page gets the intraday
  // setups computed and the block redrawn (used by Cohort Sniper's market detail)
  const block = (u, L, px, nm) => html(u, { L, px, s: nm }) + table(u, [[nm, u, L]]);
  async function refreshBlocks() { for (const el of document.querySelectorAll("[data-agu]")) { if (!el.isConnected) continue; const u = el.dataset.agu, L = +el.dataset.agl || 1, px = +el.dataset.agpx || null, nm = el.dataset.ags || u;
      if (!el._agT || Date.now() - el._agT > 60e3) { el._agT = Date.now(); await load(); await intra(u); el.innerHTML = block(u, L, px, nm); } } }
  setInterval(refreshBlocks, 4000);
  window.Agree = { block, intra, intraCalc, load, setups, html, publish, reads, table, lab: () => LAB, baseOf };
})();
