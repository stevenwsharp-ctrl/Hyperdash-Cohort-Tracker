/* Spot flow view · shared by Cohort Sniper and SOXX Sniper (same file in both repos).
   Reads spotflow.json from Cohort Sniper's data branch: every trade on Hyperliquid's 16 biggest spot pairs, collected live
   by the data job through the websocket (both wallets of each trade are known). Shows, for 5m / 15m / 1h / 4h / 24h:
   taker buying vs selling per token, big trades ($25K+), and what the biggest spot traders do, with market makers
   (huge two-sided volume, little net) kept apart from traders who take a side.
   SpotFlow.mount(el, { tag: address -> {name, kind: "best" | "worst" | ""} | null }) */
(function () {
  "use strict";
  if (window.SpotFlow) return;
  const URL0 = "https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/data/spotflow.json";
  const WS = ["5m", "15m", "1h", "4h", "24h"];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const usd = n => { const a = Math.abs(n); return (n < 0 ? "-$" : "$") + (a >= 1e9 ? (a / 1e9).toFixed(2) + "B" : a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a >= 1e3 ? (a / 1e3).toFixed(1) + "K" : Math.round(a)); };
  const sg = n => (n > 0 ? "+" : "") + usd(n);
  const px = p => !p ? "–" : p >= 1000 ? p.toLocaleString(undefined, { maximumFractionDigits: 0 }) : p >= 1 ? p.toFixed(2) : p.toPrecision(4);
  const cls = v => v > 0 ? "sf-up" : v < 0 ? "sf-dn" : "";
  const short = a => a.slice(0, 6) + "…" + a.slice(-4);
  let J = null, at = 0, W = (() => { try { return localStorage.getItem("sf_w") || "1h"; } catch (e) { return "1h"; } })();
  const st = document.createElement("style");
  st.textContent = `.sf{font:12px var(--mono)}.sf-up{color:var(--bull,var(--up))}.sf-dn{color:var(--bear,var(--down))}.sf-f{color:var(--faint,var(--mute))}
.sf table{width:100%;border-collapse:collapse}.sf th,.sf td{padding:3px 6px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.sf th{color:var(--dim);font-size:11px;font-weight:600}.sf td.l,.sf th.l{text-align:left}
.sf .tw{overflow-x:auto;margin-top:6px}.sf .chips{display:flex;gap:3px;align-items:center;flex-wrap:wrap;margin:4px 0}.sf .chips button{font:11px var(--mono);padding:2px 8px;border-radius:7px;border:1px solid var(--line);background:transparent;color:var(--dim);cursor:pointer}.sf .chips button.on{border-color:var(--accent);color:var(--accent)}
.sf .sum{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:6px 0}.sf .sum>div{border:1px solid var(--line);border-radius:8px;padding:6px 9px;background:var(--panel2)}.sf .sum b{display:block;font-size:15px}
.sf .bar{display:inline-block;height:6px;border-radius:3px;vertical-align:middle;margin-left:4px}.sf h5{margin:10px 0 2px;font:600 11px var(--mono);color:var(--dim);text-transform:uppercase;letter-spacing:.04em}`;
  document.head.appendChild(st);
  async function load() {
    if (J && Date.now() - at < 50000) return J;
    try { const r = await fetch(URL0 + "?t=" + Math.floor(Date.now() / 60000), { cache: "no-store" }); if (r.ok) { J = await r.json(); at = Date.now(); delete J.state; } } catch (e) { }
    return J;
  }
  function html(o) {
    if (!J) return `<div class="sf sf-f">Loading spot flow… (the data job starts collecting with its next run; the first full 24 hours take a day)</div>`;
    const age = Math.round((Date.now() - Date.parse(J.t)) / 6e4), cover = Math.round((Date.now() - Date.parse(J.from)) / 36e5 * 10) / 10;
    const T = Object.entries(J.tokens).map(([k, v]) => ({ k, ...v, w: v.W[W] })).filter(t => t.w && t.w[0] + t.w[1] > 0).sort((a, b) => (b.w[0] + b.w[1]) - (a.w[0] + a.w[1])).slice(0, 12);
    const takerNet = T.reduce((a, t) => a + t.w[0] - t.w[1], 0), bigNet = T.reduce((a, t) => a + t.w[2] - t.w[3], 0);
    const Wh = J.whales.filter(w => !w.mm), MM = J.whales.filter(w => w.mm);
    const dirNet = Wh.reduce((a, w) => a + (w.net[W] || 0), 0), mmNet = MM.reduce((a, w) => a + (w.net[W] || 0), 0);
    const tag = a => { const t = o && o.tag ? o.tag(a) : null; return t ? ` <span class="${t.kind === "best" ? "sf-up" : t.kind === "worst" ? "sf-dn" : "sf-f"}">${esc(t.name)}</span>` : ""; };
    const mx = Math.max(1, ...T.map(t => Math.abs(t.w[0] - t.w[1])));
    return `<div class="sf"><div class="chips"><span class="sf-f">Time frame</span>${WS.map(w => `<button data-sfw="${w}" class="${w === W ? "on" : ""}">${w}</button>`).join("")}<span class="sf-f" style="margin-left:auto">updated ${age} min ago · ${J.pairs} pairs · ${cover >= 24 ? "full 24h" : cover + "h collected"}</span></div>
      <div class="sum"><div><span class="sf-f">Takers net, ${W}</span><b class="${cls(takerNet)}">${sg(takerNet)}</b>${takerNet >= 0 ? "buyers lifting offers" : "sellers hitting bids"}</div>
        <div><span class="sf-f">Big trades ($25K+) net, ${W}</span><b class="${cls(bigNet)}">${sg(bigNet)}</b>size players</div>
        <div><span class="sf-f">Top spot traders (not MMs), ${W}</span><b class="${cls(dirNet)}">${sg(dirNet)}</b>${Wh.length} wallets that take a side</div>
        <div><span class="sf-f">Market makers, ${W}</span><b class="${cls(mmNet)}">${sg(mmNet)}</b>${MM.length} MMs: inventory, the other side of the flow</div></div>
      <h5>Tokens · ${W}</h5><div class="tw"><table><tr><th class="l">Token</th><th>Price</th><th>24h</th><th>Taker buy</th><th>Taker sell</th><th>Net</th><th>Big-trade net</th><th>Trades</th></tr>
        ${T.map(t => { const n = t.w[0] - t.w[1]; return `<tr><td class="l"><b>${esc(t.k)}</b></td><td>${px(t.px)}</td><td class="${cls(t.ch)}">${t.ch == null ? "–" : (t.ch > 0 ? "+" : "") + t.ch.toFixed(2) + "%"}</td><td>${usd(t.w[0])}</td><td>${usd(t.w[1])}</td><td class="${cls(n)}">${sg(n)}<span class="bar" style="width:${Math.round(Math.abs(n) / mx * 60)}px;background:${n >= 0 ? "var(--bull,var(--up))" : "var(--bear,var(--down))"}"></span></td><td class="${cls(t.w[2] - t.w[3])}">${t.w[2] + t.w[3] ? sg(t.w[2] - t.w[3]) : "–"}</td><td>${t.w[4]}</td></tr>`; }).join("")}</table></div>
      <h5>Biggest spot traders that take a side · net by time frame</h5><div class="tw"><table><tr><th class="l">Wallet</th><th>24h volume</th>${WS.map(w => `<th${w === W ? ' style="color:var(--accent)"' : ""}>${w}</th>`).join("")}<th class="l">Main tokens (24h net)</th></tr>
        ${Wh.slice(0, 15).map(w => `<tr><td class="l"><a href="https://hyperdash.com/address/${esc(w.a)}" target="_blank" rel="noopener">${short(w.a)}</a>${tag(w.a)}</td><td>${usd(w.g)}</td>${WS.map(x => `<td class="${cls(w.net[x])}">${w.net[x] ? sg(w.net[x]) : "·"}</td>`).join("")}<td class="l">${w.top.map(([t, v]) => `<span class="${cls(v)}">${esc(t)} ${sg(v)}</span>`).join(" · ")}</td></tr>`).join("")}</table></div>
      <h5>Newest big trades ($25K+)</h5><div class="tw"><table><tr><th class="l">Time</th><th class="l">Token</th><th>Side (taker)</th><th>Size</th><th>Price</th><th class="l">Buyer</th><th class="l">Seller</th></tr>
        ${J.big.slice(0, 12).map(b => `<tr><td class="l">${new Date(b[0]).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td><td class="l">${esc(b[1])}</td><td class="${b[4] > 0 ? "sf-up" : "sf-dn"}">${b[4] > 0 ? "buy" : "sell"}</td><td>${usd(b[3])}</td><td>${px(b[2])}</td><td class="l">${b[5] ? short(b[5]) + tag(b[5]) : ""}</td><td class="l">${b[6] ? short(b[6]) + tag(b[6]) : ""}</td></tr>`).join("")}</table></div>
      <div class="sf-f" style="margin-top:6px;line-height:1.5">Taker = the side that crossed the spread (paid up to buy or sold into bids): that is the urgent money. Market makers mostly sit on the other side, so their net shows the crowd's flow in reverse. Read: takers and the biggest side-taking wallets buying in 5m–1h while price is flat or down = accumulation; big wallets selling into a rally = distribution.</div></div>`;
  }
  function mount(el, o) {
    if (!el) return; el._sfo = o;
    const draw = async () => { await load(); el.innerHTML = html(el._sfo); };
    if (!el._sf) { el._sf = 1; el.addEventListener("click", e => { const b = e.target.closest("[data-sfw]"); if (!b) return; W = b.dataset.sfw; try { localStorage.setItem("sf_w", W); } catch (x) { } el.innerHTML = html(el._sfo); }); setInterval(() => { if (el.isConnected && !document.hidden) draw(); }, 60000); }
    draw();
  }
  window.SpotFlow = { mount, load, data: () => J };
})();
