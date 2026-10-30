/* Cohort Sniper · lets SOXX Sniper's pro chart (prochart.js, the same file in both repos) run on this site.
   prochart.js needs some globals from SOXX Sniper's page; this file gives it small versions of them.
   The pro chart charts the real stock (Yahoo through the Worker, with pre-market and after-hours); the live last
   price comes from the stock's Hyperliquid perp. Settings and drawings use their own key (cs_pc), so SOXX Sniper's chart is not changed. */
(function () {
  "use strict";
  const W = window, WORKER0 = "https://soxx-sniper-fred.sharpventures.workers.dev";
  // SOXX Sniper colors (dark and light) for the parts of the chart that use them
  const st = document.createElement("style");
  st.textContent = `:root{--ink:#e6edf5;--mute:#5a6676;--up:#19d38a;--down:#ff4d5e;--amber:#ffb547;--violet:#9b6bff}
:root[data-theme=light]{--ink:#0f1726;--mute:#8a94a3;--up:#0b9e65;--down:#e1354a;--amber:#b86e00;--violet:#6d44f0}
#pcWrap{font-family:var(--mono)} #pcWrap .pcbar button.pcclassic,#pcClassic{display:none!important}
#taCard[hidden]{display:none}`;
  document.head.appendChild(st);
  const f = document.createElement("link"); f.rel = "stylesheet"; f.href = "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap"; document.head.appendChild(f);
  // the hidden home of the chart (prochart.js builds into #pcMount inside #taCard)
  const card = document.createElement("section"); card.id = "taCard"; card.hidden = true; card.innerHTML = `<div id="pcMount"></div>`; document.body.appendChild(card);

  const def = (k, v) => { if (!(k in W)) W[k] = v; };
  def("FUND", "SOXL");
  def("HOLDINGS", (W.Basket && Basket.SOXX || []).map(h => [h[0], h[0], h[1], h[2]]));
  def("ETFS", []);
  def("demo", false);
  def("EARN", []); def("BIGEARN", []);
  def("fredProxy", () => { try { return (localStorage.getItem("soxx_fred_proxy") || "").trim().replace(/\/+$/, "") || WORKER0; } catch (e) { return WORKER0; } });
  def("ySym", s => s === "BTC" ? "BTC-USD" : s === "ETH" ? "ETH-USD" : s);
  def("isDST", ms => { const y = new Date(ms).getUTCFullYear(), nth = (m, n) => { const w = new Date(Date.UTC(y, m, 1)).getUTCDay(); return 1 + ((7 - w) % 7) + (n - 1) * 7; };
    return ms >= Date.UTC(y, 2, nth(2, 2), 7) && ms < Date.UTC(y, 10, nth(10, 1), 6); });
  def("etInfo", ms => { const l = new Date(ms - (isDST(ms) ? 4 : 5) * 3600000); return { d: l.toISOString().slice(0, 10), min: l.getUTCHours() * 60 + l.getUTCMinutes(), wd: l.getUTCDay() }; });
  def("etDate", (t = Date.now()) => etInfo(t).d);
  def("fmtPct", (x, d = 2) => isFinite(x) ? (x >= 0 ? "+" : "") + (x * 100).toFixed(d) + "%" : "--");
  def("fmtPx", x => isFinite(x) && x > 0 ? "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "--");
  const key = k => String(k).replace(/^soxx_pc/, "cs_pc");
  def("lsGet", k => { try { return localStorage.getItem(key(k)); } catch (e) { return null; } });
  def("lsSet", (k, v) => { try { localStorage.setItem(key(k), v); } catch (e) { } });
  def("alert1", (k, cd, msg) => { try { const s = JSON.parse(localStorage.getItem("cs_pc_al") || "{}"); if (s[k] && Date.now() - s[k] < cd) return; s[k] = Date.now(); localStorage.setItem("cs_pc_al", JSON.stringify(s));
    if (typeof toast === "function") toast(`<b>${String(msg).replace(/[<>&]/g, "")}</b>`, "tl"); if (W.Notification && Notification.permission === "granted") new Notification("Cohort Sniper", { body: msg }); } catch (e) { } });
  def("soxlLevels", () => null); def("mhRead", () => null); def("macroState", () => ({ L: [] }));
  // live last price: the stock's Hyperliquid perp (any venue), only while US stock trading is open (4:00 am – 8:00 pm ET, weekdays)
  def("Q", new Proxy({}, { get(_, sym) {
    if (typeof sym !== "string") return undefined;
    const e = etInfo(Date.now()); if (e.wd === 0 || e.wd === 6 || e.min < 240 || e.min >= 1200) return undefined;
    try { for (const v of ["XYZ", "PARA", "IO", "CASH", "FLX", "KM"]) { const c = typeof ctxOf === "function" ? ctxOf(v + ":" + sym) : null; if (c && c.px > 0) return { c: c.px }; } } catch (e) { }
    return undefined; } }));
})();
