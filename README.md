# Cohort Sniper

A GitHub Pages tracker. It finds Hyperliquid markets (crypto, stocks, indices, ETFs, commodities, FX) where the **smart** Hyperdash cohorts and the **fool** cohorts hold opposite sides.

- Smart (default): Extremely Profitable + Very Profitable (all-time PnL)
- Fools (default): Unprofitable + Very Unprofitable + Rekt
- Red flag: a smart cohort holds the other side (example: Very Profitable is bullish when the setup is smart short)

## How it works

1. `.github/workflows/update.yml` stays on all the time: each run lasts about 55 minutes and checks Hyperdash every 20 seconds. Hyperdash makes a new snapshot every 5 minutes, and each new one is pushed. A new run starts every 20 minutes and waits in the queue, so there is no gap (cancelled queued runs are normal).
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
- **Alignment trend**: gap change over 30m / 1h / 4h / 24h / 7d (7d shows only once there is a full 7 days of history), a chart per market, and the **Changes** tab (expert exits, flips, fades, adds, new setups).
- **Trader count**: bias blends $ (60%) and trader count (40%), so a few whales cannot set the side alone; "Whale-driven" flag when they disagree.
- **Rating** = disparity × context (liquidity, funding, trend/exits, momentum, earnings, macro regime from VIX/S&P/BTC, news sentiment).
- **Listing filters**: S&P 500, NYSE, Nasdaq.
- **News**: Hyperdash news stream (Bloomberg, WSJ, CNBC, squawks) + Yahoo Finance per ticker, matched to markets; popups on the page, desktop notifications, and `news` / `macro` alert types.
- **Coin specialists**: for the top 30 setups, the 30 largest holders of each coin are checked: win rate on this coin vs overall (adjusted for few trades), coin PnL, and wallets that look like one trader. "Specialists agree / disagree" adjusts the rating.
- **Leverage, liquidations, stops**: open positions of the top holders from Hyperliquid (leverage, real exposure, entry, liquidation price, stop and target orders), good vs bad traders per side, a price ladder, "liquidation fuel" and "smart near liquidation" rating factors, and a Traders tab with the best and worst traders on these coins.
- **Loss-cut habits and liquidation history**: for each top holder, the median move against them when they close a losing trade (last 100 closed trades), the implied exit for their open position, and how often they were liquidated in 60 days. Shown for good vs bad traders per coin and in the Traders tab.
- **Froth / bloodbath**: per-market heat scores (fast moves vs normal volatility, funding, open interest, liquidations, RSI, stretch, volume), a Heat tab, row badges, popups and `froth` / `bloodbath` alerts (`ALERT_HEAT_MIN`, default 60).
- **Funding card**: next-payment countdown (Hyperliquid pays hourly), cost or income per timeframe, Binance/Bybit comparison, 24h trend; carry over a 72h hold weighed against the backtested edge.
- **Flow / liquidation map / volume profile** (`scripts/flow.mjs`): all traders' long/short flows, taker flow (CVD), resting liquidations ±30% with max-pain zones, options max pain, 30d/7d volume profile.
- **Fidelity filter**: single stocks without a US listing are hidden and get no alerts (toggle in Settings).
- **Live prices**: the page reads Hyperliquid prices and funding directly every 20 seconds.
- **Alerts**: add repo secret `NTFY_TOPIC` (ntfy phone app) and/or `DISCORD_WEBHOOK_URL`. Optional repo variables: `ALERT_MIN_SCORE` (default 65) and `ALERT_TYPES` (default `setup,exit,flip`; also `fade`, `add`, `new`). Test: Actions → Run workflow → tick "Send a test alert".

## Market chart (each market)

Open a market row: the detail starts with a live chart (TradingView Lightweight Charts, candles from Hyperliquid).
- Timeframes 1m, 5m, 15m, 1h, 4h, 1D; updates every few seconds.
- VWAP with ±1σ/±2σ bands, EMA 9/21/50, Bollinger 20/2, volume, volume profile of the visible range.
- Liquidation map as side bars, max pain for longs and shorts, 30-day POC and value area, options max pain (scaled to the perp).
- Smart-money events (exit, flip, fade, add) as markers, and a lower pane with smart bias, fools bias and the gap from the 5-minute snapshots.
- Drawing tools: trend line, extended line, ray, level, alert line (browser alert when price crosses), parallel channel, zone, Fibonacci, long/short position with R:R, measure. Drawings are kept per market in your browser; select one and press Delete to remove it.
- Snapshot (saved and copied to the clipboard) and full screen.

## Site tools

Light and dark mode, page width (fit screen by default), a heartbeat for the live prices, a terms / disclaimer / privacy page, link-preview image (`og.png`) and tab icon. Contact: sniperdesk.tribunal635@passmail.net.

## Backtest

`.github/workflows/backtest.yml` (every Sunday, or Actions → Backtest → Run workflow, 2–3 hours) rebuilds the hourly positions of ~2,400 sampled traders (best and worst by all-time PnL) from their Hyperliquid fills, puts each one in the cohort they were in at that hour, recomputes the smart-vs-fools gap per market, and tests it against the next 4h / 24h / 72h move. Fit = first 60% of the window, check = last 40%. Results go to the `backtest` branch and the **Backtest** tab. Conditions that move the hit rate the same way in both periods set the size of the matching rating factor; the rest are removed.

## Cycle, Key points, Things to look for

`scripts/cycle.mjs` labels each market's cycle phase from daily candles (moving averages, 90-day range position, RSI, volatility). Each row shows **Key points** (state) and **Things to look for** (levels and events that would confirm or break the setup).

## Notes

- The repo must be public (raw data links and free Pages need this).
- GitHub stops scheduled workflows after 60 days with no repo activity. Push any commit to start it again.
- If the Hyperdash API blocks GitHub servers, the page shows the error from `status.json`. Then run `node scripts/fetch.mjs data` on your own computer and serve the folder.
- The Hyperdash API has no public docs. If they change it, the fetch can stop. The page shows the data age.

## Starred sheet, market overview and help

- Click ☆ next to a market to star it. The **★ Starred** tab (also in the Excel-style sheet tabs at the bottom of the page) shows your starred markets as a worksheet: price, 24h, setup, rating, gap, smart and fools bias, gap change 1h/4h/24h, rank in your filter, funding, smart $, flags, ways to trade, earnings and news. Double-click a row to open the market.
- The top of the sheet shows the market: Dow, S&P 500, Nasdaq, Russell 2000, VIX, 10Y yield, oil, dollar index (through the Worker), and live 24/7 Hyperliquid perps (Nasdaq-100, S&P 500, WTI and Brent oil, gold, silver, BTC, ETH, SOL).
- For each starred market: the last 5 major trades of the best and of the worst traders among its top holders (fills from Hyperliquid, 14 days, refresh every 2 minutes). New trades show in yellow and as a toast.
- Hover any column heading for a floating explanation.
- Light / dark mode: button in the header and in the bottom sheet bar.
- Alignment trend: the top row is the gap change in points (not the rating); the bottom row is the rank by gap size among the markets that pass your filters, and its move in each window.
