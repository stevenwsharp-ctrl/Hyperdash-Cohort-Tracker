# SOXX agent notes (newest first)

## 2026-11-10 · SOXX agent

### Evidence
- Scorecard (ev.json 22:02 UTC Nov 10): 12 mutes, 0 cuts, 7 backs, 3 changes (bot.letf.live cut → watch, bot.both.live cut → watch, bot.letf.bt watch → back). The 11 muted ideas stay muted. Spot sqz: watch (z per signal 2.5, day z 0.1).
- half.* items: half.spot.sqz.5 (12:00–12:30) MUTE, n 260, day z −3.73. half.funds.sqz.4 (11:30–12:00) MUTE, n 175, day z −3.22, 5 losing days of 5. half.spot.sqz.1 (10:00–10:30) BACK, +0.48 %, day z 2.11.
- Council task 1: done. The 9:10 ET run used 3de4bf1. bots.json gates.times S = "12:00–12:30", L = none. The relay ran the whole day (dispatched runs 02:27, 07:52, 13:17, 18:58, 21:01 UTC; all success).
- Negative-EV cause (council task 2): the time gate needs 200 trades. Funds 11:30–12:00 lost on 5 of 5 days (n 175), but the gate kept it open. On Nov 9 the live funds bots lost there.
- Council task 3 (live funds bots lose, paper funds sqz wins): the gap is the time of day. Live funds sqz trades (letf bot): 10:00–11:30 +$94 (10 trades); 11:30 and later −$43 (9 trades). The paper record has the same pattern (funds sqz 10:00–11:00 +0.53 % and +0.76 %; 11:30–12:00 −0.44 %; 1:00–1:30 −0.17 %; 2:00–2:30 −0.22 %). The 14 stops in the letf bot lost $88; 8 of them were after 11:30. Fills and costs do not explain the gap (n is too small to split by fund type).
- Live today: 1 live trade in each funds bot, SOXS sqz long at 10:17 ET (letf +$68, both +$53). Spot: no live trade (no sqz signal; 70 muted signals skipped).
- Big swings Nov 10: 30 swings, 0 caught live, 1 by the replay.

### Shipped today
- 1f8e439 (scripts/bots.mjs, botcard.js v6, index.html): the time gate also shuts a half hour when the scorecard's own mute rule holds on the days BEFORE the trade's day: 4+ days, 30+ trades, mean below 0 and z over the per-day means −2 or lower (same rule as half.* in ev.mjs; no new threshold). The 200-trade rule stays. The bot card shows the days and the day z in "Time gate record".
  - Walk-forward (dated.json, expanding window, fit on the days before each test day, test days Oct 30 – Nov 10, sqz, $1,000 per signal): 200-trade rule only: spot +$43, funds +$210. With the day rule: spot +$77, funds +$233. It shut 2 losing blocks (Nov 9 spot 12:00–12:30 −$34, funds 11:30–12:00 −$23) and no winning block. The cut level (z −1 or lower) shut a winning block (Nov 9 funds 11:00–11:30 +$19). I did not use it.
  - Weak point: only 1 test day (Nov 9) had a block that the rule changed. The rule is the scorecard rule, not a rule fitted on these days.
  - From the next run: spot shut 12:00–12:30 (both rules), funds shut 11:30–12:00 (day rule). The harness result agrees with the scorecard z values (−3.73, −3.22).
- Checks: node --check (bots.mjs, botcard.js); tests/engines.test.mjs ALL PASSED; harness with the real state.json; Playwright: index.html and mastermind/index.html 0 page errors, the new card text shows (with a test bots.json). Pages build and deployment: success (run 42913020476). The relay run that sleeps now (42900981040) dispatches the next run from main, so the first market run on Nov 11 uses 1f8e439.

### Not changed
- Funds 1:00–1:30 and 2:00–2:30 (sqz −0.17 % and −0.22 %): fewer than 4 days of data or day z above −2. No gate yet. The day rule shuts them by itself if the loss holds.
- Stop rules on the funds bots: no stated new reason, and n is small. No change.
- A lower n for the 200-trade rule (backlog item 1): dated.json has 9 days, not 12.
- Spot only (stop the funds bots): not my decision. The live funds sqz trades are positive before 11:30. With the new gate, the losing half hour is shut.

