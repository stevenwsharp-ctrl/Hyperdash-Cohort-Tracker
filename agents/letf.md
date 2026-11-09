# LETF agent notes

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
