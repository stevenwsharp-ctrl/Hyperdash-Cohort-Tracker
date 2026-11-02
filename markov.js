/* Markov engine · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   From "The Strange Math That Predicts (Almost) Anything" (Veritasium, 2025): the law of large numbers, Markov chains,
   the Monte Carlo method, PageRank, and "how many shuffles until the deck forgets its order".
   1. States: each hourly bar becomes one of 5 states by its move in σ of the last 48 bars:
      ▼▼ big down (≤ −1σ) · ▼ down · ― flat (±0.25σ) · ▲ up · ▲▲ big up (≥ +1σ).
   2. Memory test (Markov vs Nekrasov): does the present state change the odds of the next 1 or 4 bars? Order 1 (this bar)
      and order 2 (the last two bars) are tested walk-forward: each prediction uses only the past, scored on the last 40%
      against the memoryless forecast (the plain base rate — the law of large numbers). The best test must reach z ≥ 2.5
      (4 tests are tried, so the bar is higher than 2). If none passes, the verdict is "memoryless" and there is no signal.
   3. Next-step odds now: P(up) after the current state(s), from all history (shrunk toward the base rate when the state is rare).
   4. Monte Carlo: 2,000 random 24-hour paths walked through the transition matrix (each step draws a real move from the
      state it lands in) vs 2,000 memoryless paths (each step draws a state from the long-run mix, then a real move from it). The difference is what memory adds.
   5. Mixing time: how many hours until the chain forgets the present state (the distance to the long-run mix < 5%) —
      the "7 riffle shuffles" of this market. Short = the present says little about later hours.
   6. PageRank of the signal web: trust flows from proven signals (high z) through the learned links, like Google ranks a page
      by who links to it. A signal linked to proven ones ranks high even before it has proven itself.
   Signals: mk.next (memory lean, only after the test passes), mk.mc (Monte Carlo with memory minus without).
   API: Markov.analyze(bars) → M (bars [[t,o,h,l,c,(v)]] oldest first) · Markov.signals(M) · Markov.html(M, title)
        Markov.pagerank(nodes, edges) → [{id,label,pr,z}] · Markov.rankHtml(list) */
