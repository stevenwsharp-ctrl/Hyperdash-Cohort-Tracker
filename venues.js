/* Venues · price gaps between outlets · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   The same thing trades in many places and in different currencies. The gaps between them are information:
   - Stock perps vs the stock: Hyperliquid perp mark vs its oracle (the stock market price feed). When the stock market is
     closed, the perp is the only live price, so its gap often shows where the stock will open. During market hours a gap
     tends to close. The two cases are separate signals (dis.basis-open, dis.basis-closed) so the web learns each one.
   - The same stock on several Hyperliquid venues (xyz, para, io ...): spread vs the median of the venues (arbitrage).
   - Crypto across exchanges (browser-readable APIs): Coinbase and Binance.US (US dollars), OKX (USDT), Upbit (Korean won),
     and Hyperliquid. Coinbase premium = US buyers vs offshore traders (US institutions and ETF flows buy on Coinbase).
     Korea premium ("kimchi premium") = Korean retail demand; a high premium is froth. Hyperliquid premium = leveraged
     traders vs spot.
   - Dollars are not all equal: USDT and USDC vs the real dollar (Coinbase, Kraken). USDT above $1 = demand to get into crypto
     offshore; below $1 = demand to get out.
   Each gap is compared with its own recent normal (z-score) so a gap that is always there does not count.
   API: Venues.perps([{ key, px, o, v }]) · await Venues.crypto(hlMarks) · Venues.signals() · Venues.html() · Venues.state() */
