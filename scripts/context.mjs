// Market context: VIX (Cboe, 15-min delay) and the earnings calendar (Nasdaq) for tracked stocks.
import { http } from "./lib.mjs";

const UAH = { "accept": "application/json, text/plain, */*", "accept-language": "en-US,en;q=0.9", origin: "https://www.nasdaq.com", referer: "https://www.nasdaq.com/" };

export async function getVix() {
  const j = await http("https://cdn.cboe.com/api/global/delayed_quotes/quotes/_VIX.json", { tries: 2, timeoutMs: 20000 });
  const d = j.data || {};
  return { px: +d.current_price || null, ch: +d.price_change_percent || 0, t: j.timestamp };
}

// Next 14 days of earnings for the given symbols. { SYM: { d: "YYYY-MM-DD", tm: "before|after|" , est } }
export async function getEarnings(symbols) {
  const want = new Set(symbols);
  const out = {};
  const days = [];
  for (let i = 0; i < 15; i++) { const d = new Date(Date.now() + i * 864e5); if (d.getUTCDay() % 6 !== 0) days.push(d.toISOString().slice(0, 10)); }
  for (const day of days) {
    try {
      const j = await http(`https://api.nasdaq.com/api/calendar/earnings?date=${day}`, { tries: 2, timeoutMs: 20000, headers: UAH });
      for (const r of (j.data && j.data.rows) || []) {
        if (!want.has(r.symbol) || out[r.symbol]) continue;
        out[r.symbol] = { d: day, tm: /before|pre/i.test(r.time) ? "before open" : /after/i.test(r.time) ? "after close" : "", est: r.epsForecast || "" };
      }
    } catch (e) { if (day === days[0]) throw e; }
  }
  return out;
}
