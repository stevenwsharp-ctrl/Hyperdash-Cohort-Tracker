/* Rollover and carry · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   From TradeWithBanks ("Why the euro drops against the dollar"): no moon phases, just the plumbing.
   1. Dollar demand: oil, debt and trade settle in dollars, so the world sells other currencies to buy them. The euro is
      57.6% of the dollar index (DXY), so a euro move shows up in the DXY almost one for one.
   2. "By 4 pm ET the day has confessed": one hour before the 5 pm ET roll-over, take the side the day closed and hold it
      through the roll-over while price respects the move. Test here, on each market's hourly bars: the move from 5 pm ET
      (the start of the trading day) to 4 pm ET, vs the next 24 hours from 4 pm. Walk-forward, the first half to learn
      and the second half to check; the signal is live only if the continuation (or the reversal) held on the unseen half.
   3. Carry: the higher-yield side is paid every night it is held. On perps the carry is the funding rate: when funding is
      positive, longs pay shorts every hour. carry.fund leans to the side that is paid (the web learns if that pays after
      price moves too — crowded longs pay funding and often get flushed).
   Signals: day.confess (the day's side, after 4 pm ET, held up to 24 h while price stays on that side of the 4 pm price),
            carry.fund (−funding, annualized, ±30%/year = full).
   API: Rollover.analyze(bars1h) → A · Rollover.signals(A, funding?) · Rollover.html(A, title, funding?) */
