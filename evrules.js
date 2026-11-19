/* EV rules · the same file on SOXX Sniper, Cohort Sniper, LETF Sniper and Mastermind Investor.
   Reads the EV governor's scorecard (ev.json on Cohort Sniper's "ev" branch, written after each US close) and gives
   every page the factor for each scored part: 0 = mute (proven negative expected value), 0.5 = cut (negative, or decaying),
   1.25 = back (proven positive), 1 = watch. EVR.factor("cohort", "outlook.mom.24h") → 0.5, for example.
   Council, Nov 19 2026 (LETF agent request): EVR.factor(tr, id, { off: true }) gives 0 while the scorecard is not loaded
   (default OFF for a part that was muted before: a flag, a push or a vote). Without the option: 1, as before. */
(function () {
  "use strict";
  if (window.EVR) return;
  const URL0 = "https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/ev/ev.json", K = "ev_rules_v1";
  const E = window.EVR = { data: null, ready: false, factor(tr, id, o) { if (o && o.off && !E.ready) return 0; const x = E.item(tr, id); return x ? x.factor : 1; }, item(tr, id) { const T = E.data && E.data.trackers && E.data.trackers[tr]; return T && T.items ? T.items.find(i => i.id === id) || null : null; }, on: [] };
  try { const c = JSON.parse(localStorage.getItem(K) || "null"); if (c && Date.now() - c.at < 2 * 864e5) { E.data = c.d; E.ready = true; } } catch (e) { }
  async function load() { try { const r = await fetch(URL0 + "?t=" + Math.floor(Date.now() / 36e5)); if (!r.ok) return; E.data = await r.json(); E.ready = true; try { localStorage.setItem(K, JSON.stringify({ at: Date.now(), d: E.data })); } catch (e) { } E.on.forEach(f => { try { f(E.data); } catch (e) { } }); } catch (e) { } }
  load(); setInterval(load, 30 * 6e4);
})();
