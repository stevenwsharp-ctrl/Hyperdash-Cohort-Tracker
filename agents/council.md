# Council notes (newest first)

## 2026-11-11 · Council

### Shipped today
- SOXX Sniper: yes, live. The paper bots now keep every LIVE trade in the dated record (`live|<bot>@<half hour>`), so the live record does not roll after 60 trades. The bot card shows live results before 11:30 ET and from 11:30 on. Pages build: success. The new record starts when the waiting Paper bots run (push of 15f1538) runs, after the current run ends.
- Cohort Sniper: yes, live. Bet lab: the setups use the idea rule that won on the older half of a walk-forward replay. 1 d and 2 d now use "recent" (last 120 days of bets). Newer half: −0.14 % and −0.12 % per step, against −0.30 % and −0.92 % for the old rule. Pages builds and Bet lab runs: success.
- LETF Sniper: yes, live. The 🚀 phone/desktop push is off while its exact alert level loses on the newer days (−0.94 %) or its time gate is muted. The alert stays in the list with "not pushed". Fast-move lines now say "do not follow; the limit-entry fade is not proven yet" (before: "fade fast moves"). Pages build: success.
- Scorecard and data job (council): see "Changes I made". EV governor run 23:17 UTC: success, 24 of 24 markets, 9 of 9 funds.

### Scoreboard (ev.json 23:17 UTC, with Nov 11 data)
- SOXX: 12 muted, 3 cut, 8 backed. Gain: funds squeeze, limit 1 ATR, plan t6a, +0.40 % per trade (n 155, z 3.7). Loss: funds squeeze 11:30–12:00 ET, −0.44 % per trade (MUTE, shut by the gate). Paper bots live today: spot 7 trades +$12.15; funds 1 trade −$6.35 (TECS squeeze, 1:03 PM, stop); both 6 trades +$15.23. bot.spot.live is BACK (+0.38 %, n 15, z 2.1). Funds and both: WATCH (+0.10 %, +0.16 %).
- Cohort: 0 muted, 23 cut, 9 backed. Gain: signal condition "smart money adding", +1.71 % in 24 h (z 3.4). Loss: condition "momentum with", −0.46 % (cut). Lab setups: 1 d −0.01 % (WATCH, decay), 2 d −0.25 % (WATCH), 7 d gated. New: lab.setup.1d.chosen −0.14 % and lab.setup.2d.chosen −0.12 % (newer half only; both WATCH, both still below 0).
- LETF: 2 muted, 6 cut, 1 backed. Gain: fade a fast 5-minute move with a limit entry, +0.27 % (BACK, n 19; new days 0 of 3 in a row). Loss: 🚀 alert in its walk-forward time windows, −1.09 % (MUTE). Now the push is off.
- Data: the Hyperdash data relay stopped from 20:23 to 22:14 UTC (one startup failure; the */20 schedule did not start a run). The Cohort agent started it by hand. It runs again (23:11 UTC).

### Agents
- SOXX agent: ran, good work. It did all 3 tasks. It found why the live record rolled, and fixed it from the full memory (no double count on a replay). It did not unmute the funds "pull" pocket at 10:00–10:30: correct, it came from a scan of 24 cells. No revert.
- Cohort agent: ran, good work. It did the walk-forward test of 5 idea rules and picked on the older half only. It found and fixed the data relay stop. Weak point: the chosen rule still loses on the newer half (−0.14 %, t −0.9), and "none" (no setup) beat every rule there. That is less loss, not yet a gain. No revert, but see tasks.
- LETF agent: ran, good work. It stopped the push only after the second scorecard with a negative newer half (the rule set on Nov 10). It found a wrong text ("fade fast moves" from a negative follow test). The stop reads the scorecard, so it comes back by itself. No revert.
- Checks by me: node --check on all changed files; tests/engines.test.mjs ALL PASSED; Playwright 0 page errors on SOXX, Mastermind, LETF (live and ?demo) and Cohort. Shared files: all the same in the repos that use them.
- All agents kept the order rules (limit entries that count only when touched, no new stops, the same bet size, Schwab-only and long-only bots).
- Yesterday's "Watch next": SOXX gate S = 12:00–12:30 and no live funds trade 11:30–12:00 (yes). LETF 🚀 newer half below 0 again (yes, so the push stopped). fade.rev.15m: failed again (0 of 3 new days). Cohort lab.setup 1 d / 2 d: decay confirmed, rule changed.

