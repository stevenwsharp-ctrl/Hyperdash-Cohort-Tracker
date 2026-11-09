# Council notes (newest first)

## 2026-11-09 · Council

### Shipped today
- SOXX Sniper: yes, live. The time gate of the paper bots now uses only the ideas that the bots can trade (before, 5 muted, losing ideas closed half hours where the squeeze idea wins). Market holidays and 1 PM early closes. Pages build: success. The new code trades from the first run of Nov 10.
- Cohort Sniper: yes, live. The signal rating uses the same rule as the scorecard (24 h return with minus without). The Outlook backtest steps every 6 h (from Sunday). The data relay starts the bet lab when its schedule is skipped. Pages builds: success.
- LETF Sniper: yes, live. HARD turns follow the mute of all turns (the follow flag had come back). The 🚀 flag, alert and X post say "no proven edge, do not chase". Pages build: success.
- Scorecard (council): see "Changes I made". EV governor run 5 (23:18 UTC): success, all 24 LETF markets read.

### Scoreboard (ev.json 23:18 UTC, with Nov 9 data)
- SOXX: 12 muted, 2 cut, 6 backed. Gain: spot squeeze 10:00–10:30 ET, +0.48 % per trade (n 305, 6 days, both halves > 0). Loss: funds breakout −0.26 % per trade (muted). Paper bots live today: spot 8 trades +$44; funds 15 trades −$13; both 16 trades −$31. Live funds and both bots go to CUT (−0.24 % and −0.20 % per trade, n 19 and 16).
- Cohort: 1 muted, 20 cut, 10 backed. Gain: gap score ≥ 40, +1.07 % in 24 h (z 8.6). Loss: Outlook momentum 48 h, −2.06 % per pick (cut). New: bet lab vol-squeeze 1 d MUTE, stage 2 d BACK.
- LETF: 2 muted, 3 cut, 2 backed. Fade a turn with a limit entry fell from BACK to WATCH: Nov 9 (day 1 of 3) gave −0.01 % (n 11). The 🚀 rule went to CUT (older half +0.30 %, newer half −0.19 %). Fast 5-minute move: CUT. New fade tests for fast 1- and 5-minute moves are BACK, but n is small (31 and 20).

### Agents
- SOXX agent: ran, good work. It found that the time gate closed a winning half hour, and it did a walk-forward check (fit on the days before each test day). It did not ship a lower gate count because it would pick it on the test days. Correct. No revert.
- Cohort agent: ran, good work. Rating and scorecard now use one rule (walk-forward: same sign on 10 of 10 conditions). It found that the bet lab schedule was skipped and added a guard. No revert.
- LETF agent: ran, good work. It found that a CUT on HARD turns brought back a flag that the MUTE on all turns had removed. No new threshold; no fade flag before 3 new days. No revert.
- Checks by me: node --check on all changed files, tests/engines.test.mjs ALL PASSED, Playwright 0 page errors on SOXX, Mastermind, LETF (live and ?demo) and Cohort, also with the new ev.json. All shared files are the same in the three repos (also fb.js).
- All agents kept the order rules (limit entries that count only when touched, no new stops, same bet size, long-only bots).
- Yesterday's tasks: all done, except the Signal web 24 h log (Cohort, needs a design). Yesterday's "Watch next": the relay ran the whole day (yes). fade.rev.15m stayed BACK (no: WATCH after day 1).

### Lessons shared
- A change of the evidence rule can silently lift mutes. The 8-day switch to a day z (my rule of Nov 8) would have unmuted 10 losing SOXX ideas tonight. Run a new rule on today's files before it goes live, and compare the rulings.
- A ruling on a group must reach its parts (LETF: HARD turns inside all turns). The same holds for a gate (SOXX: gate on the ideas that trade). Cohort: check that lab rulings reach every page that shows the lab ideas.
- 9 of the 10 largest SOXX-universe swings on Nov 9 started at 9:30 ET, before any bot signal. LETF: the "open" window (9:30–10:30) of the fade tests is the place to look for a first-30-minutes rule.
- A good result on the days where you found it is not proof. fade.rev.15m was BACK on 7 days and failed on the first new day.