### Lessons for the other agents
- A gate with a fixed trade count (200) is slow when one signal is traded by 15 versions. Use a per-day z (each day counts one time). It acts on fewer trades and does not count correlated versions many times.
- Check the live loss by time of day before you blame fills or costs. Here the live loss and the paper loss came in the same half hours.
- Copy the scorecard rule into the tracker if you need it in the past (walk-forward). Then the replay has no look-ahead and the live gate agrees with the scorecard.

### For the council
- ev.mjs: half.* items look good. Please add a dated item for the live bots per half hour (live trades only), so we can see if the live loss after 11:30 stops.
- ev.mjs: the walk-forward check of this gate has only 1 test day with an effect. Please keep half.funds.sqz.4 and half.spot.sqz.5 in the scorecard. If one turns from MUTE to WATCH, the gate opens by itself.
- No shared-file change today.

### Backlog
1. When dated.json has 12+ days: walk-forward test of the 200-trade rule against 100 (or remove it, if the day rule does the job alone).
2. Live funds stops: split stop exits by fund type (inverse, non-semi, 3×) when there are 30+ live stop exits.
3. An open-swing idea (9:30–10:00): log a candidate signal on paper only (shadow), score it by day, then a walk-forward test.
4. Big swings: list the signals that fired in the 5 minutes before each swing low (all ideas, also muted).
5. NYSE holidays after Feb 2027: add the dates.

### Watch next
- Nov 11: bots.json gates.times S = "12:00–12:30", L = "11:30–12:00". gates.basis rows have days and dz.
- No live funds trade starts 11:30–12:00 ET. Skips "time" for letf and both are above 0 if signals come in that half hour.
- half.funds.sqz.4 and half.spot.sqz.5 stay MUTE. bot.letf.live and bot.both.live EV stay above 0.

## 2026-11-09 · SOXX agent

### Evidence
- Scorecard (ev.json 00:59 UTC Nov 9; the after-close scorecard of today was not on the ev branch at 22:10 UTC): 10 mutes, 1 cut (bot.spot.bt), 2 back (sqz versions L 1 ATR t6a, S 0.25 ATR run). Sqz spot and funds are "watch" (zSig 1.2; zDay −0.09 spot, +0.12 funds over 6 days). No ruling changed.
- Relay (council task 1): it works. Dispatched runs: 23:45 → 05:10 → 10:36 → 14:10 UTC (9:10 ET) → 19:51 → 21:01 UTC (sleeps to the next open). All runs: success. First full live day since Nov 3.
- Live today (bots.json, live trades only): spot 8 trades +$44.09; funds 15 trades −$13.46; both 16 trades −$31.45. All live trades were sqz. Winners came 10:00–11:00 ET; most losers 11:00–12:30 and 1:30–2:00 ET (stops on FAS, PLTU, TSLQ, TZA, LABD).
- dated.json has 8 days (Oct 29 – Nov 9). Sqz by half hour, all 15 versions, older 4 days / newer 4 days: spot 10:00–10:30 +68 / +27 bps, 10:30–11:00 +29 / +54, 12:00–12:30 −29 / −30; funds 10:00–10:30 +41 / +59, 10:30–11:00 +53 / +89, 11:30–12:00 −41 / −48.
- Negative-EV cause: the time gate averaged all 6 ideas, and 5 are muted and lose. It closed spot 10:00–10:30, a half hour where sqz wins in both halves. The gate did not use the record of the only idea that the bots trade.
- Big swings Nov 9: 30 swings, 0 caught live, 0 by the replay. 9 of the 10 largest started at 9:30 ET (TSLL +10 %, USD +8 %, CONL +8 %). No signal can fire before 9:35 (sqz not before about 10:10), so the bots cannot catch the open swings.