(function () {
  "use strict";
  if (window.Markov) return;
  const c1 = v => Math.max(-1, Math.min(1, v)), ST = ["▼▼", "▼", "―", "▲", "▲▲"], SN = ["big down", "down", "flat", "up", "big up"];
  const stateOf = z => z <= -1 ? 0 : z < -0.25 ? 1 : z <= 0.25 ? 2 : z < 1 ? 3 : 4;
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function analyze(B) {
    if (!B || B.length < 400) return null;
    const r = []; for (let i = 1; i < B.length; i++) r.push(Math.log(B[i][4] / B[i - 1][4]));
    const S = new Array(r.length).fill(-1); let s1 = 0, s2 = 0; const W = 48;
    for (let i = 0; i < r.length; i++) { if (i >= W) { const sd = Math.sqrt(Math.max(1e-12, s2 / W - (s1 / W) ** 2)); S[i] = stateOf(r[i] / sd); } s1 += r[i]; s2 += r[i] * r[i]; if (i >= W) { s1 -= r[i - W]; s2 -= r[i - W] * r[i - W]; } }
    const n = r.length, start = W + 50, cut = Math.floor(start + (n - start) * 0.6), fut = (i, h) => { let s = 0; for (let k = 1; k <= h && i + k < n; k++) s += r[i + k]; return i + h < n ? s : null; };
    const ctx = (i, k) => k === 1 ? S[i] : S[i - 1] * 5 + S[i];
    // walk-forward memory test
    const tests = [];
    for (const k of [1, 2]) for (const h of [1, 4]) {
      const up = {}, cnt = {}; let bu = 0, bn = 0, ll = 0, ll0 = 0, calls = 0, hits = 0, ex = 0, vr = 0, m = 0;
      for (let i = start; i < n - h; i++) {
        const y = fut(i, h); if (y == null || S[i] < 0 || (k === 2 && S[i - 1] < 0)) continue; const c = ctx(i, k), base = bn ? (bu + 1) / (bn + 2) : 0.5;
        const p = ((up[c] || 0) + 5 * base) / ((cnt[c] || 0) + 5), Y = y > 0 ? 1 : 0;
        if (i >= cut) { m++; const cl = q => Math.min(0.99, Math.max(0.01, q)); ll -= Y ? Math.log(cl(p)) : Math.log(1 - cl(p)); ll0 -= Y ? Math.log(cl(base)) : Math.log(1 - cl(base));
          if (Math.abs(p - base) >= 0.03) { const side = p > base ? 1 : 0, q = side ? base : 1 - base; calls++; if (side === Y) hits++; ex += q; vr += q * (1 - q); } }
        // learn only after the outcome is known (h bars later): delayed update keeps the test honest
        const j = i - h; if (j >= start && S[j] >= 0 && (k === 1 || S[j - 1] >= 0)) { const yj = fut(j, h); if (yj != null) { const cj = ctx(j, k); cnt[cj] = (cnt[cj] || 0) + 1; if (yj > 0) up[cj] = (up[cj] || 0) + 1; bn++; if (yj > 0) bu++; } }
      }
      const z = vr ? (hits - ex) / Math.sqrt(vr) / Math.sqrt(h) : 0;   // overlapping 4-bar outcomes: z shrunk by √h
      tests.push({ k, h, m, skill: ll0 ? 1 - ll / ll0 : 0, calls, hit: calls ? hits / calls : null, z });
    }
    const best = tests.slice().sort((a, b) => b.z - a.z)[0], pass = best && best.z >= 2.5 && best.skill > 0;
    // full-history tables
    const T = Array.from({ length: 5 }, () => new Array(5).fill(0.5)), bucket = Array.from({ length: 5 }, () => []), recent = Math.max(start, n - 1500);
    for (let i = start; i < n - 1; i++) if (S[i] >= 0 && S[i + 1] >= 0) T[S[i]][S[i + 1]]++;
    for (let i = recent; i < n; i++) if (S[i] >= 0) bucket[S[i]].push(r[i]);
    const P = T.map(row => { const t = row.reduce((a, b) => a + b, 0); return row.map(v => v / t); });
    const cond = (k, h) => { let u = 0, c = 0, bu = 0, bc = 0; const now = ctx(n - 1, k); for (let i = start; i < n - h; i++) { const y = fut(i, h); if (y == null || S[i] < 0 || (k === 2 && S[i - 1] < 0)) continue; bc++; if (y > 0) bu++; if (ctx(i, k) === now) { c++; if (y > 0) u++; } } const base = bc ? bu / bc : 0.5; return { p: (u + 5 * base) / (c + 5), n: c, base }; };
    const now = { s: S[n - 1], s2: S[n - 2] }, nx = best ? cond(best.k, best.h) : null, row1 = cond(1, 1);
    // stationary mix and mixing time from the present state
    let pi = new Array(5).fill(0.2); for (let it = 0; it < 200; it++) pi = pi.map((_, j) => pi.reduce((s, v, i) => s + v * P[i][j], 0));
    let v = new Array(5).fill(0); v[now.s] = 1; let mix = 48; for (let t = 1; t <= 48; t++) { v = v.map((_, j) => v.reduce((s, q, i) => s + q * P[i][j], 0)); if (v.reduce((s, q, i) => s + Math.abs(q - pi[i]), 0) / 2 < 0.05) { mix = t; break; } }
    // Monte Carlo, 24 bars: with memory (Markov) vs without (draws at random)
    const all = [].concat(...bucket), R = rng(n * 7919 + Math.round(B[B.length - 1][4] * 1000)), N = 2000, H = 24;
    const sim = mem => { const out = []; for (let p = 0; p < N; p++) { let s = now.s, x = 0; for (let t = 0; t < H; t++) { if (mem) { let u = R(), j = 0; while (j < 4 && (u -= P[s][j]) > 0) j++; s = j; const b = bucket[s].length ? bucket[s] : all; x += b[Math.floor(R() * b.length)]; } else { let u = R(), j = 0; while (j < 4 && (u -= pi[j]) > 0) j++; const b = bucket[j].length ? bucket[j] : all; x += b[Math.floor(R() * b.length)]; } } out.push(Math.exp(x) - 1); } out.sort((a, b) => a - b); return out; };
    const sum = a => ({ up: a.filter(x => x > 0).length / a.length, q05: a[Math.floor(a.length * 0.05)], q50: a[Math.floor(a.length * 0.5)], q95: a[Math.floor(a.length * 0.95)], hi: a.filter(x => x >= 0.05).length / a.length, lo: a.filter(x => x <= -0.05).length / a.length });
    const mcM = all.length >= 100 ? sum(sim(true)) : null, mcI = all.length >= 100 ? sum(sim(false)) : null;
    const sig = {};
    if (pass && nx) sig.next = c1((nx.p - nx.base) * 6) * Math.min(1, best.z / 3);
    if (pass && mcM && mcI) sig.mc = c1((mcM.up - mcI.up) * 5);
    return { n, tests, best, pass, P, pi, now, nx, row1, mix, mcM, mcI, sig, verdict: pass ? `${best.k === 1 ? "1-step" : "2-step"} memory (next ${best.h === 1 ? "hour" : "4 hours"}, z ${best.z.toFixed(1)})` : "memoryless: the present state does not change the odds" };
  }
  function signals(M) {
    if (!M) return []; const I = [];
    if (M.sig.next) I.push(["mk.next", M.sig.next, `Markov · after ${ST[M.now.s2] || ""}${ST[M.now.s]} the next ${M.best.h === 1 ? "hour" : "4 h"} goes up ${Math.round(M.nx.p * 100)}% (base ${Math.round(M.nx.base * 100)}%)`]);
    if (M.sig.mc) I.push(["mk.mc", M.sig.mc, "Monte Carlo · 24 h paths with memory vs without"]);
    return I;
  }
  const pc = v => v == null ? "–" : (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
  function html(M, title) {
    if (!M) return `<div class="note">The Markov engine needs about 400 hourly bars.</div>`;
    const t = M.tests.map(x => `<tr><td style="text-align:left">order ${x.k} (${x.k === 1 ? "this bar" : "last 2 bars"}) → next ${x.h === 1 ? "1 h" : "4 h"}</td><td>${x.calls}</td><td>${x.hit != null ? Math.round(x.hit * 100) + "%" : "–"}</td><td class="${x.z >= 2.5 ? "L" : ""}">${x.z.toFixed(1)}</td><td>${(x.skill * 100).toFixed(2)}%</td></tr>`).join("");
    const mat = `<table class="tr" style="width:auto"><thead><tr><th style="text-align:left">from \\ to</th>${ST.map(s => `<th>${s}</th>`).join("")}</tr></thead><tbody>${M.P.map((row, i) => `<tr${i === M.now.s ? ' style="background:var(--hover,rgba(127,127,127,.1))"' : ""}><td style="text-align:left">${ST[i]} ${SN[i]}</td>${row.map((p, j) => `<td style="${p >= M.pi[j] + 0.05 ? "font-weight:700" : p <= M.pi[j] - 0.05 ? "opacity:.55" : ""}">${Math.round(p * 100)}%</td>`).join("")}</tr>`).join("")}<tr><td style="text-align:left;color:var(--dim)">long-run mix</td>${M.pi.map(p => `<td style="color:var(--dim)">${Math.round(p * 100)}%</td>`).join("")}</tr></tbody></table>`;
    const mc = M.mcM ? `<table class="tr" style="width:auto"><thead><tr><th style="text-align:left">Next 24 h, 2,000 paths</th><th>P(up)</th><th>median</th><th>5% … 95%</th><th>≥ +5%</th><th>≤ −5%</th></tr></thead><tbody>${[["with memory (Markov)", M.mcM], ["memoryless (long-run mix)", M.mcI]].map(([l, s]) => `<tr><td style="text-align:left">${l}</td><td>${Math.round(s.up * 100)}%</td><td>${pc(s.q50)}</td><td>${pc(s.q05)} … ${pc(s.q95)}</td><td>${Math.round(s.hi * 100)}%</td><td>${Math.round(s.lo * 100)}%</td></tr>`).join("")}</tbody></table>` : "";
    return `<div class="note" style="max-width:none">${title ? `<b>${title}</b> · ` : ""}Now: <b>${ST[M.now.s2] || ""} ${ST[M.now.s]}</b> · verdict: <b class="${M.pass ? "L" : ""}">${M.verdict}</b> · the chain forgets the present state after about <b>${M.mix} h</b> (the market's "7 shuffles")${M.nx && M.pass ? ` · next ${M.best.h === 1 ? "hour" : "4 h"} up <b>${Math.round(M.nx.p * 100)}%</b> vs ${Math.round(M.nx.base * 100)}% normally (seen ${M.nx.n}×)` : ""}</div>
      <div style="display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;margin-top:4px"><div>${mat}<div class="note">Transition odds per hour (bold = more often than the long-run mix, faint = less).</div></div>
      <div>${mc}<table class="tr" style="width:auto;margin-top:6px"><thead><tr><th style="text-align:left">Memory test (walk-forward, last 40%)</th><th>calls</th><th>hit</th><th>z</th><th>skill</th></tr></thead><tbody>${t}</tbody></table>
      <div class="note">z ≥ 2.5 passes (4 tests tried). Skill = less surprise than the base rate (log loss). Most liquid markets are close to memoryless: when the test fails, the web gets no Markov signal.</div></div></div>`;
  }
  // PageRank with trust: teleport toward proven signals, walk along learned links weighted by how strongly they agree
  function pagerank(N, E) {
    const ids = Object.keys(N).filter(k => N[k].n >= 20); if (ids.length < 3) return []; const ix = Object.fromEntries(ids.map((k, i) => [k, i])), m = ids.length;
    const out = Array.from({ length: m }, () => []);
    E.forEach(e => { if (ix[e.a] == null || ix[e.b] == null || e.n < 20) return; const w = Math.abs(e.agreeR - 0.5) * 2 + Math.min(1, Math.abs(e.w || 0) * 3) + (e.learned ? 0.5 : 0); if (w <= 0.05) return; out[ix[e.a]].push([ix[e.b], w]); out[ix[e.b]].push([ix[e.a], w]); });
    const tp = ids.map(k => 0.05 + Math.max(0, N[k].z || 0)), ts = tp.reduce((a, b) => a + b, 0), tel = tp.map(v => v / ts);
    let pr = tel.slice(); const d = 0.85;
    for (let it = 0; it < 40; it++) { const nx = tel.map(v => (1 - d) * v); let dang = 0;
      out.forEach((L, i) => { const tw = L.reduce((s, x) => s + x[1], 0); if (!tw) { dang += pr[i]; return; } L.forEach(([j, w]) => nx[j] += d * pr[i] * w / tw); });
      for (let j = 0; j < m; j++) nx[j] += d * dang * tel[j]; pr = nx; }
    return ids.map((k, i) => ({ id: k, label: N[k].label || k, pr: pr[i] * m, z: N[k].z || 0, links: out[i].length })).sort((a, b) => b.pr - a.pr);
  }
  function rankHtml(L, n) {
    if (!L || !L.length) return `<div class="note">PageRank needs signals with 20+ lessons and some links. It fills in as the web learns.</div>`;
    return `<table class="tr"><thead><tr><th>#</th><th style="text-align:left">Signal</th><th title="1.0 = average">PageRank</th><th>own z</th><th>links</th></tr></thead><tbody>${L.slice(0, n || 12).map((x, i) => `<tr><td>${i + 1}</td><td style="text-align:left">${x.label}</td><td>${x.pr.toFixed(2)}</td><td class="${x.z >= 3 ? "L" : x.z <= -2 ? "S" : ""}">${x.z.toFixed(1)}</td><td>${x.links}</td></tr>`).join("")}</tbody></table>
      <div class="note" style="max-width:none">Like Google's PageRank: a signal ranks high when proven signals link to it. A high rank with a low own z = a candidate worth watching; the lab tests it.</div>`;
  }
  window.Markov = { analyze, signals, html, pagerank, rankHtml, states: ST };
})();
