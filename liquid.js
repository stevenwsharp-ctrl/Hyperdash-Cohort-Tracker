/* Liquidity hound · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   Liquidity = how much money is ready to trade near the price, and where. It decides how far a given push moves price:
   a thick book absorbs, a thin book lets price run. Liquidity sits where people put orders on purpose (round numbers, the
   last high and low, big holders' entries) and where stops and liquidations are forced to trade.
   From Hyperliquid's live order book (fine book for the spread, coarse book for ±2.5% depth) and hourly candles:
   - liq.imbalance  more money bidding than offering within ±1% (+), or the reverse (−)
   - liq.wall       the nearest large resting order (5× the median level or more) within 2.5%: a wall below = a floor (+),
                    above = a ceiling (−); closer and bigger = stronger. Walls can be pulled: the web learns how much they hold
   - liq.thin       depth within ±1% vs this market's normal depth, signed by the recent move: in a thin book moves run
   - liq.pool       stop pools beyond the 24 h high and low (and round numbers): price is drawn toward the nearest pool
                    within 2%; after a sweep it often reverses (the web learns which happens on each market)
   - liq.sweep      the last hour ran past the 24 h high or low and closed back inside: stops taken, often a turn
   - liq.impact     price impact per $ traded (Amihud) vs normal, signed by the move: moves on thin money tend to fade
   Across markets (Cohort Sniper): liq.rotation (a market's share of its industry's $ volume rising = money arriving)
   and liq.tide (total open interest across all markets: leverage flowing in lifts risk, flowing out sinks it).
   API: await Liquid.read(coin, bars?) · Liquid.signals(A, sym) · Liquid.html(rows) · Liquid.tide(ctxNow) · Liquid.rotation(rows) */
