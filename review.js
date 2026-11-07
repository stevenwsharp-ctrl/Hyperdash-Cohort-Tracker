/* Cohort Sniper · weekly review. Grades every setup of the last 7 days (history.json, 5-minute snapshots) against what
   price did for the smart side 24 hours later, and lets the rating use what held up.
   Sample: one setup per market per UTC day (the first snapshot that day with smart and fools on opposite sides and a raw
   gap of 60+ points, about score 30+), so one market cannot fill the sample.
   Conditions (each is tested against all other setups of the same week):
     chase   price already moved 2%+ WITH the smart side in the 24h before the setup (late entry)
     pull    price moved 2%+ AGAINST the smart side in the 24h before (pull-back entry)
     wide    single stock with a raw gap of 120+ (score 60+): a very lopsided stock perp (Alibaba, Nov 2026)
   A condition changes the rating only when it is steady: 30+ setups with it, and the same sign of effect on at least
   two thirds of the days that have 5+ such setups (and 3 days or more). Size: 1 + 0.6 × hit-rate difference, held inside
   0.75–1.20. The chase / pull factor replaces "Momentum (24h) · backtested" when both point the same way, because it is
   the newer data; if they disagree, the weekly factor is not used.
   Use: Review.get() → the report; Review.factors(r) → factors for one row (r.dir, r.cls, r.score, r.ctx.ch). */
