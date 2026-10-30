/* Why · trade motive study, shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   For every tracked trade it asks: why would the trader do this now? It reads the context at the moment of the trade
   (the move in the 4 and 24 hours before, where price sat in its 24h range, the time of day in New York, the closing
   rebalance window, after-hours / overnight / weekend, an earnings report close by, averaging down) and names the
   belief behind it ("buy the dip", "chase the breakout", "fade the rally", ...). Then it checks the result 1h, 4h and
   24h later. Grouped by belief and by trader group (best vs worst) this shows which common beliefs lose money, which
   ones the best traders use, and what each belief would mean if you acted on it right now.
   Why.analyze(moves, candles, opts) -> rows; Why.summary(rows); Why.now(candles, opts); Why.html(...) */
(function () {
  "use strict";
  if (window.Why) return;
  const H = 36e5;
  const etP = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23" });
  const et = ms => { const p = {}; etP.formatToParts(new Date(ms)).forEach(x => p[x.type] = x.value); return { min: +p.hour * 60 + +p.minute, wk: p.weekday === "Sat" || p.weekday === "Sun", wd: p.weekday }; };
  // price at time t from candles [{t, o, h, l, c}] sorted by t
  function pxAt(C, t) { let lo = 0, hi = C.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (C[m].t <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k < 0 ? null : C[k].c; }
  function ctxAt(C, t) {
    const p = pxAt(C, t), p4 = pxAt(C, t - 4 * H), p24 = pxAt(C, t - 24 * H); if (!p) return null;
    let lo = Infinity, hi = -Infinity; for (const c of C) { if (c.t > t) break; if (c.t >= t - 24 * H) { lo = Math.min(lo, c.l); hi = Math.max(hi, c.h); } }
    const e = et(t);
    return { p, r4: p4 ? p / p4 - 1 : 0, r24: p24 ? p / p24 - 1 : 0, pos: hi > lo ? (p - lo) / (hi - lo) : 0.5, min: e.min, wk: e.wk, wd: e.wd };
  }
  const sess = c => c.wk ? "weekend" : c.min < 240 || c.min >= 1200 ? "overnight" : c.min < 570 ? "pre-market" : c.min < 600 ? "open" : c.min < 900 ? "midday" : c.min < 960 ? "power hour" : "after-hours";
  // the belief behind an entry (side: +1 long, -1 short)
  function belief(m, c, prev, ev) {
    const s = m.dir, r4 = c.r4 * s, r24 = c.r24 * s, B = [];
    if (m.entry) {
      if (prev && prev.dir === s && (m.px - prev.px) * s < -0.005 * m.px) B.push("avg-down");
      if (r4 <= -0.03 || (s > 0 ? c.pos <= 0.2 : c.pos >= 0.8)) B.push(s > 0 ? "dip" : "fade-drop");
      else if (r4 >= 0.03 || (s > 0 ? c.pos >= 0.85 : c.pos <= 0.15)) B.push(s > 0 ? "chase" : "breakdown");
      const ss = sess(c);
      if (ss === "power hour" && Math.sign(c.r24) === s && Math.abs(c.r24) >= 0.02) B.push("rebal");
      if (ss === "after-hours" || ss === "overnight" || ss === "weekend") B.push("offhours");
      if (ss === "open") B.push("open");
      if (ev) B.push("event");
      if (!B.length || (B.length === 1 && B[0] === "open")) B.push(r24 >= 0 ? "trend" : "contrarian");
    } else {
      const since = prev && prev.dir === s ? (m.px / prev.px - 1) * s : null;
      B.push(since == null ? "exit" : since >= 0.01 ? "take-profit" : since <= -0.01 ? "stop-out" : "scratch");
    }
    return B;
  }
  const NAME = { "dip": "Buy the dip", "chase": "Chase the breakout", "fade-drop": "Short a falling market (sell the drop)", "breakdown": "Short the breakdown", "avg-down": "Average down (add to a loser)",
    "rebal": "Ride the closing rebalance", "offhours": "After-hours / overnight bet", "open": "Opening-bell trade", "event": "Bet before an earnings report", "trend": "Follow the 24h trend", "contrarian": "Go against the 24h trend",
    "take-profit": "Take profit", "stop-out": "Cut a loser", "scratch": "Exit near entry", "exit": "Exit (entry not seen)" };
  const WHY = { "dip": "They believe the drop went too far and will bounce.", "chase": "They believe strength brings more strength.", "fade-drop": "They believe the fall is not over (or they hedge).",
    "breakdown": "They believe a break of the lows starts a bigger fall.", "avg-down": "They believe their idea is still right and a better price lowers their average.",
    "rebal": "They expect the leveraged-ETF closing flow to push price further in the day's direction.", "offhours": "They act on news or a view while the stock market is closed; only the perp trades.",
    "open": "They trade the opening volatility.", "event": "They take a side before a big holding reports.", "trend": "They go with the recent direction.", "contrarian": "They expect the recent direction to turn.",
    "take-profit": "They lock in a gain.", "stop-out": "They admit the trade is wrong and cut the loss.", "scratch": "They leave near their entry.", "exit": "They close a position we did not see open." };
  // moves: [{ t, dir: +1/-1, entry: bool, px, usd, a, g: "best"|"worst", who }]; candles: [{t,o,h,l,c}]; events: [ms]
  function analyze(moves, C, opts) {
    opts = opts || {}; if (!C || C.length < 50) return [];
    const ev = opts.events || [], last = C[C.length - 1].t, prevOf = {}, out = [];
    moves.slice().sort((a, b) => a.t - b.t).forEach(m => {
      const c = ctxAt(C, m.t); if (!c) return;
      const evNear = ev.some(e => e - m.t > 0 && e - m.t < 30 * H);
      const B = belief(m, c, prevOf[m.a], evNear), f = h => { if (m.t + h > last) return null; const p = pxAt(C, m.t + h); return p ? (p / c.p - 1) * m.dir : null; };
      const r = { ...m, c, B, f1: f(H), f4: f(4 * H), f24: f(24 * H), sess: sess(c) };
      // an exit is right when price then goes against the side they left
      r.ok = r.f4 == null ? null : m.entry ? r.f4 > 0 : r.f4 < 0;
      if (m.entry) prevOf[m.a] = m; out.push(r);
    });
    return out;
  }
  function summary(rows) {
    const S = {};
    rows.forEach(r => r.B.forEach(b => { for (const g of [r.g, "all"]) { const k = b + "|" + g, o = S[k] = S[k] || { b, g, n: 0, ok: 0, f4: 0, f24: 0, n24: 0, usd: 0 };
      if (r.ok == null) continue; o.n++; if (r.ok) o.ok++; o.f4 += (r.entry ? 1 : -1) * r.f4; if (r.f24 != null) { o.f24 += (r.entry ? 1 : -1) * r.f24; o.n24++; } o.usd += r.usd || 0; } }));
    return Object.values(S).map(o => ({ ...o, win: o.n ? o.ok / o.n : null, avg4: o.n ? o.f4 / o.n : null, avg24: o.n24 ? o.f24 / o.n24 : null }));
  }
  // which beliefs would fire if someone entered long or short right now
  function now(C, opts) { if (!C || C.length < 50) return null; const t = C[C.length - 1].t, c = ctxAt(C, t); if (!c) return null;
    const ev = (opts && opts.events || []).some(e => e - t > 0 && e - t < 30 * H);
    return { c, sess: sess(c), long: belief({ dir: 1, entry: true, px: c.p }, c, null, ev), short: belief({ dir: -1, entry: true, px: c.p }, c, null, ev) }; }

  const pc = v => v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : "") + (v * 100).toFixed(2) + "%";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const U = n => { const a = Math.abs(n || 0); return "$" + (a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? (a / 1e3).toFixed(0) + "K" : Math.round(a)); };
  function html(rows, C, opts) {
    opts = opts || {}; const sym = opts.sym || "", up = "var(--bull,var(--up))", dn = "var(--bear,var(--down))", dim = "var(--faint,var(--mute))";
    if (!rows.length) return `<div style="font:12px var(--mono);color:${dim}">No tracked trades with price history yet.</div>`;
    const S = summary(rows), get = (b, g) => S.find(o => o.b === b && o.g === g), N = now(C, opts);
    const rowsB = [...new Set(S.map(o => o.b))].map(b => ({ b, best: get(b, "best"), worst: get(b, "worst"), all: get(b, "all") })).filter(x => x.all && x.all.n >= 3).sort((a, b) => b.all.n - a.all.n);
    const w = o => !o || !o.n ? `<td style="color:${dim}">–</td>` : `<td style="color:${o.win >= 0.55 ? up : o.win <= 0.45 ? dn : "inherit"}">${Math.round(o.win * 100)}% <span style="color:${dim}">of ${o.n}</span></td>`;
    const losing = rowsB.filter(x => x.worst && x.worst.n >= 4 && x.worst.win < 0.45 && x.worst.avg4 < 0).sort((a, b) => a.worst.win - b.worst.win);
    const bestUse = rowsB.filter(x => x.best && x.best.n >= 4 && x.best.win >= 0.55 && x.best.avg4 > 0).sort((a, b) => b.best.win - a.best.win);
    const verdict = side => { if (!N) return ""; const B = N[side].filter(b => b !== "open"); const L = B.map(b => ({ b, o: get(b, "all"), be: get(b, "best"), wo: get(b, "worst") })).filter(x => x.o && x.o.n >= 3);
      if (!L.length) return `<li>${side === "long" ? "Going long" : "Going short"} now would be "${B.map(b => NAME[b]).join(" + ")}": not enough tracked trades of this kind yet.</li>`;
      const avg = L.reduce((a, x) => a + x.o.win, 0) / L.length;
      return `<li><b style="color:${side === "long" ? up : dn}">${side === "long" ? "Long" : "Short"} ${esc(sym)} now</b> = ${L.map(x => `"${NAME[x.b]}"`).join(" + ")}: ${L.map(x => `${Math.round(x.o.win * 100)}% right in ${x.o.n}${x.be && x.be.n ? `, best ${Math.round(x.be.win * 100)}%` : ""}${x.wo && x.wo.n ? `, worst ${Math.round(x.wo.win * 100)}%` : ""}`).join("; ")}. <b>${avg >= 0.55 ? "History favors it." : avg <= 0.45 ? "History says this usually loses." : "History is mixed."}</b></li>`; };
    const recent = rows.slice().sort((a, b) => b.t - a.t).slice(0, opts.recent || 10);
    return `<div style="font:12px var(--mono)">
      ${N ? `<div style="margin:2px 0 6px">Now: ${esc(sym)} ${pc(N.c.r4)} in 4h, ${pc(N.c.r24)} in 24h, at ${Math.round(N.c.pos * 100)}% of its 24h range, ${N.sess}.</div><ul style="margin:0 0 8px 18px;padding:0">${verdict("long")}${verdict("short")}</ul>` : ""}
      ${losing.length ? `<div style="margin:4px 0"><b style="color:${dn}">Common beliefs that lose money here:</b> ${losing.slice(0, 3).map(x => `"${NAME[x.b]}" (worst traders right ${Math.round(x.worst.win * 100)}% of ${x.worst.n}, average ${pc(x.worst.avg4)} after 4h)`).join("; ")}.</div>` : ""}
      ${bestUse.length ? `<div style="margin:4px 0"><b style="color:${up}">What works for the best traders:</b> ${bestUse.slice(0, 3).map(x => `"${NAME[x.b]}" (right ${Math.round(x.best.win * 100)}% of ${x.best.n}, ${pc(x.best.avg4)} after 4h)`).join("; ")}.</div>` : ""}
      <div style="overflow-x:auto;margin-top:6px"><table style="width:100%;border-collapse:collapse"><tr style="color:var(--dim);font-size:11px"><th style="text-align:left;padding:3px 6px">Belief behind the trade</th><th>Best traders right</th><th>Worst traders right</th><th>All</th><th>Avg 4h</th><th>Avg 24h</th><th style="text-align:left">Why they do it</th></tr>
        ${rowsB.map(x => `<tr style="border-top:1px solid var(--line)"><td style="padding:3px 6px">${NAME[x.b]}</td>${w(x.best)}${w(x.worst)}${w(x.all)}<td style="text-align:right;color:${x.all.avg4 >= 0 ? up : dn}">${pc(x.all.avg4)}</td><td style="text-align:right;color:${(x.all.avg24 || 0) >= 0 ? up : dn}">${pc(x.all.avg24)}</td><td style="color:${dim};white-space:normal">${WHY[x.b]}</td></tr>`).join("")}</table></div>
      <div style="margin-top:8px;color:var(--dim)">Recent trades explained</div>
      ${recent.map(r => `<div style="padding:3px 0;border-top:1px solid var(--line);line-height:1.45"><span style="color:${dim}">${new Date(r.t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span> <b style="color:${r.g === "best" ? up : dn}">${esc(r.who || r.g)}</b> ${r.entry ? (r.dir > 0 ? "went long" : "went short") : (r.dir > 0 ? "closed a long" : "closed a short")} ${U(r.usd)} @ ${r.px.toFixed(2)} · <i>why:</i> ${r.B.map(b => NAME[b]).join(" + ")} (${pc(r.c.r4)} in 4h before, ${r.sess}) · <i>result:</i> ${r.f4 == null ? "waiting" : `${pc(r.entry ? r.f4 : -r.f4)} after 4h ${r.ok ? "✓" : "✗"}`}${r.f24 != null ? `, ${pc(r.entry ? r.f24 : -r.f24)} after 24h` : ""}</div>`).join("")}
      <div style="margin-top:6px;color:${dim};line-height:1.5">"Right" = for an entry, price moved their way in the next 4 hours; for an exit, price then moved against the side they left. A trade can carry more than one belief. Beliefs come from the context at the time of the trade, not from the trader: they are our best reading of why.</div></div>`;
  }
  window.Why = { analyze, summary, now, html, NAME, WHY };
})();
