# SOXX agent notes (newest first)

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
