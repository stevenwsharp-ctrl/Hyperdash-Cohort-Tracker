# SOXX agent notes (newest first)

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