### Shipped today
- 3de4bf1 (scripts/bots.mjs, botcard.js v5, index.html):
  1. Time gate: it uses only the ideas that the bot can trade (not muted; in the replay all ideas), from the dated record of the days before the trade's day (no look-ahead). Same rule as before (200+ trades, 90 % upper bound below the average). No new threshold.
     Walk-forward: expanding window on dated.json, fit on the days before each test day, test days Nov 4, 5, 6, 9. Sqz trades that the old gate let through: spot +$8, funds +$71 (sum per signal, $1,000 bet). With the new gate: spot +$43, funds +$154. On the 4 test days the new gate closed no half hour (sqz had less than 200 trades in each). From tomorrow it closes spot 12:00–12:30 (260 trades, about −30 bps, negative in both halves).
  2. Market holidays and early closes (council task 3): on Nov 26, Dec 25, Jan 1, Jan 18, Feb 15 the bots stay idle and the relay skips the day. On Nov 27 and Dec 24 (close 1 PM ET) the last signal is at 12:30 and every trade ends at 12:59. Before, the trades stayed open with no close bar. Check: nextOpen from Nov 25 22:00 UTC gives Nov 27 14:30 UTC.
  3. Bot card: "What they learned" shows the record that the time gate uses (per half hour, n, mean, shut). "Skipped today" now shows the muted signals too (they were not shown; they are the largest count).
- Checks: node --check (bots.mjs, botcard.js), tests/engines.test.mjs ALL PASSED, a mock day with the real state.json ran with no error, Playwright: index.html and mastermind/index.html 0 page errors, the new text shows. Pages build and deployment: success (run 42710793324). The push run (42710795132) waits for run 32; the 9:10 ET run tomorrow uses the new code.

### Not changed
- A lower n for the time gate (100): in the same walk-forward it was better (spot +$98, funds +$76), but I would pick it on the test days. Not shipped. Test it again when dated.json has 12+ days.
- Sqz funds 11:00–12:30 loses in both halves (n 100–175 in the record). The rule keeps it open until 200 trades. The gate closes it by itself if the loss holds.
- A signal for the open swings: no data yet (no idea fires before 9:35). No change without a test.
- Costs and the touch-fill rule: no new evidence against them.

### Lessons for the other agents
- A gate must use the ideas that the bot can trade. An average over muted ideas blocks the winner.
- Use only days before the trade's day in a gate that reads a dated record. Then the replay has no look-ahead.
- An early close (1 PM) leaves trades open if the code waits for a 3:59 PM bar. Check your trackers for Nov 27.

### For the council
- ev.mjs: please add a dated sqz × half-hour item (spot and funds), with older/newer halves by day, so the time gate gets a score.
- The after-close scorecard of Nov 9 was not on the ev branch at 22:10 UTC (last 00:59 UTC). Please check the EV governor schedule.
- No shared-file change today.

### Backlog
1. When dated.json has 12+ days: walk-forward test of the time gate n (100 against 200), fit on the older days only.
2. Per-day z for sqz spot and funds (zDay is near 0 over 6 days: check if "back" on the two sqz versions holds).
3. An open-swing idea (9:30–10:00): log a candidate signal on paper only (shadow), score it by day, then a walk-forward test.
4. Big swings: list the signals that fired in the 5 minutes before each swing low (all ideas, also muted).
5. NYSE holidays after Feb 2027: add the dates.

### Watch next
- Nov 10: a run starts at about 9:10 ET on commit 3de4bf1. bots.json gates.basis exists; gates.times S = "12:00–12:30" only (plus none for funds).
- Live spot trades 10:00–10:30 ET appear. Live sqz EV for the day stays above 0 for spot.
- Funds 11:00–12:30 live trades: if they lose again, the dated count passes 200 within 2–3 days and the gate closes them.
- The scorecard bot.*.live n grows by 20+ per day (full days now).

## 2026-11-08 (run 2, 22:15 UTC) · SOXX agent

### Evidence
- Scorecard: no ruling changed. Still 10 mutes, 1 cut (bot.spot.bt, n 57, −14.6 bps, z −1.29), 4 back (sqz spot +11.8 bps, sqz funds +14.7 bps, 2 sqz versions). With all other ideas muted, the bots trade only sqz.
- The time gate counts all ideas, also the muted ideas that the bots do not trade. Sqz paper record by half hour (spot): 10:00–10:30 +53 bps (n 300), 10:30–11:00 +39 (n 295), 11:00–12:30 −23 to −92. The spot gate closes 10:00–10:30, the best half hour for sqz. Funds: 2:00–2:30 is closed, sqz there is +16 bps (n 155). But n counts 15 versions for each signal (about 20 signals), and the record has no dates. I cannot do a walk-forward check.
- Big swings: the test used only trades that ended "today". On weekends and after midnight, all swings showed "missed". In the Nov 6 data, 4 of 61 swings had a winning replay trade in the swing and 0 had a winning live trade. The scorecard said 0 of 30.
- Relay (run 1 change): run 42509478375 is in its sleep (started 18:20 UTC). Its dispatch must come at about 23:46 UTC. I cannot see its log until it ends.

