/* Trapped traders · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   Who is under water, how much, and how close to being forced out — from the top holders of each market
   (Cohort Sniper's data job: specialists.json = size, side, unrealized P&L, cohort, skill; levels.json = entry, leverage,
   liquidation price, and each trader's own habit: how far price usually goes against them before they cut a loser).
   For each side (trapped longs = long and losing; trapped shorts = short and losing):
   - count and $ size, the $ they are down, and the share of all top-holder money that is trapped
   - depth: the move back to their entry (break-even), size-weighted; buckets: near (< 2%), 2–5%, 5–10%, deep (> 10%)
   - past their own stop: already further under water than where they usually cut a loser (pain, forced selling risk)
   - near liquidation: liquidation price within 5% and within 10% of price (fuel for a cascade)
   - leverage, the skill mix (good vs bad traders trapped), and the break-even wall: the size-weighted break-even price
     (trapped longs sell into it on a bounce = supply above; trapped shorts buy back at it = demand below; past it the
     other way, they add fuel: a squeeze for shorts, a flush for longs)
   Pressure = squeeze fuel − flush fuel: shorts' pain (size × depth vs their stop, plus liquidation risk) minus longs'.
   + = trapped shorts dominate (squeeze risk up); − = trapped longs dominate (supply, flush risk down). Signal trap.pressure.
   API: Trapped.analyze(holders, levelsH, px) → T · Trapped.signals(T) · Trapped.html(T, { px, usd, title }) · Trapped.rowHtml */