### Tasks for tomorrow
- SOXX agent: 1) Check the 9:10 ET run uses 3de4bf1: gates.times S has 12:00–12:30. 2) The scorecard now scores each squeeze half hour (half.*). Funds 11:30–12:00 is MUTE (n 175, z −3.2 over 5 days, both halves < 0) but the gate needs 200 trades. Do a walk-forward test: gate on half.* mutes from the days before, against the 200-trade rule. Ship only if it wins on newer days. 3) Live funds bots lose (−0.24 %/trade) while squeeze funds paper versions win (+0.17 %). Find the gap (fills, inverse and non-semi funds, the stops on FAS, PLTU, TSLQ, TZA, LABD).
- Cohort agent: 1) Signal web 24 h forecast log, so a forward test can start (no change to web.js; ask me if web.js must change). 2) Sunday: read outlook.without.<sys>.<h>h in the scorecard (now scored) and decide the 24 h gate with it. 3) Bet lab: vol-squeeze 1 d is MUTE and stage 2 d is BACK; check every place that shows lab ideas follows the ruling.
- LETF agent: 1) fade.rev.15m failed day 1 (Nov 9). The 3-new-day count starts again from Nov 10. Use fade.rev.15m.days in the scorecard. Same rule for fade.fast1m and fade.fast5m (BACK on small n, found on the same days). 2) 🚀 is now CUT (decay) and the alert level fast.15m.alert is −0.05 % (n 102). Check the page text for CUT. If the next scorecard mutes it, stop the 🚀 push alert. 3) fade.rev.15m.tgate (window chosen on the older half, scored on the newer half): only "mid" is kept, +0.17 %, z 0.9, not proven. No time window yet.

### Changes I made
- Hyperdash-Cohort-Tracker 6aff7e4 (scripts/ev.mjs, update.yml):
  1. SOXX ideas: a negative idea keeps the trade-level z for its mute after 8 days. A BACK needs z per signal ≥ 2 and a day z ≥ 2. Check: with today's files, the old code turned 10 muted ideas to WATCH or CUT (the bots trade every idea with factor not 0); the new code keeps all 10 muted. Spot squeeze: trade z 9.8, day z 0.1, so WATCH, not BACK.
  2. New items (agents asked for them): half.<class>.<idea>.<half hour> (SOXX); fade.fast1m.15m, fade.rev.15m per day, fade.rev.15m.tgate, fast.15m.alert (LETF); outlook.without.<sys>.<h>h (Cohort, from Sunday).
  3. update.yml: each data run starts the EV governor when ev.json is older than the last 21:17 UTC and no EV run is busy. The schedule was 3.7 h late on Nov 8 and did not start on Nov 9.
- Checks: node --check; an offline run with today's files and mock bars; YAML; the live EV run (success, 16 s, 24 of 24 markets); Playwright with the new ev.json on all sites (0 page errors).
- No shared file change. No revert.

### What Steven should know
- Nothing to paste. No Worker change.
- The bots trade only the squeeze idea. Spot made money today (+$44). Funds lost (−$13) and the combined bot lost (−$31); the scorecard now cuts both live funds bots. A decision for you: if the funds bots still lose after the SOXX agent's check, you can stop the funds bots and keep only spot.
- LETF: do not trade the fade of a turn yet. It failed on the first new market day.
- From tomorrow the scorecard is made each day before the agents run, also when GitHub skips its schedule.

## 2026-11-08 · Council

### Shipped today
- SOXX Sniper: yes, live. Paper bots: a stop that is hit in the fill bar now ends the trade (bug fix). Each run starts the next run (the relay), so the bots can trade the whole day. A dated record of paper trades (dated.json). Big swings: "caught" now means a live trade. Pages builds: success.
- Cohort Sniper: yes, live. Outlook: reversion and momentum at 24 h are gated as one group; momentum at 7 d is gated. Pages builds: success.
- LETF Sniper: yes, live. Reversal: one reading per underlying for every fund. When the rule is muted, the card starts closed and grey. Pages builds: success.
- Scorecard (council): one test per underlying, new limit-entry fade tests, a test for the 🚀 rule, a z per signal for the SOXX ideas, and a guard for failed data. Live (EV governor run 3, 23:18 UTC, success).

### Scoreboard (ev.json 23:18 UTC)
- SOXX: 10 muted, 1 cut, 2 backed. Gain: best version funds sqz, limit 1 ATR, t6a, +34.5 bps (n 65). Loss: funds brk −28.6 bps per trade (muted). Paper bots live: spot n 3, +2 bps; 2×/3× funds n 4, −79 bps. All trades: spot −$0.13, funds −$1.39 per trade. The bots now trade only sqz.
- Cohort: 1 muted, 17 cut, 9 backed. Gain: gap score ≥ 40, +1.07 % in 24 h (z 8.6). Loss: Outlook momentum 48 h, −2.06 % per pick (cut).
- LETF: 2 muted (rev.all.15m, fast.1m.15m), 1 cut (rev.hard.15m), 1 backed (fade.rev.15m). Gain: fade a turn with a limit entry, +0.16 % per trade after cost (n 99, both halves +0.16 %, fill 69 %). Loss: follow a fast 1-minute move, −0.36 % (n 44).
- Changed today: SOXX sqz spot and funds back → watch (z per signal 1.2, not proven). LETF rev.hard mute → cut, fast.5m mute → watch (n 12), fast.1m cut → mute.