(function () {
  "use strict";
  if (window.Liquid) return;
  const c1 = v => Math.max(-1, Math.min(1, v)), med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };
  const post = b => fetch("https://api.hyperliquid.xyz/info", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => { if (r.status === 429) throw new Error("429"); return r.json(); });
  const NK = "liq_norm_v1", N = (() => { try { return JSON.parse(localStorage.getItem(NK) || "{}"); } catch (e) { return {}; } })();
  let nT = 0; const nsave = () => { if (Date.now() - nT < 6e4) return; nT = Date.now(); try { localStorage.setItem(NK, JSON.stringify(N)); } catch (e) { } };
  const norm = (k, v, a) => { const o = N[k]; N[k] = o ? o * (1 - (a || 0.03)) + v * (a || 0.03) : v; nsave(); return o || v; };   // slow running normal
  async function read(coin, bars) {
    const [fine, wide] = await Promise.all([post({ type: "l2Book", coin }), post({ type: "l2Book", coin, nSigFigs: 3 })]);
    const lv = b => (b && b.levels) ? b.levels.map(side => side.map(q => ({ px: +q.px, sz: +q.sz, n: +q.n }))) : [[], []];
    const [fb, fa] = lv(fine), [wb, wa] = lv(wide); if (!fb.length || !fa.length) return null;
    const bid = fb[0].px, ask = fa[0].px, mid = (bid + ask) / 2, spread = (ask - bid) / mid;
    // depth (in $) within a band, from the coarse book (falls back to the fine book)
    const B = wb.length ? wb : fb, A = wa.length ? wa : fa, dep = (side, pct, dir) => side.filter(q => dir > 0 ? q.px >= mid * (1 - pct) : q.px <= mid * (1 + pct)).reduce((s, q) => s + q.px * q.sz, 0);
    const d05 = [dep(B, 0.005, 1), dep(A, 0.005, -1)], d1 = [dep(B, 0.01, 1), dep(A, 0.01, -1)], d2 = [dep(B, 0.025, 1), dep(A, 0.025, -1)];
    const tot1 = d1[0] + d1[1], imb = tot1 ? (d1[0] - d1[1]) / tot1 : 0, nrm = norm("d1:" + coin, tot1), thin = nrm ? tot1 / nrm : 1;
    // walls: levels 5× the median level size (in $) within 2.5%
    const all = B.concat(A).filter(q => Math.abs(q.px / mid - 1) <= 0.025), m$ = med(all.map(q => q.px * q.sz)) || 1;
    const walls = all.filter(q => q.px * q.sz >= 5 * m$).map(q => ({ px: q.px, usd: q.px * q.sz, x: q.px * q.sz / m$, side: q.px < mid ? 1 : -1, dist: q.px / mid - 1 })).sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist));
    const out = { coin, at: Date.now(), mid, spread, d05, d1, d2, imb, thin, nrm, walls };
    // pools, impact and momentum from candles [[t,o,h,l,c,v]] (hourly)
    if (bars && bars.length >= 30) { const n = bars.length, last = bars.slice(-24), hi = Math.max(...last.map(b => b[2])), lo = Math.min(...last.map(b => b[3]));
      const step = Math.pow(10, Math.floor(Math.log10(mid))) / 2, rnd = [Math.floor(mid / step) * step, Math.ceil(mid / step) * step].filter(p => p !== mid);
      out.pools = [hi > mid ? { px: hi, k: "24 h high (stops of shorts)" } : null, lo < mid ? { px: lo, k: "24 h low (stops of longs)" } : null].filter(Boolean).concat(rnd.map(p => ({ px: p, k: "round number" }))).map(p => ({ ...p, dist: p.px / mid - 1 })).filter(p => Math.abs(p.dist) <= 0.02 && Math.abs(p.dist) > 0.0005).sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist));
      const am = bars.slice(-48).map((b, i, a) => i ? Math.abs(Math.log(b[4] / a[i - 1][4])) / Math.max(1, b[4] * b[5]) * 1e6 : null).filter(v => v != null && isFinite(v));
      const amNow = am.slice(-4).reduce((s, v) => s + v, 0) / 4, amN = med(am) || amNow; out.impact = amN ? amNow / amN : 1;
      // a sweep: the last bar ran past the prior 24 h high (or low) and closed back inside = stops taken, often a turn
      const pr = bars.slice(-25, -1), pH = Math.max(...pr.map(b => b[2])), pL = Math.min(...pr.map(b => b[3])), b = bars[n - 1];
      out.sweep = b[2] > pH && b[4] < pH ? -1 : b[3] < pL && b[4] > pL ? 1 : 0;
      out.mo = Math.log(bars[n - 1][4] / bars[Math.max(0, n - 5)][4]); }
    return out;
  }
  function signals(A, sym) {
    if (!A) return []; const I = [], s = sym || A.coin.split(":").pop();
    if (Math.abs(A.imb) >= 0.15) I.push(["liq.imbalance", s, c1(A.imb * 1.5), "Liquidity · order book imbalance within ±1%"]);
    const w = A.walls[0]; if (w && Math.abs(w.dist) <= 0.025) I.push(["liq.wall", s, c1(w.side * Math.min(1, w.x / 15) * (1 - Math.abs(w.dist) / 0.03)), "Liquidity · nearest large resting order (floor + / ceiling −)"]);
    if (A.mo != null && A.thin < 0.7) I.push(["liq.thin", s, c1(Math.sign(A.mo) * (0.7 - A.thin) * 2.5), "Liquidity · thin book, moves run (signed by the move)"]);
    const p = A.pools && A.pools[0]; if (p) I.push(["liq.pool", s, c1(Math.sign(p.dist) * (1 - Math.abs(p.dist) / 0.02)), "Liquidity · nearest stop pool (price drawn toward it)"]);
    if (A.sweep) I.push(["liq.sweep", s, A.sweep * 0.7, "Liquidity · stops swept past the 24 h " + (A.sweep < 0 ? "high" : "low") + " and price came back (a turn?)"]);
    if (A.impact != null && A.mo && A.impact >= 1.5) I.push(["liq.impact", s, c1(-Math.sign(A.mo) * Math.min(1, (A.impact - 1) / 2)), "Liquidity · move made on thin money (tends to fade)"]);
    return I;
  }
  // across markets: total open interest (the tide) and money rotating inside an industry
  function tide(ctx) { if (!ctx) return null; let oi = 0, v = 0; Object.values(ctx).forEach(c => { oi += +c.oi || 0; v += +c.v || 0; }); const o0 = norm("tide:oi", oi, 0.01), v0 = norm("tide:v", v, 0.01);
    return { oi, v, oiCh: o0 ? oi / o0 - 1 : 0, vR: v0 ? v / v0 : 1 }; }
  function rotation(rows, tagOf) { const G = {}; rows.forEach(r => { const t = tagOf(r.coin); if (!t || !t.ind || !r.v) return; (G[t.ind] = G[t.ind] || []).push(r); }); const out = {};
    Object.values(G).forEach(L => { if (L.length < 3) return; const tot = L.reduce((s, r) => s + r.v, 0); L.forEach(r => { const sh = r.v / tot, n0 = norm("sh:" + r.coin, sh, 0.02); out[r.coin] = { sh, ch: n0 ? sh / n0 - 1 : 0 }; }); });
    return out; }
  // ---------- html ----------
  const usd = v => v >= 1e9 ? "$" + (v / 1e9).toFixed(1) + "B" : v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : v >= 1e3 ? "$" + (v / 1e3).toFixed(1) + "K" : "$" + Math.round(v);
  function html(rows, o) {
    o = o || {}; const fx = o.px || (v => v >= 100 ? v.toFixed(2) : v.toPrecision(4)); rows = rows.filter(Boolean); if (!rows.length) return `<div class="note">Order books load in a minute.</div>`;
    return `<table class="tr"><thead><tr><th style="text-align:left">Market</th><th>Spread</th><th title="$ waiting within ±1%: bids / asks">Depth ±1% (bid / ask)</th><th title="Depth within ±1% vs this market's normal">vs normal</th><th title="Bids minus asks within ±1%">Imbalance</th><th style="text-align:left">Nearest wall</th><th style="text-align:left">Nearest stop pool</th><th title="Price move per $ traded vs normal (Amihud)">Impact</th></tr></thead><tbody>${rows.map(A => { const w = A.walls[0], p = A.pools && A.pools[0];
      return `<tr><td style="text-align:left"><b>${A.coin.split(":").pop()}</b></td><td>${(A.spread * 1e4).toFixed(1)} bp</td><td>${usd(A.d1[0])} / ${usd(A.d1[1])}</td><td class="${A.thin < 0.7 ? "S" : A.thin > 1.4 ? "L" : ""}">${(A.thin * 100).toFixed(0)}%${A.thin < 0.7 ? " thin" : ""}</td><td class="${A.imb > 0.15 ? "L" : A.imb < -0.15 ? "S" : ""}">${A.imb >= 0 ? "+" : ""}${(A.imb * 100).toFixed(0)}%</td>
        <td style="text-align:left">${w ? `<span class="${w.side > 0 ? "L" : "S"}">${w.side > 0 ? "floor" : "ceiling"} ${fx(w.px)}</span> (${(w.dist * 100).toFixed(2)}%, ${usd(w.usd)}, ${w.x.toFixed(0)}×)` : "none within 2.5%"}</td>
        <td style="text-align:left">${A.sweep ? `<b class="${A.sweep > 0 ? "L" : "S"}">swept the 24 h ${A.sweep > 0 ? "low" : "high"}</b> · ` : ""}${p ? `${fx(p.px)} ${p.k} (${(p.dist * 100).toFixed(2)}%)` : "–"}</td><td class="${A.impact >= 1.5 ? "S" : ""}">${A.impact != null ? A.impact.toFixed(1) + "×" : "–"}</td></tr>`; }).join("")}</tbody></table>
      <div class="note" style="max-width:none;margin-top:4px">Liquidity decides how far a push moves price. A thick book absorbs; a thin one (nights, weekends, a pulled book) lets price run. Walls are large resting orders: floors and ceilings until they are pulled or eaten. Stops and liquidations sit just beyond the last high and low and at round numbers: price is often drawn to them, sweeps them, then reverses. Moves on thin money (high impact) tend to fade. The signal web learns which of these leads on each market.</div>`;
  }
  window.Liquid = { read, signals, tide, rotation, html };
})();
