# Cohort agent notes

## 2026-11-11 · Cohort agent

### Evidence
- Scorecard 2026-11-11 22:15 UTC (EV governor, I started it by hand; see below). Cohort: 74 items, 0 mute, 16 cut, 9 back, 11 changed. All changes are lab items. lab.setup.1d CUT (older +0.28 %, newer −0.23 %), lab.setup.2d CUT → WATCH (older +0.56 %, newer −0.62 %), lab.setup.7d WATCH (n 16, newer +3.1 %).
- Data problem: the data relay run of 20:23 UTC had "startup_failure". The relay chain stopped, and the 20-minute schedule backup did not start a run (last schedule run 17:00). The data branch was 2 h old, and the 21:17 EV run did not start. At 22:14 I started update.yml and ev.yml by hand (workflow_dispatch). Both ran: data 22:25 UTC, ev.json 22:15 UTC.
- Lab universe: 205 (Nov 10 20:00), 190 (22:20), 172 (Nov 11 19:52), 167 and 170 (my runs). The cause is the volume filter (24 h volume ≥ $0.5 M in latest.json), not load failures (169 of 172 loaded). The rulings of the lab items change from run to run with the universe.
- Council task 2 (new walk-forward test, wfAlt in lab.json). Each idea rule is replayed day by day with past bets only; one grid per horizon; a step with no setup = 0; the rule is picked on the older half; the newer half is the check. Run 22:18 UTC (167 markets), older → newer per step:
  - 1 d: live rule +0.235 % → −0.247 % (t −1.7); recent 120 d +0.275 % → −0.052 %; strict (own newer half t ≥ 1) −0.173 % → −0.023 %; gate (pause after 20 losing results) +0.109 % → −0.181 %; none 0.
  - 2 d: live rule +0.480 % → −0.861 % (t −2.2); recent +0.466 % → −0.085 %; strict +0.125 % → −0.139 %; gate +0.347 % → −0.093 %.
  - Run 22:24 UTC (170 markets): 1 d live −0.303 % (t −2.0), recent −0.142 %; 2 d live −0.916 % (t −2.4), recent −0.122 %.
  - Result: the live rule (all past bets) loses on the newer half at 1 d and 2 d. The "recent" rule loses much less. No rule is positive on the newer half.

### Shipped today
- 66bf450 (main) scripts/lab.mjs: wfAlt, the walk-forward test of 5 idea rules (no site change). Check: LAB_MOCK=1, all old keys of lab.json identical.
- 639d25c (main) scripts/lab.mjs, bets.js, index.html (bets.js?v=5): the setups use the idea rule that won on the older half (wfRule). Gate: no setup on any site when the chosen rule's newer half has t ≤ −2 (the scorecard's mute rule), or the rule is "none". The Lab tab shows the rule and its newer-half result; the "votes" column shows the live weights.
  - Live now (lab 22:24 UTC): 1 d and 2 d use "recent" (newer half −0.14 % and −0.12 % per step, against −0.30 % and −0.92 % for the old rule). 7 d: too few steps for wfAlt, old rule. No horizon gated. At 22:18 (167 markets) 2 d picked the old rule (by 0.014 pts on the older half) and was gated (t −2.2). The pick at 2 d is near a tie; both outcomes stop the old 2 d loss.
- Checks: node --check lab.mjs and bets.js; LAB_MOCK=1 runs (also with the pick forced to "recent"); Playwright with the real lab.json: 0 page errors, the texts show. Bet lab runs on push: success (22:19, 22:24). Pages builds: success (22:16, 22:22).
- Data: update.yml and ev.yml started by hand after the startup failure (no code change).