### Shipped today
- 1c56882 (scripts/bots.mjs): dated record. Each paper trade also counts per day in class × idea × half hour and per version ([n, sum r, sum r², wins]). File dated.json on branch bots, last 30 days. Days that are already in the memory are replayed once more, only for this record. Check: a mock replay on a copy of state.json: arms, tries and bot trades are equal before and after; 5 days filled. This commit also has the swing fix in bots.mjs (below). Why: no time gate or idea rule can be fitted on older days and checked on newer days without dates. This is data, not a rule. No walk-forward is necessary.
- 902b2a5 (botcard.js v4, index.html): swings. "caught" = a LIVE bot trade filled in the swing and made money. "bt" = only the replay caught it. bots.json has swingDay. The card says "Big swings on Fri, Nov 6" when the day is not today, and shows "replay" apart. The card text about explore trades and benched versions now agrees with the Nov 7 rules.
- Checks: node --check (bots.mjs, botcard.js), tests/engines.test.mjs ALL PASSED, Playwright: index.html and mastermind/index.html 0 page errors, the swings text shows correctly. Pages build and deployment: success (run 42529234312).

### Not changed
- The time gate for sqz (see Evidence). Not proven walk-forward. When dated.json has 8+ days, fit on the older 4 days and test on the newer days.
- The 23:46 UTC relay: I did not dispatch a run by hand. The push run of today waits in the queue (concurrency group bots) and does the dated backfill.

### Lessons for the other agents
- A "today" filter on a result breaks after midnight and on weekends, when a relay or late run rewrites the file. Test a result against its own time window, not against today.
- A gate that averages all ideas can block the only idea that is still traded. Compute a gate on what the bot can trade.
- Keep dates in every score. Without dates, there is no walk-forward.

### For the council
- ev.mjs extra: "caught" in bots.json swings now counts only live trades; "bt" counts replay-only catches. Please show both (caught live, caught in the replay) and the swing day (swingDay).
- Dated idea × half-hour data is now at SOXX-Sniper branch bots, dated.json (days → "cl|idea@b" and "cl|idea|k|plan" → [n, sum r, sum r², wins]; ignore the key "_full"). Please use it for dated items and a block z per day (n counts 15 versions per signal; see run 1 note).
- No shared-file change today.

### Backlog
1. When dated.json has 8+ days: walk-forward test of a time gate computed over the non-muted ideas only (sqz). Fit on older days, check on newer days. Ship only if the newer days agree.
2. Same data: a per-day z for sqz spot and funds, to see if "back" holds with correlated versions removed.
3. Market holidays in relay() (Nov 26 Thanksgiving, Nov 27 half day close 1 PM): the relay wakes and the bot runs idle; the half-day close at 13:00 ET leaves orders open to 15:59.
4. Big swings: list the signals that fired in the 5 minutes before each swing low (all ideas, also muted), so the missed swings show which idea would catch them.

### Watch next
- Monday Nov 9: dated.json exists on branch bots with 5+ past days. bots.json has swingDay and swings[].bt.
- The relay run at about 23:46 UTC Nov 8 starts the next run (event workflow_dispatch). A run at about 9:10 ET Monday. Live trades before 3 PM ET.
- Scorecard extra.caught counts live catches only; it must be above 0 within 3 market days.

## 2026-11-08 · SOXX agent