(function () {
  "use strict";
  if (window.Trapped) return;
  const c1 = v => Math.max(-1, Math.min(1, v));
  function analyze(H, LV, px) {
    if (!H || !H.length || !px) return null; LV = LV || {};
    const side = () => ({ n: 0, usd: 0, loss: 0, dep: 0, b: [0, 0, 0, 0], past: 0, pastN: 0, liq5: 0, liq10: 0, levW: 0, levN: 0, good: 0, bad: 0, be: 0, list: [], pain: 0 });
    const S = { L: side(), Sh: side() }; let tot = 0, totL = 0, totS = 0;
    H.forEach(h => { if (h.miss && h.u == null) return; tot += h.n || 0; if (h.sd > 0) totL += h.n || 0; else totS += h.n || 0;
      // trapped at today's price: from the entry when it is known (levels.json), else from the P&L in the holder file
      const l = LV[h.a] || {}, o = h.sd > 0 ? S.L : S.Sh, n = h.n || 0; let ep = l.ep, d, loss;
      if (ep) { d = h.sd > 0 ? ep / px - 1 : 1 - ep / px; if (!(d > 0)) return; loss = n * Math.abs(px / ep - 1); }
      else { if (!(h.u < 0)) return; d = -h.u / Math.max(1, n); loss = -h.u; ep = h.sd > 0 ? px * (1 + d) : px * (1 - d); }
      o.n++; o.usd += n; o.loss += loss; o.dep += d * n; o.b[d < 0.02 ? 0 : d < 0.05 ? 1 : d < 0.1 ? 2 : 3] += n; o.be += ep * n;
      const cut = (l.lcC != null ? l.lcC : l.lc) / 100, scalp = l.lc != null && l.lc < 0.5 && l.hold != null && l.hold < 120;
      const past = cut > 0 && !scalp && d > cut; if (past) { o.past += n; o.pastN++; }
      const lq = l.lq ? Math.abs(l.lq / px - 1) : null; if (lq != null && lq <= 0.05) o.liq5 += n; if (lq != null && lq <= 0.1) o.liq10 += n;
      if (l.lev) { o.levW += l.lev * n; o.levN += n; }
      const g = h.q >= 0.25 || h.coh === "EP" || h.coh === "VP" ? "good" : h.q <= -0.25 || ["U", "VU", "R"].includes(h.coh) ? "bad" : null; if (g) o[g] += n;
      o.pain += n * (Math.min(3, cut > 0 ? d / cut : d / 0.05) + (lq != null && lq <= 0.1 ? (0.1 - lq) * 20 : 0));
      o.list.push({ a: h.a, lb: h.lb, n, u: h.u, loss, d, ep, lq: l.lq || null, lqD: lq, lev: l.lev || null, cut: cut > 0 ? cut : null, past, coh: h.coh, q: h.q }); });
    [S.L, S.Sh].forEach(o => { o.depW = o.usd ? o.dep / o.usd : 0; o.be = o.usd ? o.be / o.usd : null; o.lev = o.levN ? o.levW / o.levN : null; o.list.sort((a, b) => b.n - a.n); });
    const P = (S.Sh.pain - S.L.pain) / Math.max(1, tot);
    return { px, tot, totL, totS, L: S.L, S: S.Sh, P, share: tot ? (S.L.usd + S.Sh.usd) / tot : 0 };
  }
  function signals(T) { if (!T || !T.tot) return []; const I = []; if (Math.abs(T.P) >= 0.05) I.push(["trap.pressure", c1(T.P), "Trapped · shorts' pain minus longs' pain (squeeze + / flush −)"]); return I; }
  const pc = v => (v * 100).toFixed(1) + "%";
  function sideHtml(o, name, cls, T, U, fx) {
    if (!o.n) return `<div><b class="${cls}">${name}</b>: none of the top holders are under water.</div>`;
    const bar = o.b.map((v, i) => `<span title="${["< 2%", "2–5%", "5–10%", "> 10%"][i]} from break-even: ${U(v)}" style="display:inline-block;height:8px;width:${Math.max(2, v / o.usd * 140)}px;background:var(--${cls === "L" ? "up" : "down"});opacity:${[0.35, 0.55, 0.75, 1][i]}"></span>`).join("");
    return `<div style="margin:4px 0"><b class="${cls}">${name}</b>: <b>${o.n}</b> wallets, <b>${U(o.usd)}</b> (${pc(o.usd / Math.max(1, cls === "L" ? T.totL : T.totS))} of top-holder ${cls === "L" ? "longs" : "shorts"}), down <b>${U(o.loss)}</b>
      <div style="font-size:12px;margin-top:2px">Average <b>${pc(o.depW)}</b> from break-even · break-even wall <b>${fx(o.be)}</b> (${cls === "L" ? "supply on a bounce" : "buy-backs on a dip"}) · ${bar} near → deep
      <br>Past their own usual stop: <b class="${o.past / o.usd > 0.3 ? "S" : ""}">${U(o.past)}</b> (${o.pastN} wallet${o.pastN === 1 ? "" : "s"}) · liquidation within 5%: <b class="${o.liq5 ? "S" : ""}">${U(o.liq5)}</b>, within 10%: ${U(o.liq10)}${o.lev ? ` · leverage ${o.lev.toFixed(1)}x` : ""} · good traders ${U(o.good)} / bad ${U(o.bad)}</div></div>`;
  }
  function html(T, o) {
    o = o || {}; const fx = o.px || (v => v >= 100 ? v.toFixed(2) : v.toPrecision(4)), U = o.usd || (v => v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? "$" + (v / 1e3).toFixed(0) + "K" : "$" + Math.round(v));
    if (!T) return `<div class="note">No holder data for this market yet (the data job covers the top setups).</div>`;
    const lean = T.P > 0.05 ? `<b class="L">trapped shorts dominate: squeeze risk up</b>` : T.P < -0.05 ? `<b class="S">trapped longs dominate: supply overhead, flush risk down</b>` : "balanced: neither side is under real pressure";
    const top = [...T.L.list.slice(0, 4).map(x => ({ ...x, s: 1 })), ...T.S.list.slice(0, 4).map(x => ({ ...x, s: -1 }))].sort((a, b) => b.n - a.n).slice(0, 8);
    return `<div class="note" style="max-width:none">${o.title ? `<b>${o.title}</b> · ` : ""}${pc(T.share)} of top-holder money is under water. Pressure <b>${T.P >= 0 ? "+" : ""}${T.P.toFixed(2)}</b>: ${lean}.</div>
      <div style="display:flex;gap:6px;align-items:center;margin:4px 0;font:12px var(--mono)"><span class="L">longs ${U(T.L.usd)}</span><span style="flex:1;height:10px;border-radius:5px;overflow:hidden;display:flex;background:var(--line)"><i style="width:${T.L.usd + T.S.usd ? T.L.usd / (T.L.usd + T.S.usd) * 100 : 50}%;background:var(--up)"></i><i style="flex:1;background:var(--down)"></i></span><span class="S">${U(T.S.usd)} shorts</span></div>
      ${sideHtml(T.L, "Trapped longs", "L", T, U, fx)}${sideHtml(T.S, "Trapped shorts", "S", T, U, fx)}
      ${top.length ? `<table class="tr" style="margin-top:4px"><thead><tr><th style="text-align:left">Biggest trapped</th><th>side</th><th>size</th><th>down</th><th>to break-even</th><th title="How far price usually goes against this trader before they cut a loser">their usual cut</th><th>liq. price</th><th>lev.</th></tr></thead><tbody>${top.map(x => `<tr><td style="text-align:left">${x.lb || x.a.slice(0, 6) + "…" + x.a.slice(-4)}</td><td class="${x.s > 0 ? "L" : "S"}">${x.s > 0 ? "long" : "short"}</td><td>${U(x.n)}</td><td class="S">${U(x.loss)}</td><td>${pc(x.d)} → ${fx(x.ep)}</td><td class="${x.past ? "S" : ""}">${x.cut != null ? pc(x.cut) + (x.past ? " (past it)" : "") : "–"}</td><td>${x.lq ? `${fx(x.lq)} <span style="color:var(--dim)">${pc(x.lqD)}</span>` : "–"}</td><td>${x.lev ? x.lev + "x" : "–"}</td></tr>`).join("")}</tbody></table>` : ""}
      <div class="note" style="max-width:none">Trapped longs tend to sell when price comes back to their entry (supply above); trapped shorts buy back at theirs (demand below). Past their usual stop, they are in pain and more likely to give up; near liquidation, the exchange closes them by force, and that pushes price further the same way (a squeeze for shorts, a flush for longs).</div>`;
  }
  // one compact row for a list of markets
  function rowHtml(coin, T, U) { U = U || (v => v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : "$" + (v / 1e3).toFixed(0) + "K");
    return `<tr><td style="text-align:left">${coin}</td><td class="L">${T.L.n} · ${U(T.L.usd)}</td><td>${pc(T.L.depW)}</td><td class="${T.L.liq10 ? "S" : ""}">${U(T.L.past)} / ${U(T.L.liq10)}</td><td class="S">${T.S.n} · ${U(T.S.usd)}</td><td>${pc(T.S.depW)}</td><td class="${T.S.liq10 ? "S" : ""}">${U(T.S.past)} / ${U(T.S.liq10)}</td><td class="${T.P > 0.05 ? "L" : T.P < -0.05 ? "S" : ""}">${T.P >= 0 ? "+" : ""}${T.P.toFixed(2)}</td></tr>`; }
  const rowHead = `<thead><tr><th style="text-align:left">Market</th><th>Trapped longs</th><th>depth</th><th title="$ past their usual stop / $ within 10% of liquidation">pain / liq.</th><th>Trapped shorts</th><th>depth</th><th title="$ past their usual stop / $ within 10% of liquidation">pain / liq.</th><th title="+ squeeze risk up, − flush risk down">Pressure</th></tr></thead>`;
  window.Trapped = { analyze, signals, html, rowHtml, rowHead };
})();
