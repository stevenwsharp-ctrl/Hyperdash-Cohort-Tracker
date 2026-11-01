/* Rhyme · the crowd's mood at every hour, and the past moments that rhyme with now · shared by both sites.
   Data: crowd.json from Cohort Sniper's data job — one row per hour (kept 3 years): how long the whole crowd is, where the
   smart and the losing cohorts lean, funding, how many markets are rising, the median move, the VIX, and 8 key prices.
   Crowd compass: x = greed (crowd long tilt, funding, breadth and the median move, as z-scores) vs fear;
                  y = smart money vs the crowd (smart minus losing cohorts' bias).
     top right    bull with smart money on board      bottom right  euphoria: the crowd buys, smart money sells
     top left     accumulation: fear, smart money buys bottom left  panic or downtrend: everyone sells
   Every past hour is a faint dot colored by what the chosen market did in the next 24 h, so the map shows which crowd
   states came before rises and falls. History does not repeat, but it rhymes: the 8 past moments most like now (z-score
   distance over all the crowd features, at least 24 h apart, not the last 2 days) and what came next.
   Feeds the signal web: crowd.greed, crowd.smart, crowd.rhyme (per market), and the whole memory as history.
   API: await Rhyme.load() · Rhyme.analyze(key) · Rhyme.html(key, el) · Rhyme.signals() · Rhyme.feedWeb() */
