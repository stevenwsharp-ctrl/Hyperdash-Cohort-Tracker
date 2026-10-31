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
  sec.innerHTML = `<div id="stMk"></div><div id="stSheet"></div><div id="stChart" style="margin-top:12px"></div><h3 style="margin:16px 0 0">Big trades on your starred markets · best vs worst traders</h3><div class="note" id="stBtNote" style="max-width:none"></div><div class="bt-grid" id="stBt"></div><h3 style="margin:18px 0 0">ETF lens · SOXX / SOXL / SOXS semis basket, smart vs fools on the holdings</h3><div id="stBk" class="card" style="padding:10px 12px;margin-top:8px"></div>
  <h3 style="margin:18px 0 0">Nightly rebalance · market makers · after-hours</h3><div id="stRb" class="card" style="padding:10px 12px;margin-top:8px"></div>
  <h3 style="margin:18px 0 0">Spot flow · the biggest spot traders on Hyperliquid, live (5m · 15m · 1h · 4h · 24h)</h3><div id="stSf" class="card" style="padding:10px 12px;margin-top:8px"></div>
  <h3 style="margin:18px 0 0">Spot · what the best and worst traders buy, sell and hold</h3><div class="note" id="spNote" style="max-width:none"></div><div id="spBody"></div>`;
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
    sec.hidden = false; render(); renderStarred(); loadMkts(); loadTrades(false); loadSpot();
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
  let SEL = null, CH = lsG("cs_star_chart", null);
  // one live chart (the same pro chart as on Setups) for the chosen starred market; chips switch it
  function renderChart() {
    const el = document.getElementById("stChart"); if (!el) return;
    const undock = () => { const mt0 = el.querySelector(".stmount"); if (mt0 && mt0.dataset.pro && window.pcUndock) { pcUndock(); mt0.dataset.pro = ""; } };   // keep the pro chart in the page (it must not be detached)
    if (!STARS.length) { undock(); el.innerHTML = ""; return; }
    if (!STARS.includes(CH)) CH = STARS[0];
    let chips = el.querySelector(".stchips");
    if (!chips) { el.innerHTML = `<div class="stchips" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-bottom:4px"></div><div class="stmount"></div>`; chips = el.querySelector(".stchips"); }
    chips.innerHTML = `<b style="font:600 12px var(--sans);margin-right:6px">Chart</b>` + STARS.map(c => `<button class="wbtn ${c === CH ? "on" : ""}" data-chart="${esc(c)}">${esc(parse(c).sym)}</button>`).join("");
    const mt = el.querySelector(".stmount"), r = (ROWS || []).find(x => x.coin === CH), p = parse(CH);
    // stocks and ETFs: SOXX Sniper's pro chart on the real symbol (pre-market and after-hours, key levels, news, replay);
    // crypto, indexes, commodities and FX: the Hyperliquid market chart
    const pro = window.pcDock && p.venue && /^[A-Z][A-Z.\-]{0,7}$/.test(p.sym) && (!r || ["Stock", "ETF"].includes(r.cls));
    if (pro) { if (mt.dataset.pro !== p.sym) { mt.innerHTML = `<div class="pcHome"></div>`; mt.dataset.pro = p.sym; } pcDock(mt.firstElementChild, p.sym); try { window.mcAttach && mcAttach(); } catch (e) { } return; }
    undock();
    if (!mt.firstElementChild || mt.firstElementChild.dataset.coin !== CH) mt.innerHTML = `<div class="mcMount" data-coin="${esc(CH)}"></div>`;
    try { window.mcAttach && mcAttach(); } catch (e) { }
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-chart]"); if (!b) return; CH = b.dataset.chart; lsS("cs_star_chart", CH); renderChart(); });
  function renderStarred() {
    if (VIEW !== "starred") return;
    try { if (typeof computeRanks === "function") computeRanks(filtered()); } catch (e) { }   // ranks in the Setups filter
    renderMk();
    const el = document.getElementById("stSheet");
    if (!STARS.length) { el.innerHTML = `<div class="empty">No starred markets yet. Click ☆ next to a market on the Setups sheet to add it here.</div>`; document.getElementById("stBt").innerHTML = ""; document.getElementById("stBtNote").textContent = ""; renderChart(); return; }
    const body = STARS.map((c, i) => `<tr data-go="${esc(c)}"><td class="rn">${i + 2}</td>${cells(c).map((v, j) => `<td class="${j <= 1 || j >= 15 ? "tl" : ""}" data-c="${L(j + 1)}${i + 2}">${v}</td>`).join("")}</tr>`).join("");
    el.innerHTML = `<div class="xlbar"><i>fx</i><span id="xlSel">${SEL ? esc(SEL) : "Click a row to chart it · double-click to open the market"}</span></div><div class="xlwrap"><table class="xl"><thead><tr class="let"><th class="rn"></th>${COLS.map((_, j) => `<th>${L(j + 1)}</th>`).join("")}</tr><tr class="nm"><th class="rn">1</th>${COLS.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
    tagTips(el);
    renderChart(); renderTrades(); renderLens();
    if (window.SpotFlow) { const sf = document.getElementById("stSf"); if (sf && !sf._sf) SpotFlow.mount(sf, { tag: a => { for (const X of Object.values(SPEC && SPEC.m || {})) { const h = (X.holders || []).find(h => h.a === a); if (h) return { name: (h.lb ? h.lb + " · " : "") + (isMM(h) ? "MM" : (COHN[h.coh] || "")), kind: ["EP", "VP"].includes(h.coh) ? "best" : ["U", "VU", "R"].includes(h.coh) ? "worst" : "" }; } return null; } }); }
  }
  document.addEventListener("click", e => {
    const td = e.target.closest(".xl tbody td"); if (!td || e.target.closest("[data-star]")) return;
    document.querySelectorAll(".xl td.cell-sel").forEach(x => x.classList.remove("cell-sel")); td.classList.add("cell-sel");
    SEL = `${td.dataset.c || ""}  ${td.textContent.trim()}`; const s = document.getElementById("xlSel"); if (s) s.textContent = SEL;
    const tr = td.closest("tr[data-go]"); if (tr && tr.dataset.go !== CH) { CH = tr.dataset.go; lsS("cs_star_chart", CH); renderChart(); }
  });
  document.addEventListener("dblclick", e => { const tr = e.target.closest(".xl tbody tr[data-go]"); if (tr) gotoCoin(tr.dataset.go); });

  /* ---------- ETF lens (basket.js, shared with SOXX Sniper) ---------- */
  function renderLens() {
    if (!window.Basket) return;
    const bk = document.getElementById("stBk"), rb = document.getElementById("stRb"); if (!bk || !rb) return;
    bk.innerHTML = Basket.html(DATA ? Basket.compute(DATA, { wD: S.wD, px: () => null }) : null);
    // rebalance estimate from the SOXL perp's 24h move (the funds use the move from the prior close; SOXX Sniper has the exact number)
    const x = ctxOf("XYZ:SOXL"); const r = x && x.ch != null ? Basket.rebalance(x.ch / 100 / 3) : null;
    rb.innerHTML = Basket.knowledge(r, Basket.lab()) + `<div class="note" style="max-width:none;margin-top:6px">${r ? "Estimate uses the SOXL perp's 24h change; SOXX Sniper uses the move from the prior close. " : ""}<a href="../SOXX-Sniper/">Open SOXX Sniper</a> for the full session study and live flow.</div>`;
  }

  /* ---------- big trades of the best and worst traders ---------- */
  const COHN = { EP: "Ext profitable", VP: "Very profitable", P: "Profitable", U: "Unprofitable", VU: "Very unprofitable", R: "Rekt" };
  const MAJOR = 5000;
  /* Market makers: their positions are mostly inventory and hedges. A market maker is short after customers bought
     from it, so its position shows the customers' flow more than its own view. They stay in the data (they are a big
     part of the market), but they count at MM_W (25%) in every weighted total and ranking, are tagged "MM", and their
     net inventory is shown on its own line with what it means. Two tests: a known market-making firm in the Hyperdash label, or the behavior of one
     (newest 2,000 fills inside 6 hours and 85%+ of the volume as maker orders). */
  const MM_RE = /wintermute|cumberland|\bjump\b|\bgsr\b|flow ?traders|amber|b2c2|\bdwf\b|keyrock|galaxy|auros|selini|\bhlp\b|hyperliquidity|jane ?street|citadel|virtu|optiver|\bimc\b|\bdrw\b|susquehanna|\bsig\b|\bxtx\b|tower research|\bqcp\b|presto|kronos|market ?mak|\bmm\b/i;
  const MMB = lsG("cs_mm", {});
  const isMM = h => !!h && (MM_RE.test(h.lb || "") || !!MMB[h.a]);
  const MM_W = 0.25, wOf = h => isMM(h) ? MM_W : 1;
  window.MM_W = MM_W;
  window.isMM = isMM;
  function mmCheck(a, f) { if (!Array.isArray(f) || f.length < 2000) return;
    const t0 = Math.min(...f.map(x => x.time)), t1 = Math.max(...f.map(x => x.time)); let mk = 0, all = 0;
    f.forEach(x => { const v = +x.sz * +x.px; all += v; if (x.crossed === false) mk += v; });
    const was = !!MMB[a], is = t1 - t0 < 6 * 36e5 && all > 0 && mk / all >= 0.85;
    if (is !== was) { if (is) MMB[a] = { t: Date.now(), mk: Math.round(mk / all * 100) }; else delete MMB[a]; lsS("cs_mm", MMB); } }
  const FILLS = {};          // wallet -> { t: fetched ms, f: fills }
  const SEEN = new Set(lsG("cs_bt_seen", []));
  let tradesBusy = false, tradesT = 0, HOLD = 0;   // HOLD = wait time after a Hyperliquid 429
  /* Skill weight (grade.js): trade grade (keeps gains, avoids round trips, holds through drawdowns that turn positive),
     grit (discipline: patient when it pays, quick when it pays, not impulsive unless it pays) and open P&L across all holdings.
     Holdings: every market where the wallet is a top-30 holder (SPEC). Grade and grit: the wallet's fills on this market
     (loaded for the starred markets) against hourly prices from history.json. */
  let HALL = null, hallT = 0; const GRC = {};
  function holdAll() { if (HALL && Date.now() - hallT < 5 * 6e4) return HALL; HALL = {};
    Object.values((SPEC && SPEC.m) || {}).forEach(X => (X.holders || []).forEach(h => { if (h.miss) return; const o = HALL[h.a] = HALL[h.a] || { u: 0, n: 0, ntl: 0 }; o.u += h.u || 0; o.n++; o.ntl += h.n || 0; }));
    hallT = Date.now(); return HALL; }
  function barsOf(coin) { const S = (HIST && HIST.snapshots) || [], B = []; let cur = null;
    S.forEach(x => { const v = x.d && x.d[coin]; if (!v || !(v[2] > 0)) return; const t = Date.parse(x.t), k = Math.floor(t / 36e5) * 36e5;
      if (!cur || cur[0] !== k) { cur = [k, v[2], v[2], v[2]]; B.push(cur); } else { cur[1] = Math.max(cur[1], v[2]); cur[2] = Math.min(cur[2], v[2]); cur[3] = v[2]; } }); return B; }
  function skill(h, coin) {
    if (!window.Grade) return null; const k = h.a + "|" + coin, F = FILLS[h.a], c = GRC[k], ha = holdAll()[h.a];
    if (c && Date.now() - c.t < 10 * 6e4 && (!F || c.ft === F.t)) return c;
    const want = hlName(coin).toLowerCase(), M = [];
    if (F) F.f.filter(x => String(x.coin).toLowerCase() === want).sort((x, y) => x.time - y.time).forEach(x => { const d = x.dir || ""; if (!/Long|Short/.test(d)) return;
      M.push({ t: x.time, entry: /Open|>/.test(d), side: /Long > Short/.test(d) ? -1 : /Short > Long/.test(d) ? 1 : /Long/.test(d) ? 1 : -1, px: +x.px, usd: +x.sz * +x.px }); });
    const B = barsOf(coin), T = Grade.trips(M, B), px = (ctxOf(coin) || {}).px;
    const R = Grade.grade(T, { bars: B, px, upnl: ha ? ha.u : null, acct: ha ? ha.ntl : 0 }); R.grit = Grade.grit(M, B, T); R.hold = ha;
    R.mult = 1 + 0.5 * (0.55 * R.Q + 0.45 * (R.grit.n >= 5 ? R.grit.G : 0)); R.t = Date.now(); R.ft = F ? F.t : 0;
    return GRC[k] = R;
  }
  const skW = (h, coin) => { const r = skill(h, coin); return r ? r.mult : 1; };
  window.csSkill = skill;
  function walletsFor(coin) {
    const X = SPEC && SPEC.m && SPEC.m[coin]; if (!X || !X.holders) return null;
    const hs = X.holders.filter(h => !h.miss);
    const GOODC = ["EP", "VP"], BADC = ["U", "VU", "R"];
    // cohort decides first; the coin record only adds traders whose cohort does not say the opposite
    // ranked by weighted size: a market maker's $ counts at 25%
    // best: size × skill weight (strong habits first); worst: size ÷ skill weight (the weakest habits first)
    const good = hs.filter(h => GOODC.includes(h.coh) || (h.q >= 0.25 && !BADC.includes(h.coh))).sort((a, b) => b.n * wOf(b) * skW(b, coin) - a.n * wOf(a) * skW(a, coin)).slice(0, 8);
    const bad = hs.filter(h => BADC.includes(h.coh) || (h.q <= -0.25 && !GOODC.includes(h.coh))).sort((a, b) => b.n * wOf(b) / skW(b, coin) - a.n * wOf(a) / skW(a, coin)).slice(0, 8);
    return { good, bad, mm: hs.filter(isMM).sort((a, b) => b.n - a.n) };
  }
  async function loadTrades(force) {
    if (tradesBusy) return;
    if (!force && Date.now() - tradesT < 120000) { renderTrades(); return; }
    tradesBusy = true; tradesT = Date.now();
    const ws = new Set(), starWallets = new Set();
    STARS.forEach(c => { const W = walletsFor(c); if (W) [...W.good, ...W.bad].forEach(h => { ws.add(h.a); starWallets.add(h.a); }); });
    const G = globalWallets(); [...G.good, ...G.bad].forEach(t => ws.add(t.a));   // also the overall best and worst traders, for the spot flow
    const start = Date.now() - 14 * 864e5;
    // Hyperliquid weight: userFills costs 20 plus 1 per 20 fills returned, so a full 2,000-fill read costs about 120.
    // First read per wallet = the newest 2,000 fills; after that only the fills since the last one (cheap).
    let pause = 0;
    for (const a of ws) {
      const F = FILLS[a];
      if (F && Date.now() - F.t < (starWallets.has(a) ? 110000 : 600000)) continue;
      if (Date.now() < HOLD) break;
      try {
        if (!F) { const f = await post({ type: "userFills", user: a, aggregateByTime: true }); mmCheck(a, f); FILLS[a] = { t: Date.now(), n: Array.isArray(f) ? f.length : 0, oldest: Array.isArray(f) && f.length ? Math.min(...f.map(x => x.time)) : null, f: Array.isArray(f) ? f.filter(x => x.time >= start) : [] }; pause = 12000; }   // a full read costs ~120 weight: at most ~5 per minute
        else { const last = F.f.reduce((m, x) => Math.max(m, x.time), start); const f = await post({ type: "userFillsByTime", user: a, startTime: last + 1, aggregateByTime: true });
          const nf = Array.isArray(f) ? f : []; F.f = F.f.concat(nf).filter(x => x.time >= start); F.t = Date.now(); pause = 1500; }
      } catch (e) { if (/429/.test(e.message)) { HOLD = Date.now() + 60000; break; } }
      await new Promise(r => setTimeout(r, pause));
    }
    tradesBusy = false; renderTrades(true);
    loadSpot();
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
    // "major" = $5K or more and among the 20 largest orders in 14 days; show the 5 newest of them
    return out.filter(g => g.ntl >= MAJOR).sort((a, b) => b.ntl - a.ntl).slice(0, 20).sort((a, b) => b.t - a.t).slice(0, 5);
  }
  /* Position watch: many top holders are high-frequency traders. Hyperliquid serves only their newest fills
     (2,000 per read, at most 10,000), which can cover only the last hour. So we also read each holder's position
     on the market (clearinghouseState, cheap) about every minute and log every change of $5K or more as a trade.
     The last positions are kept in this browser, so changes made while the page was closed show on the next visit. */
  const POS = lsG("cs_pos", {});          // "wallet|dex" -> { t, m: { coin: [szi, entry, uPnL] } }
  let PEV = lsG("cs_pos_ev", []), posBusy = false;
  async function pollPositions() {
    if (posBusy || !STARS.length || Date.now() < HOLD || document.hidden) return; posBusy = true;
    const jobs = new Map();
    STARS.forEach(c => { const W = walletsFor(c); if (W) [...W.good, ...W.bad].forEach(h => jobs.set(h.a + "|" + dexOf(c), { a: h.a, dex: dexOf(c) })); });
    const list = [...jobs.entries()].sort((x, y) => ((POS[x[0]] || {}).t || 0) - ((POS[y[0]] || {}).t || 0)).slice(0, 10);
    for (const [k, j] of list) {
      if (Date.now() < HOLD) break;
      try {
        const st = await post({ type: "clearinghouseState", user: j.a, dex: j.dex }), m = {};
        (st && st.assetPositions || []).forEach(x => { const p = x.position || {}; m[String(p.coin).toLowerCase()] = [+p.szi || 0, +p.entryPx || 0, +p.unrealizedPnl || 0]; });
        const prev = POS[k]; POS[k] = { t: Date.now(), m };
        if (prev) posDiff(j, prev, POS[k]);
      } catch (e) { if (/429/.test(e.message)) { HOLD = Date.now() + 60000; break; } }
      await new Promise(r => setTimeout(r, 300));
    }
    lsS("cs_pos", POS); posBusy = false; if (VIEW === "starred") renderTrades(true);
  }
  function posDiff(j, A, B) {
    STARS.forEach(c => { if (dexOf(c) !== j.dex) return; const W = walletsFor(c); if (!W) return;
      const h = W.good.find(x => x.a === j.a) || W.bad.find(x => x.a === j.a); if (!h) return; const g = W.good.includes(h) ? "best" : "worst";
      const key = hlName(c).toLowerCase(), s0 = (A.m[key] || [0])[0], s1 = (B.m[key] || [0])[0]; if (s0 === s1) return;
      const cx = ctxOf(c), px = cx && cx.px || (B.m[key] || A.m[key] || [0, 0])[1], d = Math.abs(s1 - s0) * px; if (!(d >= MAJOR)) return;
      const side = x => x > 0 ? "Long" : "Short";
      const dir = s0 === 0 ? "Open " + side(s1) : s1 === 0 ? "Close " + side(s0) : Math.sign(s0) !== Math.sign(s1) ? side(s0) + " > " + side(s1) : Math.abs(s1) > Math.abs(s0) ? "Add " + side(s1) : "Cut " + side(s1);
      PEV.unshift({ t: B.t, t0: A.t, c, a: j.a, g, dir, ntl: d, px, now: Math.abs(s1) * px, src: "pos" }); });
    PEV = PEV.slice(0, 300); lsS("cs_pos_ev", PEV);
  }
  // fill coverage: when a wallet's read hit the 2,000-fill cap, the fills reach back only to the oldest one
  const coverage = hs => { const v = hs.map(h => FILLS[h.a]).filter(Boolean); if (!v.length) return null; const capped = v.filter(F => F.n >= 2000);
    return { n: v.length, capped: capped.length, from: capped.length ? Math.max(...capped.map(F => F.oldest || 0)) : null }; };
  const holdLine = (c, hs) => { const key = hlName(c).toLowerCase(), rows = hs.map(h => { const P = POS[h.a + "|" + dexOf(c)], x = P && P.m[key]; return { h, x }; })
      .filter(o => o.x ? o.x[0] : o.h.n).sort((p, q) => (q.x ? Math.abs(q.x[0] * q.x[1]) : q.h.n) * wOf(q.h) - (p.x ? Math.abs(p.x[0] * p.x[1]) : p.h.n) * wOf(p.h)).slice(0, 3);
    // group net on this market, with market makers at 25%
    let net = 0, netMM = 0; hs.forEach(h => { const P = POS[h.a + "|" + dexOf(c)], x = P && P.m[key], px = (ctxOf(c) || {}).px || (x && x[1]) || 0, v = x ? x[0] * px : h.sd * h.n; net += v * wOf(h); if (isMM(h)) netMM += v; });
    const netTxt = `<b class="${net >= 0 ? "L" : "S"}">group net ${net >= 0 ? "long" : "short"} ${usd(Math.abs(net))}</b>${netMM ? ` <span style="color:var(--faint)">(MMs at 25%)</span>` : ""} · `;
    return rows.length ? `<div style="font:11px var(--mono);color:var(--dim);margin:2px 0 4px">${netTxt}Holds now: ${rows.map(({ h, x }) => { const sz = x ? x[0] : h.sd * h.n, v = x ? Math.abs(x[0]) * (ctxOf(c) || {}).px || Math.abs(x[0] * x[1]) : h.n;
      const sk = skill(h, c);
      return `<span class="${sz > 0 ? "L" : "S"}">${esc(h.lb || h.a.slice(0, 6) + "…")}${isMM(h) ? ` <span class="flag f-thin" title="Market maker: counts at 25%">MM</span>` : ""}${sk && sk.parts.length ? " " + Grade.badge(sk) : ""}${sk && sk.grit && sk.grit.n >= 5 ? " " + Grade.gritBadge(sk.grit) : ""}${sk && sk.hold && sk.hold.n > 1 ? ` <span title="Open P&L across the ${sk.hold.n} markets where this wallet is a top holder" class="${sk.hold.u >= 0 ? "L" : "S"}">all ${sk.hold.u >= 0 ? "+" : "-"}${usd(Math.abs(sk.hold.u))}</span>` : ""} ${usd(v)} ${sz > 0 ? "long" : "short"}${x && x[1] ? " @ " + price(x[1]) : ""}</span>${x && x[2] ? ` <span class="${x[2] >= 0 ? "L" : "S"}">(${x[2] >= 0 ? "+" : ""}${usd(x[2])})</span>` : ""}`; }).join(" · ")}</div>` : ""; };

  /* Market-maker record: every 10 minutes, log each coin's market-maker net inventory and price; 4 hours later check
     whether price moved against the inventory (MMs short → price up). The hit rate tunes the rating factor in index.html. */
  let MMLOG = lsG("cs_mm_log", []);
  function mmRecord() {
    if (typeof mmInventory !== "function" || !SPEC || !SPEC.m) return;
    const now = Date.now(), H = 4 * 36e5;
    MMLOG.forEach(e => { if (e.r == null && now - e.t >= H && now - e.t < H + 36e5) { const c = ctxOf(e.c); if (c && c.px && e.px) e.r = c.px / e.px - 1; } else if (e.r == null && now - e.t >= H + 36e5) e.r = NaN; });
    const last = MMLOG.length ? MMLOG[MMLOG.length - 1].t : 0;
    if (now - last >= 10 * 6e4) Object.keys(SPEC.m).forEach(c => { const M = mmInventory(c), x = ctxOf(c); if (M && Math.abs(M.net) >= 100000 && M.share >= 0.05 && x && x.px) MMLOG.push({ t: now, c, net: Math.round(M.net), sh: Math.round(M.share * 100) / 100, px: x.px }); });
    MMLOG = MMLOG.filter(e => now - e.t < 14 * 864e5).slice(-4000); lsS("cs_mm_log", MMLOG);
    // one check per coin per 4 hours, so overlapping logs do not count many times
    const seen = {}, done = MMLOG.filter(e => isFinite(e.r) && Math.abs(e.r) > 0.0005).filter(e => { const k = e.c + "|" + Math.floor(e.t / H); if (seen[k]) return false; seen[k] = 1; return true; });
    const hit = done.filter(e => Math.sign(e.r) === -Math.sign(e.net)).length;
    window.MMREC = { n: done.length, hit: done.length ? hit / done.length : 0, avg: done.length ? done.reduce((a, e) => a + -Math.sign(e.net) * e.r, 0) / done.length : 0, open: MMLOG.filter(e => e.r == null).length };
  }
  mmRecord(); setInterval(mmRecord, 60000);

  /* Why: the belief behind each big trade of the best / worst holders on a starred market, and whether it worked
     (why.js, shared with SOXX Sniper). Prices: the market's own Hyperliquid candles, 15 minutes, 20 days. */
  const WCC = {}, WHYOPEN = new Set(lsG("cs_whyopen", [])); let wccBusy = false;
  document.addEventListener("toggle", e => { const d = e.target; if (!d.dataset || !d.dataset.why) return; d.open ? WHYOPEN.add(d.dataset.why) : WHYOPEN.delete(d.dataset.why); lsS("cs_whyopen", [...WHYOPEN]); }, true);
  async function loadWhyCandles() {
    if (wccBusy || !STARS.length || Date.now() < HOLD) return; wccBusy = true;
    for (const c of STARS) { const o = WCC[c]; if (o && Date.now() - o.t < 10 * 6e4) continue;
      try { const r = await post({ type: "candleSnapshot", req: { coin: hlName(c), interval: "15m", startTime: Date.now() - 20 * 864e5, endTime: Date.now() } });
        if (Array.isArray(r)) WCC[c] = { t: Date.now(), C: r.map(x => ({ t: x.t, o: +x.o, h: +x.h, l: +x.l, c: +x.c })) }; } catch (e) { if (/429/.test(e.message)) { HOLD = Date.now() + 60000; break; } }
      await new Promise(r => setTimeout(r, 800)); }
    wccBusy = false;
  }
  setTimeout(loadWhyCandles, 6000); setInterval(loadWhyCandles, 5 * 6e4);
  function whyHtml(c, W) {
    if (!window.Why || !WCC[c] || !W) return "";
    const want = hlName(c).toLowerCase(), M = [], grpOf = a => W.good.some(h => h.a === a) ? "best" : W.bad.some(h => h.a === a) ? "worst" : null, nm = h => h.lb || h.a.slice(0, 6) + "…";
    [...W.good, ...W.bad].forEach(h => { const F = FILLS[h.a]; if (!F) return; const by = {};
      F.f.filter(x => String(x.coin).toLowerCase() === want).forEach(x => { const d = x.dir || "", k = x.oid + "|" + d, g = by[k] = by[k] || { t: x.time, a: h.a, g: grpOf(h.a), who: nm(h) + (isMM(h) ? " (MM)" : ""), entry: /Open|>/.test(d), dir: /> Long|Open Long|Close Short/.test(d) ? (/Open|>/.test(d) ? 1 : -1) : (/Open|>/.test(d) ? -1 : 1), sz: 0, usd: 0 };
        g.sz += +x.sz; g.usd += +x.sz * +x.px; g.t = Math.min(g.t, x.time); });
      Object.values(by).forEach(g => { g.px = g.usd / g.sz; M.push(g); }); });
    PEV.filter(e => e.c === c).forEach(e => { const h = [...W.good, ...W.bad].find(x => x.a === e.a); if (!h) return; const d = e.dir;
      M.push({ t: e.t, a: e.a, g: e.g, who: nm(h) + (isMM(h) ? " (MM)" : ""), entry: /^Open|^Add|>/.test(d), dir: /Long$/.test(d) && !/^Close|^Cut/.test(d) ? 1 : /Short$/.test(d) && !/^Close|^Cut/.test(d) ? -1 : /Long$/.test(d) ? 1 : -1, px: e.px, usd: e.ntl }); });
    const rows = Why.analyze(M.filter(m => m.usd >= MAJOR && m.px > 0), WCC[c].C, {});
    return `<details data-why="${esc(c)}" ${WHYOPEN.has(c) ? "open" : ""} style="margin-top:6px"><summary style="cursor:pointer;font:600 11px var(--mono);color:var(--dim);text-transform:uppercase">Why they trade ${esc(parse(c).sym)} · beliefs that win and lose (${rows.length} trades)</summary>${Why.html(rows, WCC[c].C, { sym: parse(c).sym, recent: 6 })}</details>`;
  }

  // Market-maker inventory: shown apart, with what it means
  function mmLine(c, mm) {
    if (!mm || !mm.length) return "";
    const key = hlName(c).toLowerCase(), px = (ctxOf(c) || {}).px || 0;
    const L = mm.map(h => { const P = POS[h.a + "|" + dexOf(c)], x = P && P.m[key]; return { h, v: x ? x[0] * (px || x[1]) : h.sd * h.n }; }).filter(o => o.v);
    if (!L.length) return "";
    const net = L.reduce((a, o) => a + o.v, 0), r = (ROWS || []).find(x => x.coin === c);
    const read = net < 0 ? "Market makers are net SHORT: customers have been net buyers and the market makers sold to them. That is buying flow, not a bearish bet. If they cover (buy back) fast, that adds to upward pressure."
      : "Market makers are net LONG: customers have been net sellers and the market makers bought from them. That is selling flow, not a bullish bet. If they unload, that adds to downward pressure.";
    const vs = r ? ` The smart cohorts are ${r.dir > 0 ? "long" : "short"}: ${(net < 0) === (r.dir > 0) ? "customer flow goes with the smart side." : "customer flow goes against the smart side, so the smart side is fading the crowd."}` : "";
    const R = window.MMREC, rec = R && R.n ? ` Our record so far: price moved against market-maker inventory within 4 hours in ${Math.round(R.hit * 100)}% of ${R.n} checks (average ${(R.avg * 100).toFixed(2)}% in that direction)${R.n < 40 ? "; the rating uses a small weight until there are 40 checks" : ""}.` : " The page logs this every 10 minutes and checks the price 4 hours later, to learn how much it predicts.";
    const f = r && (r.factors || []).find(x => x.name === "Market-maker inventory");
    return `<h5>Market makers · inventory (counted at 25%)</h5><div style="font:11px var(--mono);margin:2px 0">${L.map(o => `<span class="${o.v > 0 ? "L" : "S"}">${esc(o.h.lb || o.h.a.slice(0, 6) + "…")} ${usd(Math.abs(o.v))} ${o.v > 0 ? "long" : "short"}</span>`).join(" · ")} → <b class="${net >= 0 ? "L" : "S"}">net ${net >= 0 ? "long" : "short"} ${usd(Math.abs(net))}</b></div><div class="note" style="max-width:none">${read}${vs}${f ? ` Rating effect: ${f.mult >= 1 ? "+" : "−"}${Math.abs(Math.round((f.mult - 1) * 1000) / 10)}%.` : ""}${rec}</div>`;
  }
  function renderTrades(fresh) {
    const box = document.getElementById("stBt"); if (!box) return;
    const note = document.getElementById("stBtNote");
    note.innerHTML = `Market makers (MM: known firms such as Wintermute and Cumberland, or wallets that trade like one: 85%+ maker volume, thousands of fills a day) stay in, but count at 25% in group totals and rankings, because their positions are mostly inventory from customer flow, not bets. Best = Extremely/Very profitable cohort, or a proven winner on this coin who is not in a losing cohort. Worst = Unprofitable/Very unprofitable/Rekt cohort, or a proven loser on this coin who is not in a winning cohort. From the top 30 holders of each market (top 30 setups only), largest 8 per group. "Major" = $5K or more. Trades come from two sources: their fills (exact price) and their position, read about every minute (a change of $5K+ between two reads counts as a trade; "position Δ"). Updates every 2 minutes on this sheet${tradesT ? ` · last ${ago(tradesT)} ago` : ""}${tradesBusy ? " · loading…" : ""}. Yellow = new since you last looked.`;
    const newOnes = [];
    box.innerHTML = STARS.map(c => {
      const W = walletsFor(c), sym = parse(c).sym;
      if (!W) return `<div class="bt"><h4>${esc(sym)}</h4><div class="note">No holder data for this market. Holder analysis runs for the top 30 setups.</div></div>`;
      const tbl = (hs, cls) => { if (!hs.length) return `<div class="note">No ${cls} traders among the top holders.</div>`;
        const set = new Set(hs.map(h => h.a)), hb = Object.fromEntries(hs.map(h => [h.a, h]));
        const F = tradesOf(c, hs).map(g => ({ ...g, src: "fill" }));
        const Pv = PEV.filter(e => e.c === c && set.has(e.a) && !F.some(f => f.a === e.a && Math.abs(f.t - e.t) < Math.max(5 * 6e4, e.t - e.t0))).map(e => ({ ...e, h: hb[e.a], pnl: 0 }));
        const T = F.concat(Pv).sort((x, y) => y.t - x.t).slice(0, 5);
        const cv = coverage(hs), watched = hs.filter(h => POS[h.a + "|" + dexOf(c)]).length;
        const cvTxt = cv && cv.capped ? ` ${cv.capped} of ${cv.n} are high-frequency traders: Hyperliquid serves only their newest fills, which reach back to ${new Date(cv.from).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` : "";
        if (!T.length) return holdLine(c, hs) + `<div class="note">${watched || hs.some(h => FILLS[h.a]) ? `No major trade ($5K+) seen yet.${cvTxt} Positions of all ${hs.length} are watched about every minute (${watched} read so far); every change of $5K+ shows here.` : "Loading…"}</div>`;
        return holdLine(c, hs) + `<table>${T.map(g => { const id = g.a + g.t + g.dir; const nw = !SEEN.has(id); if (nw) newOnes.push({ c, g, cls });
          const open = /Open|Add/.test(g.dir), lng = /(Open|Add|Close|Cut) Long|> Long/.test(g.dir) ? !/Close|Cut/.test(g.dir) : /Short/.test(g.dir) ? /Close|Cut/.test(g.dir) : g.dir === "Buy";
          return `<tr class="${nw ? "new" : ""}"><td>${new Date(g.t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
          <td><a href="https://hyperdash.com/address/${esc(g.a)}" target="_blank" rel="noopener">${esc(g.h.lb || g.a.slice(0, 6) + "…" + g.a.slice(-4))}</a> <span style="color:var(--faint)">${COHN[g.h.coh] || ""}</span></td>
          <td class="${lng ? "L" : "S"}">${esc(g.dir)}</td><td class="r">${usd(g.ntl)}</td><td class="r">@ ${price(g.px)}</td>
          <td class="r ${g.pnl >= 0 ? "L" : "S"}">${g.src === "pos" ? `<span style="color:var(--faint)" title="From a change of the position between two reads (${new Date(g.t0).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} – ${new Date(g.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}); price = market price at the read">position Δ · now ${usd(g.now)}</span>` : open || !g.pnl ? "" : "PnL " + usd(g.pnl)}</td></tr>`; }).join("")}</table>${cvTxt && T.length < 5 ? `<div class="note" style="margin-top:2px">${cvTxt.trim()}</div>` : ""}`; };
      const r = (ROWS || []).find(x => x.coin === c);
      return `<div class="bt"><h4><button class="cstar on" data-star="${esc(c)}">★</button><a href="#" data-goto="${esc(c)}">${esc(sym)}</a>${r ? `<span class="${r.dir > 0 ? "L" : "S"}" style="font:600 11px var(--mono)">SMART ${r.dir > 0 ? "LONG" : "SHORT"} · rating ${r.rating}</span>` : ""}</h4>${window.Web ? `<div style="margin:-2px 0 4px">${Web.forecastHtml(sym) || ""}</div>` : ""}
        <h5 class="L">Best traders · last 5 major trades</h5>${tbl(W.good, "best")}<h5 class="S">Worst traders · last 5 major trades</h5>${tbl(W.bad, "worst")}${mmLine(c, W.mm)}${ordHtml(c)}${whyHtml(c, W)}</div>`;
    }).join("");
    if (fresh && newOnes.length) {
      const first = SEEN.size === 0;
      newOnes.forEach(x => SEEN.add(x.g.a + x.g.t + x.g.dir)); lsS("cs_bt_seen", [...SEEN].slice(-800));
      if (!first) newOnes.slice(0, 3).forEach(x => { try { toast(`<b class="${x.cls === "best" ? "L" : "S"}">★ ${esc(parse(x.c).sym)} · ${x.cls} trader</b><div>${esc(x.g.dir)} ${usd(x.g.ntl)} @ ${price(x.g.px)}</div>`, x.cls === "best" ? "tl" : "ts", () => tb.click()); } catch (e) { } });
    }
  }
  box_goto();
  function box_goto() { document.addEventListener("click", e => { const a = e.target.closest("#v-starred [data-goto]"); if (a) { e.preventDefault(); gotoCoin(a.dataset.goto); } }); }

  /* ---------- spot: buys, sells and holdings of the best vs worst traders ---------- */
  const GOODC = ["EP", "VP"], BADC = ["U", "VU", "R"];
  // The overall best and worst traders across the top holders of the top 30 setups (same sets as the Traders tab), 20 of each by size.
  function globalWallets() {
    const T = {};
    for (const X of Object.values(SPEC && SPEC.m || {})) (X.holders || []).forEach(h => { if (h.miss) return;
      const t = T[h.a] = T[h.a] || { a: h.a, lb: h.lb, coh: h.coh, q: 0, n: 0 }; t.q += h.q || 0; t.n += (h.n || 0) * wOf(h); });
    const all = Object.values(T);
    const good = all.filter(t => GOODC.includes(t.coh) || (t.q >= 0.25 && !BADC.includes(t.coh))).sort((a, b) => b.n - a.n).slice(0, 12);
    const bad = all.filter(t => BADC.includes(t.coh) || (t.q <= -0.25 && !GOODC.includes(t.coh))).sort((a, b) => b.n - a.n).slice(0, 12);
    return { good, bad };
  }
  let SPM = null, spmT = 0;              // spot pairs: "@107" -> { base, px, ch, vol }
  const BAL = {};                        // wallet -> { t, b: balances }
  let spotBusy = false, spotT = 0;
  async function loadSpotMeta() {
    if (SPM && Date.now() - spmT < 60000) return;
    try {
      const [meta, ctxs] = await post({ type: "spotMetaAndAssetCtxs" });
      const tok = {}; meta.tokens.forEach(t => tok[t.index] = t.name);
      const m = {};
      const byCoin = {}; ctxs.forEach(c => { if (c && c.coin) byCoin[c.coin] = c; });   // match by pair name; the two arrays are not in the same order
      meta.universe.forEach(u => { const c = byCoin[u.name] || {}; const base = tok[u.tokens[0]], quote = tok[u.tokens[1]];
        const px = +c.markPx || +c.midPx || 0, prev = +c.prevDayPx || 0;
        m[u.name] = { base, quote, px, ch: prev ? (px / prev - 1) * 100 : null, vol: +c.dayNtlVlm || 0 }; });
      SPM = m; spmT = Date.now();
    } catch (e) { }
  }
  const baseOf = coin => { const p = SPM && SPM[coin]; return p ? p.base : String(coin).includes("/") ? String(coin).split("/")[0] : null; };
  const pxOf = tok => { if (!SPM) return null; if (/^USD[CTH]?$/.test(tok)) return 1; let best = null; for (const p of Object.values(SPM)) if (p.base === tok && /^USD/.test(p.quote || "") && (!best || p.vol > best.vol)) best = p; return best; };
  async function loadSpot() {
    if (spotBusy || Date.now() - spotT < 240000) { renderSpot(); return; }
    spotBusy = true; spotT = Date.now(); await loadSpotMeta();
    const G = globalWallets();
    for (const t of [...G.good, ...G.bad]) {
      if (BAL[t.a] && Date.now() - BAL[t.a].t < 230000) continue;
      if (Date.now() < HOLD) break;
      try { const j = await post({ type: "spotClearinghouseState", user: t.a }); BAL[t.a] = { t: Date.now(), b: j && j.balances || [] }; } catch (e) { if (/429/.test(e.message)) { HOLD = Date.now() + 60000; break; } }
      await new Promise(r => setTimeout(r, 300));
    }
    spotBusy = false; renderSpot();
  }
  function renderSpot() {
    const body = document.getElementById("spBody"); if (!body) return;
    const G = globalWallets(), grp = {}; G.good.forEach(t => grp[t.a] = "g"); G.bad.forEach(t => grp[t.a] = "b");
    // starred-coin holders count too
    STARS.forEach(c => { const W = walletsFor(c); if (W) { W.good.forEach(h => grp[h.a] = grp[h.a] || "g"); W.bad.forEach(h => grp[h.a] = grp[h.a] || "b"); } });
    const now = Date.now(), T = {};
    const row = tok => T[tok] = T[tok] || { tok, g24: 0, g7: 0, b24: 0, b7: 0, gB: new Set(), gS: new Set(), bB: new Set(), bS: new Set(), gH: 0, bH: 0, gHn: 0, bHn: 0, last: [] };
    let nW = 0;
    for (const [a, F] of Object.entries(FILLS)) { const g = grp[a]; if (!g) continue; nW++;
      F.f.forEach(x => { if (!(String(x.coin).startsWith("@") || String(x.coin).includes("/"))) return;   // spot fills only
        const tok = baseOf(x.coin); if (!tok) return; const r = row(tok), v = +x.sz * +x.px * (x.side === "B" ? 1 : -1), age = now - x.time;
        if (age <= 7 * 864e5) { r[g + "7"] += v; (v > 0 ? r[g + "B"] : r[g + "S"]).add(a); }
        if (age <= 864e5) r[g + "24"] += v;
        if (Math.abs(v) >= 2000) r.last.push({ a, g, v, t: x.time, px: +x.px }); }); }
    for (const [a, B] of Object.entries(BAL)) { const g = grp[a]; if (!g) continue;
      B.b.forEach(b => { if (/^USD/.test(b.coin)) return; const p = pxOf(b.coin), px = p == null ? null : typeof p === "number" ? p : p.px; if (!px) return;
        const v = +b.total * px; if (v < 100) return; const r = row(b.coin); r[g + "H"] += v; r[g + "Hn"]++; }); }
    const list = Object.values(T).filter(r => Math.abs(r.g7) + Math.abs(r.b7) + r.gH + r.bH >= 1000)
      .sort((a, b) => (Math.abs(b.g7) + Math.abs(b.b7) + (b.gH + b.bH) / 4) - (Math.abs(a.g7) + Math.abs(a.b7) + (a.gH + a.bH) / 4)).slice(0, 25);
    const sig = r => { const gs = Math.sign(Math.round(r.g7 / 1000)), bs = Math.sign(Math.round(r.b7 / 1000));
      if (gs > 0 && bs < 0) return ["L", "Smart accumulate · fools sell"]; if (gs < 0 && bs > 0) return ["S", "Smart distribute · fools buy"];
      if (gs > 0 && bs > 0) return ["", "Both buying"]; if (gs < 0 && bs < 0) return ["", "Both selling"];
      if (gs > 0) return ["L", "Smart buying"]; if (gs < 0) return ["S", "Smart selling"]; if (bs > 0) return ["S", "Fools buying"]; if (bs < 0) return ["L", "Fools selling"]; return ["N", "Holding"]; };
    const $v = v => v ? `<span class="${v > 0 ? "L" : "S"}">${v > 0 ? "+" : ""}${usd(v)}</span>` : `<span class="N">0</span>`;
    const perp = tok => { const c = [tok, tok.replace(/^U(?=[A-Z]{3,})/, ""), "K" + tok].find(x => ctxOf(x)); return c ? `<a href="#" data-goto="${esc(c)}">${esc(c)} perp</a>` : ""; };
    const sm = ROWS ? Object.fromEntries((ROWS || []).map(r => [r.coin, r])) : {};
    const cells = list.map(r => { const p = pxOf(r.tok), px = p && typeof p === "object" ? p : null, s = sig(r);
      const pc = [r.tok, r.tok.replace(/^U(?=[A-Z]{3,})/, "")].find(x => sm[x]); const pr = pc ? sm[pc] : null;
      return `<tr><td class="tl"><b>${esc(r.tok)}</b> ${perp(r.tok)}</td><td>${px ? price(px.px) : "–"}</td><td>${px && px.ch != null ? `<span class="${px.ch >= 0 ? "L" : "S"}">${px.ch >= 0 ? "+" : ""}${px.ch.toFixed(2)}%</span>` : "–"}</td><td>${px ? usd(px.vol) : "–"}</td>
        <td>${$v(r.g24)}</td><td>${$v(r.g7)} <span style="color:var(--faint)">${r.gB.size}↑ ${r.gS.size}↓</span></td><td>${$v(r.b24)}</td><td>${$v(r.b7)} <span style="color:var(--faint)">${r.bB.size}↑ ${r.bS.size}↓</span></td>
        <td>${r.gH ? usd(r.gH) + ` <span style="color:var(--faint)">${r.gHn}</span>` : "–"}</td><td>${r.bH ? usd(r.bH) + ` <span style="color:var(--faint)">${r.bHn}</span>` : "–"}</td>
        <td class="tl ${s[0]}">${s[1]}</td><td class="tl">${pr ? `<span class="${pr.dir > 0 ? "L" : "S"}">perp smart ${pr.dir > 0 ? "long" : "short"} ${pr.rating}</span>` : "–"}</td></tr>`; }).join("");
    // general spot market movement: biggest pairs by 24h volume
    const top = SPM ? Object.values(SPM).filter(p => /^USD/.test(p.quote || "") && p.vol > 0).sort((a, b) => b.vol - a.vol).slice(0, 12) : [];
    const totV = SPM ? Object.values(SPM).reduce((a, p) => a + (/^USD/.test(p.quote || "") ? p.vol : 0), 0) : 0;
    const up = top.filter(p => p.ch > 0).length;
    const nb = Object.values(T).reduce((a, r) => a + r.g7, 0), nf = Object.values(T).reduce((a, r) => a + r.b7, 0);
    const act = { g: new Set(), b: new Set() }, cash = { g: 0, b: 0 }, nRead = { g: 0, b: 0 };
    Object.values(T).forEach(r => ["g", "b"].forEach(q => { r[q + "B"].forEach(a => act[q].add(a)); r[q + "S"].forEach(a => act[q].add(a)); }));
    for (const [a, Bl] of Object.entries(BAL)) { const q = grp[a]; if (q) Bl.b.forEach(b => { if (/^USD/.test(b.coin)) cash[q] += +b.total || 0; }); }
    for (const a of Object.keys(FILLS)) if (grp[a]) nRead[grp[a]]++;
    const gc = (lab, n, q) => `<div class="mk"><span class="src">7d</span>${lab}${act[q].size ? `<b class="${n >= 0 ? "L" : "S"}">${n >= 0 ? "+" : ""}${usd(n)}</b>${n >= 0 ? "buying" : "selling"} · ${act[q].size} of ${nRead[q]} trade spot` : `<b>no spot trades</b>${nRead[q]} read: perps only`}${cash[q] >= 1000 ? ` · ${usd(cash[q])} cash` : ""}</div>`;
    document.getElementById("spNote").innerHTML = `From the spot fills (last 7 days, newest 2,000 fills per wallet) and spot balances of the ${G.good.length} best and ${G.bad.length} worst traders among the top holders of the top 30 setups, plus the holders of your starred markets (${nW} wallets with fills loaded). Net = buys minus sells in $. ↑/↓ = number of traders who bought / sold. Hold = spot value held now (number of traders). Most Hyperliquid spot is crypto (U-tokens such as UBTC, UETH, USOL are bridged BTC, ETH, SOL); stocks trade only as perps here, so for a stock the useful spot signal is the general risk appetite below. Balances refresh every 4 minutes${spotT ? ` · last ${ago(spotT)} ago` : ""}${spotBusy ? " · loading…" : ""}.`;
    body.innerHTML = `<div class="mkts" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
      ${gc("Best traders, net spot", nb, "g")}${gc("Worst traders, net spot", nf, "b")}
      <div class="mk"><span class="src">24h</span>Spot volume (USD pairs)<b>${usd(totV)}</b>${up}/${top.length} top pairs up</div>
      ${top.slice(0, 5).map(p => `<div class="mk"><span class="src">spot</span>${esc(p.base)}<b>${price(p.px)}</b><span class="${p.ch >= 0 ? "L" : "S"}">${p.ch != null ? (p.ch >= 0 ? "+" : "") + p.ch.toFixed(2) + "%" : "–"}</span> · ${usd(p.vol)}</div>`).join("")}</div>
      ${list.length ? `<div class="xlwrap"><table class="xl"><thead><tr class="nm"><th>Token</th><th>Price</th><th>24h</th><th>Spot vol 24h</th><th>Best net 24h</th><th>Best net 7d</th><th>Worst net 24h</th><th>Worst net 7d</th><th>Best hold</th><th>Worst hold</th><th>Signal</th><th>Perp setup</th></tr></thead><tbody>${cells}</tbody></table></div>`
        : `<div class="empty">${spotBusy || tradesBusy ? "Loading spot fills and balances…" : "No spot trades or holdings of $1K+ by these traders yet."}</div>`}`;
    tagTips(body);
  }
  Object.assign(TIPS, { "Token": "Hyperliquid spot token. U-tokens are bridged coins (UBTC = BTC). Link = the perp market for the same coin.",
    "Spot vol 24h": "24h spot volume of the token's main USD pair.", "Best net 24h": "Spot buys minus sells of the best traders in 24h.",
    "Best net 7d": "Spot buys minus sells of the best traders in 7 days; ↑ traders who bought, ↓ traders who sold.", "Worst net 24h": "Spot buys minus sells of the worst traders in 24h.",
    "Worst net 7d": "Spot buys minus sells of the worst traders in 7 days.", "Best hold": "Spot value the best traders hold now (number of traders).", "Worst hold": "Spot value the worst traders hold now.",
    "Signal": "Smart accumulate · fools sell = the strongest bullish spot pattern; the reverse is the strongest bearish one.", "Perp setup": "The cohort setup on the same coin's perp, if any." });

  /* ---------- open orders of the best and worst holders: catch price moves, size changes, cancel/replace ---------- */
  const ORDS = {};                                  // "wallet|dex" -> { at, list }
  let OEV = lsG("cs_ord_ev", []), ordBusy = false;
  const dexOf = c => c.includes(":") ? c.split(":")[0].toLowerCase() : "";
  async function pollOrders() {
    if (ordBusy || !STARS.length || Date.now() < HOLD || document.hidden) return; ordBusy = true;
    const jobs = [];
    STARS.forEach(c => { const W = walletsFor(c); if (!W) return; [...W.good.map(h => [h, "best"]), ...W.bad.map(h => [h, "worst"])].forEach(([h, g]) => jobs.push({ c, h, g, k: h.a + "|" + dexOf(c) })); });
    const uniq = [...new Map(jobs.map(j => [j.k, j])).values()].sort((a, b) => ((ORDS[a.k] || {}).at || 0) - ((ORDS[b.k] || {}).at || 0)).slice(0, 6);
    for (const j of uniq) {
      if (Date.now() < HOLD) break;
      try { const o = await post({ type: "frontendOpenOrders", user: j.h.a, dex: dexOf(j.c) });
        const list = (o || []).map(x => ({ oid: x.oid, coin: String(x.coin), side: x.side === "B" ? 1 : -1, px: +(x.isTrigger ? x.triggerPx : x.limitPx) || +x.limitPx, sz: +x.sz, osz: +x.origSz || +x.sz, ro: !!x.reduceOnly || !!x.isPositionTpsl, trig: !!x.isTrigger, type: x.orderType || "" }));
        const prev = ORDS[j.k]; ORDS[j.k] = { at: Date.now(), list };
        if (prev) STARS.forEach(c => { if (dexOf(c) !== dexOf(j.c)) return; const want = hlName(c).toLowerCase(), W = walletsFor(c); if (!W) return;
          const g = W.good.some(h => h.a === j.h.a) ? "best" : W.bad.some(h => h.a === j.h.a) ? "worst" : null; if (!g) return;
          ordDiff(c, j.h, g, prev.list.filter(x => x.coin.toLowerCase() === want), list.filter(x => x.coin.toLowerCase() === want)); });
      } catch (e) { if (/429/.test(e.message)) { HOLD = Date.now() + 60000; break; } }
      await new Promise(r => setTimeout(r, 1200));
    }
    ordBusy = false;
  }
  function ordDiff(c, h, g, A, Bn) {
    const cx = ctxOf(c), P = cx && cx.px, min = 5000, out = [];
    const nm = o => `${o.side > 0 ? "buy" : "sell"} ${o.trig ? (o.type || "trigger").toLowerCase() : "limit"}${o.ro ? " (reduce-only)" : ""}`, val = o => o.sz * (o.px || P || 0);
    const byA = new Map(A.map(o => [o.oid, o])), byB = new Map(Bn.map(o => [o.oid, o]));
    for (const [id, o1] of byB) { const o0 = byA.get(id); if (!o0) continue; const dp = o0.px && o1.px ? o1.px / o0.px - 1 : 0;
      if (Math.abs(dp) >= 0.0005 && Math.max(val(o0), val(o1)) >= min) out.push({ k: "move", txt: `moved a ${usd(val(o1))} ${nm(o1)} ${price(o0.px)} → ${price(o1.px)} (${dp > 0 ? "+" : ""}${(dp * 100).toFixed(2)}%)` });
      else if (o1.osz !== o0.osz && Math.max(val(o0), val(o1)) >= min) out.push({ k: "size", txt: `${o1.osz > o0.osz ? "raised" : "cut"} a ${nm(o1)} @ ${price(o1.px)}: ${usd(val(o0))} → ${usd(val(o1))}` }); }
    const gone = A.filter(o => !byB.has(o.oid)), born = Bn.filter(o => !byA.has(o.oid)), used = new Set();
    gone.forEach(o0 => { const j = born.findIndex((o1, i) => !used.has(i) && o1.side === o0.side && o1.trig === o0.trig && o1.ro === o0.ro);
      if (j >= 0) { used.add(j); const o1 = born[j]; if (Math.max(val(o0), val(o1)) < min) return; const dp = o0.px && o1.px ? o1.px / o0.px - 1 : 0;
        out.push({ k: "replace", txt: `replaced a ${nm(o0)}: ${usd(val(o0))} @ ${price(o0.px)} → ${usd(val(o1))} @ ${price(o1.px)}${Math.abs(dp) >= 0.0005 ? ` (${dp > 0 ? "+" : ""}${(dp * 100).toFixed(2)}%)` : ""}` }); }
      else if (val(o0) >= min * 2) out.push({ k: "pull", txt: `pulled a ${usd(val(o0))} ${nm(o0)} @ ${price(o0.px)} (cancelled or filled)` }); });
    born.forEach((o1, i) => { if (!used.has(i) && val(o1) >= min * 2) out.push({ k: "place", txt: `placed a ${usd(val(o1))} ${nm(o1)} @ ${price(o1.px)}${P ? ` (${((o1.px / P - 1) * 100).toFixed(2)}% from price)` : ""}` }); });
    out.slice(0, 4).forEach(e => { OEV.unshift({ t: Date.now(), c, a: h.a, lb: h.lb || "", coh: h.coh, g, k: e.k, txt: e.txt });
      if (e.k !== "pull") try { toast(`<b class="${g === "best" ? "L" : "S"}">📝 ★ ${esc(parse(c).sym)} · ${g} trader</b><div>${esc(e.txt)}</div>`, g === "best" ? "tl" : "ts", () => tb.click()); } catch (x) { } });
    if (out.length) { OEV = OEV.slice(0, 200); lsS("cs_ord_ev", OEV); if (VIEW === "starred") renderTrades(); }
  }
  const ordHtml = c => { const L = OEV.filter(e => e.c === c).slice(0, 6), open = Object.entries(ORDS).filter(([k]) => k.endsWith("|" + dexOf(c))).reduce((a, [, v]) => a + v.list.filter(x => x.coin.toLowerCase() === hlName(c).toLowerCase()).length, 0);
    return `<h5>Order changes · best & worst <span style="text-transform:none;font-weight:400;color:var(--faint)">${open} open orders watched</span></h5>${L.length ? `<table>${L.map(e => `<tr><td>${new Date(e.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td><td><a href="https://hyperdash.com/address/${esc(e.a)}" target="_blank" rel="noopener">${esc(e.lb || e.a.slice(0, 6) + "…" + e.a.slice(-4))}</a> <b class="${e.g === "best" ? "L" : "S"}">${e.g}</b></td><td style="white-space:normal">${esc(e.txt)}</td></tr>`).join("")}</table>` : `<div class="note">No order changes yet. Orders are checked about every 2–3 minutes; a price move, size change or cancel-and-replace shows here and as a toast.</div>`}`; };

  /* ---------- Signal web (web.js): feed it every cohort signal, show the web, use what it learned ---------- */
  const clip = v => Math.max(-1, Math.min(1, v));
  let webT = 0;
  function feedWeb() {
    if (!window.Web || !ROWS || !ROWS.length || Date.now() - webT < 60000) return; webT = Date.now();
    if (!feedWeb.p) { feedWeb.p = 1; Web.addPrice(a => { for (const v of ["", "XYZ:", "PARA:", "IO:", "CASH:", "FLX:", "KM:"]) { const c = ctxOf(v + a); if (c && c.px > 0) return c.px; } return null; }); }
    ROWS.slice().sort((a, b) => b.rating - a.rating).slice(0, 80).forEach(r => {
      const a = r.sym || parse(r.coin).sym;
      Web.emit("cohort.gap", a, clip(r.dir * r.rating / 100), "Cohort · smart side × rating");
      Web.emit("cohort.gapraw", a, clip(r.sm.b - r.fo.b), "Cohort · gap (smart − fools bias)");
      Web.emit("cohort.smart", a, clip(r.sm.b), "Cohort · smart bias");
      Web.emit("cohort.fools", a, clip(r.fo.b), "Cohort · fools bias");
      const t4 = r.tr && r.tr["4h"]; if (t4) Web.emit("cohort.trend4h", a, clip(t4[0] / 20), "Cohort · gap change 4h");
      const t1 = r.tr && r.tr["1h"]; if (t1) Web.emit("cohort.trend1h", a, clip(t1[0] / 10), "Cohort · gap change 1h");
      if (r.spx && r.spx.agg && r.spx.agg.conf >= 0.3) Web.emit("cohort.spec", a, clip(r.spx.agg.sig * r.spx.agg.conf), "Cohort · coin specialists");
      const M = typeof mmInventory === "function" ? mmInventory(r.coin) : null; if (M && M.share >= 0.03) Web.emit("cohort.mm", a, clip(-Math.sign(M.net) * M.share / 0.25), "Cohort · market makers (contra inventory)");
      if (r.lv && r.lv.fuelPct) Web.emit("cohort.liqfuel", a, clip(r.lv.dir * r.lv.fuelPct / 30), "Cohort · liquidation fuel");
      if (r.earn != null) Web.emit("cohort.funding", a, clip(r.dir * r.earn / 50), "Cohort · funding (smart side earns +)");
      if (r.ctx && r.ctx.ch != null) Web.emit("cohort.mom24", a, clip(r.ctx.ch / 8), "Cohort · 24h momentum");
      if (r.big && r.big.n) Web.emit("cohort.big", a, clip(r.big.b), "Cohort · apex + whale size cohorts");
      if (t4 && t4[4] != null) Web.emit("cohort.smartflow4h", a, clip(r.dir * t4[4] / 500), "Cohort · smart $ added / cut in 4h");
      if (r.evs && r.evs.length) { const ty = r.evs.map(e => e.type); Web.emit("cohort.expert-exit", a, ty.includes("flip") ? -r.dir : ty.includes("exit") ? -r.dir * 0.7 : ty.includes("fade") ? -r.dir * 0.4 : 0, "Cohort · experts exiting / flipping"); }
      if (r.ht) Web.emit("cohort.heat", a, clip(((r.ht.bb || 0) - (r.ht.fr || 0)) / 100), "Cohort · froth (−) vs bloodbath (+)");
      try { const T = typeof takerFlow === "function" ? takerFlow(r) : null; if (T && isFinite(T.i4)) Web.emit("cohort.taker4h", a, clip(T.i4 * 3), "Cohort · taker flow 4h (vs normal volume)"); } catch (e) { }
      if (r.lv && r.lv.riskPct) Web.emit("cohort.smartnearliq", a, clip(-r.lv.dir * r.lv.riskPct / 30), "Cohort · smart side near liquidation");
      const nb = (r.news || []).filter(n => n.b && n.s && Date.now() - n.t < 24 * 36e5); if (nb.length) Web.emit("cohort.news", a, clip(nb.reduce((s, n) => s + Math.sign(n.s), 0) / 3), "Cohort · big news tone 24h");
    });
    try { const B = window.Basket && DATA ? Basket.compute(DATA, { wD: S.wD }) : null; if (B && B.basket.gap != null) { Web.emit("basket.gap", "SEMIS", clip(B.basket.gap * 2), "Semis basket: smart vs fools gap"); if (B.basket.d4h != null) Web.emit("basket.trend4h", "SEMIS", clip(B.basket.d4h / 20), "Semis basket: gap change 4h"); } } catch (e) { }
  }
  /* Past data into the web: the 7 days of 5-minute cohort snapshots (history.json). For every market and every 30 minutes,
     rebuild the signals the live page sends (gap, smart bias, fools bias, gap change 1h / 4h, 24h momentum) and score
     them with the price 4 hours later. Web.ingest skips what it already learned, so this only adds new history. */
  let histFedT = 0;
  function feedHistory() {
    if (!window.Web || !HIST || !HIST.snapshots || HIST.snapshots.length < 60 || Date.now() - histFedT < 25 * 6e4) return; histFedT = Date.now();
    const S0 = HIST.snapshots, T = S0.map(s => Date.parse(s.t)), at = (t, tol) => { let lo = 0, hi = T.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] < t) lo = m + 1; else hi = m; }
      let b = lo; if (lo > 0 && Math.abs(T[lo - 1] - t) < Math.abs(T[lo] - t)) b = lo - 1; return Math.abs(T[b] - t) <= tol ? b : -1; };
    const items = [], g = v => (v[0] - v[1]) / 200, B = 30 * 6e4, H4 = 4 * 36e5, AV = {};
    // each coin's average 4-hour move, for the volatility regime
    for (let t = T[0] + H4; t <= T[T.length - 1]; t += 4 * H4) { const i = at(t, 6e5), j = at(t - H4, 9e5); if (i < 0 || j < 0) continue;
      for (const [coin, v] of Object.entries(S0[i].d || {})) { const w = S0[j].d && S0[j].d[coin]; if (v && w && v[2] > 0 && w[2] > 0) { const o = AV[coin] = AV[coin] || [0, 0]; o[0] += Math.abs(v[2] / w[2] - 1); o[1]++; } } }
    for (let t = Math.ceil(T[0] / B) * B; t <= T[T.length - 1] - H4; t += B) {
      const i = at(t, 6e5), j = at(t + H4, 9e5), j1 = at(t + 36e5, 6e5), j24 = at(t + 24 * 36e5, 18e5), i1 = at(t - 36e5, 9e5), i4 = at(t - H4, 9e5), i24 = at(t - 24 * 36e5, 18e5); if (i < 0 || j < 0) continue;
      for (const [coin, v] of Object.entries(S0[i].d || {})) {
        const w = S0[j].d && S0[j].d[coin]; if (!v || !w || !(v[2] > 0) || !(w[2] > 0)) continue;
        const x = { "cohort.gapraw": (v[0] - v[1]) / 100, "cohort.smart": v[0] / 100, "cohort.fools": v[1] / 100 };
        const v1 = i1 >= 0 && S0[i1].d && S0[i1].d[coin], v4 = i4 >= 0 && S0[i4].d && S0[i4].d[coin], v24 = i24 >= 0 && S0[i24].d && S0[i24].d[coin];
        if (v1) x["cohort.trend1h"] = (g(v) - g(v1)) * 100 / 10; if (v4) x["cohort.trend4h"] = (g(v) - g(v4)) * 100 / 20; if (v24 && v24[2] > 0) x["cohort.mom24"] = (v[2] / v24[2] - 1) * 100 / 8;
        Object.keys(x).forEach(k => { if (!isFinite(x[k]) || !x[k]) delete x[k]; });
        if (v4 && v.length > 4 && v4.length > 4) { const fl = ((v[3] + v[4]) - (v4[3] + v4[4])) / 500; if (isFinite(fl) && fl) x["cohort.smartflow4h"] = fl; }
        const av = AV[coin] && AV[coin][1] ? AV[coin][0] / AV[coin][1] : 0, reg = v4 && v4[2] > 0 && av > 0 ? Math.max(-1, Math.min(1, Math.abs(v[2] / v4[2] - 1) / av - 1)) : 0;
        const fx = k => { const q = k >= 0 && S0[k].d && S0[k].d[coin]; return q && q[2] > 0 ? q[2] / v[2] - 1 : null; };
        items.push({ t, a: parse(coin).sym, x, reg, rh: { 1: fx(j1), 4: w[2] / v[2] - 1, 24: fx(j24) } });
      }
    }
    const n = Web.ingest("cohort-history", items, "cohort 7-day history");
    if (n && VIEW === "web") renderWeb();
  }
  setTimeout(feedHistory, 20000); setInterval(feedHistory, 30 * 6e4);
  // the Web tab
  const wtb = document.createElement("button"); wtb.className = "tab"; wtb.dataset.tab = "web"; wtb.textContent = "🕸 Web";
  tb.after(wtb);
  const wsec = document.createElement("section"); wsec.id = "v-web"; wsec.hidden = true;
  wsec.innerHTML = `<div class="info" style="margin-top:12px">The signal web connects every signal on this site and on SOXX Sniper (same browser). Every 30 minutes it takes a snapshot of each market's live signals and price; 4 hours later it scores the snapshot and learns: a weight for each signal (online logistic regression), each signal's own record, and how pairs of signals do when they agree. It keeps growing while either site is open. Its forecast feeds the rating once it has 100 scored snapshots ("Signal web" factor, up to ±8%).</div><div id="webBody" style="margin-top:10px"></div><h3>Forecasts now (markets in your Setups list)</h3><div id="webFc"></div>`;
  sec.after(wsec);
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => { wsec.hidden = b.dataset.tab !== "web"; }));
  wtb.onclick = () => { VIEW = "web"; document.querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === wtb)); document.querySelectorAll("section[id^='v-']").forEach(s => s.hidden = s.id !== "v-web"); render(); renderWeb(); };
  function renderWeb() {
    if (VIEW !== "web" || !window.Web) return;
    Web.render(document.getElementById("webBody"), { h: 460 });
    const rows = (typeof filtered === "function" ? filtered() : ROWS).slice(0, 25);
    document.getElementById("webFc").innerHTML = `<div class="card" style="padding:6px 10px;overflow-x:auto"><table class="tr"><thead><tr><th style="text-align:left">Market</th><th>Setup</th><th>Rating</th><th style="text-align:left">Signal web</th></tr></thead><tbody>${rows.map(r => `<tr><td style="text-align:left"><a href="#" data-goto="${esc(r.coin)}">${esc(r.sym)}</a></td><td class="${r.dir > 0 ? "L" : "S"}">SMART ${r.dir > 0 ? "LONG" : "SHORT"}</td><td>${r.rating}</td><td style="text-align:left">${Web.forecastHtml(r.sym) || "–"}</td></tr>`).join("")}</tbody></table></div>`;
  }
  document.addEventListener("click", e => { const a = e.target.closest("#v-web [data-goto]"); if (a) { e.preventDefault(); gotoCoin(a.dataset.goto); } });

  /* ---------- the rating learns from its own results ----------
     Every 30 minutes: save the top 80 setups (side, price, rating, every factor). After 4h and 24h, grade them: did price
     move the smart side's way? A factor that raised confidence in a setup that then worked, or cut it in one that failed,
     gains trust; the opposite loses trust (×0.2 … ×2.5). index.html applies the trust to each factor's effect.
     The same record gives the hit rate by rating band, so a high rating has to earn its meaning. */
  window.FTRUST = lsG("cs_factor_trust", {});
  let RLOG = lsG("cs_rating_log", []);
  function rateLearn() {
    if (!ROWS || !ROWS.length) return; const now = Date.now(), FT = window.FTRUST;
    if (!RLOG.length || now - RLOG[RLOG.length - 1].t > 30 * 6e4) {
      RLOG.push({ t: now, L: ROWS.filter(r => r.ctx && r.ctx.px).sort((a, b) => b.rating - a.rating).slice(0, 80).map(r => [r.coin, r.dir, r.ctx.px, r.rating, (r.factors || []).filter(f => !/backtested/.test(f.name)).map(f => [f.name, Math.round((f.raw || f.mult) * 1000) / 1000])]) }); }
    let changed = false;
    for (const e of RLOG) for (const [k, h, lr] of [["g4", 4, 0.04], ["g24", 24, 0.08]]) {
      if (e[k] || now - e.t < h * 36e5) continue;
      if (now - e.t > (h + 3) * 36e5) { e[k] = 1; continue; }
      e[k] = 1; changed = true; e["o" + h] = [];
      e.L.forEach(([coin, dir, px, rating, F]) => { const c = ctxOf(coin); if (!c || !c.px) return; const ret = dir * (c.px / px - 1); if (Math.abs(ret) < 0.002) return; const o = Math.sign(ret);
        e["o" + h].push([rating, o]);
        F.forEach(([nm, m]) => { const lean = Math.sign(m - 1); if (!lean) return; const t = FT[nm] = FT[nm] || { t: 1, n: 0, ok: 0 };
          t.t = Math.max(0.2, Math.min(2.5, t.t * Math.exp(lr * lean * o * Math.min(1, Math.abs(m - 1) * 8)))); if (h === 24) { t.n++; if (lean === o) t.ok++; } }); }); }
    RLOG = RLOG.filter(e => now - e.t < 21 * 864e5);
    if (changed) lsS("cs_factor_trust", FT);
    lsS("cs_rating_log", RLOG);
  }
  window.ratingRecord = () => { const B = [[60, 101, "60+"], [40, 60, "40–59"], [20, 40, "20–39"], [0, 20, "under 20"]], out = {};
    for (const h of [4, 24]) out[h] = B.map(([lo, hi, lab]) => { const v = RLOG.flatMap(e => e["o" + h] || []).filter(([r]) => r >= lo && r < hi); return { lab, n: v.length, hit: v.length ? v.filter(([, o]) => o > 0).length / v.length : null }; });
    return out; };
  setInterval(() => { try { rateLearn(); } catch (e) { } }, 60000); setTimeout(() => { try { rateLearn(); } catch (e) { } }, 20000);
  // spot flow for the rating (live Hyperliquid spot takers)
  // for crowd.js (coordination study): fills of the best and worst holders of each starred market, one item per order
  window.csTrades = () => { const out = [];
    STARS.forEach(c => { const W = walletsFor(c); if (!W) return; const want = hlName(c).toLowerCase();
      [["best", W.good], ["worst", W.bad]].forEach(([g, hs]) => hs.forEach(h => { const F = FILLS[h.a]; if (!F) return; const by = {};
        F.f.forEach(x => { if (String(x.coin).toLowerCase() !== want) return; const k = x.oid + "|" + x.dir, o = by[k] = by[k] || { t: 0, usd: 0, dir: x.dir || "" }; o.t = Math.max(o.t, x.time); o.usd += +x.sz * +x.px; });
        Object.values(by).forEach(o => { const entry = /Open|>/.test(o.dir), side = /Long > Short/.test(o.dir) ? -1 : /Short > Long/.test(o.dir) ? 1 : /Long/.test(o.dir) ? 1 : -1;
          if (/Long|Short/.test(o.dir)) out.push({ t: o.t, a: h.a, g, d: entry ? side : -side, usd: o.usd, c, mm: isMM(h) }); }); })); });
    return out; };
  const sfLoad = async () => { try { if (window.SpotFlow) window.SFJ = await SpotFlow.load(); } catch (e) { } };
  sfLoad(); setInterval(sfLoad, 2 * 6e4);

  /* ---------- hook into the page's render loop ---------- */
  const r0 = render;
  window.render = render = function () { const x = r0.apply(this, arguments); try { decorate(); if (VIEW === "starred") renderStarred(); tabLabels(); feedWeb(); } catch (e) { console.warn(e); } return x; };
  setInterval(() => { try { feedWeb(); if (VIEW === "web") renderWeb(); } catch (e) { } }, 60000);
  setInterval(pollOrders, 60000); setTimeout(pollOrders, 15000);
  setInterval(pollPositions, 30000); setTimeout(pollPositions, 3000);
  setInterval(() => { if (STARS.length || VIEW === "starred") loadTrades(false); if (VIEW === "starred") loadMkts(); }, 30000);
  setInterval(() => { if (VIEW === "starred" && !document.hidden) { renderStarred(); const s = document.getElementById("xlSel"); if (s && SEL) s.textContent = SEL; } }, 10000);   // live prices on the sheet   // trades refresh every 2 min (in loadTrades), markets every minute
  tabLabels(); decorate();
})();
