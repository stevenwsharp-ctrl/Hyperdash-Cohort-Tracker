# LETF agent notes

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
