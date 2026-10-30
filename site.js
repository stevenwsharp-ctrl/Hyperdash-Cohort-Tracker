/* Cohort Sniper · site tools shared with SOXX Sniper: light/dark mode, page width, heartbeat, terms and disclaimer. */
(function () {
  "use strict";
  const lsG = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, lsS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
  const css = `
:root[data-theme=light]{--bg:#f4f6f7;--panel:#ffffff;--panel2:#eef2f3;--line:#d9e0e1;--text:#0f1a1a;--dim:#55625f;--faint:#86928f;--bull:#0b9e72;--bull-bg:#d6f2e8;--bear:#d43648;--bear-bg:#fbe0e3;--neutral-bg:#e6ebeb;--warn:#b5760a;--accent:#1f6fd1}
:root[data-theme=light] .row:hover{background:#eef2f3}
.wrap{max-width:var(--pagew,1360px)!important;padding-left:clamp(12px,1.4vw,28px)!important;padding-right:clamp(12px,1.4vw,28px)!important}
.sitebar{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:6px;flex-wrap:wrap}
.sitebar select,.sitebar button{font:12px var(--mono);background:var(--panel);border:1px solid var(--line);color:var(--text);border-radius:8px;padding:4px 8px;cursor:pointer}
.hbx{display:inline-flex;align-items:center;gap:6px;font:11px var(--mono);color:var(--dim)}
.hbx i{width:12px;height:12px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--bull);animation:hbspin var(--spd,1.4s) linear infinite}
.hbx.slow i{border-top-color:var(--warn)}.hbx.stale i{border-top-color:var(--bear);animation-duration:5s}
@keyframes hbspin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.hbx i{animation:none}}
.ftr{margin:28px 0 8px;padding-top:12px;border-top:1px solid var(--line);font-size:12px;color:var(--faint);line-height:1.6}
#termsOv{position:fixed;inset:0;z-index:400;background:var(--bg);overflow:auto;padding:20px clamp(16px,4vw,60px)}
#termsOv .in{max-width:860px;margin:0 auto}#termsOv h3{font-size:14px;margin:16px 0 4px}#termsOv p{font-size:13px;line-height:1.6;margin:0}
`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const root = document.documentElement;
  const setTheme = t => { root.dataset.theme = t; lsS("cs_theme", t); const b = document.getElementById("thBtn"); if (b) b.textContent = t === "light" ? "☾ Dark" : "☀ Light"; };
  const setW = v => { lsS("site_width", v); root.style.setProperty("--pagew", v === "fit" ? "100%" : v === "classic" ? "1360px" : v + "px"); window.dispatchEvent(new Event("resize")); };
  setTheme(lsG("cs_theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  setW(lsG("site_width") || "fit");
  const hdr = document.querySelector("header");
  if (hdr) {
    const bar = document.createElement("div"); bar.className = "sitebar";
    bar.innerHTML = `<span class="hbx" id="hbx" title="Heartbeat: live prices from Hyperliquid"><i></i><span id="hbxT">--</span></span>
      <select id="cwSel" title="Page width"><option value="fit">Width: fit screen</option><option value="2560">Width: 2560</option><option value="1920">Width: 1920</option><option value="1600">Width: 1600</option><option value="classic">Width: classic</option></select>
      <button id="thBtn"></button>`;
    const stat = document.getElementById("stat"); (stat && stat.parentNode === hdr ? stat : hdr.lastElementChild).appendChild(bar);
    document.getElementById("cwSel").value = lsG("site_width") || "fit";
    document.getElementById("cwSel").onchange = e => setW(e.target.value);
    document.getElementById("thBtn").onclick = () => setTheme(root.dataset.theme === "light" ? "dark" : "light"); setTheme(root.dataset.theme);
  }
  setInterval(() => { const el = document.getElementById("hbx"); if (!el) return; let t = 0; try { t = typeof LIVE_T !== "undefined" ? LIVE_T : 0; } catch (e) { }
    const a = t ? (Date.now() - t) / 1000 : Infinity; el.classList.toggle("slow", a > 25 && a <= 60); el.classList.toggle("stale", a > 60);
    document.getElementById("hbxT").textContent = !t ? "starting" : a <= 25 ? `live ${Math.round(a)}s` : a <= 60 ? `slow ${Math.round(a)}s` : document.hidden ? "paused" : `stale ${Math.round(a / 60)}m`; }, 1000);

  // footer and terms
  const MAIL = "sniperdesk.tribunal635@passmail.net", wrap = document.querySelector(".wrap");
  if (wrap) { const f = document.createElement("div"); f.className = "ftr";
    f.innerHTML = `Contact: <a href="mailto:${MAIL}">${MAIL}</a> · <a href="#" id="tmLink">Terms of use, disclaimer and privacy</a> · Sister sites: <a href="../SOXX-Sniper/">SOXX Sniper</a> · <a href="../LETF-Sniper/">LETF Sniper</a><br>
      Not investment advice. Leveraged and perpetual products are high risk. Data from Hyperdash and Hyperliquid can be late, wrong or stop. Wallets are public on-chain data; labels are statistics, not judgments of any person. Not affiliated with Hyperliquid, Hyperdash or any company shown.`;
    wrap.appendChild(f);
    f.querySelector("#tmLink").onclick = e => { e.preventDefault(); openTerms(); }; }
  function openTerms() {
    const o = document.createElement("div"); o.id = "termsOv";
    o.innerHTML = `<div class="in"><button id="tmX" style="float:right">✕ Close</button><h2>Cohort Sniper · terms of use, disclaimer and privacy</h2><p class="sub">By using this site you agree to these terms.</p>
      <h3>Not investment advice</h3><p>This is a data and education tool. Nothing here is investment, financial, legal or tax advice, or a recommendation to buy or sell anything. The operator is not a registered adviser or broker and has no fiduciary duty to you.</p>
      <h3>High risk</h3><p>Perpetual futures, leveraged ETFs, options and crypto can lose more than you put in. Only trade money you can afford to lose.</p>
      <h3>Data can be wrong</h3><p>Cohort data comes from Hyperdash (unofficial API) and prices from Hyperliquid. They can be delayed, wrong or stop. Ratings, backtests and profiles are statistical estimates; past results do not predict future results.</p>
      <h3>Public information</h3><p>Wallet addresses and trades on Hyperliquid are public on-chain data. The site does not try to identify any person. "Smart", "fools", "best" and "worst" are statistical groups, not statements about anyone. To ask for a wallet to be removed, write to ${MAIL}.</p>
      <h3>No affiliation; no warranty; limit of liability</h3><p>Not affiliated with Hyperliquid, Hyperdash, any exchange or any fund. Provided "as is" without warranty. To the maximum extent allowed by law, the operator is not liable for any loss, including trading losses, from using the site.</p>
      <h3>Privacy</h3><p>No accounts and no tracking cookies. Your settings and drawings stay in your own browser. Contact: <a href="mailto:${MAIL}">${MAIL}</a>.</p></div>`;
    document.body.appendChild(o); o.querySelector("#tmX").onclick = () => o.remove();
  }
})();
