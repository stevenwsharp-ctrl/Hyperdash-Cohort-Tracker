# LETF agent notes

## 2026-11-18 · LETF agent

### Evidence
- Source: ev.json on branch ev, t 2026-11-18T22:14:27Z (has the Nov 18 data). trackers.letf: 18 items, 3 mute, 4 cut, 0 back, 5 changed.
- fast.15m.alert: WATCH → MUTE (−0.63% per 15 min, n 83, z −2.09; older −0.33%, newer −0.93%). fast.15m.alert.tgate (open hour): MUTE, −1.42%, n 17. Nov 18 open hour alone: −2.31% (n 11). Without Nov 18 the gate is +0.23% (n 6). One day made this mute, but both halves of the full item are below 0, so the mute is fair.
- fast.15m.15m.tgate (open-hour 🚀 gate): WATCH → CUT, −0.76%, n 21. Nov 18: −2.06% (n 12). Without Nov 18: +0.97% (n 9). New days: 2 of 3 positive (Nov 16 +1.45%, Nov 17 +0.36%, Nov 18 −2.06%).
- fast.15m.15m.todH (new): open older +0.49% / newer −0.76%; mid older −0.62% / newer −0.18%. Mid-day 🚀 loses on both halves.
- fade.15m.15m: CUT → WATCH (−0.05%, older −0.53%, newer +0.43%; Nov 18 +1.50%, n 8). Not proven.
- rev.all.15m: WATCH, +0.044%, older −0.07%, newer +0.16%. rev.hard.15m: CUT, both halves below 0 (the rev.js hold keeps HARD flags muted).
- Plans: plan.setup.60m CUT (−0.08%, newer −0.19%); full CUT (decay; +0.07%, newer −0.002%); LEAN MUTE (gate shut). Full plans with no stop: +0.08%, both halves above 0 (record only).
- NEGATIVE EV ON THE PAGE (found today): fastPushOn() returned "push" while the scorecard was not loaded (first visit, or no cache for 2 days). In that gap the page could push a 🚀 alert on the phone or desktop, also now that fast.15m.alert is MUTE.

### Shipped today
- LETF-Sniper 87ac8ca (index.html inline code; no script file changed, so no ?v= bump):
  1. Council task 1. The mid-day text "lost in the test … do not chase" shows only while BOTH halves of that time of day lose (fast.15m.15m.todH o and r below 0). The text gives the two halves. Without todH the old rule applies. No new threshold. Today: mid-day text stays (−0.61% / −0.18%). The open hour now says "no proven edge, do not chase" by itself, because the open-hour gate went below 0.
  2. No 🚀 push before the scorecard is loaded. The alert stays in the list with "not pushed: the test scorecard is not loaded yet".
- Checks: node --check on all inline scripts OK. Playwright with the Nov 18 ev.json, clock at 09:45, 12:00, 15:30 ET, ?demo, #/f/TSLL, #/f/SOXL, and with no scorecard (live and ?demo): 0 page errors; texts and push state correct.
- Pages build and deployment: success (run 44410811190, 87ac8ca).
- worker.js not changed. Steven does not need to paste anything.

### Council tasks
1. todH text: done (above).
2. Plan crowding with mL / mS (plan.setup.60m.hour, 88 signal times, 18 days; older = Oct 26 – Nov 5). Rule "skip a side with more than N signals at one signal time", fitted on the older days: best N 10 (older +0.25% against +0.17% for all), newer +0.16% against +0.11%. BUT the weights are signal counts, not fills: the signal-weighted mean of all plans is +0.14%, the true item mean is −0.08%. One-side signal times weighted by fills give −0.13%. The test is not reliable, so no rule. Per size class the means jump (5 signals: −0.41% / −0.47%; 8: +0.74% / +1.25%): no order. Request below.
3. New days for fast.15m.15m.tgate: 2 of 3 positive (Nov 18 −2.06%). The gate is now CUT; the page reads it by itself.

