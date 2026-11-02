/* Market shock alarm · the same file on SOXX Sniper, Cohort Sniper, LETF Sniper and Mastermind Investor.
   When a headline is likely to move whole markets (a Fed rate decision, a war or a peace deal, a big data surprise,
   new tariffs, a bank failure, an election result, a head of state out, a big crypto law or hack, a large disaster),
   a full-screen alarm shows on top of everything, with a siren sound and, when the tab is in the background, a
   desktop notification and a flashing tab title.
   Source: Cohort Sniper's news feed (news.json on the data branch: Bloomberg, WSJ, CNBC, Reuters, squawk accounts),
   read every 45 seconds. Each headline gets a score: the event (what happened, not what could happen), the source,
   and confirmation by other sources. Hedged words (could, may, plans to, ahead of, poll, explainer, "?") take points
   off, so talk about an event does not set off the alarm; the event does.
   Score 6+ = the alarm. Score 4–6 = a small banner at the top, no sound.
   The 🔔 button (bottom right) turns the sound on or off, asks for desktop notifications, shows the last alarms
   and plays a test alarm. A browser plays sound only after one click on the page: click the bell once.
   Node (the data job) can use the same rules: require this file, then globalThis.ShockRules.classify(item, recent). */
(function (G) {
  "use strict";
  // ---------- the rules ----------
  const SRC = /@business\b|@markets\b|@reuters|@ap\b|@wsj|@cnbc|@ft\b|@axios|bloomberg|wsj|reuters|cnbc|firstsquawk|financialjuice|deitaone|walterbloomberg|marketwatch|\bft\b|financial times|\bap\b|associated press|axios|barron|coindesk|the block|unusual_whales|zerohedge|nikkei|yahoo/i;
  const C = "(?:Iran|Iranian|Tehran|Russia|Russian|Moscow|Ukraine|Ukrainian|Kyiv|China|Chinese|Beijing|Israel|Israeli|Gaza|Hamas|Hezbollah|Lebanon|Houthi|Yemen|North Korea|Pyongyang|Taiwan|Venezuela|Saudi|India|Pakistan|NATO|U\\.?S\\.?|United States|America|Europe|EU|Japan|Mexico|Canada|Syria|Iraq)";
  const HEDGE = /\b(could|may|might|would|should|consider(s|ing)?|weigh(s|ing)?|mull(s|ing)?|plans? to|aims? to|seeks? to|hopes?|expected to|likely|unlikely|poll(s|ing)?|odds|explainer|analysis|opinion|column|preview|ahead of|what to know|what it means|why|how|if|whether|risk of|fears? of|threatens?|warns?|vows?|urges?|calls? for|says? it is time|podcast|watch:|video|live:|live updates|recap|week ahead|could be|talks? (on|about)|discuss(es|ed)?|meets?|meeting with|prepar(e|es|ing)|delay(s|ed)?|report(edly)? (says|suggests)|suggests?|claims?|accus\w+|denies|says? (they|he|she) (want|would)|ICYMI|reminder|they say|can wait|wait for|until)\b|\?/i;
  // [id, label, weight, test(text) → direction or null, first reaction by direction]
  const R = [
    ["fed", "Central bank rate decision", 5, t => { if (!/\b(Fed|FED|FOMC|Federal Reserve|FEDERAL RESERVE|ECB|BOJ|Bank of Japan|BOE|Bank of England|PBOC|PBoC|SNB|RBA|Bank of Canada)\b/.test(t)) return null;
        const PR = "(interest rates?|rates by|benchmark rate|policy rate|key rate|deposit rate|lending rate|loan prime rate|federal funds|fed funds|basis points?|bps?)"; if (new RegExp(`\\b(cuts?|lowers?|slash(es)?|reduces?)\\b.{0,40}\\b${PR}`, "i").test(t) || /\b(delivers?|announces?) (a )?rate cut\b/i.test(t)) return "cut"; if (new RegExp(`\\b(raises?|hikes?|lifts?|increases?)\\b.{0,40}\\b${PR}`, "i").test(t) || /\b(delivers?|announces?) (a )?rate (hike|increase)\b/i.test(t)) return "hike";
        if (/\b(holds?|keeps?|leaves?|maintains?)\b.{0,30}\brates?\b.{0,30}\b(unchanged|steady|on hold)?/i.test(t) && /\b(decision|unchanged|steady)\b/i.test(t)) return "hold"; if (/\b(emergency|unscheduled|surprise)\b.{0,20}\b(cut|hike|meeting|move)\b/i.test(t)) return "cut"; return null; },
      { cut: "stocks ↑ · bonds ↑ · dollar ↓ · gold ↑ · bitcoin ↑", hike: "stocks ↓ · bonds ↓ · dollar ↑ · gold ↓ · bitcoin ↓", hold: "watch the statement and the press conference: the surprise is in the words" }],
    ["fedchair", "Central bank chief news", 5, t => /\b(Powell|Fed chair|Federal Reserve chair|Lagarde|Ueda|Bailey|ECB President|BOJ Governor)\b.{0,40}\b(resigns?|resigned|fired|ousted|removed|steps down|stepping down|nominat\w+|named|replac\w+)\b|\b(fires?|removes?|ousts?)\b.{0,20}\bPowell\b/i.test(t) ? "x" : null,
      { x: "dollar and bonds move first · gold ↑ if the Fed looks less independent" }],
    ["data", "Big economic data surprise", 4.5, t => { if (!/\b(CPI|PCE|payrolls|jobs report|nonfarm|non-farm|unemployment rate|jobless claims|GDP|retail sales|ISM|consumer prices|inflation (rate|data|report|rose|fell|rises|falls|jumps|slows|accelerates))\b/i.test(t) || /\b(investors?|notes|bonds? (fund|investors)|traders bet|economists see)\b/i.test(t)) return null;
        if (/\b(hotter|higher|stronger|faster)\b.{0,15}\bthan (expected|forecast|estimates?)\b|\bunexpectedly (rises?|rose|jumps?|jumped|accelerat\w+)\b|\b(surges?|soars?|jumps?|accelerat\w+)\b.{0,30}\b(to|by) [\d.]+%|\b(biggest|largest|highest|fastest) (since|in) \d/i.test(t)) return /payroll|jobs|nonfarm|GDP|retail|ISM/i.test(t) ? "strong" : "hot";
        if (/\b(cooler|lower|weaker|slower|softer)\b.{0,15}\bthan (expected|forecast|estimates?)\b|\bunexpectedly (falls?|fell|drops?|dropped|slow\w*|contract\w*)\b|\b(plunges?|tumbles?|slumps?|contracts?|shrinks?)\b.{0,30}\b(to|by) -?[\d.]+%|\b(economy|GDP) (contracts?|shrinks?|shrank)\b|\b(lowest|slowest|smallest) (since|in) \d/i.test(t)) return /payroll|jobs|nonfarm|GDP|retail|ISM/i.test(t) ? "weak" : "cool";
        const m = t.match(/(-?\+?[\d.,]+)\s*([KkMm%])?\s+(?:vs\.?|versus)\s+(-?\+?[\d.,]+)\s*([KkMm%])?\s*(?:expected|exp\.?|est\.?|estimate|forecast|consensus|f'cast)/i);
        if (m) { const a = parseFloat(m[1].replace(/[,+]/g, "")), e = parseFloat(m[3].replace(/[,+]/g, "")), gap = Math.abs(a - e) / Math.max(Math.abs(e), /%/.test(m[2] || m[4] || "") ? 0.2 : 1e-9);
          if (isFinite(a) && isFinite(e) && gap >= (/%/.test(m[2] || m[4] || "") ? 0.5 : 0.5)) { const up = a > e; return /payroll|jobs|nonfarm|GDP|retail|ISM/i.test(t) ? (up ? "strong" : "weak") : (up ? "hot" : "cool"); } }
        return null; },
      { hot: "stocks ↓ · bonds ↓ (yields ↑) · dollar ↑ · bitcoin ↓", cool: "stocks ↑ · bonds ↑ (yields ↓) · dollar ↓ · bitcoin ↑", strong: "yields ↑ · dollar ↑ · stocks mixed (fewer rate cuts)", weak: "yields ↓ · dollar ↓ · stocks mixed (recession fear vs rate cuts)" }],
    ["peace", "Peace deal or ceasefire", 5, t => new RegExp(`\\b${C}\\b`).test(t) && /\b(ceasefire|cease-fire|truce|armistice|peace (deal|agreement|accord|treaty)|nuclear (deal|agreement)|deal to end the war|(deal|agreement) (with|between) (Iran|Russia|Ukraine|Israel|Hamas|China))\b/i.test(t) && !/\btrade deal\b/i.test(t) && /\b(reached|reach(es)? (a |an )?(ceasefire|truce|deal|agreement|peace)|struck|strikes (a|an)|signs?|signed|agrees? to|agreed|announces?|announced|seal(s|ed)|clinch(es|ed)|finali[sz]ed|in effect|takes? effect|began|begins)\b/i.test(t) && !/\b(collapses?|collapsed|breaks? down|violat\w+|rejects?|rejected|no deal|must|before any|wait)\b/i.test(t) ? "x" : null,
      { x: "oil ↓ · stocks ↑ · gold ↓ · defense stocks ↓ · bitcoin ↑" }],
    ["war", "War or big military escalation", 5, t => { const neg = /\b(not|no|denies|denied|fake|drill|exercises?|warnings?|hacked|evade[sd]?|evading|slipping|film(ed)?|seen)\b/i; if (neg.test(t)) return null; const big = "(U\\.?S\\.?|US|United States|American|Pentagon|Israel|Israeli|Iran|Iranian|China|Chinese|PLA|Russia|Russian|NATO|North Korea|Taiwan)";
        const hit = "(strikes?|struck|attacks?|attacked|bombs?|bombed|launch(es|ed) (missiles?|strikes?|an? attack)|fires? missiles? (at|on|into)|invades?|invaded)";
        return new RegExp(`\\b${big}\\b[^.]{0,30}\\b${hit}\\b[^.]{0,40}\\b${big}\\b`, "i").test(t) && !/\b(killed in|palestinian|houthi|refiner(y|ies)|drone strike on|governor says|region)\b/i.test(t)
          || /\b(declares? war|declared war|nuclear (strike|attack|test|weapon used)|invasion of (Taiwan|Ukraine|Poland|the Baltics?)|troops (enter|entered|cross|crossed) (into )?(Taiwan|Poland|Lithuania|Latvia|Estonia|Iran)|Article 5)\b/i.test(t) && !/\b(threat|warn|could|if)\b/i.test(t) ? "x" : null; },
      { x: "oil ↑ · gold ↑ · stocks ↓ · bonds ↑ · bitcoin ↓ · defense stocks ↑" }],
    ["oilroute", "Oil route open or shut", 5, t => /\b(Strait of Hormuz|Hormuz|Suez Canal|Bab el-Mandeb)\b/i.test(t) && /\b(clos(es|ed)|shut(s)?|reopen(s|ed)|is (closed|open|reopened)|blockade (ends|ended|lifted|begins|imposed))\b/i.test(t) && !/\b(must|before any|demands?|if)\b/i.test(t) ? (/reopen|is open|ends|ended|lifted/i.test(t) ? "open" : "x") : /\bOPEC\+?\b.{0,40}\b(cuts?|slash(es)?|boosts?|raises?|increases?)\b.{0,30}\b(output|production|supply)\b/i.test(t) ? "opec" : null,
      { x: "oil ↑↑ · gold ↑ · stocks ↓ · airlines ↓", open: "oil ↓↓ · stocks ↑ · airlines ↑ · gold ↓", opec: "oil moves first: a cut = oil ↑, a boost = oil ↓" }],
    ["tariff", "Tariffs or trade deal", 5, t => { if (!/\b(tariffs?|trade (deal|agreement|war|pact)|export (ban|controls?)|import ban|duties)\b/i.test(t)) return null;
        if (/\b(lift(s|ed)?|remov(es|ed)|scrap(s|ped)?|suspend(s|ed)?|paus(es|ed)|cut(s)?|lower(s|ed)?|exempt(s|ed)?|delay(s|ed)?|trade (deal|agreement|pact)|deal)\b/i.test(t) && /\b(announc\w+|sign(s|ed)?|reach(es|ed)?|agree[sd]?|struck|strikes?|order(s|ed)?|effective|takes? effect|lift(s|ed)?|scrap(s|ped)|suspend(s|ed)|paus(es|ed))\b/i.test(t)) return "ease";
        if (/\b(impos(es|ed)|announc(es|ed)|slap(s|ped)?|rais(es|ed)|hik(es|ed)|order(s|ed)|sign(s|ed)|effective|takes? effect|retaliat\w+|ban(s|ned)?|\d+(\.\d+)?%)\b/i.test(t) && new RegExp(`\\b(${C}|all imports|semiconductors?|chips?|autos?|steel|pharma\\w*)\\b`, "i").test(t)) return "new"; return null; },
      { ease: "stocks ↑ · chip stocks ↑ · dollar mixed · bitcoin ↑", new: "stocks ↓ · chip stocks ↓ · gold ↑ · the hit country's currency ↓" }],
    ["stress", "Financial system stress", 5, t => /\b(bank run|bank (failure|collapse)|(bank|lender)s? (fails?|failed|collapses?|collapsed)|seized by (regulators|the FDIC)|FDIC (takes over|seizes)|sovereign default|defaults? on (its )?(sovereign |government )?(debt|bonds)|(government|federal|bank) bailout|circuit breakers? (triggered|tripped|halt)|market-wide (halt|circuit)|trading (halted|suspended) (on|across) (the )?(NYSE|Nasdaq|exchange|market)|flash crash|downgrades? (the )?(US|U\.S\.|United States)( credit| sovereign)?|(US|U\.S\.) (loses|lost) (its )?(AAA|top) (credit )?rating)\b/i.test(t) && !/\b(years? ago|anniversary)\b/i.test(t) ? "x" : null,
      { x: "stocks ↓ · gold ↑ · bonds ↑ · bank stocks ↓ · bitcoin swings both ways" }],
    ["leader", "Head of state or central bank chief out", 5, t => /\b(President( Donald)?( Trump)?|Trump|Vance|Xi( Jinping)?|Putin|Zelensky|Netanyahu|Khamenei|Prime Minister \w+|Chancellor \w+|Supreme Leader|Lagarde|Powell|Ueda|Bailey|Modi|Starmer|Macron|Merz|Takaichi)\b,?( \w+){0,3},? (has |is |was )?(resigns?|resigned|steps down|stepped down|impeached|assassinated|shot|killed|dies|died|dead|hospitali[sz]ed|incapacitated|ousted|removed from office|arrested)\b/i.test(t) || /\b(coup (in|attempt in)|declares? martial law|House votes to impeach|assassination of)\b/i.test(t) && !/\b(judicial coup|attempted|similar)\b/i.test(t) ? "x" : null,
      { x: "stocks ↓ · gold ↑ · that country's currency and bonds move first · the volatility index ↑" }],
    ["election", "Election result", 5, t => /\b(wins?|won|captures?|captured|takes?|took|retains?|retained|keeps?|kept|flips?|flipped|projected to (win|take|keep|retain|control)|will control|clinch(es|ed)?)\b.{0,40}\b(control of (the )?(House|Senate|Congress)|the House|the Senate|House majority|Senate majority|presidency|election|majority in (the )?(House|Senate))\b/i.test(t) && /\b(Democrats?|Republicans?|GOP|Dems?|projected|AP|NBC|CNN|Fox|race call|calls)\b/i.test(t) && !/\b(primary|district|seat in|governor|mayor|state senate|state house|county)\b/i.test(t) ? "x" : null,
      { x: "a split Congress = less new law (often fine for stocks) · one party with all control = bigger moves in taxes, spending and sectors" }],
    ["shutdown", "Government shutdown", 4, t => /\bgovernment shutdown\b|\bshutdown\b.{0,20}\b(government|federal)\b/i.test(t) && /\b(begins?|began|starts?|started|ends?|ended|averted|over|signs?|signed)\b/i.test(t) ? "x" : null,
      { x: "small for stocks · data releases stop while it lasts" }],
    ["crypto", "Crypto law, approval or big hack", 4.5, t => /\b(SEC|CFTC|Congress|Senate|House|President|Trump|White House)\b.{0,50}\b(approv(es|ed)|pass(es|ed)|signs?|signed|rejects?|rejected|executive order)\b.{0,50}\b(ETF|crypto|stablecoin|bitcoin|ether|market structure|CLARITY|GENIUS|reserve)\b/i.test(t) ? "law" : /\b(hack(ed)?|exploit(ed)?|drained|stolen)\b.{0,60}\$?\d+(\.\d+)? ?(million|billion|bn|m)\b/i.test(t) && /\$?\d+(\.\d+)? ?(billion|bn)\b|\$\d{3,}(\.\d+)? ?(million|m)\b/i.test(t) ? "hack" : /\bstrategic bitcoin reserve\b/i.test(t) && /\b(sign|signs|signed|creat|establish|order)/i.test(t) ? "law" : null,
      { law: "bitcoin ↑ · crypto stocks ↑ (if it allows more) · ↓ (if it rejects)", hack: "the hit coin and exchange ↓ · bitcoin ↓ for a short time" }],
    ["disaster", "Large disaster or outbreak", 4.5, t => /\b(magnitude (7\.[5-9]|[89](\.\d)?)|[89]\.\d magnitude|tsunami warning|pandemic declared|declares? (a )?pandemic|national emergency|nationwide lockdown|nuclear (accident|leak|meltdown))\b/i.test(t) ? "x" : null,
      { x: "stocks in the region ↓ · safe havens (yen, gold, bonds) ↑ · insurers ↓" }],
    ["mega", "Giant company shock", 4, t => /\b(Nvidia|Apple|Microsoft|Tesla|Amazon|Meta|Alphabet|Google|TSMC|Broadcom|OpenAI|Berkshire|JPMorgan)\b/.test(t) && (/\b(plunges?|plunged|crashes?|crashed|soars?|soared|surges?|surged|tumbles?|tumbled|sinks?|sank)\b.{0,20}\b([2-9]\d|1[5-9])(\.\d+)?%/i.test(t) || /\b(to (acquire|buy)|agrees? to (buy|acquire)|merger|takeover)\b.{0,60}\$\d+(\.\d+)? ?(billion|bn|trillion)\b/i.test(t) || /\b(antitrust|DOJ|FTC|EU)\b.{0,40}\b(break ?up|orders? .{0,20}(sale|divest)|fines?.{0,10}\$\d+ ?billion)\b/i.test(t)) ? "x" : null,
      { x: "the company and its index move · its suppliers and peers follow" }]
  ];
  const norm = s => String(s || "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
  // it: { id, t, h, src }; recent: other items (for confirmation by other sources)
  function classify(it, recent) {
    const t = norm(it.h).slice(0, 400); if (t.length < 12) return null; let best = null;
    for (const [id, label, w, test, react] of R) { let d = null; try { d = test(t); } catch (e) { } if (d) { if (!best || w > best.w) best = { id, label, w, d, react: react[d] || react.x || "" }; } }
    if (!best) return null;
    let s = best.w; const why = [best.label]; if (best.id === "fed" && best.d === "hold") { s -= 1; why.push("no change"); }
    if (SRC.test(it.src || "")) { s += 1; why.push("trusted source"); }
    if (/^(BREAKING|JUST IN|\*|FLASH|URGENT)\b|^[^a-z]{25,}$/.test(t)) { s += 0.5; why.push("flash headline"); }
    const hedge = t.replace(/\bthan (expected|forecast|estimates?)\b/gi, "").match(HEDGE); if (hedge) { s -= 3; why.push(`hedged ("${hedge[0]}")`); }
    if (/\b(last (week|month|year)|years? ago|anniversary|since \d{4}|history of|in \d{4},)\b/i.test(t)) { s -= 2; why.push("looks back"); }
    if (recent && recent.length) { const srcs = new Set(recent.filter(x => x.id !== it.id && Math.abs(x.t - it.t) < 30 * 6e4 && x.src !== it.src && SRC.test(x.src || "") && norm(x.h).slice(0, 40) !== t.slice(0, 40)).filter(x => { let d = null; try { d = R.find(r => r[0] === best.id)[3](norm(x.h)); } catch (e) { } return !!d; }).map(x => x.src)); if (srcs.size) { s += Math.min(2, srcs.size); why.push(`${srcs.size} other source${srcs.size > 1 ? "s" : ""}`); } }
    return { s: Math.round(s * 10) / 10, cat: best.id, label: best.label, dir: best.d, react: best.react, why };
  }
  G.ShockRules = { classify, ALARM: 6, BANNER: 4 };
  if (typeof document === "undefined" || G.SHOCKUI) return; G.SHOCKUI = 1;

  // ---------- the alarm on the page ----------
  const RAW = "https://raw.githubusercontent.com/stevenwsharp-ctrl/Hyperdash-Cohort-Tracker/data/news.json", K = "shock_v1";
  const lsG = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }, lsS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const st = lsG(K, { seen: {}, log: [], sound: 1, since: 0 }); st.seen = st.seen || {}; st.log = st.log || []; const save = () => lsS(K, st);
  const css = document.createElement("style");
  css.textContent = `#shockBell{position:fixed;right:16px;bottom:16px;z-index:2147483600;width:46px;height:46px;border-radius:50%;border:1px solid var(--line,#333);background:var(--panel,#111);color:var(--ink,#eee);font-size:20px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,.35)}
#shockBell.off{opacity:.55}#shockBell .dot{position:absolute;top:6px;right:7px;width:9px;height:9px;border-radius:50%;background:#ff4d5e;display:none}#shockBell.new .dot{display:block}
#shockPanel{position:fixed;right:16px;bottom:72px;z-index:2147483600;width:min(380px,calc(100vw - 32px));max-height:60vh;overflow:auto;background:var(--panel,#111);color:var(--ink,#eee);border:1px solid var(--line,#333);border-radius:14px;padding:12px 14px;font:13px/1.45 var(--sans,system-ui,sans-serif);box-shadow:0 10px 40px rgba(0,0,0,.45);display:none}
#shockPanel button{font:12px var(--mono,monospace);color:var(--ink,#eee);background:var(--panel2,#1a1a1a);border:1px solid var(--line,#333);border-radius:8px;padding:5px 10px;cursor:pointer;margin:0 6px 6px 0}
#shockPanel .it{border-top:1px solid var(--line,#333);padding:7px 0}#shockPanel .m{font:11px var(--mono,monospace);color:var(--dim,#888)}
#shockOv{position:fixed;inset:0;z-index:2147483647;background:rgba(10,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px)}
#shockOv .box{max-width:760px;width:100%;background:#16080a;color:#fff;border:3px solid #ff2d43;border-radius:18px;padding:22px 24px;box-shadow:0 0 0 0 rgba(255,45,67,.7);animation:shockP 1.2s infinite;font-family:var(--sans,system-ui,sans-serif)}
@keyframes shockP{0%{box-shadow:0 0 0 0 rgba(255,45,67,.75)}70%{box-shadow:0 0 0 26px rgba(255,45,67,0)}100%{box-shadow:0 0 0 0 rgba(255,45,67,0)}}
#shockOv .tag{font:700 13px var(--mono,monospace);letter-spacing:.12em;color:#ff6b7a}#shockOv h2{font-size:clamp(22px,3.6vw,32px);line-height:1.2;margin:10px 0 12px}
#shockOv .meta{font:12.5px var(--mono,monospace);color:#ffb3bb}#shockOv .re{margin:12px 0;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.07);font-size:15px}
#shockOv .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}#shockOv a,#shockOv button{font:600 14px var(--sans,system-ui,sans-serif);padding:10px 16px;border-radius:10px;border:1px solid #ff2d43;background:#ff2d43;color:#fff;text-decoration:none;cursor:pointer}
#shockOv .ghost{background:transparent;color:#ffb3bb;border-color:#5a2a30}#shockOv .more{font-size:13px;color:#ffb3bb;margin-top:8px}
#shockBan{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483646;max-width:min(720px,calc(100vw - 24px));background:#2a1c05;color:#ffe0a8;border:1px solid #ffb547;border-radius:12px;padding:9px 14px;font:13.5px/1.4 var(--sans,system-ui,sans-serif);box-shadow:0 6px 24px rgba(0,0,0,.4);cursor:pointer}`;
  document.head.appendChild(css);
  const bell = document.createElement("button"); bell.id = "shockBell"; bell.title = "Market shock alarm: sound, notifications, last alarms"; bell.innerHTML = '🔔<span class="dot"></span>';
  const panel = document.createElement("div"); panel.id = "shockPanel";
  document.body.append(bell, panel); const setBell = () => { bell.classList.toggle("off", !st.sound); bell.firstChild.textContent = st.sound ? "🔔" : "🔕"; }; setBell();
  // sound: a siren made in the browser (no file). Browsers allow sound only after a click on the page.
  let AC = null; const ac = () => { try { AC = AC || new (G.AudioContext || G.webkitAudioContext)(); if (AC.state === "suspended") AC.resume(); } catch (e) { } return AC; };
  ["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, () => { if (st.sound) ac(); }, { once: true, capture: true }));
  function siren(rep) { const a = ac(); if (!a || !st.sound) return; const t0 = a.currentTime + 0.05, g = a.createGain(); g.connect(a.destination); g.gain.value = 0.0001;
    for (let r = 0; r < (rep || 3); r++) for (let k = 0; k < 3; k++) { const o = a.createOscillator(), t = t0 + r * 1.6 + k * 0.42; o.type = "square"; o.frequency.setValueAtTime(880, t); o.frequency.linearRampToValueAtTime(1320, t + 0.3); o.connect(g); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36); o.start(t); o.stop(t + 0.38); } }
  let flash = null; const title0 = document.title;
  function flashTitle(on) { clearInterval(flash); document.title = title0; if (!on) return; let k = 0; flash = setInterval(() => { document.title = k++ % 2 ? title0 : "🚨 MARKET SHOCK"; }, 900); }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !document.getElementById("shockOv")) flashTitle(false); });
  const ago = t => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago"; };
  const mmLink = x => `https://stevenwsharp-ctrl.github.io/SOXX-Sniper/mastermind/#q=${encodeURIComponent(x.c && x.c.length ? x.c[0].split(":").pop() : x.cat === "crypto" ? "BTC" : x.cat === "war" || x.cat === "peace" || x.cat === "oilroute" ? "CL" : "XYZ100")}`;
  function alarm(x, test) {
    const old = document.getElementById("shockOv"); if (old) old.remove();
    const ov = document.createElement("div"); ov.id = "shockOv"; ov.setAttribute("role", "alertdialog");
    ov.innerHTML = `<div class="box"><div class="tag">🚨 ${test ? "TEST · " : ""}MARKET SHOCK · ${esc(x.label.toUpperCase())}</div><h2>${esc(x.h)}</h2>
      <div class="meta">${esc(x.src || "")} · ${ago(x.t)} · score ${x.s} (${esc((x.why || []).join(", "))})</div>
      <div class="re"><b>Usual first reaction:</b> ${esc(x.react || "big moves across markets")}<div class="more">A first reaction, not a forecast: the first move often reverses in the first hour. Check your stops and your leverage now.</div></div>
      <div class="row">${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener">Open the story</a>` : ""}<a class="ghost" href="${mmLink(x)}" target="_blank" rel="noopener">Ask Mastermind</a><button class="ghost" data-x="1">Dismiss (Esc)</button></div></div>`;
    document.body.appendChild(ov); const close = () => { ov.remove(); flashTitle(false); document.removeEventListener("keydown", onK); }; const onK = e => { if (e.key === "Escape") close(); };
    ov.querySelector("[data-x]").onclick = close; ov.onclick = e => { if (e.target === ov) close(); }; document.addEventListener("keydown", onK);
    siren(3); if (document.hidden) { flashTitle(true); try { if (G.Notification && Notification.permission === "granted") { const n = new Notification("🚨 Market shock · " + x.label, { body: x.h + "\n" + (x.react || ""), requireInteraction: true, tag: "shock-" + x.id }); n.onclick = () => { G.focus(); n.close(); }; } } catch (e) { } }
    bell.classList.add("new");
  }
  function banner(x) { const old = document.getElementById("shockBan"); if (old) old.remove(); const b = document.createElement("div"); b.id = "shockBan"; b.title = "Click to close";
    b.innerHTML = `⚠️ <b>${esc(x.label)}</b> · ${esc(x.h)} <span style="opacity:.75">· ${esc(x.src || "")} · ${ago(x.t)}</span>${x.url ? ` · <a href="${esc(x.url)}" target="_blank" rel="noopener" style="color:#ffd27a">story</a>` : ""}`;
    b.onclick = e => { if (e.target.tagName !== "A") b.remove(); }; document.body.appendChild(b); setTimeout(() => b.remove(), 90000); bell.classList.add("new"); }
  function drawPanel() {
    const L = st.log.slice(0, 12), np = G.Notification ? Notification.permission : "unsupported";
    panel.innerHTML = `<div style="font:600 11px var(--mono,monospace);letter-spacing:.06em;text-transform:uppercase;color:var(--dim,#888);margin-bottom:8px">Market shock alarm</div>
      <button data-a="snd">${st.sound ? "🔕 Sound off" : "🔔 Sound on"}</button><button data-a="ntf">${np === "granted" ? "Notifications on ✓" : np === "denied" ? "Notifications blocked (browser settings)" : "Desktop notifications"}</button><button data-a="test">Test alarm</button>
      <div class="m" style="margin:2px 0 6px">Checks the news every 45 s on every tracker page. An alarm needs score 6+ (an event that happened, from a trusted source, not hedged); 4–6 shows a small banner. Keep one tracker tab open to hear it.</div>
      ${L.length ? L.map(x => `<div class="it"><div class="m">${ago(x.t)} · ${esc(x.label)} · score ${x.s}</div>${x.url ? `<a href="${esc(x.url)}" target="_blank" rel="noopener" style="color:inherit">${esc(x.h)}</a>` : esc(x.h)}</div>`).join("") : '<div class="m">No alarms yet.</div>'}`;
    panel.querySelectorAll("[data-a]").forEach(b => b.onclick = async () => { const a = b.dataset.a;
      if (a === "snd") { st.sound = st.sound ? 0 : 1; save(); setBell(); if (st.sound) { ac(); siren(1); } }
      if (a === "ntf" && G.Notification && Notification.permission === "default") { try { await Notification.requestPermission(); } catch (e) { } }
      if (a === "test") { ac(); alarm({ id: "test", t: Date.now(), h: "TEST: Fed cuts rates by 50 basis points in a surprise move", src: "test", label: "Central bank rate decision", s: 9, why: ["test"], react: "stocks ↑ · bonds ↑ · dollar ↓ · gold ↑ · bitcoin ↑", cat: "fed" }, true); }
      drawPanel(); }); }
  bell.onclick = () => { ac(); bell.classList.remove("new"); const on = panel.style.display !== "block"; panel.style.display = on ? "block" : "none"; if (on) drawPanel(); };
  // ---------- the check ----------
  let busy = false;
  async function tick() {
    if (busy) return; busy = true;
    try { const r = await fetch(RAW + "?t=" + Math.floor(Date.now() / 3e4)), N = await r.json(), items = (N.items || []).filter(x => x && x.h && x.t), now = Date.now();
      const first = !st.since; const fresh = items.filter(x => now - x.t < 20 * 6e4 && x.t > (st.since || 0) - 20 * 6e4);
      const hits = [];
      for (const it of fresh) { if (st.seen[it.id]) continue; const c = it.x || classify(it, items); st.seen[it.id] = now; if (c && c.s >= 4) hits.push({ ...it, ...c }); }
      st.since = now; for (const k in st.seen) if (now - st.seen[k] > 2 * 864e5) delete st.seen[k];
      // the same event from several sources: one alarm (the highest score), the others go to the log
      hits.sort((a, b) => b.s - a.s); const shown = new Set();
      for (const x of hits) { const key = x.cat + ":" + x.dir; st.log.unshift({ id: x.id, t: x.t, h: x.h, src: x.src, url: x.url, label: x.label, s: x.s }); if (shown.has(key)) continue; shown.add(key);
        const recent = st.log.slice(1).some(l => l.label === x.label && now - (l.shownAt || 0) < 20 * 6e4); if (recent && !first) continue;
        st.log[0].shownAt = now; if (first && now - x.t > 10 * 6e4) continue;   // on a first visit, older items only go to the log
        if (x.s >= 6) alarm(x); else banner(x); }
      st.log = st.log.slice(0, 40); save();
    } catch (e) { } finally { busy = false; }
  }
  // one tab checks at a time (a shared lock in this browser), so two open trackers do not both sound
  function lead() { const L = lsG("shock_lead", null), now = Date.now(); if (!L || now - L.t > 100000 || L.id === TAB) { lsS("shock_lead", { id: TAB, t: now }); return true; } return false; }
  const TAB = Math.random().toString(36).slice(2);
  G.addEventListener("storage", e => { if (e.key === "shock_alarm" && e.newValue) { try { const x = JSON.parse(e.newValue); if (x && Date.now() - x.at < 60000) { if (x.s >= 6) _alarm(x); else _banner(x); } } catch (er) { } } });
  const _alarm = alarm, _banner = banner;
  alarm = function (x, test) { _alarm(x, test); if (!test) lsS("shock_alarm", { ...x, at: Date.now() }); };   // eslint-disable-line no-func-assign
  banner = function (x) { _banner(x); lsS("shock_alarm", { ...x, at: Date.now() }); };   // eslint-disable-line no-func-assign
  const loop = () => { if (lead()) tick(); }; setTimeout(loop, 4000); setInterval(loop, 45000);
  G.Shock = { tick, alarm: x => alarm(x, true), classify };
})(typeof window !== "undefined" ? window : globalThis);
