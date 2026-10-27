# Cohort Sniper

A GitHub Pages tracker. It finds Hyperliquid markets (crypto, stocks, indices, ETFs, commodities, FX) where the **smart** Hyperdash cohorts and the **fool** cohorts hold opposite sides.

- Smart (default): Extremely Profitable + Very Profitable (all-time PnL)
- Fools (default): Unprofitable + Very Unprofitable + Rekt
- Red flag: a smart cohort holds the other side (example: Very Profitable is bullish when the setup is smart short)

## How it works

1. `.github/workflows/update.yml` runs every 15 minutes.
2. `scripts/fetch.mjs` gets the cohort data from the Hyperdash API (`api.hyperdash.com/graphql`).
3. The workflow pushes `latest.json`, `history.json` and `status.json` to the `data` branch. It replaces that branch each time, so the repo stays small. History keeps 7 days.
4. `index.html` (GitHub Pages, `main` branch) reads the data from `raw.githubusercontent.com/<owner>/<repo>/data/`.

The browser cannot call the Hyperdash API directly from another site (CORS). That is why the GitHub Action does the fetch.

Site: https://stevenwsharp-ctrl.github.io/Hyperdash-Cohort-Tracker/

## Setup (web only)

1. Make a new **public** repo. Upload all files, with the `.github` and `scripts` folders.
2. Settings → Pages → Deploy from a branch → `main`, `/ (root)`.
3. Actions tab → enable workflows → "Update Hyperdash data" → Run workflow.

## Notes

- The repo must be public (raw data links and free Pages need this).
- GitHub stops scheduled workflows after 60 days with no repo activity. Push any commit to start it again.
- If the Hyperdash API blocks GitHub servers, the page shows the error from `status.json`. Then run `node scripts/fetch.mjs data` on your own computer and serve the folder.
- The Hyperdash API has no public docs. If they change it, the fetch can stop. The page shows the data age.