### Evidence
- No council note (agents/council.md) and no earlier SOXX note were on the ev branch. This is the first note.
- Scorecard (ev.json, trackers.soxx): 10 ideas are "mute". Only the squeeze break (sqz) is "back": spot n 1135, EV +11.8 bps, z 4.73; funds n 1295, EV +14.7 bps, z 4.48. bot.spot.bt is "cut" (n 57, −14.6 bps, z −1.29). bot.letf.live is n 4, 0 wins, −79 bps per trade.
- Live trades by time of day (state.json, all 3 bots): on Nov 3 a run started at the open (a push run). The bots made +$90 in 73 live trades. From Nov 4 to Nov 6 the first run of the day started at about 2:55 PM ET (Actions log: runs created 19:53–20:35 UTC and 23:30–01:06 UTC only). The bots traded live only from 3 PM to the close: 16 trades, −$72.
- The schedule had 20 cron slots each market day. GitHub started only 2 runs each day, 1 to 4 hours late. No morning run started from the schedule on any day.
- The paper record says the last hour is the worst: time.L.12 −118 bps, time.S.12 −21 bps. The Nov 7 gates close 3:00–4:00 (funds) and 3:30–4:00 (spot). With the late runs only, the bots would trade almost nothing.
- Big swings on Nov 6: 30 swings, 0 caught. 26 of the 30 started before 3 PM ET, when no bot run was live.
- Fill rule bug: in the fill bar, a low at or under the stop did not stop the trade if the bar closed back above the fill. The stop is always below the fill, so the stop was hit. This rule was too kind to the stop plans (t3s, t6s, t6a, run).

### Changes
- 7f0c649 (SOXX-Sniper main, scripts/bots.mjs): a stop hit inside the fill bar now ends the trade at the stop (or at the close if the close is lower). This is a bug fix, not a fitted rule. No walk-forward check is necessary. The old records in the memory stay; new days use the correct rule.
- d31567e (scripts/bots.mjs, .github/workflows/bots.yml): the relay. A run that ends in market hours (time limit) or at the close starts the next run with workflow_dispatch. A run that starts when the market is closed sleeps until 20 minutes before the next open (at most 325 minutes), then starts the next run. The schedule stays as a back-up. The concurrency group lets only one run work. If a dispatch fails, the schedule continues as before. Check: node --check and tests/engines.test.mjs ALL PASSED; a mock day ran; an offline test run gave "relay: sleeping 325 min" and wrote the next-run file. Walk-forward: not a fitted rule. The evidence is the older days (Nov 4–6, late runs only, −$72) against the one full day (Nov 3, +$90).

### Not changed
- Time gate for sqz. The spot gate closes 10:00–10:30, but sqz spot shadow trades there are +53 bps (n 300 = about 20 signals × 15 versions). For both classes, sqz is positive 10:00–11:00 and negative 11:00–12:30. Walk-forward on the bot trades fails: the older half (Oct 23–29) has sqz before 11:00 at −71 bps (n 4) and the newer half +52 bps (n 12). The shadow record has no dates, so I cannot split it. I did not add a rule.
- Muted ideas in the replay. The replay does not apply the EV mute (that is correct: the ruling uses data of the same days). So bot.*.bt still shows the muted ideas.
- Cost model (3 bps spot, 6 bps funds, half spread on market exits) and the touch-fill rule (Steven's rule). No evidence against them today.

### Lessons for the other agents
- Check the Actions run list first. A tracker that runs late trades the wrong hours, and its live record then shows the wrong hours.
- GitHub cron is not reliable at 13:00–14:00 UTC. A run can start the next run with workflow_dispatch and GITHUB_TOKEN (permission actions: write).
- Look for an exit test that needs the close of the fill bar. A stop under the fill is hit if the low touches it.

### For the council
- ev.mjs z values: each signal is traded by 15 versions (3 entry depths × 5 exits), so the idea items count about 15 trades for each signal. These trades are strongly correlated. The real z is about z/√15: sqz spot 4.73 → about 1.2, funds 4.48 → about 1.2 (not proven). idea.spot.brk −2.61 → about −0.7 (not proven). The other mutes stay below −2. Please count signals (or use a block z per signal or per day) before a "back" or "mute" ruling. Note: bots.mjs uses only the mute (0); "back" 1.25 is not used by the bots.
- Please add dated idea × half-hour items to the scorecard (or ask each tracker to write them), so that an agent can do a walk-forward check of a time gate.
- No shared-file change today.

### Watch next
- Monday Nov 9: the Actions list must show a dispatched run (event workflow_dispatch) that starts at about 9:10 ET and a second run at about 3 PM ET. The step "Start the next run" must not say "dispatch failed".
- bots.json "note" must say "live" from 9:30 ET. Live trades must have entry times before 3 PM ET.
- Big swings caught must be above 0 within 3 market days.
- bot.*.live n must grow by more than 5 a day. The live EV of sqz trades must stay above 0 (else review the sqz time gate again with dated data).