### Lessons shared
- A long memory can cause decay. Cohort: weights from ALL past bets lost on the newer half; the last 120 days lost much less. SOXX agent: the bots choose versions on all their paper trades. Test a short-memory choice the same way. LETF agent: the 🚀 rule wins on older days and loses on newer days; it is the same pattern.
- A scan finds false winners. I now score pockets of muted SOXX ideas as shadow items (watch only). 31 pockets have EV > 0, and 6 of them would be "back" by the rule. With about 150 pockets tested, some z ≥ 2 by chance is normal. Only new days count.
- Check the age of the data, not only the run result. Cohort: a relay stopped for 2 h with no red run. SOXX: the Paper bots relay has the same design (one run starts the next); check bots.json age each day.
- A negative follow test is not a positive fade trade (LETF). SOXX agent: check that no "opposite reading" text on the bot card or Mastermind tells a reader to trade the other side.
- 10 of 30 big swings on Nov 11 started 10:20–10:30 ET (SOXX). LETF agent: check if 🚀 moves also cluster at 10:20–10:30, and how they end.

### Tasks for tomorrow
- SOXX agent: 1) Check that dated.json has `live|…` keys after the push run, and that live.<bot>.* in ev.json now show "src: dated.json" (more trades than before). 2) half.funds.pull.1 now has a newDays record from Nov 12: report it each day; no unmute before 3+ new winning days and your walk-forward test. 3) Test a short-memory version choice (for example the last 5 market days of paper trades) walk-forward against the current choice, on dated.json.
- Cohort agent: 1) lab.setup.1d.chosen and .2d.chosen are the out-of-sample record of what the sites show. If one stays below 0 on the next 2 scorecards, gate that horizon ("none" beat every rule on the newer half). 2) Check the new Data watchdog workflow: it must log "relay OK" when the data is fresh, and start update.yml only when the data is 60+ min old. 3) Backlog 1 (universe stability) before Sunday's backtest.
- LETF agent: 1) Read the new items: fade.fast1m.15m.k25 (limit 0.25σ: fill 52 %, n 13, +0.03 %, CUT for decay) and the fill per day in fade.fast1m.15m.days. A closer limit gets more fills but no edge yet. 2) Check that the 🚀 push stays off on the live page and that the alert list shows "not pushed". 3) Check if 🚀 moves cluster 10:20–10:30 ET (SOXX swing lesson) on the scorecard's tod split.

### Changes I made
- Hyperdash-Cohort-Tracker 4ad7a8a (scripts/ev.mjs, new .github/workflows/watchdog.yml):
  - SOXX request: live.<bot>.<half hour> and live.<bot>.early / .late read the new dated `live|…` keys (all live trades, z over the days). Until the keys are there, the old source (bots.json) stays.
  - SOXX request: half.<class>.<idea>.<b> for MUTED ideas, pockets with EV > 0 only, always WATCH (shadow; "ruling" shows what the rule would say). half.funds.pull.1 has a record of new days from Nov 12.
  - Cohort request: lab.rule.<h>d.<rule> (each idea rule of wfAlt) and lab.setup.<h>d.chosen (the newer half of the rule picked on the older half).
  - LETF request: fill rate per market day for fade.fast1m.15m, and fade.fast1m.15m.k25 (a fixed comparison, not a fit). fade.fast1m.15m is unchanged.
  - Cohort request: Data watchdog (every 30 min): it starts update.yml only when the data branch is 60+ min old and no update run is running or waiting. It does not call Hyperliquid.
- Hyperdash-Cohort-Tracker 308a73c (scripts/ev.mjs): no z for a live record of one trade (it showed z −6,350,000).
- Checks: node --check; offline run with mocked fetch and today's files: every old item has the same ruling, n and EV, except live.* (more trades, as intended). Live EV run 23:17 UTC: success.
- Not done: layout.js move of the LETF reversal card (small value). setupOf plan test (LETF request): next council run.
- No revert of agent work.

### What Steven should know
- Nothing to paste. No Worker change. No decision is necessary.
- The Cohort data stopped for about 2 hours tonight (20:23–22:14 UTC). It runs again, and a new watchdog restarts it if it stops again.
- The LETF 🚀 alert no longer sends a phone or desktop push. It lost on the newer days of the test. It comes back by itself when the test turns positive.
- Cohort 1-day and 2-day setups still lose a little on new data (−0.14 % and −0.12 % per bet). Do not use them alone.

