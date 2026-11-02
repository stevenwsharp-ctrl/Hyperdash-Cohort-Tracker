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
  let LAB = lsG("lab_cache_v1", null), lT = 0;
  async function load() { if (LAB && Date.now() - lT < 30 * 6e4 && Date.now() - Date.parse(LAB.t) < 30 * 36e5) return LAB; lT = Date.now();
    try { const r = await fetch(RAW + "?t=" + Math.floor(Date.now() / 18e5)); if (r.ok) { LAB = await r.json(); try { const small = { ...LAB, prof: Object.fromEntries(Object.entries(LAB.prof).map(([k, p]) => [k, { s: p.s, px: p.px, setups: p.setups, ind: p.ind, cls: p.cls, stage: p.stage, athD: p.athD, relZ: p.relZ, grp: p.grp, ageHL: p.ageHL, yr: p.yr, cap: p.cap, r30: p.r30, grpR30: p.grpR30, beta: p.beta }])) }; lsS("lab_cache_v1", small); } catch (e) { } } } catch (e) { }
    return LAB; }
  load(); setInterval(load, 30 * 6e4);
  // which lab market stands for an underlying, and its leverage to that underlying
  const BASE = { SOXX: ["XYZ:SOXL", 3], SOX: ["XYZ:SOXL", 3], SMH: ["XYZ:SOXL", 3], QQQ: ["XYZ:XYZ100", 1], NDX: ["XYZ:XYZ100", 1], SPY: ["XYZ:SP500", 1], "BTC.X": ["BTC", 1], "ETH.X": ["ETH", 1], "SOL.X": ["SOL", 1], "XRP.X": ["XRP", 1], GLD: ["XYZ:GOLD", 1], SLV: ["XYZ:SILVER", 1], USO: ["XYZ:CL", 1] };
  function baseOf(u) { if (!LAB || !u) return null; const b = BASE[u]; if (b && LAB.prof[b[0]]) return { k: b[0], Lb: b[1] }; for (const v of ["XYZ:", "", "IO:", "CASH:", "FLX:", "KM:", "VNTL:"]) if (LAB.prof[v + u]) return { k: v + u, Lb: 1 }; return null; }
  const HZ = [[1, "24 h"], [2, "48 h"], [7, "7 days"]];
  // the lab's setups converted to an instrument with leverage L on underlying u, priced at px
  function setups(u, L, px) { const b = baseOf(u); if (!b) return null; const P = LAB.prof[b.k], k = (L || 1) / b.Lb, map = p => p == null || !px ? null : px * (1 + k * (p / P.px - 1)), out = {};
    for (const [h] of HZ) { const S = P.setups && P.setups[h]; out[h] = !S || !S.side ? { side: 0 } : { side: S.side * Math.sign(k), lean: S.lean, lim: map(S.lim), tgt: map(S.tgt), wrong: map(S.wrong), why: S.why }; }
    return { base: b.k, P, out, asOf: LAB.asOf }; }
  const WHY = { "stage": "trend stage", "rs-peer": "leads its peers", "laggard": "peer catch-up", "group-mom": "industry rotation", "new-listing": "young listing", "ath": "life cycle / highs", "pump-fade": "fade the extreme", "beta-tide": "beta to the tide", "vol-squeeze": "coiled spring", "young-small": "young and small" };
  function html(u, o) {
    o = o || {}; const S = setups(u, o.L, o.px), fx = o.fx || (v => v == null ? "–" : v >= 1000 ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : v >= 10 ? v.toFixed(2) : v.toPrecision(4)), nm = o.s || u;
    if (!S) return `<div class="note">No shared setup for ${nm} yet (the daily bet lab covers liquid Hyperliquid markets; ${u} has no market there, or the lab has not run).</div>`;
    const sd = v => v > 0 ? `<b class="L">LONG</b>` : v < 0 ? `<b class="S">SHORT</b>` : `<span style="color:var(--dim,#888)">no setup</span>`;
    return `<table class="tr"><thead><tr><th style="text-align:left">${nm}</th><th>Setup</th><th title="Entry is a limit order: the bet starts only when price touches it">Limit entry</th><th title="Limit exit">Target</th><th title="Exit at market if price gets here first">Wrong if</th><th style="text-align:left">Why (hypotheses that held up in the lab)</th></tr></thead><tbody>${HZ.map(([h, l]) => { const x = S.out[h]; return `<tr><td style="text-align:left">${l}</td><td>${sd(x.side)}${x.lean ? ` <span style="color:var(--dim,#888)">${Math.abs(x.lean).toFixed(2)}</span>` : ""}</td><td>${x.side ? fx(x.lim) : "–"}</td><td class="${x.side > 0 ? "L" : "S"}">${x.side ? fx(x.tgt) : "–"}</td><td>${x.side ? fx(x.wrong) : "–"}</td><td style="text-align:left">${x.side ? (x.why || []).map(w => WHY[w] || w).join(", ") : ""}</td></tr>`; }).join("")}</tbody></table>
      <div class="note" style="max-width:none">Same numbers on all three sites: from the daily bet lab (as of ${S.asOf}) on ${S.base.split(":").pop()}${S.base.split(":").pop() !== u ? `, converted to ${nm} through its leverage (${o.L > 0 ? "+" : ""}${o.L || 1}×${S.base === "XYZ:SOXL" ? " vs SOXX; the SOXL perp is 3×" : ""})` : ""}.${S.P.stage ? ` Life cycle: stage ${S.P.stage}${S.P.athD != null ? `, ${(S.P.athD * 100).toFixed(0)}% from its all-time high` : ""}${S.P.relZ != null ? `, ${S.P.relZ > 0 ? "ahead of" : "behind"} its ${S.P.grp || "peers"} by ${Math.abs(S.P.relZ).toFixed(1)}σ (30 days)` : ""}.` : ""}</div>`;
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
  window.Agree = { load, setups, html, publish, reads, table, lab: () => LAB, baseOf };
})();