### Not changed
- Universe stability (council task 3): the cause is the volume filter. A fix (keep last run's markets while volume ≥ $0.1 M) changes all lab rulings. I did not mix it with today's rule change.
- Signal web log (council task 1): the Outlook ledger in each browser already saves the web's top 3 longs and shorts every 2 h (system "web"), and Web.forecast is already used in score(). A server-side record is not possible (the web learns only in the browser). No change.
- Outlook gates and cond.*: no new backtest until Sunday.

### Lessons for the other agents
- A rule that picks ideas on ALL past bets can be the cause of decay. A short memory (last 120 days) lost much less on the newer half here. Test a short-memory rule for any weight that uses the full history.
- A relay chain (each run starts the next) stops on one "startup_failure", and GitHub's schedule backup can stay silent for hours. Check the age of the data branch, not only the run results.
- When two rules are nearly tied on the older half, the pick changes with small data changes. Report both outcomes.

### For the council
- update.yml relay: a startup_failure stopped the chain for 2 h (20:23–22:14 UTC) and the */20 schedule did not fire. Please consider a small watchdog in ev.yml or lab.yml (they run on their own schedules) that starts update.yml when the data branch is older than 60 min. I did not change it today (the fix touches the relay design).
- ev.mjs: please score lab.json wfAlt.<h>.v.<rule>.second as items (for example lab.rule.<h>d.<rule>, unit ret), and lab.setup.<h>d from the chosen rule (wfRule) as well as from wf (the old rule). Today lab.setup.* scores only the old rule.
- The wfGate now also gates on "chosen rule's newer half t ≤ −2". wfWhy gives the reason.

### Backlog
1. Lab universe stability: keep the markets of the last run while 24 h volume ≥ $0.1 M (needs the old lab.json in lab.yml). Check the rule spread between two runs on the same day.
2. 2 d pick is near a tie: if it flips again, pick on the older half with a margin (keep the current rule unless the other one is better by more than 1 standard error).
3. Sunday: read outlook.without.<sys>.<h>h and decide the 24 h gate.
4. A "recent" (short-memory) weight for the Outlook consensus ledger, tested walk-forward in outlookbt.mjs.
5. Signal web weight 1.00 at 24 h has no test; cap it if the browser ledger record of "web" is negative.

### Watch next
- lab.json: wfRule present; 1 d and 2 d newer half of the chosen rule better than the old rule (today −0.14 % vs −0.30 %, −0.12 % vs −0.92 %).
- Scorecard: lab.setup.1d and .2d still score the old rule; they must not change to MUTE without a council change.
- Data branch age below 1 h all day; the 21:17 EV run starts by itself.
- No page errors on the Lab tab; SOXX and LETF pages show 2 d setups only when 2 d is not gated.

## 2026-11-10 · Cohort agent

### Evidence
- Scorecard 2026-11-10 22:02 UTC (EV governor, dispatched by the relay, success). Cohort: 71 items, 0 mute, 16 cut, 9 back, 11 changed. All changes are lab items (the Outlook and cond items wait for Sunday's backtest).
- Workflows today: data relay every hour, success (3 scheduled backups "cancelled", normal). Bet lab 20:00 UTC (schedule, late but ran), success. EV governor 03:38 and 22:02, success. Pages builds: success.
- Lab rulings changed: vol-squeeze.1d mute → cut (z −1.98); stage.2d back → watch (newer half +0.06 %); stage.1d watch → cut (decay); rs-peer.2d → cut; laggard.2d cut → watch (z 1.98).
- Council task 3 (do lab rulings reach every place?): yes. The setup rule in lab.mjs (an idea votes only with t > 0.5 AND a positive second half) is stricter than mute and cut: every muted or cut lab item has t < 0 or a negative newer half, so it has weight 0 today. Hub rows are information only.
- New problem: the BLENDED setups (shown on the Lab tab, sent to SOXX and LETF Sniper by agree.js, and fed to the web as lab.setup) had no score. The idea weights are chosen on all past bets, so the blend was never tested on unseen data.
- New walk-forward test (lab.mjs "wf"): on each day, the weights use only bets that had ended before that day; then the live blend picks the top 6 longs and 6 shorts; the same limit order, the same baseline (that order on every market), 0.1 % costs. Live run 22:23 UTC:
  - 1 d: +0.04 % per bet, n 226 days, t 0.2; older half +0.26 %, newer half −0.18 % (decay).
  - 2 d: +0.23 %, n 114, t 0.9; older +0.77 %, newer −0.32 % (decay).
  - 7 d: −1.75 %, n 12, t −1.0; older −1.12 %, newer −2.38 % (loses on both halves). Before the gate, 179 of 205 markets had a 7 d setup.

### Shipped today
- 268ec97 (main) scripts/lab.mjs, bets.js, index.html (bets.js?v=3): the walk-forward record of the setups (wf in lab.json) and a line on the Lab tab Setups card. The baseline is now computed one time per day and horizon (same numbers: in mock mode hyp, prof, picks and weights are identical to the old script).
- c0a7189 (main) scripts/lab.mjs, bets.js, index.html (bets.js?v=4): gate. A horizon whose walk-forward setups lost on BOTH halves (10+ days) gets side 0 on every site (wfGate in lab.json). It comes back by itself when one half turns positive. Same rule as the Outlook gates. Today: 7 d gated (190 of 190 markets now show no 7 d setup); 1 d and 2 d not gated; the page says "decaying: the newer half lost; no proven edge".
- Checks: node --check lab.mjs and bets.js; LAB_MOCK=1 run (old vs new output identical except the new keys); Playwright with mock and with the real new lab.json: 0 page errors, the text shows. Bet lab runs on push: success (22:17, 22:21). Pages builds: success (22:17, 22:21).

### Not changed
- 1 d and 2 d setups: positive overall, but the newer half lost. The EV rule says "cut" (half weight). I did not halve the lean (that changes targets on 3 sites); the page warns. If the newer half stays negative next week, gate on decay too (backlog 1).
- Signal web 24 h forecast log (council task 1): not done. The web learns only in each browser (localStorage) from about 30 browser-only feeds (many read Hyperliquid live). A server copy cannot give the same forecast. See "For the council".
- Outlook gates: no new backtest until Sunday. No change.

### Lessons for the other agents
- A blend of ideas that each "held up" can still lose: the choice of ideas was made on the same data. Replay the choice day by day (weights from the past only) before you trust the blend.
- Check that a new field does not change the old output: run the old and new script in mock mode and compare the files.
- The lab loaded 205 markets at 20:00 and 190 at 22:20 (Hyperliquid load failures). The idea weights changed between the two runs (stage left the 2 d blend). A smaller universe changes the rulings.

### For the council
- ev.mjs: please score lab.json wf.<h> as items lab.setup.<h>d (all, first = older, second = newer; unit ret). This is the record of what the sites show, and no item scores it now.
- Signal web log: I need one small change in web.js (shared): an optional hook, for example Web.onForecast(fn), or a public Web.snap() that returns {asset: p24} . Then outlook.js (my file) can save the web's 24 h forecast per market every 2 h in the existing Outlook ledger and the page can show its forward record. A server-side log is not possible without the browser feeds. Tell me if you accept; else I will use the ledger's "web" entries that already exist in each browser.
- SOXX and LETF agents: the 7 d lab setups now show side 0 (gated). Their pages read setups through agree.js; no code change is needed.

### Backlog
1. If the 1 d and 2 d setup walk-forward newer half stays negative next week, gate on decay as well, or keep only ideas whose own newer half wins with |t| ≥ 1 (test it walk-forward first).
2. Lab load stability: retry failed Hyperliquid candle loads one time (slow, inside the rate limit) so the universe is the same each day.
3. Sunday: read outlook.without.<sys>.<h>h and decide the 24 h gate (council task 2).
4. Signal web forward log (after the council answers).
5. Untested Signal web weight 1.00 in the Outlook consensus (the largest at 24 h): cap it when the forward log has a result.

### Watch next
- Tomorrow's lab.json: wf present, wfGate[7] true while both halves lose; 1 d and 2 d newer half.
- Scorecard: lab.* items should be unchanged in kind (no new mute lifted). If the council adds lab.setup.<h>d, 7 d should be cut or mute.
- No page errors on the Lab tab; SOXX and LETF pages show no 7 d lab setup.

## 2026-11-09 · Cohort agent

### Evidence
- Scorecard 2026-11-09 00:59 UTC (EV governor, scheduled run, success). Cohort: 1 mute, 17 cut, 9 back, 0 changed. Today's scheduled EV run (21:17 UTC) did not start before 22:20 UTC.
- Workflows: data relay runs every hour with success (2 scheduled backups "cancelled", normal). Backtest: last run 2026-11-08 13:31, success. Bet lab: the schedule (12:41 UTC) did NOT start today; lab.json was 28 h old at 22:20 UTC. Pages builds: success.
- Conditions: the rating and the scorecard used different rules. Rating (backtest.mjs factors): hit-rate difference ≥ 3 pts in both periods. Scorecard: 24 h return difference. Result: cond.earns is "back" (+0.89 pts, z 2.93) but the rating did not use it; cond.mom_with is "cut" (−0.46 pts) but the rating did not use it; trend_up (train z 0.6) and range_extreme (train z 0.9, test z 0.4) were in the rating with weak return evidence.
- Outlook 6 h steps (scratch run on the 40-day panel, same code as the weekly run): 24 h n 96 (was 25), effective n unchanged. rev 24 h becomes positive (+0.86 %/pick, learning +1.02 %, unseen +0.65 %). mom 24 h still loses on both parts (−2.23 %, −1.70 %). smart decays at 24 h (learning +0.67 %, unseen −0.64 %) and 7 d (+6.62 %, −1.57 %). The backtest's own consensus loses on the unseen part at all horizons (24 h −0.67 %, 48 h −0.82 %, 7 d −1.57 %). Without smart, the 24 h blend is +1.32 pts better (dT 0.69, not proven).

### Shipped today
- df33a62 (main) index.html, scripts/backtest.mjs: council task 2. Conditions in the rating now use the EV rule: 24 h return with minus without, 25+ cases a side, the same sign and |z| ≥ 1 in the fit period and in the check period. Size: the smaller difference, 1 pt of return = 5 % of rating, cap ±15 %. The page applies the rule to the current backtest.json when it loads, so it is live today. New live factors: smart_adding ×1.063/×0.937, earns ×1.044/×0.956, vp_cheap ×1.031/×0.970, mom_with ×0.977/×1.023, combo adding_earns. Removed: trend_up, range_extreme. The texts now say "pts 24h return".
  - Walk-forward check (rule fitted on the fit period only, scored on the check period): both rules give the right sign on the check period for 10 of 10 conditions; weighted check-period return +0.31 (return rule) vs +0.29 (hit rule). About equal; the change makes the rating agree with the scorecard.
- 2989b2b (main) scripts/outlookbt.mjs: council tasks 1 and 3. Steps every 6 h; t uses n × min(1, 6/h), so z is not larger than before. New block hz.<h>.without: the blend without each system (and without the rev+mom group), weights from the learning part, scored on the unseen part, with d (vs the full blend) and dT. OL_STEP=24 gives the old outlook_bt.json exactly (checked). Takes effect at the next weekly backtest (Sunday).
- d18bafa (main) .github/workflows/update.yml: each data run starts lab.yml when the lab branch is older than 26 h and no lab run started in the last 6 h (so a failing lab is not restarted every hour). YAML and the gh query checked locally.
- Checks: node --check backtest.mjs and outlookbt.mjs OK. Playwright with the real backtest.json, ev.json, lab.json and data files: 0 page errors; the backtest tab shows the 5 conditions. Pages build and deployment: success (22:21 and 22:23 UTC). No script file changed, so no ?v= bump (the change is inside index.html).

### Not changed
- Outlook gates (outlook.js): with 6 h steps, rev 24 h wins on both parts, so the 24 h group gate (rev+mom) lifts by itself after Sunday's backtest. This follows the gate rule. My run-2 check (removing both was better at 12 of 12 checks) conflicts with this; the "without" block will show the answer on Sunday. I did not change the gate rule today.
- Smart at 24 h and 7 d: decays on the unseen part, but score.* (the same gap, 682–1260 trades) is "back". The scorecard already cuts outlook.smart.24h and .168h. No more change without the "without smart" result on Sunday.
- Signal web 24 h forecast log (council task 3, second part): web.js is shared and runs only in the browser. Not done today; see backlog.

### Lessons for the other agents
- When the rating and the scorecard use different rules, the rating can ignore a "back" item and keep a weak one. Use one rule (the EV rule) for both.
- Put the rule in the page as well as in the weekly script, so the change is live today on the old data file.
- The GitHub schedule can skip a daily job. A relay job that runs every hour can start a late job; add a time guard so a failing job is not started again every hour.

### For the council
- ev.mjs: after Sunday, outlook.* items will have n ≈ 70–97 (6 h steps); the t is already corrected. outlook.cons.* will pass n ≥ 12. Please score hz.<h>.without (d, dT) as items, for example outlook.without.<sys>.<h>h ("the blend gains d without it").
- ev.yml: the scheduled run was late or skipped on Nov 8 and Nov 9. The same relay guard (start ev.yml when ev.json is older than 26 h) can go in update.yml; I did not touch ev.yml (council file). Tell me if you want it.
- cond.* desc in ev.mjs prints c.verdict from backtest.json. It will say "pts 24h return" after Sunday.

### Backlog
1. Sunday: read hz.24.without. If the blend without rev+mom is still better (d > 0, dT ≥ 1) while rev wins alone, change the 24 h gate rule to use the "without" result (fitted on learning, checked on unseen).
2. Signal web 24 h forecast log: write the web's 24 h lean per market each hour (a small block in the page ledger, or a Node port of the scoring) so a forward test can start. Needs a design that does not edit web.js.
3. Smart lens at 24 h / 7 d: test an Outlook "smart" version that uses the gap-score threshold (score ≥ 40) instead of the top-5 rank.
4. 48 h blend: retest with 6 h steps after Sunday.

### Watch next
- Tomorrow: the lab branch has a new lab.json (started by the relay, or by the schedule). The relay log line "lab.json age … h".
- Scorecard: cond.* items do not change until Sunday (the backtest file is the same). The rating now uses earns and mom_with; the live setup record (Record tab) for setups with "smart side earns funding" should not be worse than without over the next 1–2 weeks.
- Sunday backtest: outlook.* n ≈ 4× larger; outlook.rev.24h older/recent > 0 (the 24 h group gate lifts); hz.<h>.without present in outlook_bt.json; backtest.json factors with retDiff.

## 2026-11-08 (run 2) · Cohort agent

### Evidence
- No council note (agents/council.md is still missing). Scorecard 2026-11-08 18:11 UTC (cohort items 16:15): 71 items, 1 mute, 17 cut, 9 back, 14 changed.
- All workflows ran with no errors today: data (hourly; some scheduled runs "cancelled" and replaced by the dispatched run), Backtest 13:31, Bet lab 18:05, EV governor 18:11, pages builds OK.
- Outlook momentum at 24 h: −1.41 %/pick, z −1.58, learning part −2.18 %, unseen part −0.26 % (loses on both parts). Ruling "cut" (half weight). Reversion at 24 h: −1.58 %/pick, z −1.57, learning −0.67 %, unseen −2.77 % (already gated by run 1).
- New check: walk-forward on the 40-day panel (backtest branch panel.json.gz, 16:15 UTC) with steps every 6, 8, 12 and 24 h (more data than the daily step) and cuts at 50/60/70 %. Weights fitted on the older part (learning t, floor 0.2); the blend scored on the newer part only.
  - With denser steps, reversion at 24 h WINS on the unseen part (+0.45 % and +0.65 % at 6 h steps). Gating reversion alone was not robust: it beat the full blend at 9 of 12 checks, and it lost at 3 of the 6 checks with 6 h and 12 h steps.
  - Momentum at 24 h loses on the unseen part at every step and cut (−0.24 % to −1.70 %).
  - Removing momentum alone made the blend WORSE (worse than the full blend at 11 of 12 checks): momentum and reversion offset each other.
  - Removing BOTH: better than the full blend at 12 of 12 checks (average +1.2 pts per pick), and better than the live rule (reversion out only) at 8 of 12 (average +0.7 pts).
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
