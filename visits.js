/* Visitor count (shared file: SOXX Sniper, Cohort Sniper, LETF Sniper; Mastermind uses the SOXX copy).
   <script src="visits.js?v=1" data-site="soxx"></script> at the end of <body>. Sites: soxx, cohort, letf, mm.
   The Worker (/hits, KV binding HITS) keeps one count per site. This browser adds itself at most once per site per ET day,
   so the total is visitor-days. If the Worker has no KV (status "off") or does not answer, nothing shows. */
(function () {
  "use strict";
  const me = document.currentScript, site = me && me.dataset.site;
  if (!site || !/^(soxx|cohort|letf|mm)$/.test(site) || window["VISITS_" + site]) return;
  window["VISITS_" + site] = 1;
  const W0 = "https://soxx-sniper-fred.sharpventures.workers.dev";
  const proxy = () => { try { return (localStorage.getItem("soxx_fred_proxy") || "").trim().replace(/\/+$/, "") || W0; } catch (e) { return W0; } };
  const day = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10), K = "visit_" + site;
  let fresh = true; try { fresh = localStorage.getItem(K) !== day; } catch (e) { }
  const fmt = n => Number(n).toLocaleString("en-US");
  function show(r) {
    if (!r || r.status !== "ok" || !isFinite(r.total) || r.total < 1) return;
    let el = document.getElementById("visits");
    if (!el) {
      el = document.createElement("div"); el.id = "visits";
      el.style.cssText = "font-size:11.5px;opacity:.75;margin-top:6px";
      const fs = document.querySelectorAll("footer"), host = fs[fs.length - 1];
      if (host) host.appendChild(el);
      else { el.style.cssText += ";text-align:center;padding:16px 0 28px;color:inherit"; document.body.appendChild(el); }
    }
    el.textContent = fmt(r.total) + (r.total === 1 ? " visit" : " visits") + (r.today ? " · " + fmt(r.today) + " today" : "");
    el.title = "Each browser counts once per day";
  }
  function go() {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const tm = ctl && setTimeout(() => ctl.abort(), 8000);
    fetch(proxy() + "/hits?s=" + site + (fresh ? "&new=1" : ""), { cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(r => r.ok ? r.json() : null)
      .then(r => { if (r && r.status === "ok" && fresh) { try { localStorage.setItem(K, day); } catch (e) { } } show(r); })
      .catch(() => { })
      .finally(() => { if (tm) clearTimeout(tm); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", go); else go();
})();