### Agents
- SOXX agent: ran 2 times, good work. It found the true cause of the loss in the last hour (GitHub started the runs late), fixed it, and found a stop bug. Checks pass (node --check, tests ALL PASSED, 0 page errors). No revert.
- Cohort agent: ran 2 times, good work. Walk-forward with 12 checks (steps 6–24 h, cuts 50–70 %). Problem: the gate rule reads the same unseen part that the check used. The real test is the next weekly backtest. No revert.
- LETF agent: ran 2 times, good work. It found that the mute did not reach the card and the scanner, and that a fund and its inverse fund could disagree. No revert.
- All three kept the order rules: limit entries that count only when touched, no new stops, the same bet size, long-only bots.
- "Watch next" items: this is the first council note. All items are for Monday (market closed today). I check them tomorrow.

### Lessons shared
- Count independent events, not rows. SOXX: 15 versions trade each signal (z too large by up to √15). LETF: SOXL+SOXS and other pairs counted one move two times. The scorecard now corrects both.
- Use past data only for a scale. The LETF fast-move test used the σ of the whole day (a look-ahead). Fixed. SOXX agent: check that ATR and σ in bots.mjs use only past bars.
- A "today" filter breaks on weekends and after midnight (SOXX). Test against the time window of the result.
- A mute must reach every place that shows a rule (LETF). A gate must use the ideas that the bot can trade (SOXX).
- When two systems offset each other, gate them as a group (Cohort).

### Tasks for tomorrow
- SOXX agent: 1) Check the relay: dispatched runs through the night, a live run from 9:30 ET, dated.json on branch bots with past days. 2) When dated.json has 8+ days, the scorecard uses a z per day for the ideas by itself; then do the walk-forward test of the sqz time gate. 3) Add market holidays to the relay (Nov 26 closed, Nov 27 close 1 PM ET).
- Cohort agent: 1) Yes to 6 h steps in outlookbt.mjs: same keys, t corrected for overlap (divide by √(24/6) or use Newey-West). ev.mjs needs no change. 2) Use one rule for conditions: the return difference (the EV rule). Change the live factors in backtest.mjs and check it on the train/test split. 3) Write "blend without X" results to outlook_bt.json so I can score them; start a log of the Signal web 24 h forecast, so a forward test can start.
- LETF agent: 1) fade.rev.15m is backed, but the idea came from the same 7 days. Do not add a fade flag until it stays backed on 3 new market days (Nov 9–11). Then add it with a limit entry and a stated stop. 2) Check the page text for the new rulings (fast.1m mute with the opposite reading; fast.5m watch; rev.hard cut). 3) 🚀 rule: n 137, −0.02 % per trade, halves disagree: no edge. Make the alert say "no proven edge, do not chase", or ask for more data.

### Changes I made
- Hyperdash-Cohort-Tracker 12d4348 (scripts/ev.mjs): LETF tests on 24 underlyings (each one time) and σ from the last 120 minutes only; new items fade.rev.15m, fade.fast5m.15m (limit entries, fill rate, time-of-day splits, cost 0.02 % of the underlying) and fast.15m.15m (9 long funds, cost 0.05 %); SOXX idea zSig = z/√versions, a "back" needs zSig ≥ 2, a z per day when dated.json has 8+ days; swings: swingDay, caught (live), caughtBt (replay); a failed source keeps its last good block (marked stale), so a failed fetch cannot lift the mutes. Checked offline with mock data (normal, Yahoo blocked, dated) and live in the EV governor run. All 3 sites: 0 page errors with the new ev.json.
- Shared files: all identical in the three repos. No change.
- Not done: layout.js move of the LETF reversal card (the card now closes to one line when muted; small value). A minimum n for the decay rule (for Outlook items the recent half is the unseen part; a loss there is the out-of-sample evidence).

### What Steven should know
- Nothing to paste. No Worker change.
- The scheduled EV governor run (21:17 UTC) did not start today; the push runs did. I check it tomorrow.
- The bots now trade only the squeeze idea. All other ideas lose money on the paper record.
- LETF: fading a turn with a limit order looks good (+0.16 % per trade), but it is not yet proven on new days. Do not trade it yet.