(function () {
  "use strict";
  if (window.Rhyme) return;
  const URL = "https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/data/crowd.json";
  const F = ["lev", "smart", "fools", "gap", "fund", "breadth", "move", "vix"], FI = { lev: 1, smart: 2, fools: 3, gap: 4, fund: 5, breadth: 6, move: 7, vix: 8 };
  const NAME = { BTC: "Bitcoin", ETH: "Ether", SOL: "Solana", "XYZ:SP500": "S&P 500", "XYZ:XYZ100": "Nasdaq 100", "XYZ:SOXL": "SOXL", "XYZ:NVDA": "Nvidia", "XYZ:GOLD": "Gold" };
  const c1 = v => Math.max(-1, Math.min(1, v));
  let C = null, cT = 0, ST = null;
  async function load() {
    if (C && Date.now() - cT < 10 * 6e4) return C;
    try { const r = await fetch(URL + "?t=" + Math.floor(Date.now() / 3e5)); if (r.ok) { C = await r.json(); cT = Date.now(); ST = null; } } catch (e) { }
    return C;
  }
  // z-score stats for every feature over the whole memory
  function stats() { if (ST) return ST; const R = C.rows; ST = {};
    F.forEach(f => { const v = R.map(r => r[FI[f]]).filter(x => x != null && isFinite(x)); const m = v.reduce((a, x) => a + x, 0) / (v.length || 1), sd = Math.sqrt(v.reduce((a, x) => a + (x - m) ** 2, 0) / (v.length || 1)); ST[f] = { m, sd: sd || 1, n: v.length }; });
    return ST; }
  const zf = (r, f) => { const v = r[FI[f]], s = ST[f]; return v == null || !isFinite(v) || s.n < 10 ? null : (v - s.m) / s.sd; };
  const avg = a => { const v = a.filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const pos = r => ({ x: avg([zf(r, "lev"), zf(r, "fund"), zf(r, "breadth"), zf(r, "move")]), y: zf(r, "gap") });
  const quad = p => p.x == null || p.y == null ? "–" : p.x >= 0 ? (p.y >= 0 ? "Bull with smart money on board" : "Euphoria: the crowd buys, smart money sells") : (p.y >= 0 ? "Accumulation: fear, smart money buys" : "Panic or downtrend: everyone sells");
  function pxAt(j, t) { const R = C.rows; let lo = 0, hi = R.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (R[m][0] <= t) lo = m; else hi = m - 1; }
    const r = R[lo]; return Math.abs(r[0] - t) <= 2 * 36e5 && r[9] && r[9][j] > 0 ? r[9][j] : null; }
  function fwd(j, t, h) { if (t + h * 36e5 > Date.now()) return null; const a = pxAt(j, t), b = pxAt(j, t + h * 36e5); return a && b ? b / a - 1 : null; }
  function analyze(key, at) {
    if (!C || !C.rows || C.rows.length < 24) return null; stats(); const R = C.rows, j = Math.max(0, (C.keys || []).indexOf(key));
    const now = at != null ? R.reduce((b, r) => Math.abs(r[0] - at) < Math.abs(b[0] - at) ? r : b, R[0]) : R[R.length - 1], zn = F.map(f => zf(now, f));
    const cand = R.filter(r => r[0] < now[0] - 48 * 36e5).map(r => { let s = 0, k = 0; F.forEach((f, i) => { const a = zn[i], b = zf(r, f); if (a != null && b != null) { s += (a - b) ** 2; k++; } }); return k >= 4 ? { r, d: Math.sqrt(s / k) } : null; }).filter(Boolean).sort((a, b) => a.d - b.d);
    const pick = []; for (const c of cand) { if (pick.every(p => Math.abs(p.r[0] - c.r[0]) >= 24 * 36e5)) pick.push(c); if (pick.length >= 8) break; }
    const out = pick.map(c => ({ t: c.r[0], d: c.d, q: quad(pos(c.r)), h4: fwd(j, c.r[0], 4), h24: fwd(j, c.r[0], 24), h72: fwd(j, c.r[0], 72) }));
    const v24 = out.map(o => o.h24).filter(x => x != null).sort((a, b) => a - b), med = v24.length ? v24[v24.length >> 1] : null, up = v24.length ? v24.filter(x => x > 0).length / v24.length : null;
    return { key, j, now, p: pos(now), q: quad(pos(now)), rh: out, med24: med, up24: up, n24: v24.length, rows: R.length, from: R[0][0] };
  }
  function signals() {
    if (!C || !C.rows || C.rows.length < 24) return []; stats(); const out = [], last = C.rows[C.rows.length - 1], p = pos(last);
    (C.keys || []).forEach(k => { const s = k.split(":").pop();
      if (p.x != null) out.push(["crowd.greed", s, c1(p.x / 2), "Crowd · greed (+) vs fear (−), whole market"]);
      if (p.y != null) out.push(["crowd.smart", s, c1(p.y / 2), "Crowd · smart money vs the crowd"]);
      const A = analyze(k); if (A && A.n24 >= 4 && A.med24 != null) { const sc = /BTC|ETH|SOL|SOXL/.test(k) ? 0.03 : 0.012; out.push(["crowd.rhyme", s, c1(A.med24 / sc * Math.abs(A.up24 - 0.5) * 2), "Crowd · past moments that rhyme with now (what came next)"]); } });
    return out;
  }
  // the whole memory as history for the signal web (each row: crowd state + what each market did 1, 4 and 24 h later)
  function feedWeb() {
    if (!window.Web || !C || !C.rows || C.rows.length < 30) return 0; stats(); let n = 0;
    (C.keys || []).forEach((k, j) => { const s = k.split(":").pop(), items = [];
      C.rows.forEach(r => { if (r[0] > Date.now() - 25 * 36e5) return; const p = pos(r), x = {}; if (p.x != null) x["crowd.greed"] = c1(p.x / 2); if (p.y != null) x["crowd.smart"] = c1(p.y / 2);
        const fz = zf(r, "fund"), bz = zf(r, "breadth"); if (fz != null) x["crowd.funding"] = c1(fz / 2); if (bz != null) x["crowd.breadth"] = c1(bz / 2);
        const rh = {}; [1, 4, 24].forEach(h => { const v = fwd(j, r[0], h); if (v != null) rh[h] = v; }); if (Object.keys(x).length && Object.keys(rh).length) items.push({ t: r[0], a: s, x, rh, reg: 0 }); });
      try { n += Web.ingest("crowdmem:" + s, items, "Crowd memory · " + (NAME[k] || s)) || 0; } catch (e) { } });
    return n;
  }
  // ---------- picture ----------
  const pc = v => v == null ? "–" : (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
  function html(key, el, opts) {
    opts = opts || {}; if (!C || !C.rows || C.rows.length < 24) { el.innerHTML = `<div class="note">The crowd memory builds one row an hour (it needs a day to start; rhymes get better every week).</div>`; return; }
    const cv = getComputedStyle(document.documentElement), col = k => cv.getPropertyValue(k).trim(), up = col("--bull") || col("--up") || "#19d38a", dn = col("--bear") || col("--down") || "#ff4d5e", ink = col("--text") || col("--ink") || "#ddd", dim = col("--dim") || "#888", line = col("--line") || "#333", acc = col("--accent") || "#4da3ff";
    const at = el._at != null ? el._at : null, A = analyze(key, at); if (!A) return; const R = C.rows, j = A.j, W = 300, Hh = 300, S = 3.2;
    const X = v => W / 2 + c1(v / S) * (W / 2 - 16), Y = v => Hh / 2 - c1(v / S) * (Hh / 2 - 16);
    const dots = R.map(r => { const p = pos(r), f = fwd(j, r[0], 24); return p.x == null || p.y == null ? "" : `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.2" fill="${f == null ? dim : f > 0 ? up : dn}" fill-opacity="${f == null ? 0.15 : 0.35}"/>`; }).join("");
    const tail = R.filter(r => r[0] <= A.now[0] && r[0] > A.now[0] - 72 * 36e5).map(pos).filter(p => p.x != null && p.y != null);
    const path = tail.length > 1 ? `<path d="${tail.map((p, i) => (i ? "L" : "M") + X(p.x).toFixed(1) + "," + Y(p.y).toFixed(1)).join("")}" fill="none" stroke="${acc}" stroke-width="1.6" stroke-opacity=".75" stroke-linejoin="round"/>` : "";
    const rh = A.rh.map(o => { const r = R.find(x => x[0] === o.t), p = r && pos(r); return p && p.x != null ? `<circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4.5" fill="none" stroke="${o.h24 == null ? dim : o.h24 > 0 ? up : dn}" stroke-width="1.6"><title>${new Date(o.t).toLocaleString()}: next 24h ${pc(o.h24)}</title></circle>` : ""; }).join("");
    const P = A.p, cur = P.x != null && P.y != null ? `<circle cx="${X(P.x).toFixed(1)}" cy="${Y(P.y).toFixed(1)}" r="7" fill="${acc}" stroke="${ink}" stroke-width="1.5"/>` : "";
    const ql = (x, y, a, t) => `<text x="${x}" y="${y}" text-anchor="${a}" fill="${dim}" font-size="9.5" font-family="var(--sans,system-ui)">${t}</text>`;
    const svg = `<svg viewBox="0 0 ${W} ${Hh}" width="100%" style="max-width:${W + 40}px;display:block;border:1px solid ${line};border-radius:12px">
      <line x1="${W / 2}" y1="10" x2="${W / 2}" y2="${Hh - 10}" stroke="${line}"/><line x1="10" y1="${Hh / 2}" x2="${W - 10}" y2="${Hh / 2}" stroke="${line}"/>
      ${ql(W - 8, 16, "end", "bull, smart on board")}${ql(W - 8, Hh - 8, "end", "euphoria")}${ql(8, 16, "start", "accumulation")}${ql(8, Hh - 8, "start", "panic")}
      ${ql(W / 2 + 4, Hh / 2 - 4, "start", "greed →")}${ql(W / 2 - 4, Hh / 2 - 4, "end", "← fear")}${ql(W / 2 + 4, 26, "start", "smart money long ↑")}
      ${dots}${path}${rh}${cur}</svg>`;
    const pick = `<select data-rhk style="font:12px var(--mono);background:var(--panel2,transparent);color:${ink};border:1px solid ${line};border-radius:6px;padding:2px 4px">${(C.keys || []).map(k => `<option value="${k}"${k === key ? " selected" : ""}>${NAME[k] || k}</option>`).join("")}</select>`;
    const slider = `<input type="range" data-rht min="${R[0][0]}" max="${R[R.length - 1][0]}" step="3600000" value="${A.now[0]}" style="width:100%">`;
    const tb = A.rh.length ? `<table class="tr" style="width:100%;margin-top:6px"><thead><tr><th style="text-align:left">When it rhymed</th><th style="text-align:left">Crowd then</th><th>Likeness</th><th>4h</th><th>24h</th><th>72h</th></tr></thead><tbody>${A.rh.map(o => `<tr><td style="text-align:left">${new Date(o.t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric" })}</td><td style="text-align:left">${o.q}</td><td>${Math.max(0, Math.round((1 - o.d / 2) * 100))}%</td>${[o.h4, o.h24, o.h72].map(v => `<td class="${v > 0 ? "L" : v < 0 ? "S" : ""}">${pc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : `<div class="note">No rhymes yet: the memory needs more than 2 days.</div>`;
    el.innerHTML = `<div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start"><div style="flex:0 0 auto;width:min(100%,${W + 40}px)">${svg}<div style="font:11px var(--mono);color:${dim};margin-top:4px">${new Date(A.now[0]).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric" })}${at != null ? " (history)" : " (now)"} · drag to travel in time</div>${slider}</div>
      <div style="flex:1 1 320px;min-width:0"><div style="font:600 13px var(--sans,system-ui);color:${ink}">${A.q}</div>
      <div class="note" style="max-width:none;margin:2px 0 6px">Greed ${P.x == null ? "–" : (P.x >= 0 ? "+" : "") + P.x.toFixed(1) + "σ"} · smart vs crowd ${P.y == null ? "–" : (P.y >= 0 ? "+" : "") + P.y.toFixed(1) + "σ"} · market ${pick} · memory ${R.length.toLocaleString()} hours since ${new Date(A.from).toLocaleDateString()}</div>
      <div style="font:12px var(--mono);color:${ink}">The ${A.rh.length} closest rhymes: ${A.med24 != null ? `next 24h median <b class="${A.med24 > 0 ? "L" : "S"}">${pc(A.med24)}</b>, up ${Math.round(A.up24 * 100)}% of ${A.n24}` : "outcomes not known yet"}</div>${tb}
      <div class="note" style="max-width:none;margin-top:6px">Dots = every past hour, colored by what ${NAME[key] || key} did in the next 24 h (green up, red down). The blue line is the crowd's last 3 days; rings mark the rhymes. History does not repeat, but it rhymes: similar crowd states often lead to similar moves, never the same one, so this is one input the web weighs, not a call.</div></div></div>`;
    const sel = el.querySelector("[data-rhk]"), sl = el.querySelector("[data-rht]");
    if (sel) sel.onchange = () => { el._key = sel.value; html(sel.value, el, opts); if (opts.onKey) opts.onKey(sel.value); };
    const lbl = sl && sl.previousElementSibling;
    if (sl) { sl.oninput = () => { if (lbl) lbl.textContent = new Date(+sl.value).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric" }) + " · let go to see the crowd then"; };
      sl.onchange = () => { el._at = +sl.value >= R[R.length - 1][0] - 36e5 ? null : +sl.value; html(key, el, opts); }; }
  }
  window.Rhyme = { load, analyze, html, signals, feedWeb, data: () => C };
})();