## 2026-11-10 · Council

### Shipped today
- SOXX Sniper: yes, live. The paper bots' time gate also shuts a half hour when the scorecard's day rule mutes it (4+ days, day z −2 or lower, only days before the trade's day). From Nov 11: spot shut 12:00–12:30, funds shut 11:30–12:00. Pages build: success.
- Cohort Sniper: yes, live. Bet lab: a walk-forward record of the blended setups (weights from past bets only), and a gate: a horizon that lost on both halves shows no setup. Today 7 d is gated on all sites. 1 d and 2 d show "decaying". Pages builds and Bet lab runs: success.
- LETF Sniper: yes, live. Reversal card: the fast 1-minute moves show their limit-entry test; close-to-close numbers say "not a price a limit order gets"; each fade test shows its record of new market days. Pages build: success.
- Scorecard (council): new items for all three trackers (see "Changes I made"). EV governor runs 23:17 and 23:20 UTC: success, 24 of 24 markets.

### Scoreboard (ev.json 23:20 UTC, with Nov 10 data)
- SOXX: 12 muted, 0 cut, 7 backed. Gain: spot squeeze 10:00–10:30 ET, +0.48 % per trade (n 305, day z 2.1). Loss: funds squeeze 11:30–12:00, −0.44 % per trade (MUTE, now shut by the gate). Paper bots live today: spot 0 trades; funds 1 trade +$68; both 1 trade +$53 (SOXS squeeze, 10:17 ET). Live funds and both bots: CUT → WATCH (+0.11 % and +0.13 % per trade, n 20 and 17).
- Cohort: 0 muted, 21 cut, 9 backed. Gain: gap score ≥ 40, +1.07 % in 24 h (z 8.6). Loss: lab pump-fade 7 d, −4.0 % per bet (cut). New: lab.setup.1d and .2d CUT (decay: newer half −0.18 % and −0.32 %), lab.setup.7d WATCH (n 12, both halves lose; gated by the lab).
- LETF: 3 muted, 3 cut, 2 backed. Gain: fade a fast 1-minute move with a limit entry, +0.31 % (BACK, but n 30 and the newer half is +0.03 %). Loss: follow a fast 1-minute move, −0.40 % (MUTE). fade.rev.15m: WATCH, 0 of 2 new market days positive (Nov 9 −0.01 %, Nov 10 −0.03 %). New: fast.15m.alert.tgate MUTE (the 🚀 alert in the windows that won on the older half lost on the newer half, −0.96 %, z −2.3).
- Spike filter (LETF agent request): 14 single-bar spikes in 7 days. Without them, follow a fast 1-minute move is −0.40 % per event (was −1.46 %), a fast 5-minute move −0.20 % (was −1.31 %, n 55 → 28). The LETF agent's reading was correct: the large numbers came from bad prints. fast.5m.15m is now CUT, not MUTE (still negative on both halves).

### Agents
- SOXX agent: ran, good work. It found the cause of the live funds loss (trades after 11:30 ET), and it used the scorecard's own rule in the gate, not a new threshold. Walk-forward (fit on the days before each test day): spot +$43 → +$77, funds +$210 → +$233. Weak point: only 1 test day changed. I checked the code: the gate uses only days before the trade's day. No revert.
- Cohort agent: ran, good work. It found that the blended setups (shown on all three sites) had no score, and it replayed the blend day by day. It checked that the old output did not change. No revert.
- LETF agent: ran, good work. It found that the page showed a fade edge about 60 times too large, and it found the bad-print cause. It made no new flag. No revert.
- Checks by me: node --check on all changed files; tests/engines.test.mjs ALL PASSED; Playwright 0 page errors on SOXX, Mastermind, LETF (live and ?demo) and Cohort, with the new ev.json. Shared files: all the same in the repos that use them.
- All agents kept the order rules (limit entries that count only when touched, no new stops, the same bet size, long-only bots).
- Yesterday's tasks: all done, except the Signal web 24 h log (Cohort: see below, no web.js change is necessary). Yesterday's "Watch next": SOXX gate S = 12:00–12:30 (yes); fade.rev.15m day 2 (failed again, 0 of 2).

### Lessons shared
- Many large results are data errors. The LETF fast-move loss fell from −1.46 % to −0.40 % when 14 bad prints were removed. SOXX agent: check the big-swing and squeeze records for single-bar prints. Cohort agent: check Hyperliquid candles for the same.
- A data filter can change what a test counts. My first spike filter removed bars, shifted the 3- and 5-minute steps of the tests, and lifted the rev.all.15m mute. I changed it in 3 minutes (the bar stays, its close is flattened). Run every change on the live data and compare the rulings before you finish.
- A blend of good ideas can lose (Cohort, lab setups). The same holds for the SOXX bot versions and the LETF 🚀 rule: replay the choice day by day.
- The live loss came in the same half hours as the paper loss (SOXX). LETF: the 🚀 rule wins on the older half and loses on the newer half in every window. That is decay, not a time-of-day effect.

### Tasks for tomorrow
- SOXX agent: 1) bots.json keeps only the last 60 trades per bot, so the new live.<bot>.<half hour> items have only 3–5 trades. Add the LIVE trades to dated.json (for example `live|<bot>@<half hour>` with n, sum, sum of squares) so the record does not roll; tell me the key and I will score it by day. 2) Watch live.letf.late and live.both.late (from Nov 11): if they are below 0 after 5 days, the gate is not enough. 3) Check that no live funds trade started 11:30–12:00 ET on Nov 11.
- Cohort agent: 1) Signal web log: Web.forecast(asset, 24) is already public in web.js (it returns p and ph per horizon). Use it from outlook.js; no shared-file change is necessary. 2) lab.setup.1d and .2d are now CUT (decay). Do the walk-forward test of backlog item 1 (keep only ideas whose own newer half wins) before the Sunday backtest. 3) Lab load stability (backlog 2): the universe changed from 205 to 190 markets between two runs.
- LETF agent: 1) The spike filter is live (extra.spikes 14). fast.5m.15m is now CUT, not MUTE. Check that the page does not show a follow flag for fast 5-minute moves (a negative EV on both halves). 2) fast.15m.alert.tgate is MUTE and fast.15m.15m is decaying (newer half −0.52 %). If the next scorecard keeps the newer half below 0, stop the 🚀 push alert. 3) New items: fade.15m.15m (limit fade of 🚀, −0.07 %, WATCH) and fade.fast1m/5m .days. Use them on the card; no fade flag before 3 positive new days.

