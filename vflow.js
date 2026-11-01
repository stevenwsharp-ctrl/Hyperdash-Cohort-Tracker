/* Volume flow · chart + volume intelligence · shared by SOXX Sniper and Cohort Sniper (the chart is LETF Sniper's).
   Why volume matters: price moves when one side is more urgent than the other, and volume shows how much money stands
   behind a move. Where a lot of volume traded, many traders hold positions and defend them: those prices act as floors
   and ceilings. Where little traded, nobody defends, so price crosses fast.
   Readings (each becomes a signal for the signal web, which learns how much it is worth on each market):
   - vol.node    profile position: above the value area (buyers in control) / below (sellers); in a low-volume pocket
                 (LVN) price tends to keep moving to the next high-volume node (HVN); just above an HVN = support,
                 just below = resistance (old buyers sell at breakeven)
   - vol.climax  a volume spike (2.5σ+ on log volume) with a wide bar at the end of a long move: capitulation after a
                 fall (bullish), blow-off after a rise (bearish)
   - vol.absorb  effort vs result (Wyckoff): heavy volume but a narrow bar = big orders absorbing the move (against it)
   - vol.cmf     Chaikin money flow (20 bars): closes near the high on volume = accumulation (+), near the low = (−)
   - vol.obvdiv  on-balance volume vs price over 20 bars: price down while OBV rises = hidden buying (+), and reverse
   - vol.vwap    distance from VWAP in its own σ: stretched far from the volume-weighted average price
   - vol.dryup   a pullback on thin volume inside a trend: sellers (or buyers) are not really there: the trend resumes
   - vol.push    the last move confirmed by heavy volume (relative volume × direction)
   Bars: [[t, open, high, low, close, volume]], oldest first.
   API: VFlow.profile(B) · VFlow.analyze(B) · VFlow.draw(canvas, B, opts) · VFlow.html(A) */
