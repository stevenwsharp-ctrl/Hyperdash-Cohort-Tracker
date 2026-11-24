/* Human Factor · a spider-web intelligence factor (same file on SOXX Sniper, LETF Sniper and Cohort Sniper; they share this
   browser's storage). Job: show where the crowd's money goes, every day, on three time frames.

   The card (top of the main page on each site) has three parts:
   1. The Bullseye: a dart board with 20 places money can go (11 sectors, 5 themes, 4 havens/alternatives). Each wedge has
      three rings: inner = TODAY (low time frame), middle = THIS WEEK (5 days, medium), outer = 1–3 MONTHS (high). Green = money
      in, red = money out, brighter = stronger. The bull (center) names today's #1 destination; the darts mark today's top 3.
   2. Sector Pulse: the 20 places in a table, sorted by today, week, 1–3 months or the blend, with a plain trend label
      (Pouring in, Fresh money, Buying the dip, Profit-taking, Draining out …), the crowd's volume today vs normal, and the
      leveraged ETFs (bull / bear) that ride each one.
   3. What money is doing: the crowd's mood (Panic … Euphoria, from risk-on vs risk-off flow, breadth and the VIX), what the
      crowd does now (chasing, fleeing, hiding, herding, rotating, bottom fishing, taking profits), where money comes FROM and
      goes TO, and what that means for this site (semis for SOXL, the leveraged funds that ride the flow, crypto for Cohort).

   Flow score of one place on one time frame (−100 … +100):
     relative move = its return − SPY's return over the window, in units of its own daily volatility × √days
     money flow    = Chaikin money flow over the window (where each bar closed in its range, weighted by volume)
     crowd size    = its dollar volume in the window vs its normal (60 bars before); a loud crowd makes the score bigger
     score = (0.6 × tanh(relative move / 1.2) + 0.4 × money flow × 2.5) × (1 + 0.5 × (crowd size − 1)), clipped to ±1.
   Today uses 5-minute bars of the current (or last) session, with pre-market and after-hours; volume pace is scaled by the
   part of the session that has passed. Week = 5 daily bars. 1–3 months = 0.6 × 21 days + 0.4 × 63 days.
   Data: Yahoo through the Worker (daily bars every 30 min, 5-minute bars every 2 min; slower when the tab is hidden).

   Honest check ("Does following the flow pay?"): for each of the last ~120 days, the week's top 3 vs bottom 3 places, and
   how they did the next day and the next 5 days (relative to each other). Shown on the card; it is not advice.

   Into the spider web: hf.low, hf.med, hf.high are emitted on each place's ETF, on its leveraged funds (bear funds with the
   sign flipped) and on big stocks of that sector; hf.mood is emitted on the main risk assets (SOXL, TQQQ, SPXL, BTC … +;
   SOXS, SQQQ, SPXS … −). The web learns their weights. The EV governor can cut or mute each one (EVR.factor).
   API: HF.compute(daily, intraday) (pure, for tests) · HF.state() · HF.refresh() */
