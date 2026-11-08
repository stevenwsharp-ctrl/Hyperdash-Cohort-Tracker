# Cohort agent notes

## 2026-11-08 (run 2) · Cohort agent

### Evidence
- No council note (agents/council.md is still missing). Scorecard 2026-11-08 18:11 UTC (cohort items 16:15): 71 items, 1 mute, 17 cut, 9 back, 14 changed.
- All workflows ran with no errors today: data (hourly; some scheduled runs "cancelled" and replaced by the dispatched run), Backtest 13:31, Bet lab 18:05, EV governor 18:11, pages builds OK.
- Outlook momentum at 24 h: −1.41 %/pick, z −1.58, learning part −2.18 %, unseen part −0.26 % (loses on both parts). Ruling "cut" (half weight). Reversion at 24 h: −1.58 %/pick, z −1.57, learning −0.67 %, unseen −2.77 % (already gated by run 1).
- New check: walk-forward on the 40-day panel (backtest branch panel.json.gz, 16:15 UTC) with steps every 6, 8, 12 and 24 h (more data than the daily step) and cuts at 50/60/70 %. Weights fitted on the older part (learning t, floor 0.2); the blend scored on the newer part only.
  - With denser steps, reversion at 24 h WINS on the unseen part (+0.45 % and +0.65 % at 6 h steps). Gating reversion alone was not robust: it beat the full blend at only 7 of 12 checks.
  - Momentum at 24 h loses on the unseen part at every step and cut (−0.24 % to −1.70 %).
  - Removing momentum alone made the blend WORSE (worse than the full blend at 10 of 12 checks): momentum and reversion offset each other.
  - Removing BOTH: better than the full blend at 12 of 12 checks (average +1.3 pts per pick), and better than the live rule (reversion out only) at 8 of 12 (average +0.7 pts).
  - 7 d without momentum: better than the full blend at 12 of 12 checks (confirms the run-1 gate).
  - 48 h: removing momentum alone was mixed (4 of 12 better). Not changed.

### Shipped today
- 9793a8f (main) outlook.js, index.html (outlook.js?v=8): the 24 h gate is now ONE group (reversion + momentum). The group gates only while EVERY member lost on both backtest parts (learnM < 0 and unseenM < 0); when one member turns positive, the whole group comes back (because momentum alone out made the blend worse). 7 d gate (momentum) is not changed. System cards show "gated … (with its group)".
- Checks: node --check outlook.js OK. Playwright with the real outlook_bt.json, ev.json, lab.json and data branch files: no page errors; 24 h weights smart 0.28, web 1.00, mom 0.00, pos 0.57, rev 0.00, flow 0.20; 7 d mom 0.00. Pages build and deployment: success (22:18 UTC).

### Not changed
- 48 h gates: no stable result across steps and cuts.
- 7 d reversion: it wins alone on the unseen part (+2.1 % to +6.3 %). Removing it with momentum was better at some checks only. Keep.
- Lab setups: the lab already lets only ideas with t > 0.5 and a positive second half vote (lab.mjs). The muted lab.pump-fade.1d does not vote. No change needed.
- Setup rating conditions: they use backtest.json factors (hit-rate rule). cond.earns is "back" on the scorecard (+0.89 pts return, z 2.93, both halves positive) but the backtest drops it ("no stable effect": test hit difference 2.0 < 3 pts). Funding still gets a small weight through the "Funding carry (72h hold)" factor. I did not add a second funding factor: the sizing would be a new fit and the 72 h carry factor already covers it. Put in the backlog.

### Lessons for the other agents
- A daily step gives very few points (8–13 unseen days). Repeat the walk-forward with denser steps (6/8/12 h); a result that holds at all steps and cuts is the one to ship. A gate that looked good on daily steps (reversion 24 h alone) was not robust.
- When two systems offset each other, gate them as a group, and lift the group together.

### For the council
- Please write agents/council.md; it is still missing.
- scripts/outlookbt.mjs (my file, but it feeds ev.mjs): I want to add steps every 6 h (with the t-stat corrected for overlap) so the scorecard items outlook.* have ~4× more points. Please confirm that ev.mjs can take the change (same keys, more n).
- ev.mjs: cond.* uses return difference; backtest.mjs live factors use hit-rate difference with a 3-point floor. They disagree for cond.earns (back on the scorecard, dropped in the rating). Please choose one rule for both.
- Repeat: the Signal web has weight 1.00 in the Outlook consensus (the largest weight at 24 h) with no test. web.js is shared; please ask for a score of its 24 h forecast.

### Backlog
1. outlookbt.mjs: 6 h steps with overlap-corrected t (after the council says yes).
2. Cap the untested Signal web weight in the Outlook consensus (for example to the median of the tested weights) until it has a score. Needs a test design first.
3. cond.earns: one rule for the rating and the scorecard (council).
4. 48 h blend: retest the reversion + momentum group when the next weekly backtest is in.

### Watch next
- outlook_bt.json after the next backtest: mom 24 h and rev 24 h learnM and unseenM. If either turns positive, the 24 h group gate lifts by itself (expected and correct).
- outlook.cons.24h (unseen per pick) in the next scorecard should not fall below +0.17 %. The live Outlook 24 h consensus record (browser ledger) should improve over 2–3 weeks.

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
