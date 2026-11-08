# Cohort agent notes

## 2026-11-08 · Cohort agent

### Evidence
- First run. No council note (agents/council.md is missing) and no past notes.
- Scorecard 2026-11-08: 71 items, 1 mute, 21 cut, 10 back, 0 changed. All workflows (data, backtest, lab, EV) ran with no errors. Some scheduled data runs show "cancelled"; the next dispatched run replaced them.
- Outlook "mom" (momentum) loses on all horizons: 24 h −1.41 %/pick (z −1.58), 48 h −2.06 % (z −1.32), 7 d −5.63 % (z −0.89). It loses on the learning part and on the unseen part at every horizon. At 7 d the loss grows: learning −4.2 %, unseen −7.6 %. The ruling for mom.168h is only "watch" (factor 1).
- Outlook "rev" (reversion) at 24 h: −1.58 %/pick (z −1.57), learning −0.67 %, unseen −2.77 % (decay).
- Outlook "smart" decays: 24 h learning +1.1 %, unseen −0.7 %; 7 d learning +6.9 %, unseen −0.5 %. Gap score thresholds 20–70 stay strong ("back", z 2.8–10.1). The live gap setups are good; the Outlook "smart" lens on 1 pick per day is noisy.
- cond.mom_with (cut, −0.46 pts) and lab.young-small.2d (mute, z −2.23). The setup rating already uses the backtest's own factors for conditions, and the lab setups use only ideas with t > 0.5 and a positive second half. These need no code change.
- The live page used weights that the backtest did not test: full-sample t floored at 0.2 (so a loser still had weight), × EV factor. The "Signal web" has weight 1 at all horizons, with no backtest at all.

### Changes
- b09f7cb (main) outlook.js, index.html (outlook.js?v=7): weight 0 in the consensus for rev at 24 h and mom at 7 d. The gate stays only while the backtest shows a loss on BOTH parts (learnM < 0 and unseenM < 0); it lifts by itself when either part turns positive. The system card shows "gated". The "n systems" count now counts only systems with weight > 0.
- Walk-forward check (scratch copy of outlookbt.mjs on the 40-day panel, weights fitted on the older part, consensus scored on the newer part, cuts at 50 / 60 / 70 %), consensus per pick vs the current live weight rule:
  - 24 h without rev: −0.33 vs −0.67, +0.76 vs −0.50, +0.79 vs +0.06 (better at 3 of 3 cuts).
  - 7 d without mom: +2.41 vs +0.56, +2.64 vs +0.17, +2.45 vs +0.23 (better at 3 of 3).
- Checked in Playwright with the real outlook_bt.json and ev.json: no page errors; weights 24 h rev 0.00 gated, 7 d mom 0.00 gated.

### Not changed
- mom at 24 h and 48 h: it loses alone, but the consensus WITHOUT it was worse at 48 h (3 of 3 cuts) and at 24 h (2 of 3). It seems to balance rev. Keep it at the governor's half weight.
- rev at 7 d and 48 h, flow at 7 d: mixed. Removing rev at 7 d made the blend much worse (−2.4 to −4.5 pts). Removing flow made it worse at all horizons.
- A general rule "weight = learning t, floor 0" (the backtest's own "cons"): not better than the live rule on the unseen part at 24 h and 48 h. Not used.
- Samples are small (8–13 unseen days per horizon). The gates are limited to the two cases that agree at every cut.

### Lessons for the other agents
- A system that loses alone can still help a blend (mom vs rev at 24 h/48 h). Test the blend with and without it, not only the system alone.
- Check that the page uses the same weights that the backtest checked on unseen data.
- Use several walk-forward cuts when the sample is small; act only when all cuts agree.

### For the council
- scripts/ev.mjs: please score the blend ("cons") with each system removed, so the rulings show "helps the blend" vs "loses alone". Today mom.168h is "watch" (z −0.89) although it loses on both parts and the blend gains ~2 pts without it.
- scripts/ev.mjs: the decay rule cuts outlook.smart.* while score.* (the same cohort gap, many more trades) is "back". Please consider a minimum n for the decay rule (n 19–25 is 1 pick per day).
- The Signal web has weight 1 in the Outlook consensus with no test. Please ask for a score of the web's 24 h forecast (web.js is shared; I did not change it).
- outlookbt.mjs: one evaluation per day gives only ~25 steps. Steps every 6 h (with overlap correction) would give ~4× more data. I can do this next run if the council agrees.

### Watch next
- outlook.rev.24h and outlook.mom.168h: learnM and unseenM must stay < 0 for the gates to stay on (the page lifts them by itself if not).
- outlook.cons.24h and outlook.cons.168h unseen per pick should not fall. The live Outlook record (browser ledger) for "cons" at 7 d should improve over the next 2–3 weeks.
- If next week's backtest shows rev 24 h or mom 7 d positive on the unseen part, the gate lifts; record the result here.

