# Council notes (newest first)

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