### Not changed
- Open-hour 🚀: no new text. The page already falls back to "no proven edge" when the gate mean or one gate half is below 0. I did not add a "fade" text: fade.15m.15m is positive only on the newer half.
- 🚀 alert MUTE: text already "fast moves tended to come back: do not chase"; push was already off (newer half below 0).
- Reversal flags, plans, stops: no change (no walk-forward win; Steven's stop rule).
- Shared files, ev.mjs and worker.js: not edited.

### Lessons for the other agents
- A part that can push or trade must default to OFF until the scorecard is loaded. A default of "on" leaks a muted rule in the load gap (same family as the Cohort lab.setup leak). SOXX agent: check what the bots and the page alerts do when ev.json cannot load.
- One day can make a gate (Nov 18 open hour: +0.97% without it, −0.76% with it). Read the gate with and without the newest day before you build on it.
- Signal counts are not fills. A crowding test weighted by signals gave the wrong sign of the total.

### For the council
- ev.mjs (record only): on plan.setup.60m.hour add the filled plans per side (fL, fS). Then the crowding test can weight mL / mS by fills.
- ev.mjs (record only): fast.15m.15m.tgate and fast.15m.alert.tgate with the days field per time of day also for the left-out windows, so the "one day" check is possible for mid-day.
- No shared-file change.

### Backlog
1. Plan crowding: fit N per size class when fL / fS are in the hour record.
2. 🚀 push in the open hour only after 3 positive new days of fast.15m.alert.tgate (now MUTE; 1 of 3).
3. rev.js backtest(): true New York clock for the day split before Mar 14 2027.
4. Audit leverage and underlying of the fund list against instruments.json (needs the Worker list).
5. 🚀 threshold per fund kind (fund move ÷ leverage), needs an ev.mjs test first.

### Watch next
- Pages: with no cached scorecard, a 🚀 alert says "not pushed: the test scorecard is not loaded yet". Mid-day 🚀 text shows both halves.
- fast.15m.15m.tgate Nov 19: is it positive again (one-day loss) or below 0 (the open-hour edge is gone)?
- fast.15m.15m.todH mid: both halves stay below 0. fast.15m.alert stays MUTE.
- fade.15m.15m: does the newer half stay above 0?

## 2026-11-17 · LETF agent

### Evidence
- Source: ev.json on branch ev (2026-11-17 22:08 UTC), trackers.letf: 18 items, 1 mute, 5 cut, 0 back, 3 changed. This scorecard has the Nov 17 data.
- rev.all.15m: WATCH, n 115, +0.043% per 15 min, older −0.073%, newer +0.157%. One half is now above 0, so the mute hold (rev.js v9) lets go, as designed: the scanner shows "⤾ reversal" flags again at factor 1 ("positive, not proven"). Nov 17: fade.rev.15m day −0.173% (n 28), so the turns of today held on.
- rev.hard.15m: CUT, −0.129%, older −0.221%, newer −0.037%. Both halves below 0: the hold keeps HARD flags muted.
- plan.setup.lean.60m: CUT → MUTE (−0.134%, z −2.1, newer −0.246%). The LEAN gate is already shut.
- plan.setup.full.60m: CUT (decay), +0.046%, older +0.171%, newer −0.079%. Nov 17: +0.689% (n 2).
- plan.setup.60m: CUT, −0.087%, newer −0.188%. Exits: target 26 +1.07%, stop 75 −1.04%, time 387 +0.02%.
- 🚀 by time of day (fast.15m.15m tod): open hour n 49 +0.724%; mid-day n 69 −0.353%; last hour n 4 +0.387%. Alert level (fast.15m.alert tod): open n 33 +0.688%; mid-day n 40 −1.021%.
- 🚀 walk-forward gate (fast.15m.15m.tgate, open hour chosen on the older half, scored on the newer half): n 18, +0.914%, z 1.78, both halves above 0 (+0.86%, +0.97%). Days: Nov 13 +1.97%, Nov 16 +0.17%, Nov 17 +0.36%.
- fade.15m.15m (limit fade of 🚀): CUT, −0.336%, both halves below 0. Fading a fast move also loses: the useful reading of a mid-day 🚀 is "do not trade it", not "fade it".
- fade.fast5m.15m: WATCH → CUT (decay: older +0.39%, newer −0.25%).
- NEGATIVE EV ON THE PAGE (found today): every 🚀 flag, alert and post had the same text "no proven edge, do not chase" all day. In the test the mid-day 🚀 loses (−0.35% per 15 min; the alert level −1.02%) and the open-hour 🚀 wins on the walk-forward gate. The page did not show this difference.

### Shipped today
- LETF-Sniper 14fc5fd (index.html inline code; no script file changed, so no ?v= bump): the 🚀 text (scanner flag tooltip, alert list, "Moving fast now" post) reads the time of day of the move, with the same buckets as ev.mjs tod() (open 09:30–10:30, mid 10:30–15:00, close 15:00–16:00 ET).
  - In a time of day that the .tgate item keeps, with n ≥ 8 and the gate mean, its older half and its newer half all above 0: "in the open hour fast moves held on in the walk-forward test (+0.91% per 15 min, n 18), not proven: limit entry only".
  - In a time of day that the gate does not keep, with tod n ≥ 8 and tod mean below 0: "mid-day fast moves lost in the test (−0.35% per 15 min, n 69): do not chase".
  - The alert at 5% / 2.5% uses its own items (fast.15m.alert and .tgate). Other cases: no change ("no proven edge, do not chase"). BACK and MUTE rulings: no change.
  - Why: priority 1 and 3. It stops a mid-day signal with negative EV from looking the same as the open-hour signal with positive walk-forward EV.
  - Walk-forward: no new fitted value. The kept windows are the .tgate choice on the older half, scored on the newer half only. The text reads the scorecard each time, so it changes by itself when the windows or the numbers change. The 🚀 push rule (fastPushOn) is not changed: the push stays off (fast.15m.alert newer half −0.32%).
  - Checks: node --check on all inline scripts OK. Playwright with today's ev.json, clock at Nov 17 09:45, 12:00, 15:30 ET, ?demo, #/f/TSLL and #/f/SOXL: 0 page errors; the text is correct at each time.
  - Pages build and deployment: success (run 44189275894, 14fc5fd).
- worker.js not changed. Steven does not need to paste anything.

### Council tasks
1. Plan crowding (plan.setup.60m.crowd3 / .crowd12 / .hour). crowd3: n 444, −0.105%, older +0.024%, newer −0.235%. crowd12: n 44, +0.104%, older +0.001%, newer +0.207%. On the older half the crowded plans did NOT lose against the 1–2 plans (+0.024% against +0.001%). A limit "at most N plans on one side per signal time" that is fitted on the older half keeps all plans (no limit). Result: no rule. The .hour record has counts and stops per signal time, but no return, so I cannot fit N per size class. Stop share by the largest side per signal time: 1–2 plans 14%, 3–5 12%, 6–8 24%, 9+ 15%: no clear order. 60% of the plans come in signal times with 9+ plans on one side.
2. Full plans: the newer half stays below 0 (−0.079%). Gate test on the per-day record (gate state from the days before each day): the gate was shut on 1 day only (Nov 17), and on that day full plans made +0.689% (n 2). Open days: +0.060% (n 104). The gate would lose. No gate.
3. New days (from Nov 16): fast.15m.15m.tgate 2 of 2 positive (+0.17%, +0.36%). fast.15m.alert.tgate 1 of 2 (−0.61%, +0.01%). fade.rev.15m.tgate 1 of 2 (+0.075%, −0.158%).

### Not changed
- Reversal flags: the hold let go (newer half +0.157%). I did not mute them again: there is no rule that both halves must be above 0 for a WATCH flag, and the flag says "not proven". The halves disagree, so I watch it.
- Full-plan gate and crowding limit: no walk-forward win (see Council tasks).
- No stop change (Steven's rule; no stop variant wins walk-forward).
- 🚀 push: stays off. Fade text for fast moves: no change (fade.15m.15m loses on both halves; the page does not show a fade trade).
- Shared files and ev.mjs: not edited.

### Lessons for the other agents
- Read a rule by time of day before you give it one text. Here one 🚀 rule is +0.72% in the open hour and −0.35% mid-day; one sentence for both hides a positive part and a negative part. SOXX agent: your squeeze half hours already do this; check that the page text for each half hour also says it.
- When the opposite reading also loses (follow and fade of a mid-day 🚀 both lose), the useful instruction is "no trade", not "fade".

### For the council
- ev.mjs (record only, small): on plan.setup.60m.hour add the plan mean per signal time and side ("mL", "mS"). Then "at most N plans on one side per signal time" can be fitted per size class on the older half. Today the crowd3 / crowd12 split shows no gain on the older half.
- ev.mjs (record only): add .tgate items per time of day with halves (tod older and newer), for fast.15m.15m and fast.15m.alert, so the mid-day loss can be checked on both halves (today only the full-window tod mean is there; my estimate of the newer-half mid-day mean is about −0.1%, not measured).
- No shared-file change.

### Backlog
1. Mid-day 🚀: when tod has halves, show the mid-day loss only while both halves are below 0 (now: full-window mean).
2. Plan crowding: fit N per size class after "mL"/"mS" are in the hour record.
3. 🚀 push in the open hour only, after 3 positive new days of fast.15m.alert.tgate (1 of 2 now).
4. rev.js backtest(): true New York clock for the day split before Mar 14 2027.
5. Audit leverage and underlying of the fund list against instruments.json (needs the Worker list).
6. 🚀 threshold per fund kind (fund move ÷ leverage), needs an ev.mjs test first.

### Watch next
- Pages: a 🚀 flag in the open hour says "held on in the walk-forward test … limit entry only"; a mid-day 🚀 says "lost in the test … do not chase". The text follows the scorecard.
- fast.15m.15m.tgate: Nov 18 positive (3 of 3 new days). fast.15m.15m tod mid stays below 0.
- rev.all.15m: does the newer half stay above 0? If both halves go below 0 again, the hold mutes the flags by itself.
- plan.setup.full.60m newer half; plan.setup.lean.60m stays MUTE (gate shut).

## 2026-11-16 · LETF agent

### Evidence
- Source: ev.json on branch ev (2026-11-16 21:51 UTC), trackers.letf, 24 of 24 underlyings, 9 of 9 funds. This scorecard has the Nov 16 data (first new market day for the 🚀 record).
- NEGATIVE EV THAT CAME BACK ON THE PAGE: the 7-day window moved and the two reversal rules lost their mute.
  - rev.all.15m: MUTE → WATCH. n 98, −0.039% per 15 min, z −0.76, older −0.069%, newer −0.008%.
  - rev.hard.15m: MUTE → CUT (factor 0.5). n 24, −0.187%, z −1.6, older −0.281%, newer −0.093%.
  - With these rulings rev.js gave factor 1 to normal turns and 0.5 to HARD turns, so the scanner showed "⤾ reversal" follow flags again, with a negative EV.
  - History (28 scorecards, Nov 8 18:06 to Nov 16 21:51): both halves of rev.all.15m and of rev.hard.15m were below 0 on every scorecard. The older-half sign agreed with the newer-half sign 28 of 28 times. The mute came off only because z went above −2, not because a half turned positive.
  - Nov 16 itself: fade.rev.15m day record +0.076% (n 13), so the turns of today also tended to fail.
- plan.setup.full.60m: WATCH → CUT (decay). n 126, +0.036%, older +0.181%, newer −0.108%. Nov 16 alone: −0.567% (n 18). Newer days: Nov 4 −0.17, Nov 5 +0.01, Nov 6 +0.20, Nov 9 +0.13, Nov 10 −0.47, Nov 11 +1.62, Nov 12 +0.02, Nov 13 +0.13, Nov 16 −0.57 (%).
- plan.setup.lean.60m: CUT, −0.118%, newer −0.209% (gate stays shut). plan.setup.60m: CUT, −0.077%, newer −0.172%.
- 🚀: fast.15m.15m.tgate BACK → WATCH (+0.545%, n 25, older +0.35%, newer +0.73%; Nov 16 +0.17%, n 7). fast.15m.alert.tgate is NOT in the scorecard today: on the new older half no time of day had n ≥ 8 and a mean above 0, so ev.mjs gives no item. fast.15m.alert: CUT, newer −0.077%, so the push stays off (fastPushOn reads the newer half).
- fade.rev.15m.tgate (mid-day only): WATCH, +0.119%, n 20, z 1.4, both halves above 0; Nov 16 +0.075% (n 11). New-day record: 1 positive day of 3.
- Council task 3 (stop exits split, record only): run on branch letf-research of LETF-Sniper (research/stopsplit.mjs, Actions run 43969607843, true New York clock, same plan engine). It reproduces the plan test: n 476, −0.091%; exits target 28 +1.04%, stop 76 −1.04%, time 372 +0.02%.
  - By day: stops on 15 of 16 days; the most on Nov 16 (13 of 49 plans, 5 of them full plans), then Nov 2 and Nov 4 (7 each). The top 3 days hold 27 of 76 stops (36%). The loss is NOT from one bad day.
  - By underlying: 23 of 24 underlyings have stops; the most are AXTI 7, COIN 5, RGTI 5, APLD 5. SPY has 0. The loss is NOT from one market.
  - By signal hour: 48 of 76 stops (63%) are in 10 signal hours where 3 to 7 underlyings stopped in the same hour (example: Nov 16 18Z, 7 stops: COIN AXTI BE RGTI IONQ IREN AVGO; Nov 10 17Z, 6 stops). The stops come from one market move that hits many plans at the same time, on the same side.
  - Stop distance: median 1.32 × 5-min ATR (q25 0.74, q75 2.29), the same as on Nov 14.

### Shipped today
- LETF-Sniper 61644a4 (rev.js v8 → v9, index.html ?v= bump): "mute hold". A follow flag for turns stays muted while its test mean, its older half and its newer half are all below 0 (and the ruling is not BACK). It applies to rev.all.15m and rev.hard.15m. The flag comes back by itself when one half goes above 0. The card shows "MUTED · both test halves lose" and "kept muted: both halves of the test still lose, no flags in the scanner". The scanner cell tooltip says "negative EV on both halves of the test".
  - Why: priority 1. Without it, the page flagged turns as trades in the new direction from tonight, with a negative EV on both halves.
  - Walk-forward: no fitted value (fixed level 0, the same "same sign in both halves" rule as the council lesson of Nov 15). Check on history: on 28 of 28 scorecards the older half (the part before) and the newer half had the same sign (below 0). rev.js detect is NOT changed, so ev.mjs still tests the same detector.
  - Checks: node --check rev.js OK. Playwright ?demo with today's ev.json at Nov 16 09:29, 09:31, 10:00, 16:01 ET and Nov 26: 0 page errors; card muted; 0 ⤾ flags. With a copy of ev.json where the newer half is +0.1%: the card is not muted (the hold lets go). Fund page #/f/TSLL: 0 page errors.
  - Pages build and deployment: success (run 43969489423, 61644a4).
- Council task 1: confirmed. With cal.js the page phase on Nov 16 is "pre" at 09:29 ET, "regular" at 09:31 and 10:00 ET, "post" at 16:01 ET; Nov 26 "closed". 0 page errors.
- Branch letf-research (not main, no deploy): research/stopsplit.mjs, record only. index.html on that branch is now the main copy (setupCore is the same text).
- worker.js not changed. Steven does not need to paste anything.

### Not changed
- Full plans: no gate. Walk-forward of "shut full plans while the newer half < 0" with the per-day record (gate state from the days before each day, Nov 2 – Nov 16): the gate never shut before today, so there is no test of it. Open days +0.012% (n 79). The newer half went below 0 because of Nov 16 (−0.57%, n 18). I do not add a gate on one day. If tomorrow the newer half stays below 0, I test again with 2 shut days.
- LEAN gate: same check on the per-day record (LEAN = all minus full): shut on all 11 days, LEAN on those days −0.17% per plan (n 234). The gate is correct; no change.
- No stop change (Steven's rule; the stop split is record only, and no stop variant won walk-forward on Nov 14).
- 🚀 push: stays off (fast.15m.alert newer half < 0). Flag text: no change.
- Fast-move items: fast.5m.15m and fast.1m.15m have halves that disagree; the page already says "no clear edge". The mute hold is only for the turn rules (the fade text of fast moves needs its limit test).

### Lessons for the other agents
- A mute can come off when the test window moves, also when the rule still loses on both halves. The z of a 7-day window falls when the worst days leave the window. Keep a mute while both halves are below 0; let it go only when one half is above 0. SOXX and Cohort agents: check that your page does not show a muted rule again only because z went above −2.
- Split the stop losses by signal hour, not only by day and by market. Here 63% of the stop exits came in hours where 3 to 7 markets stopped together. One market move hits many plans on the same side. SOXX agent: check if your funds stop exits are on the same hours as the spot stops.

### For the council
- ev.mjs (data, small): when the time gate keeps no time of day, please still write the .tgate item (n 0, keep [], why "no time of day won on the older half"). Today fast.15m.alert.tgate is missing, and a missing item looks like "no data" on the page.
- ev.mjs (record only, new item request): plan.setup.60m.hour = per signal hour (ET day + hour) the count of plans and stops across the 24 underlyings, and the plan mean when 3+ plans are on the same side in the same hour against 1–2 plans. Question to test walk-forward: do the plans lose when many underlyings give the same side at the same time (one market move)? A rule "at most N plans on one side per hour" needs this test first.
- Please confirm the mute hold (rev.js 61644a4). If you agree, it can be a general rule in evrules.js (shared): factor 0 while ev < 0, older < 0 and newer < 0 for an item that was MUTE on an earlier scorecard. I did not edit evrules.js.

### Backlog
1. Full plans: if the newer half stays below 0 on Nov 17, test the full-plan gate again on the per-day record (2+ shut days needed).
2. Plan crowding by hour: after the council adds plan.setup.60m.hour, test a limit of plans on one side per hour, walk-forward.
3. fast.15m.15m.tgate and fade.rev.15m.tgate: count positive new days from Nov 16 (each has 1 of 3 now).
4. rev.js backtest(): use the true New York clock for the day split before Mar 14 2027.
5. Audit leverage and underlying of the fund list against instruments.json (needs the Worker list).
6. 🚀 threshold per fund kind (fund move ÷ leverage), needs an ev.mjs test first.

### Watch next
- Pages: the reversal card says "MUTED · both test halves lose" and the scanner shows no ⤾ flags, while rev.all.15m and rev.hard.15m have both halves below 0. If one half goes above 0, the flags come back and the card says WATCH or CUT.
- fade.rev.15m day record: Nov 17 positive (the turns keep failing) supports the hold.
- plan.setup.full.60m newer half: above 0 again, or a second day below 0 (then backlog 1).
- fast.15m.15m.tgate: Nov 17 positive (2 of 3 new days).

## 2026-11-15 · LETF agent

### Evidence
- Source: ev.json on branch ev (2026-11-15 01:06 UTC), trackers.letf, 24 of 24 underlyings, 9 of 9 funds. This is the first scorecard with the true New York clock. Sunday: no new market day since Nov 13.
- Muted (page already mutes): rev.all.15m −0.23% (n 110, z −2.4); rev.hard.15m −0.33% (n 23, z −2.6).
- plan.setup.60m (all plans): n 504, −0.04%, older −0.005%, newer −0.08%, WATCH (was CUT). Exits: target 29 +1.05%, stop 69 −0.98%, time 406 +0.04%.
- plan.setup.lean.60m: CUT, n 373, −0.08%, older +0.015%, newer −0.18%. The LEAN gate stays shut (newer half < 0).
- plan.setup.full.60m: WATCH, n 131, +0.08%, older +0.10%, newer +0.06%. Both halves above 0: no gate (council task 3).
- Council task 1 (nostop): full plans no stop +0.09% (older +0.102%, newer +0.079%) against the plan stop +0.08% (older +0.103%, newer +0.056%). On the older half the stop is equal or better, so "no stop" is not a walk-forward winner. All plans no stop −0.003% (older −0.024%, newer +0.018%); LEAN no stop −0.036% (newer −0.067%). No stop change.
- 🚀: fast.15m.alert.tgate BACK +0.97% (n 26, z 2.3); fast.15m.15m.tgate BACK +0.86% (n 38, z 2.5). New days start Nov 16 (council task 2).
- fade.15m.15m CUT −0.34%, both halves < 0 (the limit fade of a 🚀 move loses: do not show it as a trade).
- DATA BUG on the page (found today): phaseAt() had no market holidays and no early closes. On Thanksgiving (Nov 26) the page was "regular" or "pre": day-move alerts (🔥) could fire again on the last session's moves, rows could show "stale", and rev.js could read old 1-minute bars as a live reversal. On Nov 27 and Dec 24 (close 13:00 ET) the hours 13:00–16:00 counted as regular (stale flags, volume pace divided by the wrong session length).

### Shipped today
- LETF-Sniper e3d9c77 (index.html, inline code; no script file changed, so no ?v= bump):
  - NYSE calendar 2026–2027 (NYSE Group release of Dec 23 2025): holidays → "closed"; early closes (2026-11-27, 2026-12-24, 2027-11-26) → regular until 13:00 ET, extended hours until 17:00 ET.
  - Volume pace and the expected-volume fraction use the true session length (210 min on an early-close day). The extended-hours cut and chart shade use the same session end.
  - setupCore and vwapBands are not changed (checked: the code that ev.mjs reads, resample … setupCore, is the same text), so the plan test does not move.
- Checks: all inline scripts parse (node --check). phaseAt unit check: Nov 26 15:00Z closed; Nov 27 12:30 ET regular, 13:30 ET post, 17:30 ET closed; Nov 16 10:00 ET regular; 2027-03-26 closed. Playwright ?demo: 0 page errors now, with the clock at Thanksgiving (phase closed) and at Nov 27 14:00 ET (phase post); fund page #/f/TSLL: 0 page errors.
- Walk-forward: not applicable (calendar fact, no fitted value).
- Pages build and deployment: success (run 43768940619, e3d9c77).
- worker.js not changed. Steven does not need to paste anything.

### Not changed
- No stop change: "no stop" does not win on the older half (see Evidence). Steven's rule: a stop change needs a stated reason.
- Full plans: no gate; both halves above 0.
- 🚀 push and flag text: unchanged until 3 positive new days (from Nov 16).
- rev.js backtest() splits days with a fixed UTC−5 clock. Its bars are regular hours only, so the split is correct until the DST change (Mar 14 2027). Backlog.
- Shared files and ev.mjs: not edited.

### Lessons for the other agents
- Check the market calendar, not only the clock. A page that knows weekends but not holidays treats Thanksgiving as a trading day and Nov 27 as a full day. SOXX agent: check that the paper bots do not open a trade or count a "day" on Nov 26, and that time exits on Nov 27 happen before 13:00 ET. Cohort agent: check any "market day" count.
- web.js (shared) already has a holiday list (HOL) for the cycle tags, but it is private to web.js. Each page needs its own copy until a shared one exists.

### For the council
- Shared-file request: a shared market calendar (holidays and early closes, 2026–2028) in one small shared file, used by index.html phaseAt on LETF and SOXX and by the SOXX paper bots. web.js HOL has no early closes and no 2027 dates after Dec 25 2026 (please check).
- ev.mjs: on Nov 27 and Dec 24 the 60-minute plan time exit and the "close" tod bucket must end at 13:00 ET. Please check that a plan from 12:30 ET on an early-close day does not read bars of the next day as its time exit.
- ev.mjs: no other request today. A per-day nostop record is not needed yet: the older half already decides it.

### Backlog
1. From Nov 16: fast.15m.alert.tgate.days; 🚀 push in 09:30–10:30 ET only after 3 positive new days.
2. If plan.setup.full.60m newer half goes below 0: test the newer-half gate for full plans (walk-forward first).
3. rev.js backtest(): use etInfo (true New York clock) for the day split before Mar 14 2027.
4. Audit leverage and underlying of the fund list against instruments.json (needs the Worker list).
5. 🚀 threshold per fund kind (fund move ÷ leverage) for consistency between 1.5×, 2× and 3× funds on one underlying; needs a new ev.mjs test first (the BACK result uses the fund move).

### Watch next
- Nov 16 (Monday): the page shows "regular" 09:30–16:00 ET as before (no change on normal days). No new page errors.
- Nov 26: the heartbeat shows closed, no 🔥 day-move alerts, no live reversal. Nov 27: regular ends at 13:00 ET; no "stale" rows after 13:00.
- fast.15m.alert.tgate.days: positive new days from Nov 16.
- plan.setup.full.60m: both halves above 0; plan.setup.lean.60m newer half below 0 (gate shut).

## 2026-11-14 · LETF agent

### Evidence
- Source: ev.json on branch ev (2026-11-14 22:05 UTC), trackers.letf, 24 of 24 underlyings, 9 of 9 funds. Market closed (Saturday). This session cannot get bars (Yahoo is blocked from the cloud). For the stop test I ran a record-only script in GitHub Actions on branch letf-research of LETF-Sniper (run 43647856215). It reproduces the scorecard exactly: n 461, exits target 24 +1.15%, stop 60 −0.92%, time 377 +0.11%.
- Muted: rev.all.15m −0.23% (z −2.4); rev.hard.15m −0.33% (z −2.6). The page already mutes both.
- plan.setup.lean.60m: n 362, all data −0.0012%, older +0.21%, newer −0.215%, ruling WATCH (changed from CUT). On 6 scorecards (Nov 12 – 14) all data was −0.004, −0.017, +0.0016, +0.0016, −0.0012% and the ruling went watch → cut → watch. The newer half was always −0.18 … −0.25%. Both "all data" and the ruling flip on noise.
- plan.setup.full.60m: n 99, +0.15%, older +0.23%, newer +0.06%, WATCH.
- Council task 1 (why stop exits lose). Plans that end on the stop have a near stop: distance entry → stop median 1.34 × 5-min ATR (other exits: 5.47 ATR). Plans with a stop nearer than 1 ATR end on the stop 58% of the time. Only 6 of 60 stops hit on the fill bar. The limit fallback (limit = middle of last and stop) did not occur. Thus the stop is not a bad fill; it is a normal hit of a near volume-node stop.
- Walk-forward of exit variants (choose on the older days Oct 22 – Oct 31, report Nov 3 – 13; per plan on the underlying):
  - All plans: current plan stop newer −0.155% (n 231). Chosen on older: "only stops ≤ 3 ATR" → newer −0.249% (worse). No stop at all: older +0.22%, newer −0.06% (best on newer, but not chosen on older: plan +0.217%, none +0.223%, 1.5 ATR stop +0.234%).
  - Full plans: chosen "stop 1.5 ATR" → newer −0.275% vs plan −0.08% (worse). LEAN: chosen "stops ≤ 5 ATR" → newer −0.124% vs −0.167% (still < 0).
  - Result: no exit variant wins walk-forward. The stop exits lose because a near stop is hit; the loss after the decay is in the entry signal, not in the stop. No stop change.
- DATA BUG (ev.mjs, for the council): etMin and tod use a fixed UTC−5 clock. Before Nov 1 2026 New York was UTC−4. On the October days of plan.setup.*, the first hour (09:30–10:30) is lost and each "10:25 ET" signal is in fact 11:25 ET. With a true New York clock (same code, same bars): all plans n 504, −0.04% (scorecard: +0.03%); full plans n 131, +0.08% (scorecard: +0.15%); LEAN n 373, −0.08%; older half of all plans +0.055% (scorecard: +0.217%). The newer half (from Nov 3) is the same on both clocks. The bug makes the older half of the plan test look better than it was.
- 🚀: fast.15m.15m.tgate BACK +0.86% (n 38, z 2.5); fast.15m.alert.tgate BACK +0.97% (n 26, z 2.3); fast.15m.alert CUT (newer −0.12%). New days start Nov 16.

### Shipped today
- LETF-Sniper 8d48ee8 (index.html, inline code; no script file changed, so no ?v= bump):
  1. LEAN gate reads only the newer half: shut while plan.setup.lean.60m has n ≥ 30 and newer half < 0. Why: today the ruling is WATCH and all data is −0.0012%, so on Monday one small plan can open the gate on noise while the newer half is −0.21% (council lesson of Nov 13: a 0 limit flips on noise). The new rule is the stated reopen condition. Check: on all 6 past scorecards it gives the same decision as before (shut). No fitted value.
  2. The plan score line on the fund page also shows the result per exit kind (byExit): target, stop, 60-min time. The reader sees that the loss comes from stop exits.
- Checks: all inline scripts parse (node --check); Playwright ?demo with today's ev.json: 0 page errors; TSLL/TSLQ, SOXL/SOXS, TQQQ/SQQQ and CONL show the same LEAN WAIT on the long and the inverse fund; MSTU shows LONG SETUP with its exits (stop −0.68%, n 11; time +0.24%, n 84).
- Pages build and deployment: success (run 43648128297, 8d48ee8).
- Branch letf-research (LETF-Sniper, new, not main): research/stops.mjs and a workflow that runs it on push. Record only; it does not deploy. Same plan engine as ev.mjs (setupCore read from index.html).
- worker.js not changed. Steven does not need to paste anything.

### Not changed
- No stop change: no exit variant won walk-forward (see Evidence). Steven's rule: a stop change needs a stated reason; there is none.
- Full plans: no gate. Scorecard newer half +0.06%. (By day, Nov 3 – 13, full plans are −0.08%, n 58: watch.)
- 🚀 push and flag text: unchanged until 3 positive new days (from Nov 16).
- Shared files and ev.mjs: not edited.

### Lessons for the other agents
- Check the clock. A fixed UTC−5 clock is wrong before Nov 1 (EDT). Any test with October bars and a time-of-day rule is shifted by 1 hour. SOXX and Cohort agents: check your tod windows and 11:00–11:30 ET rules on data from before Nov 2.
- A stop that is hit often is not always a bad stop. Here the hit stops are the near ones, and no wider or no stop won on new days. Test the variants walk-forward before you move a stop.
- A gate should read one input with a clear meaning (here the newer half). "All data" near 0 and the ruling both flipped 3 times in 6 scorecards.
- When the cloud cannot get bars, a record-only workflow on a side branch can run the test in GitHub Actions and print the result to the log.

### For the council
- ev.mjs DATA BUG (high): etMin, etDay and tod use t − 5 h. Please use the real New York time (Intl.DateTimeFormat with timeZone "America/New_York", as in research/stops.mjs on branch letf-research of LETF-Sniper). It changes plan.setup.* (October days) and every tod split that uses bars from before Nov 2. Expected after the fix (from my run): plan.setup.60m ≈ −0.04% (n ≈ 504), full ≈ +0.08% (n ≈ 131). The next DST change is Mar 8 2027.
- ev.mjs (record only, new item request): plan.setup.full.60m.nostop (same plan, exit at the target or 60 min, no stop) and riskA quartiles (entry → stop in 5-min ATR) per exit kind. My run says "no stop" was the best on the newer days (−0.06% vs −0.155%), but it did not win on the older days. A scored record on new days decides it. No page change until then.
- Review of your LEAN gate fix 5ed6c6d (task 3): it matched my test on the data of Nov 13. I replaced it today with "newer half < 0" only (8d48ee8), because today's ruling is WATCH and all data is −0.0012%: your rule and mine both open on noise. Please confirm.
- layout.js: no request today.

### Backlog
1. When ev.mjs uses the true clock: read plan.setup.full.60m again. If its newer half goes below 0, test the same newer-half gate for full plans (walk-forward first).
2. From Nov 16: fast.15m.alert.tgate.days; 🚀 push in 09:30–10:30 ET only after 3 positive new days.
3. Show fade.15m.15m next to the 🚀 rule with its new-day record.
4. Audit leverage and underlying of the fund list against instruments.json (needs the Worker list; not reachable from the cloud).
5. 🚀 threshold per fund kind: per-underlying move (fund move ÷ leverage) between 1.5× and 2× funds.

### Watch next
- Pages build for 8d48ee8 is success. On the live fund page, LEAN reads stay WAIT on every fund of the underlying, also when all data of plan.setup.lean.60m goes above 0, while its newer half is below 0.
- The plan score line shows "Exits in this test" with target, stop and time.
- After the council clock fix: plan.setup.* numbers move as in "For the council". If full plans fall below 0 on the newer half, act (backlog 1).
- fast.15m.alert.tgate: stays BACK, with new days from Nov 16.

## 2026-11-13 · LETF agent

### Evidence
- Source: ev.json on branch ev (2026-11-13 21:49 UTC), trackers.letf, 24 of 24 underlyings, 9 of 9 funds, 14 spikes flattened. This scorecard has the Nov 13 data. This session cannot get bars. I used the scorecard only.
- plan.setup.60m (all fund-page plans): CUT for decay, n 461, +0.02% per plan, older +0.22%, newer −0.18%, fill 70%, exits: target 26, stop 63, time 372. The last 5 market days all lost (Nov 9 −0.07%, Nov 10 −0.67%, Nov 11 −0.09%, Nov 12 −0.43%, Nov 13 −0.22%).
- plan.setup.lean.60m (LEAN, 2 of 3 filters): n 362, −0.02%, older +0.22%, newer −0.25% (second scorecard in a row with the newer half below 0; Nov 12: −0.18%). Last 5 days: −0.11%, −0.72%, −0.34%, −0.58%, −0.40%. 79% of all plans are LEAN.
- plan.setup.full.60m (LONG / SHORT SETUP): n 99, +0.15%, z 1.7, older +0.24%, newer +0.05%, WATCH. Both halves above 0.
- Council task 1, walk-forward (choose on the older 9 plan days, Oct 22 – Nov 3; report the newer 8 days, Nov 4 – 13, only):
  - Fixed choice "show LEAN" or "WAIT for LEAN" on the older days: show LEAN wins (+0.16% per plan, n 199, against 0). On the newer days that choice gives −0.23% per plan (n 163). Thus a fixed choice made on older days does NOT give WAIT.
  - Trailing gates (show LEAN only when the last k days of LEAN were above 0), k chosen on the older days: no k beat "always show" on the older days, so none is chosen.
  - Gate that reads only the scorecard state of the days before each day (shut LEAN when its newer half < 0 AND all data ≤ 0; no fitted value, fixed level 0): it shut LEAN on Nov 12 and Nov 13 only. Shut days: −0.53% per plan (n 34). Open days (Oct 28 – Nov 11): −0.05% (n 229). The same gate never shut LONG/SHORT SETUP (n 75, +0.12%). Small sample (2 shut days).
- Council task 3: fast.15m.15m.open10 (record only): 9:40 +1.73% (n 26), 9:50 −1.42% (n 7), 10:00 +0.12% (n 16), 10:10 +0.61% (n 7), 10:20 +0.25% (n 8). No cluster at 10:20–10:30 ET. All buckets except 9:40 have n < 30. No rule.
- 🚀: fast.15m.15m WATCH, +0.15%, both halves > 0 (+0.15%, +0.16%); trimmed +0.25%. fast.15m.15m.tgate (open hour, chosen on the older half, newer half only): BACK, +0.86%, n 38, z 2.5. fast.15m.alert: CUT (decay, newer −0.12%). fast.15m.alert.tgate: BACK, +0.97%, n 26, z 2.3. On Nov 12 the same gate was −0.00% (n 29), on Nov 11 MUTE (−1.09%).
- Reversal and fast-move follow: rev.all.15m MUTE (−0.21%, z −2.2). rev.hard.15m CUT → MUTE (−0.30%, z −2.5); the page already muted HARD turns with all turns. fast.1m.15m WATCH (−0.22%, both halves < 0). fast.5m.15m WATCH (+0.04%, halves disagree). fade.15m.15m CUT (−0.38%, both halves < 0). No fade test has 3 positive new days.

### Shipped today
- LETF-Sniper 78121bc (index.html, inline code; no script file changed, so no ?v= bump):
  1. LEAN gate: setupOf now passes through leanGate. While plan.setup.lean.60m has n ≥ 30, newer half < 0 and all data ≤ 0, a LEAN read shows "WAIT · LEAN LONG (2 of 3 filters) is off: LEAN plans lost on the newer days of the test", with no plan (no entry, target, stop). It applies to the underlying's read, so the long fund and the inverse fund show the same WAIT. U.side is 0, so the agreement panel and the web get no LEAN signal. It comes back by itself when the scorecard changes. If ev.json is not loaded, nothing changes.
  2. Plan score next to the plan (council task 2, my backlog 1): each plan shows its own test (full or LEAN), EV per plan on the underlying (about × leverage on the fund), n, older and newer halves, the ruling and the fill rate. A gated LEAN shows the LEAN numbers and the condition to come back.
- Why: priority 1 (negative EV). LEAN is 79% of the plans and lost on each of the last 5 market days. LONG/SHORT SETUP is not changed.
- setupCore is NOT changed (checked: the function text is the same), so the plan test in ev.mjs still scores LEAN and full plans with the same code. The ev.mjs code extraction (resample … setupCore) still runs in a vm (checked offline).
- Checks: all inline scripts parse. Playwright ?demo with today's ev.json: 0 page errors; 14 underlyings, 20 funds: 8 LEAN reads gated, 0 underlyings with inconsistent readings (TSLL and TSLQ both WAIT); fund page TSLL shows the WAIT and the LEAN score; AXTX (LONG SETUP) shows the plan and its score. Pages build and deployment: success (run 43518705696, 78121bc).
- worker.js not changed. Steven does not need to paste anything.

### Not changed
- 🚀 push: stays off. The rule (Nov 11) needs fast.15m.alert newer half > 0; it is −0.12%. The open-hour gate is BACK for the first time, but it was −0.00% yesterday and MUTE on Nov 11. One day (Nov 13) moved it. I need a record per new day first (request below).
- 🚀 flag text: fast.15m.15m is WATCH with both halves > 0. The text "no proven edge, do not chase" stays correct.
- No change to the reversal detector (muted already) or to fade tests.
- Shared files: not edited.

### Lessons for the other agents
- A fixed choice made on the older days can be the wrong choice, and a walk-forward test shows it. LEAN won on the older days and lost on the newer days. A gate that reads only the scorecard of the days before each day caught the decay; a fixed choice did not. Cohort agent: your two-run gate is the same idea; count days.
- A plan with fewer filters is most of the plans. 79% of LETF plans were LEAN. When you gate the weak version, check how much of the page goes quiet, and say why on the page.
- Show the score next to the thing it scores. The reader sees "+0.15% per plan, not proven" next to the plan, not only on the scorecard.

### For the council
- ev.mjs (new item request): fast.15m.15m.tgate.days and fast.15m.alert.tgate.days (per new market day, n and mean, from Nov 14), same form as fade.*.days. The open-hour gate is BACK on one scorecard; I want 3 positive new days before the push or the flag text changes.
- ev.mjs (new item request): plan.setup.full.60m.tod is there; please add plan.setup.full.60m by hold exit (target, stop, time) with mean per exit. 372 of 461 plans exit on time; maybe the 60-min limit is too short or the target too far. Record only.
- ev.mjs: no change to the plan test. The page gate does not change setupCore, so LEAN keeps its score and can come back.
- layout.js (shared): request of Nov 8 stays open (put #revCard after the scanner while rev.all.15m is muted).

### Backlog
1. When tgate.days exists and the open-hour 🚀 gate has 3 positive new days: push the 🚀 alert only 09:30–10:30 ET, and change the flag text in that hour.
2. Show fade.15m.15m (limit fade of 🚀) next to the 🚀 rule, with its new-day record.
3. Audit leverage and underlying of the fund list against instruments.json.
4. 🚀 threshold per fund kind: check a per-underlying move (fund move ÷ leverage) for consistency between 1.5× and 2× funds.

### Watch next
- Pages build for 78121bc is success. On the live fund page, a LEAN read shows WAIT with no plan on every fund of the underlying; LONG/SHORT SETUP shows its plan and "+0.15% per plan · WATCH".
- plan.setup.lean.60m: the newer half stays below 0 (gate stays shut). If it goes above 0, LEAN plans come back by themselves: check that this is correct.
- plan.setup.full.60m: both halves must stay above 0. If the newer half goes below 0, I will test the same gate for full plans (walk-forward first).
- fast.15m.alert.tgate: must stay BACK on the next scorecards, with positive new days.

## 2026-11-12 · LETF agent

### Evidence
- Source: ev.json on branch ev (2026-11-12 22:15 UTC), trackers.letf, 24 of 24 underlyings, 9 of 9 funds, 14 spikes flattened. This scorecard has the Nov 12 data. This session cannot get bars (Yahoo and github.io are blocked from the cloud). I used the scorecard and the EV governor log (run 43318130510).
- rev.all.15m: MUTE, n 126, −0.20% per 15 min, z −2.3 (older −0.37%, newer −0.03%). rev.hard.15m: CUT, n 27, −0.19% (the page mutes it with all turns).
- fast.1m.15m: WATCH, n 29, −0.22%, both halves negative (−0.39%, −0.07%). fast.5m.15m: WATCH, n 31, +0.04%, halves disagree (−0.15%, +0.22%). The page says "do not follow" and "no clear edge". No follow flag exists for 1-minute or 5-minute moves.
- Largest single events (log): SMCI Nov 12 11:24–11:25 ET, −2.95% in 1 min (−3.65% in 5 min), then +5.35% in the next 15 min. One event moves these small samples very much.
- Limit fades: fade.fast5m.15m BACK → CUT (Nov 12: −0.93%, n 5; new-day streak 0). fade.fast1m.15m WATCH, n 14, −0.33%; Nov 12 −0.62% with 100% fill (n 8). fade.fast1m.15m.k25 (limit 0.25σ): n 17, fill 59%, −0.27%; Nov 12 −0.63% with 100% fill. fade.rev.15m BACK → CUT (decay: newer half −0.05%; new days 1 of 4 positive (Nov 12 +0.13%), streak 1). fade.15m.15m WATCH, −0.06%; Nov 12 −0.41%.
- 🚀 rule fast.15m.15m: WATCH → CUT (decay: older +0.28%, newer −0.22%). Time of day (same data): open +0.44% (n 65), mid −0.29% (n 91). Walk-forward gate (window chosen on the older half: open), newer half only: +0.09%, n 39, z 0.2. No edge.
- 🚀 alert fast.15m.alert: WATCH, −0.04%, older +0.34%, newer −0.40% (third scorecard with the newer half below 0). fast.15m.alert.tgate: MUTE → WATCH (open only, newer half −0.00%, n 29).
- Consistency check (?demo, Playwright, 10 underlyings with 2+ funds): with the underlying chart loaded, every fund gives the same reading (0 of 10 bad). With the underlying chart missing, the page read each fund's own chart: 7 of 9 underlyings gave inconsistent readings, for example SPXL "LONG SETUP" and SPXS "LONG SETUP" (opposite bets on SPY). In live use this occurs when the Worker /chart call for the underlying fails or is slow; uvLoad then waited 55 s before it tried again.

### Shipped today
- LETF-Sniper fc16bd9 (index.html, inline code; no script file changed, so no ?v= bump):
  1. setupOf: when a fund has an underlying but the underlying's 5-minute chart is not loaded, the setup is "WAIT · the $<underlying> chart is not loaded yet", with no plan (no entry, target or stop). All long and inverse funds on that underlying show the same WAIT. A line says that the filters below come from the fund's own chart only and are not a setup. Agree.publish and the web emit do not fire for this state.
  2. uvLoad: when the underlying's bars do not load, it tries again after 10 s (before: 55 s).
- Why: priority 2 (inconsistent setups on one underlying). Steven's rule: long and inverse funds on one underlying must give one consistent reading.
- Walk-forward: not applicable (no new rule, no threshold). The change removes a reading that had no test and could give opposite bets.
- Checks: Playwright ?demo: with underlying bars, 0 of 10 underlyings inconsistent (same as before); with the underlying bars removed, 0 of 10 inconsistent and no plan (before: 7 of 9 inconsistent). Fund page SPXS with SPY missing shows the WAIT text. 0 page errors on /, ?demo and ?demo#/f/SOXS. Pages build and deployment: success (run 43319334485, fc16bd9).
- Council task 2 checked with today's ev.json (route of ev.json to the local file, ?demo, synthetic +9% 15-minute move): fastPushOn() = false; alert text "… no proven edge, do not chase · not pushed: this alert lost on the newer days of the test"; hot = false. The push stays off. I cannot open the live github.io page from the cloud.
- worker.js not changed. Steven does not need to paste anything.

### Not changed
- 🚀 flag: kept with "no proven edge, do not chase". fast.15m.15m is CUT for decay, not negative on both halves. The open window is positive on all data (+0.44%), but the walk-forward gate (open, chosen on the older half) gives only +0.09% on the newer half (z 0.2). That is not evidence for an "open only" flag.
- No fade flag: no fade test has 3 positive new days in a row. A closer limit (k25) fills more (59% against 48%) but loses the same (Nov 12 −0.63% at 100% fill). When every limit fills, the move kept going against the fade (adverse selection). Do not move the limit closer.
- Council task 3 (🚀 cluster at 10:20–10:30 ET): the scorecard splits only open (09:30–10:30), mid (10:30–15:00) and close. 65 of 162 🚀 events (40%) are in the open hour, which is 15% of the session. I cannot see 10-minute buckets from the scorecard, and I cannot get bars. Request below.
- Shared files: not edited.

### Lessons for the other agents
- A fallback can break a consistency rule. The page read the underlying for every fund, but when that chart did not load it read each fund's own chart in silence. Check what your page shows when one data source fails, not only when all load. Show WAIT, not a reading from a different source.
- A closer limit is not a better limit. LETF k25 fills more often, and the extra fills are the losers (100% fill on the worst day). SOXX agent: check the fill rate per day next to the result for your limit entries.
- One event can flip a small test. SMCI on Nov 12 (+5.35% in 15 min after a −3.65% drop) moved fast.5m.15m from a negative newer half to a positive one. Read the log of the largest events before you act on a small n.

### For the council
- ev.mjs (new item request): fast.15m.15m by 10-minute ET bucket in the open hour (09:30–10:30), n and mean per bucket, the same events as fast.15m.15m. Only a record (WATCH), for your 10:20–10:30 swing lesson. No ruling from it.
- ev.mjs (request from Nov 11, still open): score the setupOf plan. It is the main trade plan on the fund page and has no score. Rule (same code as index.html setupCore on the UNDERLYING's 5-minute bars): when side ≠ 0, LIMIT entry 0.5 × 5-min ATR in the trade direction, alive 60 min, counts only when touched; exit at the target or the stop or after 60 min; report fill rate, EV per trade, older and newer halves, one per underlying per hour. Please copy setupCore, swings, profile, trendOf, rsi, ema, atr into ev.mjs (the same code as the page).
- ev.mjs: fade.fast1m.15m.k25 answered the question (more fills, no edge). You can drop it if the scorecard is too long.
- layout.js (shared): request of Nov 8 stays open (put #revCard after the scanner while rev.all.15m is muted).

### Backlog
1. When the setupOf plan has a score: show its EV on the fund page next to the plan, and mute the plan if it is proven negative.
2. Show fade.15m.15m (limit fade of 🚀) next to the 🚀 rule, with its new-day record.
3. Audit leverage and underlying of the fund list against instruments.json.
4. The 🚀 flag threshold is per fund kind (4% single-stock, 2% index). A 1.5× and a 2× fund on one underlying can disagree. Check if a per-underlying move (fund move ÷ leverage) is more consistent.

### Watch next
- Pages build for fc16bd9 is success. On the live fund page, a long fund and its inverse fund never show opposite setups (WAIT when the underlying chart is missing).
- fast.15m.alert newer half stays below 0: the push stays off. If it goes above 0 and the tgate is not MUTE, the push comes back by itself.
- fade.fast5m.15m and fade.fast1m.15m: Nov 13 must be > 0 to start a streak. fast.1m.15m must stay negative on both halves (no follow flag).
- fast.15m.15m (🚀): if the newer half stays below 0 and the older half goes below 0 too, the flag text changes by itself to "fast moves tended to come back: do not chase".

## 2026-11-11 · LETF agent

### Evidence
- Source: ev.json on branch ev (2026-11-11 22:15 UTC), trackers.letf, 24 of 24 underlyings, 9 of 9 funds, 14 spikes flattened. This scorecard has the Nov 11 data. This session cannot get bars (Yahoo is blocked from the cloud).
- 🚀 alert level (fast.15m.alert, 5% / 2.5% in 15 min, $1M+ traded): n 102, −0.20% per 15 min, older half +0.54%, newer half −0.94%. Its walk-forward time gate (fast.15m.alert.tgate): MUTE, −1.09%, z −2.5, n 48.
- 🚀 flag level (fast.15m.15m): n 149, −0.04%, WATCH. Newer half −0.53% (Nov 10 scorecard: −0.52%). Second scorecard in a row with the newer half below 0. Council task 2 condition is met: stop the 🚀 push alert.
- fast.1m.15m: MUTE → CUT (z −1.9, n 25), both halves negative (−0.32%, −0.54%). fast.5m.15m: CUT, both halves negative (−0.06%, −0.34%).
- The limit fades of fast moves are not proven on new days: fade.fast1m.15m WATCH, n 9, −0.03% (fill 36%). fade.fast5m.15m BACK, n 19, +0.27%, z 2.1, but new days: Nov 9 +0.39% (14), Nov 10 −0.36% (1) → 0 of 3 in a row.
- Problem found on the page: with both follow halves negative, the reversal card line said "CUT (fade fast moves)". That reads as an instruction to fade, but the tradable (limit-entry) fade is not proven.
- Council task 1 checked: no follow flag for fast 1-minute or 5-minute moves exists in the scanner (index.html makes no flag from m1 or m5). Only 🚀 (15 min) makes a flag.
- fade.rev.15m: WATCH, n 89, +0.09%. New days: Nov 9 −0.01% (11), Nov 10 −0.03% (15), Nov 11 −0.00% (5). 0 of 3, three negative new days. fade.15m.15m (limit fade of 🚀): WATCH, −0.04%, new days Nov 9 −0.39%, Nov 10 −0.35%, Nov 11 +0.42% → 1 of 3.
- rev.all.15m: MUTE, n 133, −0.20%, z −2.4. rev.hard.15m: CUT (the page uses the mute of all turns).

### Shipped today
- LETF-Sniper 3b35b96 (index.html, rev.js, rev.js?v=7):
  1. 🚀 push alert: the phone/desktop notification stops while fast.15m.alert loses on the newer half OR fast.15m.alert.tgate is muted. The alert stays in the alert list, not highlighted, with "not pushed: this alert lost on the newer days of the test". It comes back by itself when the newer half is above 0 and the gate is not muted. If ev.json is not loaded, the old behaviour stays.
  2. Fast 1-minute and 5-minute lines on the reversal card: "do not follow; the limit-entry fade is not proven yet" (before: "fade fast moves"). "fade fast moves" comes back only when the limit test is BACK on both halves and has 3 positive new days in a row.
- Why: priority 1 (negative EV). The exact alert level loses on the newer days (−0.94%) and its time gate is proven negative (z −2.5). A push makes a reader act fast on a move that tended to come back.
- Walk-forward: no new rule, no new threshold. The stop uses the newer half (the unseen part of the test) and the council's tgate item (windows chosen on the older half, scored on the newer half). Rule from the council note of Nov 10.
- Checks: node --check rev.js OK. Playwright ?demo with today's ev.json: 0 page errors; fastPushOn() false; a synthetic +8% 15-minute move made a list entry with "not pushed" and hot false; card text correct. Live page (no data): 0 page errors. Pages build and deployment: success (run 43111250507, 3b35b96).
- worker.js not changed (it is not in the repo). Steven does not need to paste anything.

### Not changed
- 🚀 flag in the Signals column: kept, with "no proven edge, do not chase". fast.15m.15m is WATCH (all data −0.04%), not muted.
- "Moving fast now" X post: kept. It is made only when the reader clicks, and it carries the same text.
- No fade flag: no fade test has 3 positive new days in a row (fade.rev 0, fade.fast5m 0, fade.15m 1, fade.fast1m no new days).
- fade.15m.15m is not on the card yet. Small value now (WATCH, −0.04%). Backlog.
- Shared files: not edited.

### Lessons for the other agents
- A rule that wins on the older half and loses on the newer half on two scorecards in a row is decay. Stop the push first (the part that makes people act fast); keep the quiet display with the honest text.
- A negative "follow" test is not a positive "fade" trade. Show the fade as a trade only when its own limit-entry test passes. SOXX agent: check your "opposite reading" texts the same way.
- Make each stop data-driven (read the scorecard item), so it comes back by itself when the evidence changes, with no new code.

### For the council
- ev.mjs: fade.fast1m.15m fills only 36% of limits (n 9). Please report the fill rate per new day, and a 0.25σ limit version as a separate item (fit on the older half only), so the fill can be compared. Do not change the current item.
- ev.mjs: fade.rev.15m has 3 negative new days (Nov 9–11). I suggest you keep it as WATCH for the record, but it is not a candidate for a flag. Please tell me if you want to drop it.
- layout.js (shared): request of Nov 8 stays open (put #revCard after the scanner while rev.all.15m is muted).
- New test request: score the setupOf plan (level-to-level limit entry on the underlying: fill rate and 1-hour result, one per underlying).

### Backlog
1. Show fade.15m.15m (limit fade of 🚀) next to the 🚀 rule (help text or card), with its new-day record.
2. When a fade test has 3 positive new days in a row and is BACK on both halves: a fade flag with a limit entry and a stated stop (beyond the turn extreme or the fast-move extreme).
3. Audit leverage and underlying of the fund list against instruments.json.
4. Score the setupOf plan (council test request above).

### Watch next
- Live page rev.js?v=7: a 🚀 move shows in the alert list with "not pushed" and makes no notification.
- Next scorecard: fast.15m.alert newer half stays below 0 (push stays off). If it goes above 0 and the tgate is not MUTE, the push comes back by itself: check that it is correct.
- fade.fast5m.15m new days: Nov 12 must be > 0 to start a streak. fast.1m.15m and fast.5m.15m must stay negative on both halves (no follow flag).

## 2026-11-10 · LETF agent

### Evidence
- Source: ev.json on branch ev (2026-11-10 22:02 UTC), trackers.letf, 24 of 24 underlyings, 9 of 9 funds. This scorecard has the Nov 10 data. This session cannot get bars (Yahoo is blocked from the cloud).
- rev.all.15m: n 157, −0.17% per 15 min, z −2.4, MUTE. rev.hard.15m: n 32, −0.20%, z −1.9, CUT (the page uses the lower factor: muted).
- fast.1m.15m: n 60, −1.46%, z −4.5, MUTE. Older half −0.33%, newer half −2.60%. fast.5m.15m: n 55, −1.31%, z −3.6, MUTE (was CUT). Older −0.19%, newer −2.40%.
- Data problem: yesterday (Nov 9 scorecard) fast.1m was n 44, −0.30%, and fast.5m n 33, −0.16%. Thus the Nov 10 events alone give about −4.5% (1-minute) and −3% (5-minute) per event on the UNDERLYING in 15 min. In the same events, the limit-entry fades got almost nothing: fade.fast5m.15m newer half +0.01% (the new fills were net ≤ 0), fade.fast1m.15m newer half +0.04%. A real reversion of 3–4% would fill a limit 0.5σ away and show in the fade tests. Thus the large close-to-close numbers come from moves that came back before a limit could fill (single-bar spikes or bad prints). The mutes stay correct (follow is negative on both halves), but the size of the "opposite reading" is not tradable.
- Problem found on the page: the reversal card told the reader that the opposite reading of fast moves was "+2.60% per 15 min" (newer half). The 1-minute table said "Not yet tested with limit entries", but fade.fast1m.15m exists (BACK, n 30).
- fade.rev.15m (limit fade of a turn): n 109, +0.10%, z 1.5, WATCH, fill 69%. Found on Nov 2–6. New market days: Nov 9 −0.01% (n 11), Nov 10 −0.03% (n 15). 0 of 3 positive new days. The edge is not there on new days.
- fade.rev.15m.tgate (window chosen on the older half: mid): newer half +0.15%, n 39, z 1.0, WATCH.
- fade.fast1m.15m: BACK, +0.31%, z 2.3, but older +0.58% and newer +0.04% (decay). fade.fast5m.15m: BACK → WATCH, newer +0.01%.
- fast.15m.15m (🚀): n 158, −0.13%, z −0.6, WATCH (was CUT). Older +0.27%, newer −0.52%. Time of day (same data, not walk-forward): open +0.16% (n 65), mid −0.39% (n 85). fast.15m.alert: n 110, −0.25%, z −0.9; mid −0.74% (n 53).

### Shipped today
- LETF-Sniper 4ed9002 (rev.js, index.html rev.js?v=6):
  1. The 1-minute table shows its limit-entry test (fade.fast1m.15m). Before, it said "Not yet tested with limit entries".
  2. When a limit-entry test exists, the close-to-close halves of the opposite reading say "close to close, not a price a limit order gets". The reader sees the limit-entry number (+0.04% newer half) next to the close-to-close number (+2.60%).
  3. Each fade test shows its record of new market days (days from Nov 9, from fade.*.days) and the count of positive days in a row (0 of 3 now for fade.rev.15m). The "Passed 3 new market days" text comes only when the test is BACK on both halves AND 3 new days in a row are positive. Tests with no per-day record say so.
  4. The fade of a turn also shows the walk-forward time gate (fade.rev.15m.tgate): the window chosen on the older half and the newer-half result only.
- Why: priority 2 (wrong numbers on the page). The page overstated the fade edge of fast moves by about 60 times and named a test as missing.
- Walk-forward: no new rule, no new threshold, no new flag. The text only shows the scorecard items. The 3-day rule is the council rule of Nov 8.
- Checks: node --check rev.js OK. Playwright ?demo with the real ev.json: 0 page errors, card text correct. Synthetic ev.json (fade.rev BACK, Nov 11–13 positive): "3 of 3 positive days in a row" and "Passed 3 new market days". Pages build and deployment: success (run 42914074978, 4ed9002).
- worker.js not changed. Steven does not need to paste it again.

### Not changed
- No fade flag and no fade order: fade.rev.15m failed Nov 9 and Nov 10 (0 of 3). fade.fast1m and fade.fast5m have no per-day record and their newer halves are near 0.
- 🚀 flag and alert: WATCH, not muted. The text already says "no proven edge, do not chase". The open/mid split was read on the same data: no time window.
- Mutes of fast.1m and fast.5m: kept. Follow is negative on both halves.
- setupOf: checked. Every fund with an underlying and underlying 5-minute bars takes the underlying's setup (flipped for inverse funds). No consistency bug found.
- Shared files: not edited.

### Lessons for the other agents
- When a market-entry test and a limit-entry test disagree by a large factor, do not show the market-entry size as an edge. A move that comes back inside one bar is not tradable with a limit.
- One day can move a 7-day mean by 5 times. Look at the change from yesterday's scorecard before you act on a large number.
- A "found on these days" result needs its own per-day record on new days. fade.rev.15m was BACK on 7 days and is 0 of 2 on new days.

### For the council
- ev.mjs, data quality (high): the Nov 10 fast-move events added about −4.5% (1-minute) and −3% (5-minute) per event on the underlying, while the limit fades of the same events got ≈ 0. Please (a) log the 5 largest |f15| events per item (symbol, ET time, m1/m5, f15) in the Actions output; (b) drop a 1-minute bar whose close is more than 10σ from both neighbor closes (a single-bar spike); (c) report a trimmed mean (drop top and bottom 5%) next to ev for fast.* items. Do not change the mute rule.
- ev.mjs: fade.fast1m.15m.days and fade.fast5m.15m.days (same form as fade.rev.15m.days), for the 3-new-day rule. The page reads them already.
- ev.mjs: fast.15m.15m.tgate and fast.15m.alert.tgate (window chosen on the older half, score the newer half only), and a limit-entry fade test of the mid-day 🚀 move (fade.15m.15m: limit against the move 0.5 × 5-min σ of the fund, alive 5 min, exit 15 min after the fill, cost 0.05%).
- layout.js (shared): request of Nov 8 stays open (put #revCard after the scanner while rev.all.15m is muted).

### Backlog
1. When a fade test is BACK on both halves and 3 new days in a row are positive (the card now says so): add a fade flag with a limit entry and a stated stop (beyond the turn extreme).
2. When the council adds the 🚀 time gate: if mid-day 🚀 is muted on the newer half, change the flag and alert text for mid-day to "tended to come back".
3. Audit leverage and underlying of the fund list against instruments.json.
4. Score the level-to-level setup (setupOf) plan: limit fill rate and 1-hour result. Ask the council for a test.

### Watch next
- Live page: rev.js?v=6. The reversal card shows "New market days: Nov 9 …, Nov 10 …" and the 1-minute line shows the limit-entry test.
- Next scorecard (Nov 11): fade.rev.15m.days must show Nov 11. If Nov 11 > 0, the count is 1 of 3. If ≤ 0, the fade of a turn is not a candidate for a flag; consider asking the council to drop it.
- fast.1m.15m and fast.5m.15m must stay MUTE. If the council adds the spike filter, the newer-half sizes must fall to below 1%.

## 2026-11-09 · LETF agent

### Evidence
- Source: ev.json on branch ev (2026-11-09 00:59 UTC), trackers.letf, 24 underlyings (each one time). This is the scorecard from after the council changes of Nov 8. The EV governor did not run after today's close yet (last run 00:59 UTC; at 22:20 UTC no new run). Thus the scorecard has no data from Nov 9. This session cannot get bars (Yahoo blocked from the cloud).
- rev.all.15m: n 146, −0.18% per 15 min, z −2.4, MUTE. Older −0.06%, newer −0.31%.
- rev.hard.15m: n 25, −0.17%, z −1.8, CUT (factor 0.5). Older −0.27%, newer −0.09%.
- fast.1m.15m: n 44, −0.36%, z −3.0, MUTE. Both halves negative (−0.41%, −0.31%).
- fast.5m.15m: n 12, −0.09%, WATCH. Halves disagree.
- fade.rev.15m (limit entry): n 101, +0.16% per trade after cost, z 2.2, BACK, fill 69%. Older +0.15%, newer +0.16%. Time of day: 10:30–15:00 +0.24% (n 66), 15:00–16:00 −0.04% (n 28).
- fade.fast5m.15m: n 6, WATCH (too few).
- fast.15m.15m (the 🚀 rule): n 137, −0.02%, WATCH. Older +0.09%, newer −0.13%: the halves disagree.
- Problem found (council task 2, check the page text for the new rulings): rev.hard changed from MUTE to CUT. rev.js read only the rev.hard factor (0.5) for a HARD turn. Thus the ⤾ "follow" flag and the green "HARD ▲ up" scanner cell came back for HARD turns, while all turns (a superset) are muted and HARD turns are negative on both halves.
- Problem found: the card said "Not yet tested with limit entries", but the scorecard now has the limit-entry tests. The 1-minute table also needs its own test (none exists).
- Problem found (council task 3): the 🚀 flag, the 🚀 push alert and the "Moving fast now" X post told the reader nothing about the missing edge.

### Shipped today
- LETF-Sniper 41e925c (rev.js, index.html, rev.js?v=5):
  1. A HARD turn takes the lower factor of rev.all.15m and rev.hard.15m. Now: factor 0, no flag, grey scanner cell. The HARD line says "muted with all turns: HARD turns are part of them". If rev.all goes back to WATCH, HARD turns show again at the rev.hard factor, with no code change.
  2. The "Opposite reading" line shows the scorecard's limit-entry test: fade.rev.15m for turns (BACK, fill 69%, both halves) and fade.fast5m.15m for 5-minute moves. It says "Not yet proven on new market days: no flag, no order yet" (council task 1). The 1-minute table says "Not yet tested with limit entries".
  3. 🚀 flag tooltip, 🚀 alert, X post and help text: "no proven edge, do not chase" while fast.15m.15m is not BACK on both halves; "fast moves tended to come back: do not chase" if it is muted.
- Walk-forward: no new rule and no new threshold. The changes only apply the existing rulings (mute, cut, watch) to every place that shows the rules. The subset rule (HARD ⊂ all turns) is logic, not a fit.
- Checks: node --check rev.js OK. Playwright ?demo with the real ev.json: 0 page errors. Synthetic HARD turn (score 1.40) on one underlying: long and inverse fund get opposite directions, evf 0, no flag; with rev.all set to WATCH, evf 0.5 and the flag comes back. fastEdge() gives the right text for WATCH and BACK. Pages build and deployment: success (run 29).
- worker.js not changed. Steven does not need to paste it again.

### Not changed
- No fade flag and no fade order: fade.rev.15m was found on the same 7 days as the mute. Council rule: wait for 3 new market days (Nov 9–11).
- No time-of-day window for the fade (10:30–15:00 looks best, 15:00–16:00 negative): the split was read on the same data that it reports. It needs a fit on the older part and a check on the newer part.
- 🚀 alert threshold (5% / 2.5%) is not the same as the flag and the test (4% / 2%). Not changed: no score for the 5% / 2.5% level.
- layout.js (shared): not edited.

### Lessons for the other agents
- When a rule set has a subset (HARD turns inside all turns), a ruling on the superset must also reach the subset. A softer ruling on the subset (cut) must not bring back a flag that the superset muted.
- When the council changes a ruling, check every page path again. A change from MUTE to CUT can switch a flag on.
- Alerts and social posts are also "places that show a rule". Put the EV ruling in them.

### For the council
- ev.mjs: fade.rev.15m with a walk-forward time-of-day gate: choose the windows on the older half, report only the newer half. Also report fade.rev.15m per new market day (Nov 9, 10, 11), so that the 3-day rule can be checked.
- ev.mjs: a limit-entry fade test for fast 1-minute moves (fade.fast1m.15m), same form as fade.fast5m.15m. fast.1m.15m is MUTE on both halves (−0.36%, n 44).
- ev.mjs: score the 🚀 alert level (5% single stock, 2.5% index, dv ≥ $1M) as well as the 4% / 2% flag level.
- EV governor: no run after the Nov 9 close by 22:20 UTC. Please check the schedule.
- layout.js (shared): request from Nov 8 stays open (put #revCard after the scanner while rev.all.15m is muted).

### Backlog
1. After 3 new market days with fade.rev.15m BACK on each day: add a fade flag with a limit entry (old direction, 0.5 × 5-min σ better, alive 10 min, exit 15 min after the fill) and a stated stop (beyond the turn extreme: the turn is then real). Show it only 09:30–15:00 ET if the walk-forward time gate holds.
2. When fast.15m.15m gets a clear ruling: mute or back the 🚀 flag and alert (the code follows by itself).
3. Audit leverage and underlying of the fund list against instruments.json.
4. Score the level-to-level setup (setupOf) plan: limit fill rate and 1-hour result. Ask the council for a test.

### Watch next
- Next scorecard (with Nov 9 data): rev.all.15m stays MUTE; then HARD turns must show no flag and a grey cell on the live page (rev.js?v=5).
- fade.rev.15m must stay BACK with both halves > 0 and the fill rate near 69%. That is day 1 of 3.
- fast.15m.15m: if it goes to MUTE, the 🚀 text must change to "fast moves tended to come back" with no code change.

## 2026-11-08 (run 2) · LETF agent

### Evidence
- Source: ev.json on branch ev (18:11 UTC), trackers.letf. No new scorecard since run 1. No council note (agents/council.md does not exist). Sunday: market closed. This session cannot get bars (Yahoo, Hyperliquid and stooq are blocked from the cloud).
- rev.all.15m: n 185, −0.31% per 15 min, z −3.2, MUTE. rev.hard.15m: n 31, −0.20%, z −2.2, MUTE. fast.5m.15m: n 130, −0.31%, z −3.3, MUTE. fast.1m.15m: n 154, −0.17%, z −1.8, CUT.
- Problem found on the page: the mute removed only the ⤾ flag in the Signals column. The reversal card stayed open above the scanner. It showed HARD TOP and BOTTOM tags in red and green and told the reader "use a limit entry". The scanner Reversal column showed "HARD ▲ up" in green. Thus the page still pushed a rule with proven negative EV.
- Bug: draw() in rev.js rebuilt the card with <details open> every 12 s. A reader could not keep the card closed.
- Checked: detect() in rev.js and in ev.mjs is the same code. In ?demo with a synthetic turn on AXTI, AXTX and AXTU got the same score (2.50) and the same direction. Consistent.

### Shipped today
- LETF-Sniper 18c5146 (rev.js, index.html rev.js?v=4):
  1. When EVR gives rev.all.15m factor 0: the card starts closed (one line), the summary shows "MUTED · proven negative EV", turn rows are grey (opacity 0.55, no HARD highlight), and the footer says "Do not trade a turn from this table". When the rule is not muted, the old text and colours come back by themselves.
  2. Scanner Reversal cell: grey when r.rev.evf is 0, with the reason in the tooltip.
  3. The card keeps the reader's open or closed choice across redraws.
- Walk-forward: no new rule or threshold. The change only follows the existing mute (z ≤ −2 on the scorecard). No winner was chosen on reported data.
- Checks: node --check rev.js OK. Playwright ?demo with ev.json stubbed: no page errors; card closed and MUTED; a click opens it and it stays open after a redraw; Reversal cell grey with the reason. Pages build and deployment: success (run 28).
- worker.js not changed. Steven does not need to paste it again.

### Not changed
- Card position: layout.js (shared) fixes the order (#revCard before #scanCard) and a MutationObserver puts it back. A move from rev.js would fight it. See "For the council".
- The 🚀 15-minute fast-move flag and alert (index.html): no score. The muted fast.5m rule is a related "follow" reading, but a 15-min window is a different test. No evidence, no change.
- Fast 1m/5m tables: information only (no flag). Their EV lines already say "fade" or "no clear edge".

### Lessons for the other agents
- A mute must reach every place that shows the rule: flags, columns, cards, colours and help text. Search for each place that reads the rule, not only the flag.
- A card that rebuilds innerHTML must keep the reader's open or closed state.
- Check layout.js before you move a card. It reorders the page.

### For the council
- layout.js (shared): on LETF, move "#revCard" from TOP (before #scanCard) to after "#watchCard", or read EVR and put it after the scanner when rev.all.15m is muted. Reason: proven negative EV (z −3.2); the scanner is the most useful part.
- Requests from run 1 stay open: fade.rev.15m and fade.fast5m.15m with limit entries; one test per underlying (drop SOXS, SQQQ, NVDL, TSLL, MSTU, CONL or test the underlyings); 0.05% cost per round trip; splits by score band, time of day and volume factor.
- New test request: fast.15m.15m, the 🚀 rule (|15-min move| ≥ 4% single stock, ≥ 2% index), follow vs fade, next 15 min, older and newer halves. The page sends push alerts on it with no score.

### Backlog
1. When fade.rev.15m or fade.fast5m.15m is > 0 on both halves with limit fills: add a fade flag with a limit entry (old direction, 0.25 × leg back) and a stated stop (beyond the turn extreme).
2. When fast.15m.15m has a score: mute or back the 🚀 flag and alert.
3. Audit leverage and underlying of the fund list against instruments.json (needs the Worker list; not reachable from the cloud).
4. Score the level-to-level setup (setupOf) plan: limit fill rate and 1-hour result. Ask the council for a test.

### Watch next
- Next scorecard: rev.all.15m and rev.hard.15m stay MUTE. Then the card must load closed and grey on the live page.
- If a rule goes back to WATCH or BACK, the card must open with colours again with no code change.
- The pages build for 18c5146 is green; the live page must show rev.js?v=4.

## 2026-11-08 · LETF agent

### Evidence
- Source: ev.json on branch ev (run 2026-11-08 18:06 UTC), trackers.letf, 30 of 30 markets, 7 days of 1-minute bars. No council note (agents/council.md) and no past LETF note existed. This session cannot get market data (Yahoo and the Worker are blocked from the cloud). Thus all numbers below come from ev.json. Half-sample z values are estimates from n, mean and z.
- rev.all.15m: n 185, EV −0.31% per 15 min, z −3.2, 41% right. Older half −0.11% (z ≈ −0.8), newer half −0.50% (z ≈ −3.6). MUTE.
- rev.hard.15m: n 31, EV −0.20%, z −2.2, 35% right. Older −0.17% (z ≈ −1.3), newer −0.23% (z ≈ −1.8). MUTE.
- fast.5m.15m: n 130, EV −0.31%, z −3.3, 30% right. Older −0.50% (z ≈ −3.7), newer −0.12% (z ≈ −0.9). MUTE.
- fast.1m.15m: n 154, EV −0.17%, z −1.8. Older −0.40% (z ≈ −3.1), newer +0.07% (z ≈ +0.5). CUT. The halves disagree.
- Walk-forward of the opposite reading (choose the sign on the older half, check it on the newer half): the fade sign holds on both halves for rev.all, rev.hard and fast.5m. It does not hold for fast.1m. In each case only ONE half is strong. This is not yet proof.
- Cause found in the code (consistency bug): rev.js used the underlying only for single-stock funds. Index, commodity, rates and crypto funds (SOXL and SOXS, TQQQ and SQQQ) each read their own bars or quotes. Thus a long fund and its inverse fund could show different turns and scores. Single-stock funds without 1-minute bars of the underlying also used their own quotes.
- Test bias (in ev.mjs): the 30 markets include pairs on one underlying (SOXL+SOXS, TQQQ+SQQQ, NVDL+NVDA, TSLL+TSLA, MSTU+MSTR, CONL+COIN). One move counts 2 times with the same sign. The z values are too large by up to about √2. The test also enters at the bar close, not with a limit order.

### Changes
- LETF-Sniper 32052b7 (rev.js, index.html rev.js?v=3):
  1. One reading per underlying. Every fund with an underlying reads the underlying: its 1-minute bars (Worker /chart), else its own quotes, else the quotes of the most traded fund on it (mapped through the sign of the leverage). The bar list (targets) now asks for the underlying of index funds. Checked in Playwright (?demo, synthetic quotes): NVDL/NVDD and SOXL/SOXS get the same score (1.14) and opposite directions. No page errors.
  2. The EV governor line shows the "opposite reading" (the turn tends to fail; a fast move tends to come back) only when the older half AND the newer half are both negative. It says "Not yet tested with limit entries" and "Do not chase it". No new flag and no order in the scanner.
  3. fast.1m now reads "no clear edge: the two halves of the test disagree" (before: "fade fast moves").
- detect() is not changed. It stays the same code as in ev.mjs. worker.js is not changed (Steven does not need to paste it again).

### Not changed
- No fade flag or fade order in the scanner rows: the fade is not tested with a limit entry (Steven's order rule), and only one half of each test is strong.
- No new threshold (score, volume, time of day): no bar data in this session, so no walk-forward fit was possible. Fitting on ev.json halves only would choose the winner on the reported data.
- Shared files (evrules.js and others): not edited.
- The 🚀 15-minute fast-move flag in index.html: it is not on the scorecard, so there is no evidence.

### Lessons for the other agents
- A muted rule is not a finished job. Check the opposite sign on the older half and on the newer half before you show it.
- Look for pairs on one underlying in a test universe. They double-count events and make z too large.
- One underlying = one reading. Check every code path (bars, quotes, fallbacks), not only the main path.

### For the council
- ev.mjs, new tests (keep detect() the same code):
  1. fade.rev.15m: after a turn (score ≥ 0.6), a LIMIT entry in the OLD direction at 0.25 × the leg back toward the extreme (or 0.5 × 5-min ATR), alive 10 min; count only when price touches the limit; exit at +15 min (market). Report older and newer halves.
  2. fade.fast5m.15m: after a 4σ 5-minute move, a LIMIT entry against the move at 0.5σ×√5 past the last close, alive 5 min; same scoring.
  3. Splits for both: score bands (0.6–1, 1+), time of day (09:30–10:30, 10:30–15:00, 15:00–16:00 ET), volume factor vf ≥ 1 vs < 1.
- ev.mjs universe: count each underlying one time. Test on the underlyings (SOXX, QQQ, SPY, IWM, NVDA, TSLA, MSTR, COIN …) and map to funds, or drop the duplicate funds (SOXS, SQQQ, NVDL, TSLL, MSTU, CONL). The page now reads the underlying, so the test should too.
- Add a cost of 0.05% per round trip (spread on thin funds) to the LETF items.

### Watch next
- Tomorrow's scorecard: rev.all and fast.5m must stay ≤ 0 on BOTH halves for the opposite reading to stay on the page (the code removes it by itself when one half turns positive).
- If the council adds fade.rev.15m and fade.fast5m.15m: they must be > 0 on the newer half with limit fills before any fade flag goes in the scanner.
- After the universe is de-duplicated: z of the rev and fast items must still be ≤ −2 for the mutes to stay.
