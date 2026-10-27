# Cohort Sniper

A GitHub Pages tracker. It finds Hyperliquid markets (crypto, stocks, indices, ETFs, commodities, FX) where the **smart** Hyperdash cohorts and the **fool** cohorts hold opposite sides.

- Smart (default): Extremely Profitable + Very Profitable (all-time PnL)
- Fools (default): Unprofitable + Very Unprofitable + Rekt
- Red flag: a smart cohort holds the other side (example: Very Profitable is bullish when the setup is smart short)

## How it works

1. `.github/workflows/update.yml` stays on all the time: each run lasts about 55 minutes and checks Hyperdash every 45 seconds. Hyperdash makes a new snapshot every 5 minutes, and each new one is pushed. A new run starts every 20 minutes and waits in the queue, so there is no gap (cancelled queued runs are normal).
2. `scripts/fetch.mjs` gets the cohort data from the Hyperdash API (`api.hyperdash.com/graphql`).
3. The workflow pushes `latest.json`, `history.json` and `status.json` to the `data` branch. It replaces that branch each time, so the repo stays small. History keeps 7 days.
4. `index.html` (GitHub Pages, `main` branch) reads the data from `raw.githubusercontent.com/<owner>/<repo>/data/`.

The browser cannot call the Hyperdash API directly from another site (CORS). That is why the GitHub Action does the fetch.

Site: https://stevenwsharp-ctrl.github.io/Hyperdash-Cohort-Tracker/

## Setup (web only)

1. Make a new **public** repo. Upload all files, with the `.github` and `scripts` folders.
2. Settings → Pages → Deploy from a branch → `main`, `/ (root)`.
3. Actions tab → enable workflows → "Update Hyperdash data" → Run workflow.

## Trade tools

- **Trade with**: the US stock, proxy ETFs and leveraged / inverse ETFs for each market, and which have listed options (Cboe list) and weekly options. Leveraged ETFs are found by name in the Nasdaq Trader list of all US listings, every 12 hours.
- **Option stats** (Cboe, 15-min delay) for the top setups: ATM IV near 30 days, put/call ratios, expiries.
- **Funding**: Hyperliquid funding per year, and if the smart side earns or pays it.
- **Track record** tab: what the price did 4h and 24h after each signal.
- **CSV** button: export the table.
- **Alignment trend**: gap change over 1h / 4h / 24h / 7d, a chart per market, and the **Changes** tab (expert exits, flips, fades, adds, new setups).
- **Trader count**: bias blends $ (60%) and trader count (40%), so a few whales cannot set the side alone; "Whale-driven" flag when they disagree.
- **Rating** = disparity × context (liquidity, funding, trend/exits, momentum, earnings, macro regime from VIX/S&P/BTC, news sentiment).
- **Listing filters**: S&P 500, NYSE, Nasdaq.
- **News**: Hyperdash news stream (Bloomberg, WSJ, CNBC, squawks) + Yahoo Finance per ticker, matched to markets; popups on the page, desktop notifications, and `news` / `macro` alert types.
- **Coin specialists**: for the top 30 setups, the 30 largest holders of each coin are checked: win rate on this coin vs overall (adjusted for few trades), coin PnL, and wallets that look like one trader. "Specialists agree / disagree" adjusts the rating.
- **Leverage, liquidations, stops**: open positions of the top holders from Hyperliquid (leverage, real exposure, entry, liquidation price, stop and target orders), good vs bad traders per side, a price ladder, "liquidation fuel" and "smart near liquidation" rating factors, and a Traders tab with the best and worst traders on these coins.
- **Loss-cut habits and liquidation history**: for each top holder, the median move against them when they close a losing trade (last 100 closed trades), the implied exit for their open position, and how often they were liquidated in 60 days. Shown for good vs bad traders per coin and in the Traders tab.
- **Live prices**: the page reads Hyperliquid prices and funding directly every 20 seconds.
- **Alerts**: add repo secret `NTFY_TOPIC` (ntfy phone app) and/or `DISCORD_WEBHOOK_URL`. Optional repo variables: `ALERT_MIN_SCORE` (default 65) and `ALERT_TYPES` (default `setup,exit,flip`; also `fade`, `add`, `new`). Test: Actions → Run workflow → tick "Send a test alert".

## Backtest

`.github/workflows/backtest.yml` (every Sunday, or Actions → Backtest → Run workflow, 2–3 hours) rebuilds the hourly positions of ~2,400 sampled traders (best and worst by all-time PnL) from their Hyperliquid fills, puts each one in the cohort they were in at that hour, recomputes the smart-vs-fools gap per market, and tests it against the next 4h / 24h / 72h move. Fit = first 60% of the window, check = last 40%. Results go to the `backtest` branch and the **Backtest** tab. Conditions that move the hit rate the same way in both periods set the size of the matching rating factor; the rest are removed.

## Cycle, Key points, Things to look for

`scripts/cycle.mjs` labels each market's cycle phase from daily candles (moving averages, 90-day range position, RSI, volatility). Each row shows **Key points** (state) and **Things to look for** (levels and events that would confirm or break the setup).

## Notes

- The repo must be public (raw data links and free Pages need this).
- GitHub stops scheduled workflows after 60 days with no repo activity. Push any commit to start it again.
- If the Hyperdash API blocks GitHub servers, the page shows the error from `status.json`. Then run `node scripts/fetch.mjs data` on your own computer and serve the folder.
- The Hyperdash API has no public docs. If they change it, the fetch can stop. The page shows the data age.