(function () {
  "use strict";
  if (window.Rollover) return;
  const c1 = v => Math.max(-1, Math.min(1, v));
  const f = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  const et = t => { const p = Object.fromEntries(f.formatToParts(new Date(t)).map(x => [x.type, x.value])); return { h: +p.hour % 24, d: `${p.year}-${p.month}-${p.day}`, wd: p.weekday }; };
  function analyze(B) {
    if (!B || B.length < 24 * 30) return null;
    // index the close of the 3–4 pm ET bar (= the 4 pm price) and the close of the 4–5 pm bar (= the 5 pm price) per day
    const at4 = [], at5 = {}; for (let i = 0; i < B.length; i++) { const e = et(B[i][0]); if (e.h === 15) at4.push({ i, d: e.d, wd: e.wd }); if (e.h === 16) at5[e.d] = i; }
    const D = [];
    for (let k = 1; k < at4.length; k++) { const x = at4[k], prevDay5 = (() => { for (let j = k - 1; j >= 0; j--) { const d = at4[j].d; if (at5[d] != null) return at5[d]; } return null; })(); if (prevDay5 == null) continue;
      const day = Math.log(B[x.i][4] / B[prevDay5][4]); const nx = at4[k + 1]; const fw = nx && nx.i - x.i <= 30 ? Math.log(B[nx.i][4] / B[x.i][4]) : null;
      const r1 = at5[x.d] != null ? Math.log(B[at5[x.d]][4] / B[x.i][4]) : null;   // the roll-over hour itself
      D.push({ i: x.i, t: B[x.i][0], wd: x.wd, day, fw, r1 }); }
    const done = D.filter(d => d.fw != null && Math.abs(d.day) > 0), half = Math.floor(done.length / 2);
    const test = L => { const n = L.length; if (n < 8) return { n, hit: null, z: 0, m: 0 }; const h = L.filter(d => Math.sign(d.fw) === Math.sign(d.day)).length, m = L.reduce((s, d) => s + Math.sign(d.day) * d.fw, 0) / n; return { n, hit: h / n, z: (h - n / 2) / Math.sqrt(n / 4), m }; };
    const learn = test(done.slice(0, half)), unseen = test(done.slice(half)), all = test(done);
    const roll = (() => { const L = D.filter(d => d.r1 != null && d.day); if (L.length < 8) return null; const h = L.filter(d => Math.sign(d.r1) === Math.sign(d.day)).length; return { n: L.length, hit: h / L.length, z: (h - L.length / 2) / Math.sqrt(L.length / 4) }; })();
    const dir = learn.z >= 1 && unseen.z >= 1.3 ? 1 : learn.z <= -1 && unseen.z <= -1.3 ? -1 : 0;   // continuation (+1), reversal (−1), or nothing proven (0)
    // live: the latest 4 pm call, kept for 24 h while price stays on its side of the 4 pm price
    const last = D[D.length - 1], n = B.length, px = B[n - 1][4]; let live = null;
    if (last && n - 1 - last.i <= 24 && last.day) { const s = Math.sign(last.day), held = Math.sign(Math.log(px / B[last.i][4])) !== -s || Math.abs(Math.log(px / B[last.i][4])) < 0.002; live = { side: s, day: last.day, from: B[last.i][4], hours: n - 1 - last.i, held, wd: last.wd }; }
    return { D: done.length, learn, unseen, all, roll, dir, live, px };
  }
  function signals(A, fund) {
    const I = [];
    if (A && A.live && A.live.held && A.dir) I.push(["day.confess", c1(A.live.side * A.dir * Math.min(1, Math.abs(A.unseen.z) / 3)), A.dir > 0 ? "Roll-over · the side the day closed at 4 pm ET (continuation, tested)" : "Roll-over · fade the side the day closed at 4 pm ET (reversal, tested)"]);
    if (fund != null && isFinite(fund) && fund !== 0) { const ann = fund * 24 * 365; if (Math.abs(ann) >= 0.03) I.push(["carry.fund", c1(-ann / 0.3), "Carry · funding: the side that gets paid (longs pay when funding is +)"]); }
    return I;
  }
  const pc = (v, d) => (v >= 0 ? "+" : "") + (v * 100).toFixed(d == null ? 2 : d) + "%";
  function html(A, title, fund, short) {
    if (!A) return `<div class="note">The roll-over test needs 30 days of hourly bars.</div>`;
    const tr = (l, s) => `<tr><td style="text-align:left">${l}</td><td>${s.n}</td><td>${s.hit != null ? Math.round(s.hit * 100) + "%" : "–"}</td><td class="${Math.abs(s.z) >= 2 ? (s.z > 0 ? "L" : "S") : ""}">${s.z.toFixed(1)}</td><td>${s.m ? pc(s.m) : "–"}</td></tr>`;
    const v = A.dir > 0 ? `<b class="L">the day's side continues</b> (tested on unseen days)` : A.dir < 0 ? `<b class="S">the day's side reverses</b> (tested on unseen days)` : `<b>no proven edge</b>: the 4 pm side does not predict the next 24 h here`;
    const lv = A.live ? `Today's 4 pm call: <b class="${A.live.side > 0 ? "L" : "S"}">${A.live.side > 0 ? "LONG" : "SHORT"}</b> (the day ${pc(A.live.day)}), ${A.live.hours} h ago from ${A.live.from >= 100 ? A.live.from.toFixed(2) : A.live.from.toPrecision(4)}; price ${A.live.held ? "still respects it" : "broke back through it: call off"}.` : "No 4 pm call in the last 24 h (weekend or not yet 4 pm ET).";
    const fd = fund != null && isFinite(fund) ? ` Funding ${(fund * 24 * 365 * 100).toFixed(1)}%/year: ${fund > 0 ? "longs pay shorts (shorts are paid to wait)" : fund < 0 ? "shorts pay longs (longs are paid to wait)" : "flat"}.` : "";
    return `<div class="note" style="max-width:none">${title ? `<b>${title}</b> · ` : ""}Verdict: ${v}. ${lv}${fd}</div>
      <table class="tr" style="width:auto"><thead><tr><th style="text-align:left">5 pm → 4 pm ET side vs the next 24 h</th><th>days</th><th>same side</th><th>z</th><th>avg follow</th></tr></thead><tbody>${tr("learn (first half)", A.learn)}${tr("unseen (second half)", A.unseen)}${tr("all days", A.all)}${A.roll ? `<tr><td style="text-align:left">the roll-over hour (4–5 pm ET) alone</td><td>${A.roll.n}</td><td>${Math.round(A.roll.hit * 100)}%</td><td>${A.roll.z.toFixed(1)}</td><td>–</td></tr>` : ""}</tbody></table>${short ? "" : `
      <div class="note" style="max-width:none">The dollar is the world's settlement currency (oil, debt, trade), so steady demand for it is plumbing, not prophecy; the euro is 57.6% of the DXY. "By 4 pm the day has confessed": the day's side is taken one hour before the 5 pm ET roll-over and held while price respects it. Carry: the side that is paid to hold (on perps, the side that receives funding). The web learns how much each is worth here.</div>`}`;
  }
  window.Rollover = { analyze, signals, html };
})();