### Changes I made
- Hyperdash-Cohort-Tracker 2006261 (scripts/ev.mjs): lab.setup.<h>d (Cohort request); live.<bot>.<half hour>, live.<bot>.early / .late from Nov 11 only (SOXX request); LETF: spike filter, trim (5 % trimmed mean) on fast.*, the 5 largest fast-move results in the log, per-day records for fade.fast1m, fade.fast5m and fade.15m, fade.15m.15m, fast.15m.15m.tgate, fast.15m.alert.tgate (LETF requests). No ruling rule changed.
- Hyperdash-Cohort-Tracker de1b3d5 (scripts/ev.mjs): fix of my own change. The first run with the filter moved rev.all.15m from MUTE to CUT, because removed bars shifted the test steps. Now the filter flattens the bar in place and acts only on the fast-move tests. Check: with the filter off, all old LETF items are the same as before (n and EV). The live run after the fix: rev.all.15m MUTE again (n 157, z −2.4, as at 22:02).
- Checks: node --check; offline runs with mocked fetch and today's files; two live EV runs (success); Playwright 0 page errors on all sites.
- Not done: layout.js move of the LETF reversal card (the card already closes to one line when muted; small value). web.js hook: not necessary (Web.forecast is public).
- No revert of agent work.

### What Steven should know
- Nothing to paste. No Worker change.
- The live funds bots made money today (+$68 and +$53, one SOXS trade each). From tomorrow they do not trade 11:30–12:00 ET, where they lost on 5 of 5 days.
- LETF: the large "fade the fast move" numbers were bad prints. Do not trade fast moves in either direction. Do not trade the fade of a turn: it failed on 2 of 2 new days.
- Cohort: the 7-day lab setups are hidden on all sites (they lost in the walk-forward test). The 1-day and 2-day setups lose on the newer half: do not use them alone.

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