(function () {
  "use strict";
  if (window.VFlow) return;
  const c1 = v => Math.max(-1, Math.min(1, v)), mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1), sdv = a => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
  const etf = (() => { let f = null; try { f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "numeric", hourCycle: "h23" }); } catch (e) { }
    return t => { if (!f) { const d = new Date(t - 4 * 36e5); return { d: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() }; } const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value])); return { d: `${p.year}-${p.month}-${p.day}`, min: (+p.hour % 24) * 60 + +p.minute }; }; })();
  function ema(v, n) { const k = 2 / (n + 1), o = []; let e = null; v.forEach((x, i) => { e = e == null ? x : x * k + e * (1 - k); o.push(i >= n - 1 ? e : NaN); }); return o; }
  function atr(B, n) { n = n || 14; if (B.length < 2) return NaN; const tr = B.slice(1).map((b, i) => Math.max(b[2] - b[3], Math.abs(b[2] - B[i][4]), Math.abs(b[3] - B[i][4]))); return mean(tr.slice(-n)); }
  // session VWAP (intraday bars: resets at the start of pre-market, the regular session and after-hours); daily bars: rolling 20
  function vwap(B) { const o = [], intraday = B.length > 1 && (B[1][0] - B[0][0]) < 864e5 * 0.9;
    if (!intraday) { for (let i = 0; i < B.length; i++) { let pv = 0, v = 0, p2 = 0; for (let j = Math.max(0, i - 19); j <= i; j++) { const b = B[j], tp = (b[2] + b[3] + b[4]) / 3, w = Math.max(b[5], 1); pv += tp * w; v += w; p2 += tp * tp * w; } const m = pv / v; o.push([m, Math.sqrt(Math.max(0, p2 / v - m * m))]); } return o; }
    let pv = 0, v = 0, p2 = 0, key = ""; B.forEach(b => { const e = etf(b[0]), k = e.d + (e.min >= 570 && e.min < 960 ? "R" : e.min < 570 ? "P" : "A"); if (k !== key) { key = k; pv = 0; v = 0; p2 = 0; }
      const tp = (b[2] + b[3] + b[4]) / 3, w = Math.max(b[5], 1); pv += tp * w; v += w; p2 += tp * tp * w; const m = pv / v; o.push([m, Math.sqrt(Math.max(0, p2 / v - m * m))]); }); return o; }
  // volume profile (LETF Sniper's method): volume spread over each bar's range, smoothed; POC, value area (70%), HVNs, LVNs
  function profile(B, rows) {
    rows = rows || 200; let lo = Infinity, hi = -Infinity; B.forEach(b => { lo = Math.min(lo, b[3]); hi = Math.max(hi, b[2]); }); if (!(hi > lo)) return null;
    const N = Math.max(24, Math.min(rows, Math.round(B.length * 1.2))), step = (hi - lo) / N, P = new Array(N).fill(0);
    B.forEach(b => { const a = Math.max(0, Math.floor((b[3] - lo) / step)), z = Math.min(N - 1, Math.floor((b[2] - lo) / step)), per = b[5] / (z - a + 1); for (let i = a; i <= z; i++) P[i] += per; });
    const tot = P.reduce((a, x) => a + x, 0); if (!(tot > 0)) return null;
    const w = Math.max(2, Math.round(N / 40)), S = P.map((_, i) => { let s = 0, ws = 0; for (let j = -w * 2; j <= w * 2; j++) { const k = i + j; if (k < 0 || k >= N) continue; const g = Math.exp(-(j * j) / (2 * w * w)); s += P[k] * g; ws += g; } return s / ws; });
    const px = i => lo + (i + 0.5) * step, poc = P.indexOf(Math.max(...P));
    let a = poc, z = poc, acc = P[poc]; while (acc < tot * 0.7 && (a > 0 || z < N - 1)) { const up = z < N - 1 ? P[z + 1] : -1, dn = a > 0 ? P[a - 1] : -1; if (up >= dn) { z++; acc += P[z]; } else { a--; acc += P[a]; } }
    const mS = mean(S), gap = Math.max(2, Math.round(N / 18)); let Hn = [];
    for (let i = 1; i < N - 1; i++) if (S[i] >= S[i - 1] && S[i] >= S[i + 1] && S[i] >= mS * 1.15) Hn.push(i);
    Hn.sort((x, y) => S[y] - S[x]); const keep = []; Hn.forEach(i => { if (keep.every(k => Math.abs(k - i) >= gap)) keep.push(i); }); Hn = keep.slice(0, 7).sort((x, y) => x - y);
    const Lv = []; for (let k = 0; k < Hn.length - 1; k++) { let m = Hn[k] + 1; for (let i = Hn[k] + 1; i < Hn[k + 1]; i++) if (S[i] < S[m]) m = i; if (S[m] <= 0.6 * Math.min(S[Hn[k]], S[Hn[k + 1]])) Lv.push(m); }
    return { lo, hi, step, N, P, S, max: Math.max(...P), poc: px(poc), vah: lo + (z + 1) * step, val: lo + a * step, hvn: Hn.map(i => ({ p: px(i), v: S[i] / mS })), lvn: Lv.map(i => ({ p: px(i), v: S[i] / mS })), Sat: p => { const i = Math.max(0, Math.min(N - 1, Math.floor((p - lo) / step))); return S[i] / mS; } };
  }
  // ---------- the volume reading ----------
  function analyze(B, o) {
    o = o || {}; if (!B || B.length < 40) return null; const n = B.length, last = o.px || B[n - 1][4], VP = profile(B, 200); if (!VP) return null;
    const I = [], why = [], c = B.map(b => b[4]), a14 = atr(B, 14) || last * 0.01;
    const lv = B.map(b => Math.log(Math.max(1, b[5]))), lm = mean(lv.slice(-60, -1)), ls = sdv(lv.slice(-60, -1)) || 1, vz = i => (lv[i] - lm) / ls;
    const mv = (k, end) => { end = end == null ? n - 1 : end; const s = Math.max(0, end - k); return c[end] / c[s] - 1; };
    const rsd = sdv(c.slice(1).map((x, i) => Math.log(x / c[i]))) || 1e-9;
    // 1. profile position
    const up = VP.hvn.filter(h => h.p > last * 1.002).sort((x, y) => x.p - y.p)[0], dn = VP.hvn.filter(h => h.p < last * 0.998).sort((x, y) => y.p - x.p)[0];
    const dens = VP.Sat(last), inLvn = dens < 0.6, mo3 = Math.sign(mv(3));
    let node = 0, nodeTxt = "";
    if (last > VP.vah) { node += 0.4; nodeTxt = `above the value area (${fx(VP.val)}–${fx(VP.vah)}): buyers in control while it holds`; }
    else if (last < VP.val) { node -= 0.4; nodeTxt = `below the value area (${fx(VP.val)}–${fx(VP.vah)}): sellers in control while it holds`; }
    else nodeTxt = `inside the value area (${fx(VP.val)}–${fx(VP.vah)}): balance, fair price for most traders`;
    if (inLvn && mo3) { node += 0.5 * mo3; nodeTxt += `; in a thin pocket (volume ${Math.round(dens * 100)}% of normal): price tends to keep going ${mo3 > 0 ? "up" : "down"} to the next node`; }
    else if (dn && (last - dn.p) / a14 < 1.2) { node += 0.35; nodeTxt += `; just above a high-volume node at ${fx(dn.p)} (support)`; }
    else if (up && (up.p - last) / a14 < 1.2) { node -= 0.35; nodeTxt += `; just under a high-volume node at ${fx(up.p)} (resistance: old buyers sell at breakeven)`; }
    if (node) I.push(["vol.node", c1(node), "Volume · profile position (value area, nodes, thin pockets)"]); why.push(nodeTxt);
    // 2. climax
    const vzL = Math.max(vz(n - 1), vz(n - 2)), ci = vz(n - 1) >= vz(n - 2) ? n - 1 : n - 2, rng = (B[ci][2] - B[ci][3]) / a14, prior = mv(10, ci - 1) / (rsd * Math.sqrt(10));
    let clx = null; if (vzL >= 2.5 && rng >= 1.3 && Math.abs(prior) >= 1.5) { clx = { dir: -Math.sign(prior), z: vzL }; I.push(["vol.climax", c1(-Math.sign(prior) * Math.min(1, (vzL - 2) / 2)), "Volume · climax (capitulation or blow-off)"]);
      why.push(`a volume climax (${vzL.toFixed(1)}σ) after a long ${prior > 0 ? "rise: a blow-off, buyers may be spent" : "fall: capitulation, sellers may be spent"} — it counts only if the next bars hold ${prior > 0 ? "below its high" : "above its low"} on lighter volume`); }
    // 3. effort vs result
    const ez = vz(n - 1), er = (B[n - 1][2] - B[n - 1][3]) / a14;
    if (ez >= 1.5 && er <= 0.6) { const d5 = Math.sign(mv(5)); if (d5) { I.push(["vol.absorb", c1(-d5 * 0.7), "Volume · absorption (heavy volume, narrow bar)"]); why.push(`absorption: heavy volume (${ez.toFixed(1)}σ) but a narrow bar — large orders are soaking up the ${d5 > 0 ? "buying" : "selling"}`); } }
    // 4. money flow (CMF 20)
    let mfv = 0, vs = 0; for (let i = n - 20; i < n; i++) { const b = B[i], r = b[2] - b[3]; if (r > 0) { mfv += ((b[4] - b[3]) - (b[2] - b[4])) / r * b[5]; } vs += b[5]; }
    const cmf = vs ? mfv / vs : 0; if (Math.abs(cmf) >= 0.08) { I.push(["vol.cmf", c1(cmf / 0.25), "Volume · money flow (accumulation or distribution)"]); why.push(`money flow ${cmf > 0 ? "+" : ""}${cmf.toFixed(2)}: closes keep landing near the ${cmf > 0 ? "high on volume (accumulation)" : "low on volume (distribution)"}`); }
    // 5. OBV divergence
    const obv = [0]; for (let i = 1; i < n; i++) obv.push(obv[i - 1] + Math.sign(c[i] - c[i - 1]) * B[i][5]);
    const slope = (A, k) => { const s = A.slice(-k), m = (k - 1) / 2, my = mean(s); let a2 = 0, b2 = 0; s.forEach((y, i) => { a2 += (i - m) * (y - my); b2 += (i - m) ** 2; }); return a2 / b2; };
    const oS = slope(obv, 20) / (sdv(obv.slice(-20)) || 1), pS = slope(c, 20) / (sdv(c.slice(-20)) || 1);
    if (Math.sign(oS) !== Math.sign(pS) && Math.abs(oS) >= 0.05 && Math.abs(pS) >= 0.05) { I.push(["vol.obvdiv", c1(Math.sign(oS) * Math.min(1, Math.abs(oS) * 4)), "Volume · OBV divergence (volume disagrees with price)"]); why.push(`on-balance volume ${oS > 0 ? "rises" : "falls"} while price ${pS > 0 ? "rises" : "falls"}: ${oS > 0 ? "hidden buying under a falling price" : "hidden selling under a rising price"}`); }
    // 6. VWAP stretch
    const vw = vwap(B), V = vw[n - 1], vzv = V && V[1] > 0 ? (last - V[0]) / V[1] : 0;
    if (Math.abs(vzv) >= 1) I.push(["vol.vwap", c1(vzv / 3), "Volume · distance from VWAP (σ)"]);
    why.push(V ? `price ${vzv >= 0 ? "above" : "below"} VWAP ${fx(V[0])} by ${Math.abs(vzv).toFixed(1)}σ${Math.abs(vzv) >= 2 ? " — stretched; it often comes back toward VWAP" : ""}` : "");
    // 7. dry-up pullback inside a trend
    const e21 = ema(c, 21), tr = e21[n - 1] > e21[n - 6] ? 1 : e21[n - 1] < e21[n - 6] ? -1 : 0, pb = Math.sign(mv(3)), v3 = mean(B.slice(-3).map(b => b[5])), v20 = mean(B.slice(-23, -3).map(b => b[5]));
    if (tr && pb === -tr && v20 > 0 && v3 / v20 < 0.7) { I.push(["vol.dryup", c1(tr * 0.7), "Volume · thin-volume pullback in a trend"]); why.push(`a pullback against the ${tr > 0 ? "uptrend" : "downtrend"} on thin volume (${Math.round(v3 / v20 * 100)}% of normal): the other side is not really there`); }
    // 8. volume-confirmed push
    const rv = v20 > 0 ? B[n - 1][5] / v20 : 1, bd = Math.sign(B[n - 1][4] - B[n - 1][1]);
    if (rv >= 1.8 && bd) I.push(["vol.push", c1(bd * Math.min(1, (rv - 1) / 2)), "Volume · move backed by heavy volume"]);
    return { VP, last, I, why: why.filter(Boolean), up, dn, inLvn, dens, clx, cmf, rv, vzv, vw: V, n };
  }
  const fx = v => !isFinite(v) ? "–" : v >= 1000 ? v.toFixed(0) : v >= 100 ? v.toFixed(2) : v >= 1 ? v.toFixed(2) : v.toPrecision(4);
  // ---------- the chart (LETF Sniper's look) ----------
  function draw(cv, B, o) {
    o = o || {}; const box = cv.parentElement, W = box.clientWidth, Hh = box.clientHeight, dpr = window.devicePixelRatio || 1; if (!W) return null;
    cv.width = W * dpr; cv.height = Hh * dpr; cv.style.width = W + "px"; cv.style.height = Hh + "px"; const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, Hh);
    const cs = getComputedStyle(document.documentElement), v = k => cs.getPropertyValue(k).trim(), TH = { mute: v("--mute") || "#5a6676", line: v("--line") || "#1e2835", dim: v("--dim") || "#8a97a8", ink: v("--ink") || v("--text") || "#e6edf5", amber: v("--amber") || "#f5b041", accent: v("--accent") || "#4da3ff", up: v("--up") || v("--bull") || "#19d38a", down: v("--down") || v("--bear") || "#ff4d5e", bg: v("--bg") || "#07090d", violet: v("--violet") || "#9b6bff" };
    g.font = "11px JetBrains Mono, IBM Plex Mono, ui-monospace, Menlo, monospace";
    if (!B || B.length < 2) { g.fillStyle = TH.dim; g.fillText(o.err || "Loading chart…", 14, 24); return null; }
    const axW = W < 520 ? 50 : 62, pl = 6, pr = W - axW, volH = Math.round(Hh * 0.16), top = 10, bot = Hh - 20 - volH, n = B.length;
    let lo = Infinity, hi = -Infinity; B.forEach(b => { lo = Math.min(lo, b[3]); hi = Math.max(hi, b[2]); }); const pad = (hi - lo) * 0.06 || hi * 0.01; lo -= pad; hi += pad;
    const X = i => pl + (i + 0.5) * (pr - pl) / n, Y = p => top + (hi - p) / (hi - lo) * (bot - top), bw = Math.max(1, (pr - pl) / n * 0.7), intraday = (B[1][0] - B[0][0]) < 864e5 * 0.9;
    g.strokeStyle = TH.line; g.lineWidth = 1; g.fillStyle = TH.mute; g.textAlign = "left";
    for (let k = 0; k <= 5; k++) { const p = lo + (hi - lo) * k / 5, y = Y(p); g.globalAlpha = 0.5; g.beginPath(); g.moveTo(pl, y); g.lineTo(pr, y); g.stroke(); g.globalAlpha = 1; g.fillText(fx(p), pr + 6, y + 4); }
    if (intraday) { g.fillStyle = TH.line; g.globalAlpha = 0.25; B.forEach((b, i) => { const m = etf(b[0]).min; if (m < 570 || m >= 960) g.fillRect(X(i) - (pr - pl) / n / 2, top, (pr - pl) / n + 0.5, bot - top); }); g.globalAlpha = 1; }
    const VP = profile(B, 200);
    if (o.vp !== false && VP) { const maxW = (pr - pl) * 0.24, rh = Math.max(1, (Y(VP.lo) - Y(VP.lo + VP.step)));
      VP.P.forEach((val, i) => { const p = VP.lo + i * VP.step, y = Y(p + VP.step), w = val / VP.max * maxW, inVA = p >= VP.val - 1e-9 && p < VP.vah; g.fillStyle = inVA ? TH.accent : TH.dim; g.globalAlpha = inVA ? 0.32 : 0.2; g.fillRect(pr - w, y, w, Math.max(1, rh - 0.5)); }); g.globalAlpha = 1;
      const hl = (p, col, dash, lab) => { const y = Y(p); g.strokeStyle = col; g.setLineDash(dash); g.lineWidth = 1; g.beginPath(); g.moveTo(pl, y); g.lineTo(pr, y); g.stroke(); g.setLineDash([]); if (lab) { g.fillStyle = col; g.textAlign = "right"; g.fillText(lab, pr - 4, y - 3); g.textAlign = "left"; } };
      VP.hvn.forEach(h => hl(h.p, TH.violet, [6, 4], "HVN " + fx(h.p))); VP.lvn.forEach(h => hl(h.p, TH.amber, [2, 4], "LVN")); hl(VP.poc, TH.accent, [], "POC " + fx(VP.poc)); }
    const vw = o.vwap !== false ? vwap(B) : null;
    if (vw) { const line = (f, col, w, dash) => { g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath(); let st = false, lk = ""; B.forEach((b, i) => { const e = etf(b[0]), k = intraday ? e.d + (e.min >= 570 && e.min < 960 ? "R" : e.min < 570 ? "P" : "A") : "x", y = f(vw[i]); if (!isFinite(y) || k !== lk) { st = false; lk = k; } if (!isFinite(y)) return; const yy = Y(y); st ? g.lineTo(X(i), yy) : g.moveTo(X(i), yy); st = true; }); g.stroke(); g.setLineDash([]); };
      line(q => q[0], TH.amber, 1.6); [1, 2].forEach(k => { line(q => q[1] > 0 ? q[0] + k * q[1] : NaN, TH.amber, 0.8, [3, 3]); line(q => q[1] > 0 ? q[0] - k * q[1] : NaN, TH.amber, 0.8, [3, 3]); }); }
    if (o.ema !== false) { const c = B.map(b => b[4]); [[ema(c, 9), TH.up], [ema(c, 21), TH.down]].forEach(([E, col]) => { g.strokeStyle = col; g.globalAlpha = 0.8; g.lineWidth = 1.2; g.beginPath(); let st = false; E.forEach((val, i) => { if (!isFinite(val)) return; st ? g.lineTo(X(i), Y(val)) : g.moveTo(X(i), Y(val)); st = true; }); g.stroke(); g.globalAlpha = 1; }); }
    B.forEach((b, i) => { const up = b[4] >= b[1], x = X(i); g.strokeStyle = g.fillStyle = up ? TH.up : TH.down; g.beginPath(); g.moveTo(x, Y(b[2])); g.lineTo(x, Y(b[3])); g.stroke(); const y1 = Y(Math.max(b[1], b[4])), y2 = Y(Math.min(b[1], b[4])); g.fillRect(x - bw / 2, y1, bw, Math.max(1, y2 - y1)); });
    const vmax = Math.max(...B.map(b => b[5])) || 1; B.forEach((b, i) => { g.fillStyle = b[4] >= b[1] ? TH.up : TH.down; g.globalAlpha = 0.45; const h = b[5] / vmax * (volH - 6); g.fillRect(X(i) - bw / 2, Hh - 20 - h, bw, h); }); g.globalAlpha = 1;
    const lp = o.px || B[n - 1][4]; if (lp >= lo && lp <= hi) { const y = Y(lp); g.strokeStyle = TH.ink; g.globalAlpha = 0.5; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(pl, y); g.lineTo(pr, y); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; g.fillStyle = TH.ink; g.fillRect(pr, y - 8, axW, 16); g.fillStyle = TH.bg; g.fillText(fx(lp), pr + 4, y + 4); }
    g.fillStyle = TH.mute; g.textAlign = "center"; const step = Math.max(1, Math.round(n / (W < 520 ? 4 : 7)));
    for (let i = 0; i < n; i += step) { const e = new Date(B[i][0]); const span = B[n - 1][0] - B[0][0]; g.fillText(intraday && span < 864e5 * 1.2 ? e.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }) : intraday && span < 864e5 * 8 ? e.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric" }) : e.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: span > 400 * 864e5 ? "2-digit" : undefined }), X(i), Hh - 5); }
    g.textAlign = "left";
    return { B, X, Y, n, pl, pr, top, bot, vw, VP };
  }
  function html(A, sym) {
    if (!A) return `<div class="note">The volume reading needs 40+ bars.</div>`;
    const net = A.I.reduce((s, x) => s + x[1], 0), cl = net > 0.15 ? "up" : net < -0.15 ? "down" : "";
    return `<div style="font:12.5px/1.5 var(--sans,system-ui)"><b class="${cl}">Volume says: ${net > 0.15 ? "buyers have the edge" : net < -0.15 ? "sellers have the edge" : "balanced / no clear edge"}</b>${sym ? ` <span class="sub">(${sym})</span>` : ""}
      <ul style="margin:4px 0 0 18px;padding:0">${A.why.map(w => `<li>${w}</li>`).join("")}</ul>
      <div class="sub" style="margin-top:4px">Next high-volume node up: ${A.up ? fx(A.up.p) + " (" + ((A.up.p / A.last - 1) * 100).toFixed(1) + "%)" : "none — open air above"} · down: ${A.dn ? fx(A.dn.p) + " (" + ((A.dn.p / A.last - 1) * 100).toFixed(1) + "%)" : "none — open air below"} · POC ${fx(A.VP.poc)}</div>
      ${A.I.length ? `<div class="sub" style="margin-top:2px">Signals to the web: ${A.I.map(x => `${x[2].replace("Volume · ", "")} <b class="${x[1] > 0 ? "up" : "down"}">${x[1] > 0 ? "+" : ""}${x[1].toFixed(2)}</b>`).join(" · ")}</div>` : ""}</div>`;
  }
  window.VFlow = { profile, analyze, draw, html, vwap, ema };
})();
