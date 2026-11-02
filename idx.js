/* Index strip · the same file on SOXX Sniper, Cohort Sniper and LETF Sniper: the Dow, the whole Nasdaq (Composite),
   the Nasdaq 100 and the S&P 500 at the top of the page, with the day's move, a sparkline and the session.
   When the cash market is closed, the futures (Dow YM, Nasdaq-100 NQ, S&P ES) show next to each index.
   Data: the Worker's /chart (Yahoo) with the Worker URL saved in this browser (shared by the three sites); Cohort Sniper
   falls back to its data job's context.json (idx) when no Worker URL is saved.
   To the signal web (SOXX Sniper, asset SOXL): mkt.dow and mkt.nasdaq (the day's move, in units of a normal day). */
(function () {
  "use strict";
  if (window.IDXSTRIP) return; window.IDXSTRIP = 1;
  const head = document.querySelector("header"); if (!head) return;
  const IX = [["^DJI", "Dow Jones", "YM=F", 0.009], ["^IXIC", "Nasdaq Composite", null, 0.012], ["^NDX", "Nasdaq 100", "NQ=F", 0.012], ["^GSPC", "S&P 500", "ES=F", 0.009]];
  const bar = document.createElement("section"); bar.id = "idxStrip"; head.after(bar);
  const st = document.createElement("style");
  st.textContent = `#idxStrip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px}@media(max-width:820px){#idxStrip{grid-template-columns:repeat(2,minmax(0,1fr))}}
    #idxStrip .ix{background:var(--panel,transparent);border:1px solid var(--line);border-radius:10px;padding:6px 10px;min-width:0;position:relative;overflow:hidden}
    #idxStrip .in{font:11px var(--mono,monospace);color:var(--dim,var(--faint,#888));display:flex;justify-content:space-between;gap:6px;white-space:nowrap}
    #idxStrip .ip{font:600 16px var(--mono,monospace);margin-top:1px}#idxStrip .ic{font:12px var(--mono,monospace)}#idxStrip .L{color:var(--up,var(--bull,#19d38a))}#idxStrip .S{color:var(--down,var(--bear,#ff4d5e))}
    #idxStrip svg{position:absolute;right:6px;bottom:6px;width:42%;height:30px;opacity:.85}#idxStrip .fu{font:10.5px var(--mono,monospace);color:var(--dim,var(--faint,#888))}`;
  document.head.appendChild(st);
  const proxy = () => { try { return (localStorage.getItem("soxx_fred_proxy") || "").trim().replace(/\/+$/, ""); } catch (e) { return ""; } };
  const usOpen = () => { const p = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date()), g = k => p.find(x => x.type === k).value, m = +g("hour") * 60 + +g("minute"); return !["Sat", "Sun"].includes(g("weekday")) && m >= 570 && m < 960; };
  const D = {}, fx = v => v == null ? "–" : v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), pc = v => v == null || !isFinite(v) ? "–" : (v >= 0 ? "+" : "") + (v * 100).toFixed(2) + "%";
  async function q(sym) { const p = proxy(); if (!p) return null; try { const r = await fetch(`${p}/chart?t=${encodeURIComponent(sym)}&range=1d&interval=5m`), j = await r.json(); if (j.status !== "ok" || !j.meta) return null; const b = (j.bars || []).filter(x => x[4] != null), px = b.length ? b[b.length - 1][4] : j.meta.price, prev = j.meta.prevClose; return { px, prev, d: prev ? px / prev - 1 : null, sp: b.map(x => x[4]) }; } catch (e) { return null; } }
  const spark = a => { if (!a || a.length < 3) return ""; const lo = Math.min(...a), hi = Math.max(...a), k = hi - lo || 1, w = 100, h = 30; return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${a.map((v, i) => `${(i / (a.length - 1) * w).toFixed(1)},${(h - 2 - (v - lo) / k * (h - 4)).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--${a[a.length - 1] >= a[0] ? "up,var(--bull" : "down,var(--bear"},#888))" stroke-width="1.4" vector-effect="non-scaling-stroke"/></svg>`; };
  async function tick() {
    if (document.hidden && Object.keys(D).length) return; const open = usOpen();
    if (proxy()) { await Promise.all(IX.map(async ([s, , f]) => { const a = await q(s); if (a) D[s] = a; if (f && !open) { const b = await q(f); if (b) D[f] = b; } })); }
    else { try { const C = typeof CONTEXT !== "undefined" && CONTEXT && CONTEXT.idx; if (C) IX.forEach(([s]) => { const x = C[s]; if (x) D[s] = { px: x.px, d: x.ch / 100, sp: x.sp || null }; }); } catch (e) { } }
    bar.innerHTML = IX.map(([s, n, f]) => { const x = D[s], fu = f && !open && D[f]; return `<div class="ix"><div class="in"><span>${n}</span><span>${open ? "open" : "closed"}</span></div><div class="ip">${x ? fx(x.px) : "–"}</div><div class="ic"><span class="${x && x.d >= 0 ? "L" : "S"}">${x ? pc(x.d) : proxy() ? "loading…" : "add the Worker URL"}</span>${fu ? ` <span class="fu">· futures <span class="${D[f].d >= 0 ? "L" : "S"}">${pc(D[f].d)}</span></span>` : ""}</div>${x ? spark(x.sp) : ""}</div>`; }).join("");
    try { if (window.Web && document.getElementById("stanceCard")) [["^DJI", "mkt.dow", "Stocks · Dow Jones today (σ)"], ["^IXIC", "mkt.nasdaq", "Stocks · Nasdaq Composite today (σ)"]].forEach(([s, id, lab]) => { const x = D[s], sd = IX.find(i => i[0] === s)[3]; if (x && x.d != null) Web.emit(id, "SOXL", Math.max(-1, Math.min(1, x.d / sd / 2.5)), lab); }); } catch (e) { }
    window.IDX = D;
  }
  tick(); setInterval(tick, 60000);
})();