(function () {
  "use strict";
  if (window.Review) return;
  const DAY = 864e5, MIN_GAP = 60, WIDE_GAP = 120, MOVE = 2;
  let CACHE = null, CKEY = "";
  const clampN = (x, a, b) => Math.max(a, Math.min(b, x));
  const isStock = coin => { try { return typeof parse === "function" ? parse(coin).cls === "Stock" : coin.indexOf(":") > 0; } catch (e) { return false; } };

  function build(H) {
    if (!H || !H.snapshots || H.snapshots.length < 50) return null;
    const F = H.fields || [], iS = F.indexOf("smartBias"), iF = F.indexOf("foolBias"), iP = F.indexOf("price");
    if (iS < 0 || iF < 0 || iP < 0) return null;
    const S = H.snapshots, T = S.map(s => Date.parse(s.t));
    // nearest snapshot to a time (within 2 h)
    const near = t => { let lo = 0, hi = T.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] < t) lo = m + 1; else hi = m; }
      let b = lo; if (lo > 0 && Math.abs(T[lo - 1] - t) < Math.abs(T[lo] - t)) b = lo - 1; return Math.abs(T[b] - t) <= 2 * 36e5 ? b : -1; };
    const seen = new Set(), rows = [];
    for (let i = 0; i < S.length; i++) {
      const j = near(T[i] + DAY), k = near(T[i] - DAY); if (j < 0 || k < 0 || j <= i || k >= i) continue;
      const day = S[i].t.slice(0, 10), D = S[i].d;
      for (const coin in D) {
        const key = coin + "|" + day; if (seen.has(key)) continue;
        const v = D[coin], sb = v[iS], fb = v[iF], px = v[iP]; if (!(px > 0) || sb * fb >= 0 || Math.abs(sb - fb) < MIN_GAP) continue;
        const w = S[j].d[coin], b = S[k].d[coin]; if (!w || !b || !(w[iP] > 0) || !(b[iP] > 0)) continue;
        seen.add(key);
        const dir = sb > 0 ? 1 : -1;
        rows.push({ coin, day, dir, gap: Math.abs(sb - fb), r: dir * (w[iP] / px - 1) * 100, tr: dir * (px / b[iP] - 1) * 100, stock: isStock(coin) });
      }
    }
    if (rows.length < 100) return null;
    const days = [...new Set(rows.map(x => x.day))].sort();
    const st = a => { const n = a.length; if (!n) return { n: 0, hit: null, avg: null }; let h = 0, s = 0; a.forEach(x => { if (x.r > 0) h++; s += x.r; }); return { n, hit: h / n, avg: s / n }; };
    const COND = {
      chase: { label: `Price already moved ${MOVE}%+ with the smart side in the 24h before`, f: x => x.tr >= MOVE },
      pull:  { label: `Price moved ${MOVE}%+ against the smart side in the 24h before (pull-back)`, f: x => x.tr <= -MOVE },
      wide:  { label: `Single stock with a very wide gap (raw ${WIDE_GAP}+, score 60+)`, f: x => x.stock && x.gap >= WIDE_GAP }
    };
    const out = { at: S[S.length - 1].t, from: days[0], to: days[days.length - 1], days: days.length, all: st(rows), stocks: st(rows.filter(x => x.stock)), crypto: st(rows.filter(x => !x.stock)), cond: {} };
    for (const id in COND) {
      const c = COND[id], Y = rows.filter(c.f), N = rows.filter(x => !c.f(x)), y = st(Y), nn = st(N);
      let tested = 0, same = 0; const per = [];
      const diff = y.n && nn.n ? y.hit - nn.hit : 0;
      for (const d of days) { const a = Y.filter(x => x.day === d), b = N.filter(x => x.day === d); if (a.length < 5 || b.length < 5) { per.push(null); continue; }
        const e = st(a).hit - st(b).hit; per.push(Math.round(e * 100)); tested++; if (Math.sign(e) === Math.sign(diff)) same++; }
      const steady = y.n >= 30 && tested >= 3 && same >= Math.ceil(tested * 2 / 3) && Math.abs(diff) >= 0.05;
      out.cond[id] = { id, label: c.label, yes: y, no: nn, diff, perDay: per, tested, same, steady, mult: steady ? +clampN(1 + 0.6 * diff, 0.75, 1.2).toFixed(3) : 1 };
    }
    return out;
  }
  function get() {
    const H = window.HIST || (typeof HIST !== "undefined" ? HIST : null); if (!H || !H.snapshots || !H.snapshots.length) return null;
    const k = H.snapshots.length + "|" + H.snapshots[H.snapshots.length - 1].t; if (k !== CKEY) { CKEY = k; try { CACHE = build(H); } catch (e) { CACHE = null; } }
    return CACHE;
  }
  const pc = x => x == null ? "–" : Math.round(x * 100) + "%";
  const sg = x => x == null ? "–" : (x >= 0 ? "+" : "") + x.toFixed(2) + "%";
  // factors for one setup row; f = the list from contextFactors (the backtested momentum factor is removed if replaced)
  function factors(r, f) {
    const R = get(); if (!R || !r) return f;
    const ch = r.ctx && r.ctx.ch != null ? r.dir * r.ctx.ch : null;
    const btMom = f.findIndex(x => /^Momentum \(24h\)/.test(x.name)), bt = btMom >= 0 ? f[btMom] : null;
    const use = (C, why) => { if (!C || !C.steady) return;
      if (bt && Math.sign(bt.mult - 1) !== Math.sign(C.mult - 1)) return;   // older backtest disagrees: keep it, skip ours
      if (bt) { f.splice(f.indexOf(bt), 1); }
      f.push({ name: "Weekly review · " + (C.id === "chase" ? "late entry" : "pull-back"), mult: C.mult, why: `${why} In the last ${R.days} days, setups like this won ${pc(C.yes.hit)} of ${C.yes.n} (24h avg ${sg(C.yes.avg)} for the smart side) vs ${pc(C.no.hit)} for the rest. Same sign on ${C.same} of ${C.tested} days.` }); };
    if (ch != null && ch >= MOVE) use(R.cond.chase, `Price already moved ${ch.toFixed(1)}% with the smart side in 24h: much of the move may be done. Wait for a pull-back to place the limit entry.`);
    else if (ch != null && ch <= -MOVE) use(R.cond.pull, `Price moved ${Math.abs(ch).toFixed(1)}% against the smart side in 24h: a better entry for the smart side.`);
    const W = R.cond.wide;
    if (W && W.steady && r.cls === "Stock" && r.score >= WIDE_GAP / 2)
      f.push({ name: "Weekly review · very wide stock gap", mult: W.mult, why: `A single stock where the cohorts are this far apart (score ${r.score}). In the last ${R.days} days these won ${pc(W.yes.hit)} of ${W.yes.n} (24h avg ${sg(W.yes.avg)}) vs ${pc(W.no.hit)} for the rest: the fools were often right (Alibaba ran +11% against a smart short, Nov 2026).` });
    return f;
  }
  // the card at the top of the Setups view
  function card() {
    const R = get(); if (!R) return "";
    const row = C => { const on = C.steady, m = C.mult, cls = !on ? "" : m >= 1 ? "L" : "S";
      return `<tr><td style="text-align:left">${C.label}</td><td>${C.yes.n}</td><td><b>${pc(C.yes.hit)}</b></td><td>${sg(C.yes.avg)}</td><td>${pc(C.no.hit)}</td><td>${C.perDay.map(x => x == null ? "·" : (x > 0 ? "+" : "") + x).join(" ")}</td><td class="${cls}"><b>${on ? (m >= 1 ? "+" : "−") + Math.abs(Math.round((m - 1) * 100)) + "%" : "not used"}</b></td></tr>`; };
    return `<details class="card" id="reviewCard" style="margin:0 0 10px;padding:8px 12px" ${localStorage.getItem("cs_review_open") === "0" ? "" : "open"}>
      <summary style="cursor:pointer;font-weight:700">Weekly review ${R.from.slice(5)} – ${R.to.slice(5)}: setups won <b>${pc(R.all.hit)}</b> of ${R.all.n} at 24h (crypto ${pc(R.crypto.hit)}, stocks ${pc(R.stocks.hit)})</summary>
      <div class="tw" style="overflow:auto;margin-top:6px"><table class="tbl" style="width:100%;font-size:12px"><thead><tr><th style="text-align:left">Condition</th><th>Setups</th><th>Won 24h</th><th>Avg 24h</th><th>Rest won</th><th>Effect by day (pts)</th><th>Rating</th></tr></thead>
      <tbody>${["chase", "pull", "wide"].map(k => row(R.cond[k])).join("")}</tbody></table></div>
      <div class="note" style="max-width:none;margin-top:4px">One setup per market per day, graded on the smart side 24h later. A condition changes the rating only when it is steady (same sign on 2 of 3 days). This week's lesson: do not chase. Place the limit entry on a pull-back against the smart side. A single stock with a very wide gap is a warning, not a top pick.</div></details>`;
  }
  window.Review = { get, factors, card, build };
  document.addEventListener("toggle", e => { if (e.target && e.target.id === "reviewCard") try { localStorage.setItem("cs_review_open", e.target.open ? "1" : "0"); } catch (x) { } }, true);
})();
