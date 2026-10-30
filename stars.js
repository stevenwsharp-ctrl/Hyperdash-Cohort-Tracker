/* Cohort Sniper · starred markets worksheet, market overview, big trades of the best and worst traders, and floating help for column headings.
   Loads after index.html's main script and uses its globals (ROWS, VIEW, SPEC, LIVE, render, gotoCoin, toast, ...). */
(function () {
  "use strict";
  const lsG = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const HL = "https://api.hyperliquid.xyz/info", WORKER0 = "https://soxx-sniper-fred.sharpventures.workers.dev";
  const wk = () => { try { return (localStorage.getItem("soxx_fred_proxy") || "").trim().replace(/\/+$/, "") || WORKER0; } catch (e) { return WORKER0; } };
  const post = b => fetch(HL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  let STARS = lsG("cs_stars", []);
  const isStar = c => STARS.includes(c);
  const saveStars = () => lsS("cs_stars", STARS);

  /* ---------- styles ---------- */
  const st = document.createElement("style");
  st.textContent = `
.cstar{background:none;border:0;cursor:pointer;font-size:15px;line-height:1;padding:0 4px 0 0;color:var(--faint);vertical-align:-1px}
.cstar.on{color:#f5b301;text-shadow:0 0 6px rgba(245,179,1,.45)}.cstar:hover{color:#f5b301}
.sheetbar{position:fixed;left:0;right:0;bottom:0;z-index:300;display:flex;align-items:flex-end;gap:2px;padding:0 12px;height:30px;background:var(--panel2);border-top:1px solid var(--line);font:12px var(--sans)}
.sheetbar .nav{color:var(--faint);font:11px var(--mono);margin-right:8px;align-self:center}
.sheetbar button{border:1px solid var(--line);border-top:0;border-radius:0 0 6px 6px;background:var(--panel2);color:var(--dim);padding:4px 14px 5px;cursor:pointer;font:600 12px var(--sans);margin-top:-1px}
.sheetbar button.on{background:var(--panel);color:var(--text);box-shadow:inset 0 -2px 0 var(--bull)}
.sheetbar .thx{margin-left:auto;align-self:center;border-radius:6px;border-top:1px solid var(--line);margin-top:0;padding:2px 10px;font-weight:500}
body{padding-bottom:34px}
.mkts{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:6px;margin:12px 0}
.mk{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px 9px;font:11px var(--mono);color:var(--dim)}
.mk b{display:block;font:600 15px var(--mono);color:var(--text)}.mk .src{float:right;font-size:9px;color:var(--faint)}
.xl{border-collapse:collapse;width:100%;font:12px var(--mono);background:var(--panel)}
.xlwrap{overflow-x:auto;border:1px solid var(--line);border-radius:6px}
.xl th,.xl td{border:1px solid var(--line);padding:4px 7px;white-space:nowrap;text-align:right}
.xl thead .let th{background:var(--panel2);color:var(--faint);font-weight:500;font-size:10px;text-align:center;padding:1px}
.xl thead .nm th{background:var(--panel2);color:var(--text);font:600 11px var(--sans);text-align:center;position:sticky;top:0}
.xl td.rn,.xl th.rn{background:var(--panel2);color:var(--faint);text-align:center;width:28px;font-size:10px}
.xl td.tl{text-align:left}.xl tbody tr:hover td{background:rgba(127,127,127,.08)}
.xl tbody tr{cursor:pointer}.xl td.cell-sel{outline:2px solid var(--bull);outline-offset:-2px}
.xlbar{display:flex;gap:8px;align-items:center;font:12px var(--mono);border:1px solid var(--line);border-bottom:0;border-radius:6px 6px 0 0;background:var(--panel2);padding:4px 8px}
.xlbar i{font-style:italic;color:var(--faint);border-right:1px solid var(--line);padding-right:8px}
.xlbar span{color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(520px,1fr));gap:10px;margin-top:12px}
.bt{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
.bt h4{margin:0 0 6px;font:600 14px var(--sans);display:flex;gap:8px;align-items:center}
.bt h5{margin:8px 0 3px;font:600 11px var(--mono);color:var(--dim);text-transform:uppercase;letter-spacing:.04em}
.bt table{width:100%;border-collapse:collapse;font:11.5px var(--mono)}.bt td{padding:2px 4px;border-bottom:1px solid var(--line);white-space:nowrap}
.bt td.r{text-align:right}.bt .new{background:rgba(245,179,1,.18)}
.ftip{position:fixed;z-index:500;max-width:340px;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:8px;padding:8px 10px;font:12px/1.45 var(--sans);box-shadow:0 8px 24px rgba(0,0,0,.35);pointer-events:none;display:none}
.ftip b{display:block;margin-bottom:2px;font-size:12.5px}
[data-tip]{cursor:help}
`;
  document.head.appendChild(st);

  /* ---------- floating help for column headings ---------- */
  const TIPS = {
    "#": "Place in the list with your current sort (rating, high to low, by default). Click a heading to sort by it.",
    "Market": "The Hyperliquid market, its live price and 24h change. Tags: asset class, venue (xyz = stock perps), S&P member, US exchange. ★ = add to your Starred sheet.",
    "Setup": "SMART LONG / SMART SHORT = the side the profitable cohorts hold. The second tag is what the losing cohorts (fools) hold.",
    "Rating · gap": "Rating 0–100 = disparity score adjusted for liquidity, funding, trend, momentum, earnings, macro, news, specialists and liquidations. Small number = the gap (smart bias minus fools bias, halved). Disparity = raw gap score before context.",
    "Smart bias": "Net long or short of the profitable cohorts in this market, −100 (all short) to +100 (all long). Mini bars = each smart cohort.",
    "Fools bias": "Net long or short of the losing cohorts, −100 to +100. The best setups have fools on the other side.",
    "Money · funding": "Dollar exposure and number of traders on each side. Funding badge = what a smart-side position earns or pays per year. Flags = exits, flips, red flags, news, earnings.",
    "Trade with": "Ways to trade the setup in a US brokerage: listed options (weekly or not, IV, put/call) and leveraged ETFs on the same side.",
    "Alignment trend": "Top row (gap): change of the gap in points over each window. Not the rating and not the rank. ▲ green = smart and fools moved further apart (stronger). Bottom row (#N): rank by gap size among the markets that pass your filters, and how many places it moved in each window. Sparkline = gap history.",
    "Window": "Look-back time. 30m = now vs 30 minutes ago. 7d shows only when there is a full 7 days of history.",
    "Gap change (pts)": "How many points the gap (smart bias minus fools bias) moved in the window. Stronger = wider on the setup side.",
    "Smart bias Δ": "Change of the smart cohorts' bias in points over the window.",
    "Fools bias Δ": "Change of the losing cohorts' bias in points over the window.",
    "Smart $ on setup side": "% and $ change of smart money on the setup side. + = smart traders added.",
    "Price, smart side": "Price move in the smart direction over the window. + = the smart side made money.",
    "Trader": "Wallet (click for Hyperdash). ◆ = several wallets that look like one trader.",
    "Cohort": "Hyperdash PnL cohort: Extremely/Very profitable … Rekt.",
    "Overall win": "Win rate on all closed trades, and the number of trades.",
    "Record on these coins": "Wins and losses on the coins where they hold a position now.",
    "PnL on these coins": "Realized PnL on those coins.",
    "Holds now": "Their largest open positions. Click a coin to open it.",
    "Avg leverage": "Size-weighted leverage of their open positions.",
    "Use a stop": "Share of their position $ that has a stop order on the exchange.",
    "Nearest liq": "How far price must move against them to liquidate their closest position.",
    "Cuts losses / takes": "Median move against them when they close a loser / median gain on a winner.",
    "Liquidated 60d": "Number of forced closes in 60 days, and the $ size.",
    // starred sheet
    "Price": "Live Hyperliquid mark price.", "24h": "Change vs 24 hours ago.", "Rating": "Rating 0–100 (see Setups).",
    "Gap": "Smart bias minus fools bias, halved. + = smart long.", "Smart": "Smart cohorts' bias, −100 to +100.", "Fools": "Losing cohorts' bias, −100 to +100.",
    "Δ1h": "Gap change in points over 1 hour (+ = stronger on the setup side).", "Δ4h": "Gap change in points over 4 hours.", "Δ24h": "Gap change in points over 24 hours.",
    "Rank": "Rank by gap size among the markets that pass your Setups filters (and the move in 1h).",
    "Funding/yr": "What a smart-side position earns (+) or pays (−) per year at the current funding.",
    "Smart $": "Smart cohorts' dollar exposure in this market.", "Flags": "Recent expert exits, flips and fading; red flags.",
    "Trade with": "Listed options and same-side leveraged ETFs.", "Earnings": "Next earnings date.", "News": "Headlines in 24 hours (big ones).",
  };
  const tip = document.createElement("div"); tip.className = "ftip"; document.body.appendChild(tip);
  const keyOf = el => (el.dataset.tipk || el.childNodes[0] && el.childNodes[0].textContent || el.textContent || "").trim();
  function tagTips(root) {
    (root || document).querySelectorAll("#hdr > div, thead th, .xl thead .nm th").forEach(el => {
      if (el.dataset.tip) return;
      const k = keyOf(el), t = TIPS[k] || el.getAttribute("title");
      if (!t) return; el.dataset.tip = t; el.dataset.tipk = k; el.removeAttribute("title");
    });
  }
  let tipEl = null;
  document.addEventListener("mouseover", e => { const el = e.target.closest("[data-tip]"); tipEl = el;
    if (!el) { tip.style.display = "none"; return; }
    tip.innerHTML = `<b>${esc(el.dataset.tipk || "")}</b>${esc(el.dataset.tip)}`; tip.style.display = "block"; });
  document.addEventListener("mousemove", e => { if (!tipEl) return; const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 16; if (x + w > innerWidth - 8) x = e.clientX - w - 14; if (y + h > innerHeight - 8) y = e.clientY - h - 12;
    tip.style.left = x + "px"; tip.style.top = y + "px"; });
  window.addEventListener("scroll", () => { tip.style.display = "none"; tipEl = null; }, { passive: true });

  /* ---------- stars on rows ---------- */
  function decorate() {
    document.querySelectorAll(".row[data-coin] .mkt").forEach(m => {
      const coin = m.closest(".row").dataset.coin; let b = m.querySelector(".cstar");
      if (!b) { b = document.createElement("button"); b.className = "cstar"; b.dataset.star = coin; m.insertBefore(b, m.firstChild); }
      b.classList.toggle("on", isStar(coin)); b.textContent = isStar(coin) ? "★" : "☆"; b.title = isStar(coin) ? "Remove from Starred" : "Add to Starred";
    });
    tagTips();
  }
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-star]"); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const c = b.dataset.star; STARS = isStar(c) ? STARS.filter(x => x !== c) : STARS.concat(c); saveStars();
    decorate(); tabLabels(); if (VIEW === "starred") renderStarred(); else if (isStar(c)) loadTrades(true);
  }, true);

  /* ---------- tab + Excel-style sheet tabs ---------- */
  const tabs = document.querySelector(".tabs");
  const tb = document.createElement("button"); tb.className = "tab"; tb.dataset.tab = "starred";
  tabs.insertBefore(tb, tabs.children[1] || null);
  const sec = document.createElement("section"); sec.id = "v-starred"; sec.hidden = true;
  sec.innerHTML = `<div id="stMk"></div><div id="stSheet"></div><h3 style="margin:16px 0 0">Big trades on your starred markets · best vs worst traders</h3><div class="note" id="stBtNote" style="max-width:none"></div><div class="bt-grid" id="stBt"></div>`;
  document.getElementById("v-setups").after(sec);
  const sheet = document.createElement("div"); sheet.className = "sheetbar";
  sheet.innerHTML = `<span class="nav">◀ ▶</span><button data-sheet="setups">Setups</button><button data-sheet="starred"></button><button data-sheet="traders">Traders</button><button data-sheet="heat">Heat</button><button class="thx" id="sbTheme" title="Light / dark mode"></button>`;
  document.body.appendChild(sheet);
  function tabLabels() {
    tb.textContent = `★ Starred${STARS.length ? " (" + STARS.length + ")" : ""}`;
    sheet.querySelector('[data-sheet="starred"]').textContent = `★ Starred${STARS.length ? " (" + STARS.length + ")" : ""}`;
    sheet.querySelectorAll("[data-sheet]").forEach(b => b.classList.toggle("on", b.dataset.sheet === VIEW));
    const th = document.getElementById("sbTheme"); th.textContent = document.documentElement.dataset.theme === "light" ? "☾ Dark mode" : "☀ Light mode";
  }
  sheet.onclick = e => { const b = e.target.closest("[data-sheet]"); if (b) { document.querySelector(`.tab[data-tab="${b.dataset.sheet}"]`).click(); window.scrollTo(0, 0); } };
  document.getElementById("sbTheme").onclick = () => { const btn = document.getElementById("thBtn"); if (btn) btn.click(); else { const t = document.documentElement.dataset.theme === "light" ? "dark" : "light"; document.documentElement.dataset.theme = t; try { localStorage.setItem("cs_theme", t); } catch (e) { } } setTimeout(tabLabels, 0); };
  new MutationObserver(tabLabels).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  // all top tabs: show or hide our section, keep the sheet bar in step
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => { sec.hidden = b.dataset.tab !== "starred"; setTimeout(tabLabels, 0); }));
  tb.onclick = () => {
    VIEW = "starred";
    document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === tb));
    document.querySelectorAll("main section, .wrap > section, section[id^='v-']").forEach(s => { if (/^v-/.test(s.id)) s.hidden = s.id !== "v-starred"; });
    sec.hidden = false; render(); renderStarred(); loadMkts(); loadTrades(false);
  };

  /* ---------- market overview ---------- */
  const YH = [["^DJI", "Dow"], ["^GSPC", "S&P 500"], ["^IXIC", "Nasdaq"], ["^RUT", "Russell 2000"], ["^VIX", "VIX"], ["^TNX", "10Y yield"], ["USO", "Oil fund USO"], ["DX-Y.NYB", "Dollar index"]];
  const HLM = [["XYZ:XYZ100", "Nasdaq-100 perp"], ["XYZ:SP500", "S&P 500 perp"], ["XYZ:CL", "WTI oil perp"], ["XYZ:BRENTOIL", "Brent oil perp"], ["XYZ:GOLD", "Gold perp"], ["XYZ:SILVER", "Silver perp"], ["BTC", "Bitcoin"], ["ETH", "Ether"], ["SOL", "Solana"]];
  let MK = {}, mkT = 0;
  async function loadMkts() {
    if (Date.now() - mkT < 55000) { renderMk(); return; } mkT = Date.now();
    await Promise.all(YH.map(([s]) => fetch(`${wk()}/chart?t=${encodeURIComponent(s)}&range=1d&interval=5m`).then(r => r.json()).then(j => {
      if (j.status === "ok" && j.meta && j.meta.price) MK[s] = { px: j.meta.price, ch: j.meta.prevClose ? (j.meta.price / j.meta.prevClose - 1) * 100 : null };
    }).catch(() => { })));
    renderMk();
  }
  function renderMk() {
    const el = document.getElementById("stMk"); if (!el) return;
    const card = (n, px, ch, src, dp) => `<div class="mk"><span class="src">${src}</span>${n}<b>${px == null ? "–" : dp != null ? px.toFixed(dp) : price(px)}</b><span class="${ch == null ? "" : ch >= 0 ? "L" : "S"}">${ch == null ? "–" : (ch >= 0 ? "+" : "") + ch.toFixed(2) + "%"}</span></div>`;
    const a = YH.map(([s, n]) => { const x = MK[s]; return x ? card(n, x.px, x.ch, "index", s === "^TNX" || s === "^VIX" ? 2 : null) : ""; }).join("");
    const b = HLM.map(([c, n]) => { const x = ctxOf(c); return x && x.px ? card(n, x.px, x.ch, "live 24/7") : ""; }).join("");
    const M = macro();
    el.innerHTML = `<div class="mkts">${a}${b}<div class="mk"><span class="src">page</span>Regime<b class="${M.regime === "Risk-on" ? "L" : M.regime === "Risk-off" ? "S" : ""}">${M.regime}</b>score ${M.score > 0 ? "+" : ""}${M.score}</div></div>`;
  }

  /* ---------- the sheet ---------- */
  const COLS = ["", "Market", "Price", "24h", "Setup", "Rating", "Gap", "Smart", "Fools", "Δ1h", "Δ4h", "Δ24h", "Rank", "Funding/yr", "Smart $", "Flags", "Trade with", "Earnings", "News"];
  const L = i => String.fromCharCode(64 + i);
  const sg = v => v == null ? "–" : (v > 0 ? "+" : "") + v;
  function cells(coin) {
    const r = (ROWS || []).find(x => x.coin === coin), cx = ctxOf(coin), sym = parse(coin).sym;
    const star = `<button class="cstar on" data-star="${esc(coin)}" title="Remove from Starred">★</button>`;
    if (!r) return [star, `<b>${esc(sym)}</b>`, cx ? price(cx.px) : "–", cx && cx.ch != null ? `<span class="${cx.ch >= 0 ? "L" : "S"}">${sg(cx.ch)}%</span>` : "–", `<span class="N">no setup now</span>`, "", "", "", "", "", "", "", "", "", "", "", "", "", ""];
    const d = k => { const v = r.tr[k]; if (!v) return "–"; const s = r.dir * v[0]; return `<span class="${s >= 5 ? "L" : s <= -5 ? "S" : ""}">${s > 0 ? "▲" : s < 0 ? "▼" : ""}${Math.abs(s)}</span>`; };
    const rk = r.rk ? `#${r.rk.now}${r.rk["1h"] != null && r.rk["1h"] !== r.rk.now ? ` <span class="${r.rk["1h"] > r.rk.now ? "L" : "S"}">${r.rk["1h"] > r.rk.now ? "▲" : "▼"}${Math.abs(r.rk["1h"] - r.rk.now)}</span>` : ""}` : "<span class='N'>filtered out</span>";
    const fl = [...new Set(r.evs.map(e => e.type))].map(t => t === "exit" ? "⚠ exit" : t === "flip" ? "⚠ flip" : t === "fade" ? "fading" : t).concat(r.red.length ? ["red flag"] : []).join(", ") || "–";
    const tw = [r.tools.opt ? "opt " + r.tools.optSym + (r.tools.wk ? " wk" : "") : "", ...(r.tools.same || []).slice(0, 2).map(x => x.s + " " + x.x + "x")].filter(Boolean).join(" · ") || "perp only";
    const n24 = r.news.filter(n => Date.now() - n.t < 24 * 36e5), nb = n24.filter(n => n.b).length;
    return [star, `<b>${esc(r.sym)}</b> <span style="color:var(--faint)">${esc(r.cls)}</span>`, r.ctx ? price(r.ctx.px) : "–",
      r.ctx && r.ctx.ch != null ? `<span class="${r.ctx.ch >= 0 ? "L" : "S"}">${sg(r.ctx.ch)}%</span>` : "–",
      `<span class="${r.dir > 0 ? "L" : "S"}">SMART ${r.dir > 0 ? "LONG" : "SHORT"}</span>`, `<b>${r.rating}</b>`, `<span class="${r.dir > 0 ? "L" : "S"}">${pct(r.gap)}</span>`,
      `<span class="${r.sm.b >= 0 ? "L" : "S"}">${pct(r.sm.b)}</span>`, `<span class="${r.fo.b >= 0 ? "L" : "S"}">${pct(r.fo.b)}</span>`, d("1h"), d("4h"), d("24h"), rk,
      r.earn != null ? `<span class="${r.earn >= 0 ? "L" : "S"}">${sg(Math.round(r.earn))}%</span>` : "–", usd(r.sm.n), fl, tw,
      r.er ? new Date(r.er.d + "T12:00:00Z").toLocaleDateString([], { month: "short", day: "numeric" }) : "–", n24.length ? `${n24.length}${nb ? ` (${nb} big)` : ""}` : "–"];
  }
  let SEL = null;
  function renderStarred() {
    if (VIEW !== "starred") return;
    renderMk();
    const el = document.getElementById("stSheet");
    if (!STARS.length) { el.innerHTML = `<div class="empty">No starred markets yet. Click ☆ next to a market on the Setups sheet to add it here.</div>`; document.getElementById("stBt").innerHTML = ""; document.getElementById("stBtNote").textContent = ""; return; }
    const body = STARS.map((c, i) => `<tr data-go="${esc(c)}"><td class="rn">${i + 2}</td>${cells(c).map((v, j) => `<td class="${j <= 1 || j >= 15 ? "tl" : ""}" data-c="${L(j + 1)}${i + 2}">${v}</td>`).join("")}</tr>`).join("");
    el.innerHTML = `<div class="xlbar"><i>fx</i><span id="xlSel">${SEL ? esc(SEL) : "Click a cell · double-click a row to open the market"}</span></div><div class="xlwrap"><table class="xl"><thead><tr class="let"><th class="rn"></th>${COLS.map((_, j) => `<th>${L(j + 1)}</th>`).join("")}</tr><tr class="nm"><th class="rn">1</th>${COLS.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
    tagTips(el);
    renderTrades();
  }
  document.addEventListener("click", e => {
    const td = e.target.closest(".xl tbody td"); if (!td || e.target.closest("[data-star]")) return;
    document.querySelectorAll(".xl td.cell-sel").forEach(x => x.classList.remove("cell-sel")); td.classList.add("cell-sel");
    SEL = `${td.dataset.c || ""}  ${td.textContent.trim()}`; const s = document.getElementById("xlSel"); if (s) s.textContent = SEL;
  });
  document.addEventListener("dblclick", e => { const tr = e.target.closest(".xl tbody tr[data-go]"); if (tr) gotoCoin(tr.dataset.go); });

  /* ---------- big trades of the best and worst traders ---------- */
  const COHN = { EP: "Ext profitable", VP: "Very profitable", P: "Profitable", U: "Unprofitable", VU: "Very unprofitable", R: "Rekt" };
  const FILLS = {};          // wallet -> { t: fetched ms, f: fills }
  const SEEN = new Set(lsG("cs_bt_seen", []));
  let tradesBusy = false, tradesT = 0;
  function walletsFor(coin) {
    const X = SPEC && SPEC.m && SPEC.m[coin]; if (!X || !X.holders) return null;
    const hs = X.holders.filter(h => !h.miss);
    const good = hs.filter(h => h.q >= 0.25 || h.coh === "EP" || h.coh === "VP").sort((a, b) => b.n - a.n).slice(0, 8);
    const bad = hs.filter(h => h.q <= -0.25 || ["U", "VU", "R"].includes(h.coh)).sort((a, b) => b.n - a.n).slice(0, 8);
    return { good, bad };
  }
  async function loadTrades(force) {
    if (tradesBusy || !STARS.length) return;
    if (!force && Date.now() - tradesT < 120000) { renderTrades(); return; }
    tradesBusy = true; tradesT = Date.now();
    const ws = new Set();
    STARS.forEach(c => { const W = walletsFor(c); if (W) [...W.good, ...W.bad].forEach(h => ws.add(h.a)); });
    const start = Date.now() - 14 * 864e5;
    for (const a of ws) {
      if (FILLS[a] && Date.now() - FILLS[a].t < 110000) continue;
      try { const f = await post({ type: "userFillsByTime", user: a, startTime: start, aggregateByTime: true }); FILLS[a] = { t: Date.now(), f: Array.isArray(f) ? f : [] }; } catch (e) { }
      await new Promise(r => setTimeout(r, 350));   // stay well under Hyperliquid's weight limit
    }
    tradesBusy = false; renderTrades(true);
  }
  function tradesOf(coin, hs) {
    const want = hlName(coin).toLowerCase(), out = [];
    hs.forEach(h => {
      const F = FILLS[h.a]; if (!F) return;
      const by = {};
      F.f.filter(x => String(x.coin).toLowerCase() === want).forEach(x => { const k = x.oid + "|" + x.dir; const g = by[k] = by[k] || { a: h.a, h, dir: x.dir, side: x.side, t: 0, sz: 0, ntl: 0, pnl: 0 };
        g.t = Math.max(g.t, x.time); g.sz += +x.sz; g.ntl += +x.sz * +x.px; g.pnl += +x.closedPnl || 0; });
      Object.values(by).forEach(g => { g.px = g.ntl / g.sz; out.push(g); });
    });
    // "major" = the 20 largest trades in 14 days; show the 5 newest of them
    return out.sort((a, b) => b.ntl - a.ntl).slice(0, 20).sort((a, b) => b.t - a.t).slice(0, 5);
  }
  function renderTrades(fresh) {
    const box = document.getElementById("stBt"); if (!box) return;
    const note = document.getElementById("stBtNote");
    note.innerHTML = `Best = Extremely/Very profitable cohort or a proven winner on this coin. Worst = Unprofitable/Very unprofitable/Rekt or a proven loser on this coin. From the top 30 holders of each market (top 30 setups only), largest 8 per group. "Major" = the 20 largest orders in 14 days; the table shows the 5 newest. Updates every 2 minutes on this sheet${tradesT ? ` · last ${ago(tradesT)} ago` : ""}${tradesBusy ? " · loading…" : ""}. Yellow = new since you last looked.`;
    const newOnes = [];
    box.innerHTML = STARS.map(c => {
      const W = walletsFor(c), sym = parse(c).sym;
      if (!W) return `<div class="bt"><h4>${esc(sym)}</h4><div class="note">No holder data for this market. Holder analysis runs for the top 30 setups.</div></div>`;
      const tbl = (hs, cls) => { const T = tradesOf(c, hs); if (!hs.length) return `<div class="note">No ${cls} traders among the top holders.</div>`;
        if (!T.length) return `<div class="note">${hs.some(h => FILLS[h.a]) ? "No trades on this coin in 14 days." : "Loading…"}</div>`;
        return `<table>${T.map(g => { const id = g.a + g.t + g.dir; const nw = !SEEN.has(id); if (nw) newOnes.push({ c, g, cls });
          const open = /Open/.test(g.dir), lng = /Long/.test(g.dir) || (g.dir === "Buy");
          return `<tr class="${nw ? "new" : ""}"><td>${new Date(g.t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
          <td><a href="https://hyperdash.com/address/${esc(g.a)}" target="_blank" rel="noopener">${esc(g.h.lb || g.a.slice(0, 6) + "…" + g.a.slice(-4))}</a> <span style="color:var(--faint)">${COHN[g.h.coh] || ""}</span></td>
          <td class="${lng ? "L" : "S"}">${esc(g.dir)}</td><td class="r">${usd(g.ntl)}</td><td class="r">@ ${price(g.px)}</td>
          <td class="r ${g.pnl >= 0 ? "L" : "S"}">${open || !g.pnl ? "" : "PnL " + usd(g.pnl)}</td></tr>`; }).join("")}</table>`; };
      const r = (ROWS || []).find(x => x.coin === c);
      return `<div class="bt"><h4><button class="cstar on" data-star="${esc(c)}">★</button><a href="#" data-goto="${esc(c)}">${esc(sym)}</a>${r ? `<span class="${r.dir > 0 ? "L" : "S"}" style="font:600 11px var(--mono)">SMART ${r.dir > 0 ? "LONG" : "SHORT"} · rating ${r.rating}</span>` : ""}</h4>
        <h5 class="L">Best traders · last 5 major trades</h5>${tbl(W.good, "best")}<h5 class="S">Worst traders · last 5 major trades</h5>${tbl(W.bad, "worst")}</div>`;
    }).join("");
    if (fresh && newOnes.length) {
      const first = SEEN.size === 0;
      newOnes.forEach(x => SEEN.add(x.g.a + x.g.t + x.g.dir)); lsS("cs_bt_seen", [...SEEN].slice(-800));
      if (!first) newOnes.slice(0, 3).forEach(x => { try { toast(`<b class="${x.cls === "best" ? "L" : "S"}">★ ${esc(parse(x.c).sym)} · ${x.cls} trader</b><div>${esc(x.g.dir)} ${usd(x.g.ntl)} @ ${price(x.g.px)}</div>`, x.cls === "best" ? "tl" : "ts", () => tb.click()); } catch (e) { } });
    }
  }
  box_goto();
  function box_goto() { document.addEventListener("click", e => { const a = e.target.closest("#v-starred [data-goto]"); if (a) { e.preventDefault(); gotoCoin(a.dataset.goto); } }); }

  /* ---------- hook into the page's render loop ---------- */
  const r0 = render;
  window.render = render = function () { const x = r0.apply(this, arguments); try { decorate(); if (VIEW === "starred") renderStarred(); tabLabels(); } catch (e) { console.warn(e); } return x; };
  setInterval(() => { if (STARS.length) loadTrades(false); if (VIEW === "starred") loadMkts(); }, 30000);
  setInterval(() => { if (VIEW === "starred" && !document.hidden) { renderStarred(); const s = document.getElementById("xlSel"); if (s && SEL) s.textContent = SEL; } }, 10000);   // live prices on the sheet   // trades refresh every 2 min (in loadTrades), markets every minute
  tabLabels(); decorate();
})();