(function () {
  "use strict";
  if (window.Venues) return;
  const c1 = v => Math.max(-1, Math.min(1, v)), med = a => { const s = a.filter(isFinite).slice().sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
  const HISTK = "venues_hist_v1", H = (() => { try { return JSON.parse(localStorage.getItem(HISTK) || "{}"); } catch (e) { return {}; } })();
  let hsT = 0; const hsave = () => { if (Date.now() - hsT < 6e4) return; hsT = Date.now(); try { localStorage.setItem(HISTK, JSON.stringify(H)); } catch (e) { } };
  // record a gap and return its z-score vs the last ~6 hours (one point per 2 minutes)
  function track(k, v) { if (!isFinite(v)) return null; const a = H[k] = H[k] || [], now = Date.now();
    if (!a.length || now - a[a.length - 1][0] >= 12e4) { a.push([now, v]); if (a.length > 180) a.splice(0, a.length - 180); } else a[a.length - 1][1] = v;
    const xs = a.map(x => x[1]); if (xs.length < 15) return null; const m = xs.reduce((s, x) => s + x, 0) / xs.length, sd = Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length);
    return sd > 1e-7 ? (v - m) / sd : 0; }
  const usOpen = () => { try { const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "numeric", hourCycle: "h23", weekday: "short" }).formatToParts(new Date());
    const g = t => p.find(x => x.type === t).value, wd = g("weekday"), m = +g("hour") * 60 + +g("minute"); return !["Sat", "Sun"].includes(wd) && m >= 570 && m < 960; } catch (e) { return false; } };
  const S = { stocks: [], groups: [], crypto: null, stable: null, at: 0 };
  // ---------- stock perps: basis vs oracle, and venues of the same stock ----------
  function perps(L) {
    const open = usOpen(), rows = [];
    L.forEach(x => { if (!(x.px > 0) || !(x.o > 0) || !x.key.includes(":")) return; const b = x.px / x.o - 1, z = track("b:" + x.key, b); rows.push({ key: x.key, sym: x.key.split(":").pop(), px: x.px, o: x.o, b, z, v: x.v || 0 }); });
    const by = {}; rows.forEach(r => (by[r.sym] = by[r.sym] || []).push(r));
    S.groups = Object.entries(by).filter(([, rs]) => rs.length >= 2).map(([sym, rs]) => { const m = med(rs.map(r => r.px)); rs.forEach(r => r.dev = r.px / m - 1);
      const lo = rs.reduce((a, r) => r.px < a.px ? r : a), hi = rs.reduce((a, r) => r.px > a.px ? r : a); return { sym, rs, m, spread: hi.px / lo.px - 1, lo, hi }; }).sort((a, b) => b.spread - a.spread);
    S.stocks = rows; S.open = open; S.at = Date.now(); hsave();
  }
  // ---------- crypto across exchanges ----------
  const COINS = ["BTC", "ETH", "SOL", "XRP", "DOGE"];
  const get = (u, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms || 8000); return fetch(u, { signal: c.signal }).then(r => r.ok ? r.json() : null).catch(() => null).finally(() => clearTimeout(t)); };
  let cT = 0;
  async function crypto(hl) {
    if (Date.now() - cT < 55000) return S.crypto; cT = Date.now(); hl = hl || {};
    const [cbUsdt, cbUsdc, kr, up, ...rest] = await Promise.all([
      get("https://api.exchange.coinbase.com/products/USDT-USD/ticker"), get("https://api.exchange.coinbase.com/products/USDC-USD/ticker").catch(() => null),
      get("https://api.kraken.com/0/public/Ticker?pair=USDTUSD,USDCUSD"),
      get("https://api.upbit.com/v1/ticker?markets=" + ["KRW-USDT"].concat(COINS.map(c => "KRW-" + c)).join(",")),
      ...COINS.map(c => get(`https://api.exchange.coinbase.com/products/${c}-USD/ticker`)),
      ...COINS.map(c => get(`https://www.okx.com/api/v5/market/ticker?instId=${c}-USDT`)),
      ...COINS.map(c => get(`https://api.binance.us/api/v3/ticker/price?symbol=${c}USD`))]);
    const n = COINS.length, cb = rest.slice(0, n), ok = rest.slice(n, 2 * n), bu = rest.slice(2 * n, 3 * n);
    const kv = k => { const r = kr && kr.result ? Object.entries(kr.result).find(([q]) => q.includes(k)) : null; return r ? +r[1].c[0] : NaN; };
    const usdt = med([cbUsdt ? +cbUsdt.price : NaN, kv("USDT")]), usdc = med([cbUsdc ? +cbUsdc.price : NaN, kv("USDC")]);
    const U = {}; (Array.isArray(up) ? up : []).forEach(x => U[x.market] = +x.trade_price); const krwT = U["KRW-USDT"];   // won per USDT
    S.stable = { usdt, usdc, zT: track("usdt", usdt), zC: track("usdc", usdc), krw: krwT && usdt ? krwT / usdt : null };
    S.crypto = COINS.map((c, i) => {
      const p = { coinbase: cb[i] ? +cb[i].price : NaN, "binance.us": bu[i] ? +bu[i].price : NaN, okx: ok[i] && ok[i].data && ok[i].data[0] ? +ok[i].data[0].last * (usdt || 1) : NaN,
        upbit: U["KRW-" + c] && krwT ? U["KRW-" + c] / krwT * (usdt || 1) : NaN, hyperliquid: hl[c] || NaN };
      const vals = Object.values(p).filter(v => v > 0), m = med(vals); if (!vals.length) return null;
      const cbp = p.coinbase > 0 && p.okx > 0 ? p.coinbase / p.okx - 1 : null, kim = p.upbit > 0 && p.okx > 0 ? p.upbit / p.okx - 1 : null, hlp = p.hyperliquid > 0 && m > 0 ? p.hyperliquid / med(vals.filter(v => v !== p.hyperliquid)) - 1 : null;
      return { c, p, m, cbp, kim, hlp, zCb: track("cb:" + c, cbp), zKim: track("kim:" + c, kim), zHl: track("hl:" + c, hlp), disp: vals.length >= 2 ? (Math.max(...vals) - Math.min(...vals)) / m : null };
    }).filter(Boolean);
    hsave(); return S.crypto;
  }
  // ---------- signals for the signal web ----------
  function signals() {
    const out = [], open = usOpen();
    // one gap per stock: the venues' gaps weighted by their trading volume
    const by = {}; S.stocks.forEach(r => (by[r.sym] = by[r.sym] || []).push(r));
    Object.entries(by).forEach(([sym, rs]) => { const w = rs.map(r => Math.max(1, r.v)), tw = w.reduce((a, x) => a + x, 0), b = rs.reduce((a, r, i) => a + r.b * w[i], 0) / tw;
      const zs = rs.filter(r => r.z != null), z = zs.length ? zs.reduce((a, r) => a + r.z * Math.max(1, r.v), 0) / zs.reduce((a, r) => a + Math.max(1, r.v), 0) : null;
      if (Math.abs(b) < 0.0005) return; const v = c1(b / 0.006) * (z != null ? Math.min(1.5, 0.5 + Math.abs(z) / 3) : 1);
      out.push([open ? "dis.basis-open" : "dis.basis-closed", sym, c1(v), open ? "Venues · perp vs stock price, market open (gap tends to close)" : "Venues · perp vs last stock price, market closed (where it may open)"]); });
    (S.crypto || []).forEach(x => {
      if (x.zCb != null && Math.abs(x.zCb) >= 1) out.push(["dis.cbprem", x.c, c1(x.zCb / 2.5), "Venues · Coinbase premium (US buyers vs offshore)"]);
      if (x.zKim != null && Math.abs(x.zKim) >= 1) out.push(["dis.kimchi", x.c, c1(x.zKim / 2.5), "Venues · Korea premium (Korean retail demand)"]);
      if (x.zHl != null && Math.abs(x.zHl) >= 1) out.push(["dis.hlprem", x.c, c1(x.zHl / 2.5), "Venues · Hyperliquid vs spot exchanges (leveraged traders)"]); });
    const st = S.stable; if (st && st.zT != null && Math.abs(st.zT) >= 1) (S.crypto || []).forEach(x => out.push(["dis.usdt", x.c, c1(st.zT / 2.5), "Venues · USDT vs the dollar (offshore demand for crypto)"]));
    return out;
  }
  // ---------- html ----------
  const pc = (v, d) => v == null || !isFinite(v) ? "–" : (v > 0 ? "+" : "") + (v * 100).toFixed(d == null ? 2 : d) + "%";
  const zt = z => z == null ? "" : ` <span style="opacity:.7">(${z >= 0 ? "+" : ""}${z.toFixed(1)}σ)</span>`;
  const cl = v => v > 0 ? "L" : v < 0 ? "S" : "";
  function html(o) {
    o = o || {}; const fx = o.px || (v => v >= 100 ? v.toFixed(2) : v >= 1 ? v.toFixed(3) : v.toPrecision(4)), filt = o.filter || (() => true);
    let h = "";
    const st = S.stable; if (st) h += `<div class="note" style="max-width:none">Dollars: USDT <b>$${isFinite(st.usdt) ? st.usdt.toFixed(4) : "–"}</b>${zt(st.zT)} · USDC <b>$${isFinite(st.usdc) ? st.usdc.toFixed(4) : "–"}</b>${zt(st.zC)}${st.krw ? ` · won per dollar (Upbit) ₩${st.krw.toFixed(0)}` : ""}. ${isFinite(st.usdt) ? (st.usdt > 1.001 ? "USDT above $1: offshore demand to buy crypto." : st.usdt < 0.998 ? "USDT below $1: offshore demand to get out of crypto." : "Stablecoins near $1: no stress.") : ""}</div>`;
    if (S.crypto && S.crypto.length) h += `<table class="tr"><thead><tr><th style="text-align:left">Coin</th><th>Coinbase $</th><th>Binance.US $</th><th>OKX (USDT→$)</th><th>Upbit (₩→$)</th><th>Hyperliquid</th><th>Coinbase premium</th><th>Korea premium</th><th>Hyperliquid gap</th><th>Spread</th></tr></thead><tbody>${S.crypto.map(x => `<tr><td style="text-align:left"><b>${x.c}</b></td>${["coinbase", "binance.us", "okx", "upbit", "hyperliquid"].map(k => `<td>${x.p[k] > 0 ? fx(x.p[k]) : "–"}</td>`).join("")}<td class="${cl(x.cbp)}">${pc(x.cbp, 3)}${zt(x.zCb)}</td><td class="${cl(x.kim)}">${pc(x.kim)}${zt(x.zKim)}</td><td class="${cl(x.hlp)}">${pc(x.hlp, 3)}${zt(x.zHl)}</td><td>${pc(x.disp, 3)}</td></tr>`).join("")}</tbody></table>`;
    const sb = S.stocks.filter(r => filt(r)).sort((a, b) => Math.abs(b.b) - Math.abs(a.b)).slice(0, o.n || 12);
    if (sb.length) h += `<table class="tr" style="margin-top:6px"><thead><tr><th style="text-align:left">Stock perp</th><th>Perp</th><th>Stock (oracle)</th><th>Gap</th><th style="text-align:left">Reading</th></tr></thead><tbody>${sb.map(r => `<tr><td style="text-align:left">${r.key}</td><td>${fx(r.px)}</td><td>${fx(r.o)}</td><td class="${cl(r.b)}">${pc(r.b)}${zt(r.z)}</td><td style="text-align:left">${Math.abs(r.b) < 0.001 ? "in line" : S.open ? (r.b > 0 ? "perp rich: tends to come back down to the stock" : "perp cheap: tends to come back up to the stock") : (r.b > 0 ? "perp above the last close: points to a higher open" : "perp below the last close: points to a lower open")}</td></tr>`).join("")}</tbody></table>`;
    const gs = S.groups.filter(g => filt(g.rs[0])).slice(0, o.ng || 8);
    if (gs.length) h += `<table class="tr" style="margin-top:6px"><thead><tr><th style="text-align:left">Same stock, several venues</th><th>Spread</th><th style="text-align:left">Cheapest → richest</th></tr></thead><tbody>${gs.map(g => `<tr><td style="text-align:left">${g.sym} (${g.rs.length} venues)</td><td class="${g.spread >= 0.003 ? "S" : ""}">${pc(g.spread)}</td><td style="text-align:left">${g.lo.key} ${fx(g.lo.px)} → ${g.hi.key} ${fx(g.hi.px)}${g.spread >= 0.003 ? " · arbitrage pull: the gap tends to close" : ""}</td></tr>`).join("")}</tbody></table>`;
    return (h || `<div class="note">Venue prices load in a minute.</div>`) + `<div class="note" style="max-width:none;margin-top:4px">Why gaps matter: prices on different outlets are tied together by arbitrage traders who buy the cheap one and sell the rich one. A gap that is bigger than its normal (σ) shows one-sided pressure in one place: US buyers on Coinbase, Korean retail on Upbit, leveraged traders on Hyperliquid, or perp traders betting on the stock open while the stock market is closed. The web learns from what price did next which gaps lead and which close.</div>`;
  }
  window.Venues = { perps, crypto, signals, html, state: () => S, usOpen };
})();