(function () {
  "use strict";
  if (window.HF) return;
  const WORKER0 = "https://soxx-sniper-fred.sharpventures.workers.dev", KEY = "hf_v1";
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const proxy = () => { try { return (localStorage.getItem("soxx_fred_proxy") || "").trim().replace(/\/+$/, "") || WORKER0; } catch (e) { return WORKER0; } };
  const cl = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v)), c1 = v => cl(isFinite(v) ? v : 0);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- the 20 places (clockwise from the top: risk-on on the right, defensives and havens on the left) ----------
  // g: sector | theme | haven · risk: +1 cyclical / risk-on, −1 defensive / haven, 0 neither · bull/bear: leveraged ETFs
  // m: big stocks (and coins) that move with it, so the spider web gets the flow on them too
  const P = [
    { t: "SMH", n: "Semis", g: "theme", risk: 1, bull: ["SOXL", "USD"], bear: ["SOXS"], m: "NVDA AMD AVGO TSM MU INTC QCOM TXN AMAT LRCX KLAC ADI MRVL NXPI MCHP ON ASML ARM MPWR TER SOXX" },
    { t: "XLK", n: "Tech", g: "sector", risk: 1, bull: ["TECL", "ROM"], bear: ["TECS"], m: "AAPL MSFT ORCL CSCO IBM ACN" },
    { t: "IGV", n: "Software", g: "theme", risk: 1, bull: [], bear: [], m: "CRM ADBE NOW PLTR SNOW PANW CRWD INTU" },
    { t: "XLC", n: "Comms", g: "sector", risk: 1, bull: ["LTL"], bear: [], m: "META GOOGL GOOG NFLX DIS TMUS" },
    { t: "XLY", n: "Discretionary", g: "sector", risk: 1, bull: ["WANT"], bear: [], m: "AMZN TSLA HD MCD NKE SBUX BKNG" },
    { t: "ARKK", n: "Speculative growth", g: "theme", risk: 1, bull: [], bear: [], m: "RKLB HOOD SHOP ROKU" },
    { t: "BTC-USD", a: "BTC", n: "Bitcoin / crypto", g: "haven", risk: 1, bull: ["BITX", "BITU", "MSTU", "MSTX", "ETHU"], bear: ["SBIT", "MSTZ"], m: "BTC ETH SOL HYPE XRP DOGE COIN MSTR IBIT" },
    { t: "IWM", n: "Small caps", g: "theme", risk: 1, bull: ["TNA", "UWM"], bear: ["TZA", "TWM"], m: "" },
    { t: "XLF", n: "Financials", g: "sector", risk: 1, bull: ["FAS", "UYG"], bear: ["FAZ"], m: "JPM BAC GS MS WFC C SCHW V MA" },
    { t: "XLI", n: "Industrials", g: "sector", risk: 1, bull: ["DUSL"], bear: [], m: "CAT GE HON BA UNP DE RTX" },
    { t: "XLB", n: "Materials", g: "sector", risk: 1, bull: ["UYM"], bear: [], m: "LIN FCX NEM DOW" },
    { t: "XLE", n: "Energy", g: "sector", risk: 0, bull: ["ERX", "GUSH"], bear: ["ERY", "DRIP"], m: "XOM CVX COP OXY SLB" },
    { t: "XLRE", n: "Real estate", g: "sector", risk: 0, bull: ["DRN"], bear: ["DRV"], m: "PLD AMT EQIX O" },
    { t: "IBB", n: "Biotech", g: "theme", risk: 0, bull: ["LABU"], bear: ["LABD"], m: "AMGN GILD VRTX REGN MRNA" },
    { t: "XLV", n: "Health care", g: "sector", risk: -1, bull: ["CURE", "RXL"], bear: [], m: "LLY UNH JNJ ABBV MRK PFE" },
    { t: "XLP", n: "Staples", g: "sector", risk: -1, bull: ["UGE"], bear: [], m: "PG KO PEP COST WMT" },
    { t: "XLU", n: "Utilities", g: "sector", risk: -1, bull: ["UTSL", "UPW"], bear: [], m: "NEE DUK SO" },
    { t: "TLT", n: "Long bonds", g: "haven", risk: -1, bull: ["TMF", "UBT"], bear: ["TMV", "TBT"], m: "" },
    { t: "GLD", n: "Gold", g: "haven", risk: -1, bull: ["UGL", "NUGT", "JNUG"], bear: ["GLL", "DUST", "JDST"], m: "GDX GDXJ" },
    { t: "UUP", n: "US dollar", g: "haven", risk: -1, bull: [], bear: [], m: "" },
  ];
  P.forEach(p => { p.a = p.a || p.t; p.m = p.m ? p.m.split(" ") : []; });
  const BENCH = "SPY", VIX = "^VIX";
  // hf.mood goes to these assets (+1 rises with a greedy crowd, −1 with a fearful one)
  const RISK = { SPY: 1, QQQ: 1, SOXL: 1, SOXX: 1, TQQQ: 1, SPXL: 1, UPRO: 1, TNA: 1, BTC: 1, ETH: 1, SOL: 1, HYPE: 1, SOXS: -1, SQQQ: -1, SPXS: -1, SPXU: -1, TZA: -1, UVXY: -1 };

  // ---------- pure math ----------
  function idxAt(B, t) { let lo = 0, hi = B.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (B[m][0] <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; }
  const clean = B => (B || []).filter(b => b && b[4] > 0 && b[2] >= b[3] && isFinite(b[4])).map(b => [b[0], +b[1] || b[4], +b[2], +b[3], +b[4], +b[5] || 0]);
  function sigma(B, j, n = 60) { const r = []; for (let k = Math.max(1, j - n + 1); k <= j; k++) { const x = Math.log(B[k][4] / B[k - 1][4]); if (isFinite(x)) r.push(x); }
    if (r.length < 5) return 0.015; const m = r.reduce((s, x) => s + x, 0) / r.length; return Math.max(0.002, Math.sqrt(r.reduce((s, x) => s + (x - m) * (x - m), 0) / (r.length - 1))); }
  function cmfOf(B, a, b) { let mv = 0, vv = 0, dv = 0; for (let k = a; k <= b; k++) { const [, , h, l, c, v] = B[k], r = h - l; mv += (r > 0 ? ((c - l) - (h - c)) / r : 0) * v; vv += v; dv += c * v; } return { cmf: vv > 0 ? mv / vv : 0, dv, vv }; }
  function score(z, cmf, rvol) { const base = 0.6 * Math.tanh(z / 1.2) + 0.4 * cl(cmf * 2.5), amp = 1 + 0.5 * cl(rvol - 1, -0.5, 1); return c1(base * amp); }
  // one window on daily bars: B = this place, S = SPY, iS = SPY bar the window ends on, n = days
  function win(B, S, iS, n) {
    if (!B || !S || iS - n < 0 || iS >= S.length) return null;
    const tE = S[iS][0] + 12 * 36e5, tS = S[iS - n][0] + 12 * 36e5, je = idxAt(B, tE), js = idxAt(B, tS);
    if (je < 1 || js < 0 || je <= js) return null;
    const ret = B[je][4] / B[js][4] - 1, sret = S[iS][4] / S[iS - n][4] - 1, rel = ret - sret, nb = je - js;
    const F = cmfOf(B, js + 1, je); let bd = 0, bn = 0; for (let k = Math.max(0, js - 59); k <= js; k++) { bd += B[k][4] * B[k][5]; bn++; }
    const rvol = F.vv > 0 && bd > 0 ? (F.dv / nb) / (bd / bn) : 1, sg = sigma(B, je), z = rel / (sg * Math.sqrt(Math.max(1, n)));
    return { s: score(z, F.cmf, rvol), ret, rel, cmf: F.cmf, rvol, z };
  }
  // today: 5-minute bars of the session (I), prevClose from the chart meta; SPY the same
  // base of the "today" move (Nov 24 2026 fix): the last daily close from a day BEFORE the 5-minute bars' day. In pre-market,
  // Yahoo's chart meta can still hold the close before the last session, so a down pre-market showed as a big gain.
  const ETD = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }), dOf = ms => ETD.format(new Date(ms));
  // crypto (BTC-USD …) trades 24/7: Yahoo's daily bars start at 00:00 UTC (7 pm ET the day before) and the last one is live,
  // so the date rule above would use the live price as the base. Crypto keeps Yahoo's previous close (the 00:00 UTC day).
  function baseOf(I, B, m, c24) { if (c24) return m && m.prevClose > 0 ? m.prevClose : B && B.length > 1 ? B[B.length - 2][4] : NaN;
    const d = dOf(I[I.length - 1][0]); if (B) for (let k = B.length - 1; k >= 0; k--) if (dOf(B[k][0]) < d) return B[k][4]; return m && m.prevClose; }
  function today(I, Im, SI, SIm, B, now, S, c24) {
    if (!I || I.length < 1 || !Im || !SI || SI.length < 3 || !SIm) return null;   // a place with 1-2 pre-market trades still counts (Nov 24 2026)
    const b0 = baseOf(I, B, Im, c24), sb0 = baseOf(SI, S, SIm); if (!(b0 > 0) || !(sb0 > 0)) return null;
    const ret = I[I.length - 1][4] / b0 - 1, sret = SI[SI.length - 1][4] / sb0 - 1, rel = ret - sret;
    const F = cmfOf(I, 0, I.length - 1), j = B && B.length ? B.length - 1 : -1, sg = j > 5 ? sigma(B, j) : 0.015;
    let bd = 0, bn = 0; if (B) for (let k = Math.max(0, B.length - 21); k < B.length - 1; k++) { bd += B[k][4] * B[k][5]; bn++; }
    const R = Im.period && Im.period.regular, t0 = R && R.start ? R.start * 1000 : I[0][0], t1 = R && R.end ? R.end * 1000 : t0 + 6.5 * 36e5;
    const part = cl(((now || Date.now()) - t0) / Math.max(36e5, t1 - t0), 0.08, 1);
    const rvol = F.vv > 0 && bd > 0 ? F.dv / (bd / bn * part) : 1, z = rel / sg;
    return { s: score(z, F.cmf, rvol), ret, rel, cmf: F.cmf, rvol, z };
  }
  function label(r) {
    const { low: L, med: M, high: H } = r;
    if (L > 0.25 && M > 0.15 && H > 0.15) return ["Pouring in", 1];
    if (L < -0.25 && M < -0.15 && H < -0.15) return ["Draining out", -1];
    if (L > 0.25 && H < -0.3) return ["Bottom fishing", 1];
    if (L > 0.25 && M <= 0.15) return ["Fresh money", 1];
    if (L > 0.15 && H > 0.2 && M < 0) return ["Buying the dip", 1];
    if (L < -0.25 && H > 0.3) return ["Profit-taking", -1];
    if (L < -0.25 && M >= -0.15) return ["Fresh selling", -1];
    if (Math.abs(L) < 0.15) return ["Quiet today", 0];
    return L > 0 ? ["Leaning in", 1] : ["Leaning out", -1];
  }
  // all of it from bars: daily = { SYM: {bars} }, intra = { SYM: {bars, meta} }
  function compute(daily, intra, now) {
    now = now || Date.now(); intra = intra || {};
    const S = clean(daily[BENCH] && daily[BENCH].bars); if (S.length < 70) return null;
    const iS = S.length - 1, SI = intra[BENCH] ? clean(intra[BENCH].bars) : null, SIm = intra[BENCH] && intra[BENCH].meta;
    const rows = [];
    for (const p of P) {
      const B = clean(daily[p.t] && daily[p.t].bars); if (B.length < 30) continue;
      const w5 = win(B, S, iS, 5), w21 = win(B, S, iS, 21), w63 = win(B, S, iS, 63) || w21;
      // today: only bars from the same session day as SPY's bars; no trade yet today (a quiet ETF in pre-market) = 0, not yesterday's move
      const ii = intra[p.t], I1 = ii ? clean(ii.bars) : [], sD = SI && SI.length ? dOf(SI[SI.length - 1][0]) : "",
        c24 = /-USD$/.test(p.t), same = I1.length && (c24 || (sD && dOf(I1[I1.length - 1][0]) === sD)), none = !same && !c24 && sD && sD > dOf(B[B.length - 1][0]),
        td = same ? today(I1, ii.meta, SI, SIm, B, now, S, c24) : null,
        w1 = td || (none ? { s: 0, ret: 0, rel: 0, cmf: 0, rvol: 0, z: 0, none: true } : win(B, S, iS, 1));
      if (!w1 || !w5 || !w21) continue;
      const r = { t: p.t, a: p.a, n: p.n, g: p.g, risk: p.risk, bull: p.bull, bear: p.bear, m: p.m, px: ii && ii.bars && ii.bars.length ? ii.bars[ii.bars.length - 1][4] : B[B.length - 1][4],
        low: w1.s, med: w5.s, high: c1(0.6 * w21.s + 0.4 * w63.s), retT: w1.ret, relT: w1.rel, rvolT: w1.rvol, ret5: w5.ret, ret21: w21.ret, ret63: w63.ret, live: !!td, none: !!w1.none };
      r.blend = c1(0.6 * r.low + 0.3 * r.med + 0.1 * r.high); r.acc = r.low - r.med; [r.lab, r.labDir] = label(r); rows.push(r);
    }
    if (rows.length < 8) return null;
    // the crowd's mood
    const avg = L => L.length ? L.reduce((s, x) => s + x, 0) / L.length : 0;
    const on = rows.filter(r => r.risk > 0), off = rows.filter(r => r.risk < 0);
    const spreadT = avg(on.map(r => r.low)) - avg(off.map(r => r.low)), spreadW = avg(on.map(r => r.med)) - avg(off.map(r => r.med));
    const eq = rows.filter(r => r.g !== "haven"), breadth = eq.filter(r => r.retT > 0).length / Math.max(1, eq.length);
    let vix = null, vixTerm = 0; const V = clean(daily[VIX] && daily[VIX].bars), VI = intra[VIX];
    if (V.length > 25) { const lv = VI && VI.bars && VI.bars.length ? VI.bars[VI.bars.length - 1][4] : V[V.length - 1][4], a20 = avg(V.slice(-21, -1).map(b => b[4])), pc = VI && VI.meta && VI.meta.prevClose || V[V.length - 2][4];
      vix = { lv, a20, chg: lv / pc - 1 }; vixTerm = -0.5 * Math.tanh((lv / a20 - 1) * 4) - 0.5 * Math.tanh((lv / pc - 1) * 100 / 8); }
    const loud = (() => { const v = rows.map(r => r.rvolT).filter(isFinite).sort((a, b) => a - b); return v.length ? v[v.length >> 1] : 1; })();
    const mood = Math.round(100 * c1(0.35 * Math.tanh(spreadT * 1.5) + 0.15 * Math.tanh(spreadW * 1.5) + 0.2 * (breadth * 2 - 1) + 0.3 * vixTerm));
    const moodLab = mood <= -60 ? "Panic" : mood <= -20 ? "Fear" : mood < 20 ? "Calm" : mood < 60 ? "Greed" : "Euphoria";
    // what the crowd does
    const B = [], sd = (() => { const m = avg(rows.map(r => r.low)); return Math.sqrt(avg(rows.map(r => (r.low - m) ** 2))); })();
    const chase = rows.filter(r => r.low > 0.4 && r.rvolT > 1.3 && r.retT > 0), flee = rows.filter(r => r.low < -0.4 && r.rvolT > 1.3 && r.retT < 0);
    const havenIn = avg(off.map(r => r.low)), riskIn = avg(on.map(r => r.low));
    if (chase.length) B.push({ k: "Chasing", d: 1, txt: `The crowd is chasing ${chase.map(r => r.n).join(", ")}: big volume (${chase.map(r => r.rvolT.toFixed(1) + "×").join(", ")} normal) on an up day.` });
    if (flee.length) B.push({ k: "Fleeing", d: -1, txt: `The crowd is running from ${flee.map(r => r.n).join(", ")}: big volume on a down day.` });
    if (havenIn > 0.25 && riskIn < 0) B.push({ k: "Hiding", d: -1, txt: `Money hides in havens (bonds, gold, dollar, staples, utilities) and leaves risk.` });
    if (riskIn > 0.25 && havenIn < 0) B.push({ k: "Risk-on", d: 1, txt: `Money leaves the havens and goes into risk (growth, small caps, crypto).` });
    if (breadth >= 0.8) B.push({ k: "Herding up", d: 1, txt: `${Math.round(breadth * 100)}% of the stock places are up today: the herd moves together.` });
    if (breadth <= 0.2) B.push({ k: "Herding down", d: -1, txt: `${Math.round((1 - breadth) * 100)}% of the stock places are down today: the herd sells together.` });
    if (sd > 0.45 && breadth > 0.3 && breadth < 0.7) B.push({ k: "Rotating", d: 0, txt: `Strong rotation: money moves between places, not in or out of the market as a whole.` });
    const fish = rows.filter(r => r.lab === "Bottom fishing"), take = rows.filter(r => r.lab === "Profit-taking");
    if (fish.length) B.push({ k: "Bottom fishing", d: 1, txt: `New buyers step into long-time losers: ${fish.map(r => r.n).join(", ")}.` });
    if (take.length) B.push({ k: "Taking profits", d: -1, txt: `Holders sell long-time winners: ${take.map(r => r.n).join(", ")}.` });
    if (loud > 1.35) B.push({ k: "Loud", d: 0, txt: `The crowd is loud: typical volume today is ${loud.toFixed(1)}× normal for this time of day.` });
    else if (loud < 0.75) B.push({ k: "Quiet", d: 0, txt: `The crowd is quiet: typical volume today is ${loud.toFixed(1)}× normal. Moves on low volume are easier to reverse.` });
    const byT = [...rows].sort((a, b) => b.low - a.low), byB = [...rows].sort((a, b) => b.blend - a.blend);
    return { at: now, rows, byT, byB, mood, moodLab, spreadT, spreadW, breadth, vix, loud, sd, beh: B, top: byB.slice(0, 3), bottom: byB.slice(-3).reverse(), live: rows.some(r => r.live), sessD: SI && SI.length ? dOf(SI[SI.length - 1][0]) : (S.length ? dOf(S[S.length - 1][0]) : "") };
  }
  // does following the flow pay? the week's top 3 vs bottom 3, next day and next 5 days (relative to each other)
  function backtest(daily) {
    const S = clean(daily[BENCH] && daily[BENCH].bars); if (S.length < 80) return null;
    const BB = {}; P.forEach(p => { const B = clean(daily[p.t] && daily[p.t].bars); if (B.length > 60) BB[p.t] = B; });
    const out = { d1: [0, 0, 0], d5: [0, 0, 0] }, fwd = (B, iS, n) => { const a = idxAt(B, S[iS][0] + 12 * 36e5), b = idxAt(B, S[Math.min(S.length - 1, iS + n)][0] + 12 * 36e5); return a >= 0 && b > a ? B[b][4] / B[a][4] - 1 : null; };
    for (let iS = Math.max(65, S.length - 125); iS < S.length - 1; iS++) {
      const sc = []; for (const t in BB) { const w = win(BB[t], S, iS, 5); if (w) sc.push([t, w.s]); } if (sc.length < 10) continue;
      sc.sort((a, b) => b[1] - a[1]); const top = sc.slice(0, 3), bot = sc.slice(-3);
      for (const [k, n] of [["d1", 1], ["d5", 5]]) { if (iS + n >= S.length) continue; const f = L => { const v = L.map(([t]) => fwd(BB[t], iS, n)).filter(x => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
        const a = f(top), b = f(bot); if (a == null || b == null) continue; out[k][0]++; if (a > b) out[k][1]++; out[k][2] += a - b; }
    }
    return out.d1[0] >= 20 ? out : null;
  }

  // ---------- data ----------
  const TICK = [BENCH, VIX, ...P.map(p => p.t)];
  const DAILY = {}, INTRA = {}; let R = null, BT = null, busyD = false, busyI = false, atD = 0, atI = 0, err = "";
  const hist = lsG(KEY + "_days", {});   // { "2026-11-20": { top:[t,n,s], bot:[t,n,s], mood } } last 30 days
  async function get(t, range, interval) { const r = await fetch(`${proxy()}/chart?t=${encodeURIComponent(t)}&range=${range}&interval=${interval}`); const j = await r.json(); if (j.status !== "ok") throw new Error(j.error || "chart error"); return j; }
  async function pool(list, fn, n = 4) { let i = 0, bad = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < list.length) { const t = list[i++]; try { await fn(t); } catch (e) { bad++; } } })); return bad; }
  async function loadDaily() { if (busyD) return; busyD = true; try { const bad = await pool(TICK, async t => { DAILY[t] = await get(t, "1y", "1d"); }); atD = Date.now(); err = bad > 8 ? "The Worker did not answer for many tickers. Check the Worker link in Settings." : ""; BT = backtest(DAILY); } finally { busyD = false; } }
  async function loadIntra() { if (busyI) return; busyI = true; try { await pool(TICK, async t => { INTRA[t] = await get(t, "1d", "5m"); }); atI = Date.now(); } finally { busyI = false; } }
  async function refresh(force) {
    const now = Date.now(), hid = typeof document !== "undefined" && document.hidden;
    if (force || now - atD > (hid ? 60 : 30) * 6e4) await loadDaily();
    if (force || now - atI > (hid ? 10 : 2) * 6e4) await loadIntra();
    const x = compute(DAILY, INTRA, Date.now()); if (x) { R = x; keepDay(x); emitWeb(x); }
    draw(true);
  }
  function keepDay(x) {
    const S = DAILY[BENCH] && DAILY[BENCH].bars, t = S && S.length ? S[S.length - 1][0] : x.at, d = new Date(t).toISOString().slice(0, 10);
    hist[d] = { top: x.byT.slice(0, 3).map(r => [r.t, r.n, Math.round(r.low * 100)]), bot: x.byT.slice(-3).reverse().map(r => [r.t, r.n, Math.round(r.low * 100)]), mood: x.mood };
    const k = Object.keys(hist).sort(); while (k.length > 30) delete hist[k.shift()]; lsS(KEY + "_days", hist);
  }

  // ---------- into the spider web ----------
  const SITE = () => typeof document === "undefined" ? "x" : document.getElementById("scanCard") ? "letf" : document.getElementById("macro") && typeof gotoCoin === "function" ? "cohort" : "soxx";
  const LBL = { low: "Human Factor · money flow today (vs SPY, volume-weighted)", med: "Human Factor · money flow this week (5 days)", high: "Human Factor · money flow 1–3 months", mood: "Human Factor · crowd mood (risk-on flow, breadth, VIX)" };
  function emitWeb(x) {
    if (typeof window === "undefined" || !window.Web || !Web.emit) return; const site = SITE();
    const f = id => { try { return window.EVR ? EVR.factor(site, id) : 1; } catch (e) { return 1; } }, F = { low: f("hf.low"), med: f("hf.med"), high: f("hf.high"), mood: f("hf.mood") };
    const E = (id, a, v) => { try { Web.emit(id, a, c1(v) * F[id.slice(3)], LBL[id.slice(3)]); } catch (e) { } };
    for (const r of x.rows) { const T = [[r.a, 1], ...r.bull.map(s => [s, 1]), ...r.bear.map(s => [s, -1]), ...r.m.map(s => [s, 1])];
      for (const [a, sg] of T) { E("hf.low", a, sg * r.low); E("hf.med", a, sg * r.med); E("hf.high", a, sg * r.high); } }
    for (const [a, sg] of Object.entries(RISK)) E("hf.mood", a, sg * x.mood / 100);
  }

  // ---------- the card ----------
  if (typeof document === "undefined" || !document.createElement || !document.head) { window.HF = { compute, backtest, score, places: P }; return; }
  const st = document.createElement("style");
  st.textContent = `#hfCard{--hfU:var(--up,#19d38a);--hfD:var(--down,#ff4d5e);--hfI:var(--ink,#e6edf5);--hfM:var(--dim,var(--mute,#8a97a8));--hfL:var(--line,rgba(127,127,127,.25));--hfA:var(--amber,#ffb547);border:1px solid var(--hfA);box-shadow:0 0 0 1px rgba(255,181,71,.15),0 8px 30px rgba(255,181,71,.06)}
#hfCard .hfU{color:var(--hfU)} #hfCard .hfD{color:var(--hfD)} #hfCard .hfDim{color:var(--hfM);font:11.5px var(--mono,ui-monospace,monospace)}
#hfCard .hfHd{display:flex;flex-wrap:wrap;align-items:baseline;gap:8px;justify-content:space-between;margin-bottom:8px}
#hfCard .hfT{font:700 18px var(--sans,system-ui);color:var(--hfI);letter-spacing:.01em} #hfCard .hfT small{font:400 12px var(--sans,system-ui);color:var(--hfM)}
#hfCard button{font:11px var(--mono,ui-monospace,monospace);padding:3px 8px;margin-left:4px;border-radius:6px;border:1px solid var(--hfL);background:transparent;color:var(--hfI);cursor:pointer}
#hfCard button.on{border-color:var(--hfA);color:var(--hfA)}
#hfCard .hfTop{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}
#hfCard .hfBoard{flex:0 1 400px;min-width:260px;max-width:440px} #hfCard .hfBoard svg{width:100%;height:auto;display:block}
#hfCard .hfBoard svg .seg{cursor:pointer;stroke:var(--panel,#0e131b);stroke-width:1.2} #hfCard .hfBoard svg .seg:hover{stroke:var(--hfA);stroke-width:2}
#hfCard .hfSide{flex:1 1 340px;min-width:0}
#hfCard h4{margin:12px 0 6px;font:700 12.5px var(--sans,system-ui);text-transform:uppercase;letter-spacing:.06em;color:var(--hfI)} #hfCard h4:first-child{margin-top:0}
#hfCard .hfMood{display:flex;align-items:center;gap:10px;font:12px var(--mono,ui-monospace,monospace);color:var(--hfI)}
#hfCard .hfGauge{position:relative;flex:1;height:12px;border-radius:6px;background:linear-gradient(90deg,var(--hfD),#ffb547 50%,var(--hfU))}
#hfCard .hfGauge i{position:absolute;top:-4px;width:4px;height:20px;border-radius:2px;background:var(--hfI);box-shadow:0 0 0 2px var(--panel,#0e131b)}
#hfCard .hfBig{font:700 22px var(--sans,system-ui)}
#hfCard .hfFT{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0} #hfCard .hfFT>div{flex:1 1 160px;border:1px solid var(--hfL);border-radius:8px;padding:6px 8px;font:12px var(--mono,ui-monospace,monospace);color:var(--hfI)}
#hfCard .hfBeh{font:12px var(--mono,ui-monospace,monospace);color:var(--hfI);padding:3px 0;line-height:1.45} #hfCard .hfTag{display:inline-block;font:600 10.5px var(--mono,ui-monospace,monospace);padding:1px 6px;border-radius:4px;border:1px solid currentColor;margin-right:6px}
#hfCard .hfPulse{width:100%;border-collapse:collapse;font:12px var(--mono,ui-monospace,monospace);color:var(--hfI);margin-top:4px}
#hfCard .hfPulse th{font:600 10.5px var(--mono,ui-monospace,monospace);color:var(--hfM);text-align:left;padding:4px 6px;border-bottom:1px solid var(--hfL);white-space:nowrap;cursor:pointer} #hfCard .hfPulse th.on{color:var(--hfA)}
#hfCard .hfPulse td{padding:4px 6px;border-bottom:1px solid var(--hfL);white-space:nowrap} #hfCard .hfPulse tr.sel td{background:rgba(255,181,71,.10)} #hfCard .hfPulse tr{cursor:pointer}
#hfCard .hfBar{display:inline-block;position:relative;width:70px;height:8px;border-radius:4px;background:var(--hfL);vertical-align:0;margin-right:6px} #hfCard .hfBar i{position:absolute;top:0;height:100%;border-radius:4px}
#hfCard .hfBar:after{content:"";position:absolute;left:50%;top:-2px;width:1px;height:12px;background:var(--hfM)}
#hfCard .hfChips{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0} #hfCard .hfScroll{overflow-x:auto}
#hfCard .hfDays{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px} #hfCard .hfDays>div{flex:0 0 auto;border:1px solid var(--hfL);border-radius:8px;padding:5px 8px;font:11px var(--mono,ui-monospace,monospace);color:var(--hfI)}
#hfCard .hfHelp{font:11.5px var(--mono,ui-monospace,monospace);color:var(--hfM);line-height:1.55;margin-top:10px}
@media (max-width:640px){#hfCard .hfPulse .hfOpt{display:none}}`;
  document.head.appendChild(st);
  const CARD = document.createElement("section"); CARD.className = "card"; CARD.id = "hfCard"; CARD.style.marginBottom = "12px";
  let UI = lsG(KEY + "_ui", { sort: "low", grp: "all", help: 0 }), SELT = null, lastHtml = "";
  const pct = v => (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + "%", sc = v => (v >= 0 ? "+" : "") + Math.round(v * 100), cls = v => v > 0.05 ? "hfU" : v < -0.05 ? "hfD" : "";
  const col = (v, a0 = 0.1) => { const a = (a0 + 0.8 * Math.min(1, Math.abs(v))).toFixed(2); return v >= 0 ? `rgba(25,211,138,${a})` : `rgba(255,77,94,${a})`; };
  const bar = v => `<span class="hfBar"><i style="${v >= 0 ? `left:50%;width:${Math.abs(v) * 50}%` : `left:${50 - Math.abs(v) * 50}%;width:${Math.abs(v) * 50}%`};background:${v >= 0 ? "var(--hfU)" : "var(--hfD)"}"></i></span><b class="${cls(v)}">${sc(v)}</b>`;
  const tm = ms => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  function board(x) {
    const W = 400, C = W / 2, rB = 30, r1 = 82, r2 = 124, r3 = 160, rL = 196, n = P.length, step = 2 * Math.PI / n;
    const pt = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)], f = v => v.toFixed(1);
    const seg = (ri, ro, a0, a1) => { const [x0, y0] = pt(ro, a0), [x1, y1] = pt(ro, a1), [x2, y2] = pt(ri, a1), [x3, y3] = pt(ri, a0); return `M${f(x0)},${f(y0)}A${ro},${ro} 0 0 1 ${f(x1)},${f(y1)}L${f(x2)},${f(y2)}A${ri},${ri} 0 0 0 ${f(x3)},${f(y3)}Z`; };
    const by = {}; x.rows.forEach(r => by[r.t] = r); const top = x.byT.slice(0, 3).map(r => r.t), bot = x.byT.slice(-3).map(r => r.t);
    let s = `<svg viewBox="0 0 ${W} ${W}" role="img" aria-label="Human Factor bullseye"><circle cx="${C}" cy="${C}" r="${rL}" fill="var(--panel2,#131a24)" stroke="var(--hfL)"/>`;
    P.forEach((p, i) => { const a0 = -Math.PI / 2 - step / 2 + i * step, a1 = a0 + step, r = by[p.t], am = (a0 + a1) / 2;
      if (r) { const tip = `${p.n} (${p.a}) · ${r.lab}\nToday ${sc(r.low)} (${pct(r.retT)}, volume ${r.rvolT.toFixed(1)}× normal)\nWeek ${sc(r.med)} · 1–3 months ${sc(r.high)}`;
        [[rB, r1, r.low], [r1, r2, r.med], [r2, r3, r.high]].forEach(([ri, ro, v]) => { s += `<path class="seg" data-hf="${p.t}" d="${seg(ri, ro, a0, a1)}" fill="${col(v, 0.06)}"><title>${esc(tip)}</title></path>`; }); }
      else s += `<path d="${seg(rB, r3, a0, a1)}" fill="var(--hfL)" opacity=".3"/>`;
      const [lx, ly] = pt((r3 + rL) / 2, am), up = top.includes(p.t), dn = bot.includes(p.t), deg = am * 180 / Math.PI + 90, flip = deg > 90 && deg < 270;
      s += `<text x="${f(lx)}" y="${f(ly)}" text-anchor="middle" dominant-baseline="central" transform="rotate(${f(flip ? deg + 180 : deg)} ${f(lx)} ${f(ly)})" style="font:${up || dn ? 700 : 500} ${p.a.length > 4 ? 9.5 : 11}px var(--mono,ui-monospace,monospace);cursor:pointer" fill="${up ? "var(--hfU)" : dn ? "var(--hfD)" : SELT === p.t ? "var(--hfA)" : "var(--hfM)"}" data-hf="${p.t}">${esc(p.a)}</text>`; });
    // ring labels and the bull
    [[(rB + r1) / 2, "TODAY"], [(r1 + r2) / 2, "WEEK"], [(r2 + r3) / 2, "1–3 MO"]].forEach(([r, t]) => { s += `<text x="${C}" y="${f(C + r + 3)}" text-anchor="middle" style="font:600 7.5px var(--mono,ui-monospace,monospace);letter-spacing:.08em" fill="var(--hfI)" opacity=".55" pointer-events="none">${t}</text>`; });
    const b0 = x.byT[0]; s += `<circle cx="${C}" cy="${C}" r="${rB}" fill="${b0 && b0.low > 0 ? col(b0.low, 0.35) : "var(--hfL)"}" stroke="var(--hfA)" stroke-width="2"/>`;
    if (b0) s += `<text x="${C}" y="${C - 5}" text-anchor="middle" style="font:700 ${b0.a.length > 4 ? 9.5 : 12}px var(--mono,ui-monospace,monospace)" fill="var(--hfI)">${esc(b0.a)}</text><text x="${C}" y="${C + 9}" text-anchor="middle" style="font:700 10px var(--mono,ui-monospace,monospace)" fill="var(--hfI)">${sc(b0.low)}</text>`;
    // darts: today's top 3, stuck in the TODAY ring of their wedge (stronger = closer to the bull)
    x.byT.slice(0, 3).forEach((r, k) => { const i = P.findIndex(p => p.t === r.t), am = -Math.PI / 2 + i * step, rr = rB + 6 + (r1 - rB - 12) * (1 - Math.max(0, r.low)), [dx, dy] = pt(rr, am), [tx, ty] = pt(rr + 26, am + 0.12);
      s += `<line x1="${f(dx)}" y1="${f(dy)}" x2="${f(tx)}" y2="${f(ty)}" stroke="var(--hfA)" stroke-width="2.4" stroke-linecap="round" pointer-events="none"/><circle cx="${f(dx)}" cy="${f(dy)}" r="4.2" fill="var(--hfA)" stroke="var(--panel,#0e131b)" stroke-width="1.2" pointer-events="none"/>`;
      s += `<circle cx="${f(tx)}" cy="${f(ty)}" r="6.5" fill="var(--hfA)" pointer-events="none"/><text x="${f(tx)}" y="${f(ty + 0.5)}" text-anchor="middle" dominant-baseline="central" style="font:700 8.5px var(--mono,ui-monospace,monospace)" fill="#111" pointer-events="none">${k + 1}</text>`; });
    return s + `</svg>`;
  }
  function siteNote(x) {
    const site = SITE(), by = {}; x.rows.forEach(r => by[r.t] = r); const rank = t => x.byT.findIndex(r => r.t === t) + 1;
    if (site === "soxx" && by.SMH) { const r = by.SMH, w = r.low > 0.2 && r.med > 0 ? "tailwind" : r.low < -0.2 && r.med < 0 ? "headwind" : "mixed";
      return `<b>For SOXL:</b> semis are <b>#${rank("SMH")} of ${x.rows.length}</b> for money today (${sc(r.low)}), week ${sc(r.med)}, 1–3 months ${sc(r.high)} · <b class="${w === "tailwind" ? "hfU" : w === "headwind" ? "hfD" : ""}">${w}</b>. ${r.lab}.${by.XLK ? ` Tech: ${sc(by.XLK.low)} today.` : ""}`; }
    if (site === "letf") { const ride = x.byT.slice(0, 3).flatMap(r => r.bull.slice(0, 2).map(s => `${s} (${r.n} ${sc(r.low)})`)), fade = x.byT.slice(-3).flatMap(r => r.bear.slice(0, 2).map(s => `${s} (${r.n} ${sc(r.low)})`));
      return `<b>Leveraged funds riding today's flow:</b> ${ride.length ? ride.join(", ") : "none of the top 3 has a bull fund"}. <b>Bear funds on the places money leaves:</b> ${fade.length ? fade.join(", ") : "none of the bottom 3 has a bear fund"}.`; }
    if (site === "cohort" && by["BTC-USD"]) { const r = by["BTC-USD"];
      return `<b>For crypto and perps:</b> Bitcoin is <b>#${rank("BTC-USD")} of ${x.rows.length}</b> for money today (${sc(r.low)}), week ${sc(r.med)}, 1–3 months ${sc(r.high)}. Mood <b>${x.moodLab}</b>: ${x.mood >= 20 ? "risk appetite helps longs" : x.mood <= -20 ? "fear helps shorts and hurts weak longs" : "no strong push either way"}.`; }
    return "";
  }
  function draw(force) {
    if (!CARD.isConnected) return; const x = R || null;
    let body = "";
    if (!x) body = `<div class="hfDim">${err ? esc(err) : "Reading a year of daily bars and today's 5-minute bars for 22 tickers…"}</div>`;
    else {
      const sel = SELT && x.rows.find(r => r.t === SELT);
      const into = x.byT.filter(r => r.low > 0.1).slice(0, 4), out = x.byT.filter(r => r.low < -0.1).slice(-4).reverse();
      const rot = into[0] && out[0] ? `<div class="hfBeh"><span class="hfTag" style="color:var(--hfA)">Rotation</span><b class="hfD">${esc(out[0].n)}</b> → <b class="hfU">${esc(into[0].n)}</b>${into[1] && out[1] ? ` · <b class="hfD">${esc(out[1].n)}</b> → <b class="hfU">${esc(into[1].n)}</b>` : ""}</div>` : "";
      const tfw = k => { const L = [...x.rows].sort((a, b) => b[k] - a[k]); return `<b class="hfU">${L.slice(0, 2).map(r => esc(r.n)).join(", ")}</b> in · <b class="hfD">${L.slice(-2).reverse().map(r => esc(r.n)).join(", ")}</b> out`; };
      const sn = siteNote(x);
      body += `<div class="hfTop"><div class="hfBoard">${board(x)}<div class="hfDim" style="text-align:center">🎯 1·2·3 = today's top destinations · inner ring today, middle week, outer 1–3 months · tap a wedge</div>
        ${sel ? `<div class="hfFT" style="margin-top:6px"><div><b>${esc(sel.n)} (${esc(sel.a)})</b> · <b class="${cls(sel.labDir)}">${esc(sel.lab)}</b><br>today ${bar(sel.low)} <span class="hfDim">${pct(sel.retT)} · vol ${sel.rvolT.toFixed(1)}×</span><br>week&nbsp; ${bar(sel.med)} <span class="hfDim">${pct(sel.ret5)}</span><br>1–3 mo ${bar(sel.high)} <span class="hfDim">${pct(sel.ret21)} / ${pct(sel.ret63)}</span>${sel.bull.length || sel.bear.length ? `<br><span class="hfDim">bull ${esc(sel.bull.join(" ") || "–")} · bear ${esc(sel.bear.join(" ") || "–")}</span>` : ""}</div></div>` : ""}</div>
        <div class="hfSide"><h4>What money is doing</h4>
          <div class="hfMood"><div><div class="hfDim">Crowd mood</div><div class="hfBig ${x.mood >= 20 ? "hfU" : x.mood <= -20 ? "hfD" : ""}" style="${Math.abs(x.mood) < 20 ? "color:var(--hfA)" : ""}">${x.moodLab} ${sc(x.mood / 100)}</div></div><div style="flex:1"><div class="hfGauge"><i style="left:calc(${(x.mood + 100) / 2}% - 2px)"></i></div><div class="hfDim" style="display:flex;justify-content:space-between;margin-top:3px"><span>Panic</span><span>Fear</span><span>Calm</span><span>Greed</span><span>Euphoria</span></div></div></div>
          <div class="hfDim" style="margin:4px 0 6px">risk-on vs havens today ${sc(c1(x.spreadT))}, week ${sc(c1(x.spreadW))} · ${Math.round(x.breadth * 100)}% of stock places up today · typical volume ${x.loud.toFixed(1)}× normal${x.vix ? ` · VIX ${x.vix.lv.toFixed(2)} (${pct(x.vix.chg)} today, 20-day avg ${x.vix.a20.toFixed(1)})` : ""}</div>
          <div class="hfFT"><div><span class="hfDim">INTO today</span><br>${into.length ? into.map(r => `<b class="hfU">${esc(r.n)}</b> ${sc(r.low)}`).join("<br>") : `<span class="hfDim">no strong inflow</span>`}</div><div><span class="hfDim">OUT OF today</span><br>${out.length ? out.map(r => `<b class="hfD">${esc(r.n)}</b> ${sc(r.low)}`).join("<br>") : `<span class="hfDim">no strong outflow</span>`}</div></div>
          ${rot}${x.beh.map(b => `<div class="hfBeh"><span class="hfTag ${b.d > 0 ? "hfU" : b.d < 0 ? "hfD" : ""}" style="${b.d ? "" : "color:var(--hfA)"}">${esc(b.k)}</span>${esc(b.txt)}</div>`).join("")}
          <div class="hfBeh"><span class="hfTag" style="color:var(--hfM)">Low</span>today: ${tfw("low")}</div><div class="hfBeh"><span class="hfTag" style="color:var(--hfM)">Medium</span>week: ${tfw("med")}</div><div class="hfBeh"><span class="hfTag" style="color:var(--hfM)">High</span>1–3 months: ${tfw("high")}</div>
          ${sn ? `<div class="hfBeh" style="margin-top:6px;border-left:3px solid var(--hfA);padding-left:8px">${sn}</div>` : ""}</div></div>`;
      // Sector Pulse
      const G = UI.grp === "all" ? x.rows : x.rows.filter(r => r.g === UI.grp), L = [...G].sort((a, b) => b[UI.sort] - a[UI.sort]);
      const th = (k, t) => `<th data-hfs="${k}" class="${UI.sort === k ? "on" : ""}">${t}${UI.sort === k ? " ▼" : ""}</th>`, chip = (k, t) => `<button data-hfg="${k}" class="${UI.grp === k ? "on" : ""}">${t}</button>`;
      body += `<h4>Sector Pulse · how money flows, by time frame</h4><div class="hfChips">${chip("all", "All 20")}${chip("sector", "Sectors")}${chip("theme", "Themes")}${chip("haven", "Havens / alt")}</div>
        <div class="hfScroll"><table class="hfPulse"><tr><th>Place</th>${th("low", R && R.sessD && R.sessD < dOf(Date.now()) ? "Last session (low)" : "Today (low)")}${th("med", "Week (medium)")}${th("high", "1–3 mo (high)")}${th("blend", "Blend")}<th>Trend</th><th class="hfOpt">Speed</th><th class="hfOpt">Vol today</th><th class="hfOpt">Ride it with</th></tr>
        ${L.map(r => `<tr data-hf="${r.t}" class="${SELT === r.t ? "sel" : ""}"><td><b>${esc(r.n)}</b> <span class="hfDim">${esc(r.a)}</span></td><td>${bar(r.low)} <span class="hfDim">${r.none ? "no trades yet" : pct(r.retT)}</span></td><td>${bar(r.med)}</td><td>${bar(r.high)}</td><td>${bar(r.blend)}</td><td class="${cls(r.labDir)}">${esc(r.lab)}</td>
          <td class="hfOpt ${r.acc > 0.3 ? "hfU" : r.acc < -0.3 ? "hfD" : "hfDim"}">${r.acc > 0.3 ? "▲ speeding up" : r.acc < -0.3 ? "▼ slowing" : "steady"}</td><td class="hfOpt ${r.rvolT > 1.3 ? "" : "hfDim"}" style="${r.rvolT > 1.3 ? "color:var(--hfA)" : ""}">${r.rvolT.toFixed(1)}×</td><td class="hfOpt hfDim">${r.bull.length ? `<span class="hfU">${esc(r.bull.slice(0, 2).join(" "))}</span>` : "–"}${r.bear.length ? ` / <span class="hfD">${esc(r.bear.slice(0, 2).join(" "))}</span>` : ""}</td></tr>`).join("")}</table></div>`;
      // the last days' bullseye and the honest check
      const days = Object.keys(hist).sort().slice(-12).reverse();
      if (days.length) body += `<h4>Daily bullseye log</h4><div class="hfDays">${days.map(d => { const h = hist[d]; return `<div><span class="hfDim">${d.slice(5)} · mood ${sc(h.mood / 100)}</span><br>🎯 <b class="hfU">${esc(h.top.map(t => t[1]).join(", "))}</b><br>✕ <span class="hfD">${esc(h.bot.map(t => t[1]).join(", "))}</span></div>`; }).join("")}</div>`;
      if (BT) { const q = (o, t) => `${t}: top 3 beat bottom 3 on <b class="${o[1] / o[0] >= 0.53 ? "hfU" : o[1] / o[0] < 0.47 ? "hfD" : ""}">${Math.round(o[1] / o[0] * 100)}%</b> of ${o[0]} days (avg gap ${pct(o[2] / o[0])})`;
        body += `<div class="hfDim" style="margin-top:8px"><b style="color:var(--hfI)">Does following the flow pay?</b> Last ~6 months, the week's flow: ${q(BT.d1, "next day")} · ${q(BT.d5, "next 5 days")}. ${BT.d5[1] / BT.d5[0] >= 0.53 ? "Flow has kept going lately: momentum." : BT.d5[1] / BT.d5[0] < 0.47 ? "Flow has turned back lately: the crowd overshoots, so fade extremes." : "No clear edge lately: use it as context, not as a signal alone."}</div>`; }
    }
    if (UI.help) body += `<div class="hfHelp">Human Factor follows the crowd's money. Each place gets a flow score from −100 to +100 on three time frames: <b>today</b> (5-minute bars, with pre-market and after-hours), <b>this week</b> (5 days) and <b>1–3 months</b>. The score mixes how much it beat or lagged SPY (in units of its own normal daily move), where its bars closed in their range weighted by volume (money flow), and how loud the crowd is (dollar volume vs normal). Crowd mood mixes risk-on vs haven flow, how many places are up, and the VIX. Trend labels: Pouring in (in on all three), Fresh money (in today, not before), Bottom fishing (in today after months out), Buying the dip (months in, week out, today in), Profit-taking (months in, today out), Draining out (out on all three). It is context, not advice; use it with your limit-order rules. The scores feed the spider web as hf.low, hf.med, hf.high and hf.mood, on each ETF, its leveraged funds (bear funds flipped) and its big stocks.</div>`;
    const html = `<div class="hfHd"><div class="hfT">🎯 Human Factor <small>· where the crowd's money flows, every day${x ? ` · ${x.live ? "live" : "last session"} · read ${tm(x.at)}` : ""}${busyD || busyI ? " · reading…" : ""}</small></div>
      <div><button data-hfa="now" title="Read again now">↻</button><button data-hfa="help" class="${UI.help ? "on" : ""}">?</button></div></div>${body}`;
    if (force || html !== lastHtml) { lastHtml = html; CARD.innerHTML = html; }
  }
  CARD.addEventListener("click", e => {
    const a = e.target.closest("[data-hfa],[data-hfs],[data-hfg],[data-hf]"); if (!a) return; e.preventDefault(); e.stopPropagation();
    if (a.dataset.hfa === "now") refresh(true); if (a.dataset.hfa === "help") UI.help = UI.help ? 0 : 1;
    if (a.dataset.hfs) UI.sort = a.dataset.hfs; if (a.dataset.hfg) UI.grp = a.dataset.hfg; if (a.dataset.hf) SELT = SELT === a.dataset.hf ? null : a.dataset.hf;
    lsS(KEY + "_ui", UI); draw(true);
  });

  // ---------- where the card goes: top of the main page on each site ----------
  const $ = id => document.getElementById(id);
  function place() {
    if ($("scanCard")) { const M = $("scanCard").parentElement, after = $("edgeBar") || $("mStrip"); if (CARD.parentElement !== M) { if (after && after.parentElement === M) after.after(CARD); else M.prepend(CARD); } return; }   // LETF Sniper (layout.js keeps it there)
    if ($("macro") && typeof gotoCoin === "function") { const m = $("macro"); if (CARD.previousElementSibling !== m) m.after(CARD); return; }   // Cohort Sniper: under the macro bar, above the tabs
    const M = $("mainView"); if (M) { if (CARD.parentElement !== M) { const after = $("extBar") || $("hlBar") || $("topRow"); if (after && after.parentElement === M) after.after(CARD); else M.prepend(CARD); } }   // SOXX Sniper (layout.js keeps it there)
  }
  const boot = () => { try { place(); draw(true); refresh(); } catch (e) { } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);
  setInterval(() => { try { place(); if (!busyD && !busyI) refresh(); } catch (e) { } }, 60e3);
  let mo = 0; new MutationObserver(() => { if (mo || CARD.isConnected) return; mo = requestAnimationFrame(() => { mo = 0; try { place(); draw(true); } catch (e) { } }); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  window.HF = { compute, backtest, score, places: P, state: () => R, refresh: () => refresh(true) };
})();
