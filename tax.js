/* Market taxonomy · shared by SOXX Sniper and Cohort Sniper (same file in both repos).
   For each Hyperliquid market: asset class, sector, industry (the peer group), size and listing year.
   Size (approximate, late 2026): mega > $200B, large $10-200B, mid $2-10B, small < $2B, private = not listed (pre-IPO perps).
   Year = first listing year (private: founding year). Unknown names fall back to their class.
   Tax.tag("XYZ:NVDA") -> { s, cls, sec, ind, cap, yr, age } */
(function () {
  "use strict";
  // sym: [class, sector, industry, size, year]
  const T = {
    NVDA: ["Stock", "Tech", "AI chips", "mega", 1999], AMD: ["Stock", "Tech", "AI chips", "mega", 1972], AVGO: ["Stock", "Tech", "AI chips", "mega", 2009],
    CAMBRICON: ["Stock", "Tech", "AI chips", "large", 2020], CBRS: ["Stock", "Tech", "AI chips", "large", 2026], ARM: ["Stock", "Tech", "Chip design", "large", 2023],
    QCOM: ["Stock", "Tech", "Chip design", "large", 1991], MRVL: ["Stock", "Tech", "Chip design", "large", 2000], CRDO: ["Stock", "Tech", "Networking chips", "large", 2022],
    TSM: ["Stock", "Tech", "Foundry", "mega", 1997], UMC: ["Stock", "Tech", "Foundry", "large", 2000], INTC: ["Stock", "Tech", "Foundry", "mega", 1971],
    MU: ["Stock", "Tech", "Memory", "mega", 1984], SKHY: ["Stock", "Tech", "Memory", "mega", 1996], SKHX: ["Stock", "Tech", "Memory", "mega", 1996], SMSN: ["Stock", "Tech", "Memory", "mega", 1975],
    KIOXIA: ["Stock", "Tech", "Memory", "large", 2024], SNDK: ["Stock", "Tech", "Memory", "large", 2025], GIGADEV: ["Stock", "Tech", "Memory", "large", 2016], CXMT: ["Private", "Tech", "Memory", "private", 2016],
    DRAM: ["ETF", "Tech", "Memory", "ETF", 2025], WDC: ["Stock", "Tech", "Storage", "large", 1978], STX: ["Stock", "Tech", "Storage", "large", 2002],
    ASML: ["Stock", "Tech", "Chip equipment", "mega", 1995], AMAT: ["Stock", "Tech", "Chip equipment", "mega", 1972], LRCX: ["Stock", "Tech", "Chip equipment", "mega", 1984], TER: ["Stock", "Tech", "Chip equipment", "large", 1970],
    COHR: ["Stock", "Tech", "Optical", "large", 1987], LITE: ["Stock", "Tech", "Optical", "large", 2015], AAOI: ["Stock", "Tech", "Optical", "mid", 2013], GLW: ["Stock", "Tech", "Optical", "large", 1945],
    CIEN: ["Stock", "Tech", "Networking", "large", 1997], NOK: ["Stock", "Tech", "Networking", "large", 1994],
    SMCI: ["Stock", "Tech", "Servers", "large", 2007], DELL: ["Stock", "Tech", "Servers", "large", 2018], IBM: ["Stock", "Tech", "IT services", "mega", 1911],
    CRWV: ["Stock", "Tech", "AI cloud", "large", 2025], NBIS: ["Stock", "Tech", "AI cloud", "large", 2024], IREN: ["Stock", "Tech", "AI cloud", "mid", 2021], CIFR: ["Stock", "Tech", "AI cloud", "mid", 2021],
    MSFT: ["Stock", "Tech", "Mega platforms", "mega", 1986], AAPL: ["Stock", "Tech", "Mega platforms", "mega", 1980], GOOGL: ["Stock", "Tech", "Mega platforms", "mega", 2004],
    AMZN: ["Stock", "Tech", "Mega platforms", "mega", 1997], META: ["Stock", "Tech", "Mega platforms", "mega", 2012], ORCL: ["Stock", "Tech", "Cloud software", "mega", 1986],
    NOW: ["Stock", "Tech", "Cloud software", "large", 2012], CRWD: ["Stock", "Tech", "Security software", "large", 2019], NET: ["Stock", "Tech", "Security software", "large", 2019],
    PLTR: ["Stock", "Tech", "Cloud software", "mega", 2020], ZM: ["Stock", "Tech", "Cloud software", "large", 2019], BB: ["Stock", "Tech", "Security software", "small", 1999],
    TSLA: ["Stock", "Consumer", "EVs and autos", "mega", 2010], RIVN: ["Stock", "Consumer", "EVs and autos", "mid", 2021], HYUNDAI: ["Stock", "Consumer", "EVs and autos", "large", 1974],
    NFLX: ["Stock", "Communication", "Media", "mega", 2002], RDDT: ["Stock", "Communication", "Internet", "large", 2024], EBAY: ["Stock", "Consumer", "E-commerce", "large", 1998],
    BABA: ["Stock", "Consumer", "E-commerce", "mega", 2014], MELI: ["Stock", "Consumer", "E-commerce", "large", 2007], SHEIN: ["Private", "Consumer", "E-commerce", "private", 2008],
    TCNT: ["Stock", "Communication", "Internet", "mega", 2004], XIAOMI: ["Stock", "Tech", "Consumer hardware", "mega", 2018], GPRO: ["Stock", "Tech", "Consumer hardware", "small", 2014],
    COST: ["Stock", "Consumer", "Retail", "mega", 1985], GME: ["Stock", "Consumer", "Retail", "mid", 2002], BIRD: ["Stock", "Consumer", "Retail", "small", 2021],
    DKNG: ["Stock", "Consumer", "Gaming", "large", 2020], TTWO: ["Stock", "Communication", "Gaming", "large", 1997],
    COIN: ["Stock", "Financials", "Crypto finance", "large", 2021], CRCL: ["Stock", "Financials", "Crypto finance", "large", 2025], HOOD: ["Stock", "Financials", "Fintech", "large", 2021],
    SOFI: ["Stock", "Financials", "Fintech", "large", 2021], MSTR: ["Stock", "Financials", "Bitcoin treasuries", "large", 1998], BMNR: ["Stock", "Financials", "Bitcoin treasuries", "mid", 2025],
    ICE: ["Stock", "Financials", "Exchanges", "large", 2005], BX: ["Stock", "Financials", "Asset managers", "mega", 2007], ANT: ["Private", "Financials", "Fintech", "private", 2014],
    SOFTBANK: ["Stock", "Financials", "Tech holdings", "large", 1994], RELIANCE: ["Stock", "Energy", "Conglomerates", "mega", 1977], JIO: ["Stock", "Communication", "Telecom", "mega", 2026],
    GEV: ["Stock", "Utilities", "Power for AI", "mega", 2024], VST: ["Stock", "Utilities", "Power for AI", "large", 2016], BE: ["Stock", "Utilities", "Power for AI", "large", 2018],
    CVX: ["Stock", "Energy", "Oil majors", "mega", 1921], LLY: ["Stock", "Health", "Pharma", "mega", 1952], MRNA: ["Stock", "Health", "Biotech", "mid", 2018], TWST: ["Stock", "Health", "Biotech", "mid", 2018],
    HIMS: ["Stock", "Health", "Digital health", "mid", 2021], OURA: ["Private", "Health", "Digital health", "private", 2013],
    RKLB: ["Stock", "Industrials", "Space", "large", 2021], SPCX: ["Private", "Industrials", "Space", "private", 2002], UNITREE: ["Private", "Industrials", "Robotics", "private", 2016],
    USAR: ["Stock", "Materials", "Rare earths", "mid", 2025],
    OAI: ["Private", "Tech", "AI labs", "private", 2015], ANTH: ["Private", "Tech", "AI labs", "private", 2021], ZHIPU: ["Private", "Tech", "AI labs", "private", 2019], MINIMAX: ["Private", "Tech", "AI labs", "private", 2021],
    // funds and indexes
    SOXL: ["ETF", "Tech", "Semis funds", "ETF", 2010], SMH: ["ETF", "Tech", "Semis funds", "ETF", 2000], IGV: ["ETF", "Tech", "Software funds", "ETF", 2001], MAGS: ["ETF", "Tech", "Mega platforms", "ETF", 2023],
    BOT: ["ETF", "Industrials", "Robotics", "ETF", 2016], XBI: ["ETF", "Health", "Biotech", "ETF", 2006], XLE: ["ETF", "Energy", "Oil majors", "ETF", 1998], GDX: ["ETF", "Materials", "Gold miners", "ETF", 2006],
    URNM: ["ETF", "Energy", "Uranium", "ETF", 2019], KORU: ["ETF", "World", "Korea", "ETF", 2013],
    SP500: ["Index", "US stocks", "US large caps", "index", 1957], XYZ100: ["Index", "US stocks", "US tech index", "index", 1985],
    EWJ: ["ETF", "World", "Japan", "ETF", 1996], JP225: ["Index", "World", "Japan", "index", 1950], EWT: ["ETF", "World", "Taiwan", "ETF", 2000], EWY: ["ETF", "World", "Korea", "ETF", 2000],
    KR200: ["Index", "World", "Korea", "index", 1990], EWZ: ["ETF", "World", "Brazil", "ETF", 2000], NIFTY: ["Index", "World", "India", "index", 1996],
    // rates, currencies, commodities, volatility
    "10Y": ["Rates", "Rates", "US yields", "macro", 0], "2Y": ["Rates", "Rates", "US yields", "macro", 0], "30Y": ["Rates", "Rates", "US yields", "macro", 0], TLT: ["Bonds", "Bonds", "Long bonds", "macro", 2002],
    EUR: ["FX", "Currencies", "Currencies", "macro", 0], GBP: ["FX", "Currencies", "Currencies", "macro", 0], JPY: ["FX", "Currencies", "Currencies", "macro", 0],
    GOLD: ["Commodity", "Metals", "Precious metals", "macro", 0], SILVER: ["Commodity", "Metals", "Precious metals", "macro", 0], PLATINUM: ["Commodity", "Metals", "Precious metals", "macro", 0],
    PALLADIUM: ["Commodity", "Metals", "Precious metals", "macro", 0], COPPER: ["Commodity", "Metals", "Industrial metals", "macro", 0],
    CL: ["Commodity", "Energy", "Oil and gas", "macro", 0], BRENTOIL: ["Commodity", "Energy", "Oil and gas", "macro", 0], NATGAS: ["Commodity", "Energy", "Oil and gas", "macro", 0], HO: ["Commodity", "Energy", "Oil and gas", "macro", 0],
    BVIV: ["Crypto", "Crypto", "Crypto volatility", "index", 0], BTCD: ["Crypto", "Crypto", "Crypto indexes", "index", 0], TOTAL2: ["Crypto", "Crypto", "Crypto indexes", "index", 0], OTHERS: ["Crypto", "Crypto", "Crypto indexes", "index", 0],
    // crypto
    BTC: ["Crypto", "Crypto", "Majors", "mega", 2009], ETH: ["Crypto", "Crypto", "Majors", "mega", 2015], SOL: ["Crypto", "Crypto", "Layer 1s", "large", 2020], XRP: ["Crypto", "Crypto", "Payments coins", "large", 2012],
    BNB: ["Crypto", "Crypto", "Exchange coins", "large", 2017], HYPE: ["Crypto", "Crypto", "Exchange coins", "large", 2024], DOGE: ["Crypto", "Crypto", "Memes", "large", 2013],
    ADA: ["Crypto", "Crypto", "Layer 1s", "large", 2017], AVAX: ["Crypto", "Crypto", "Layer 1s", "mid", 2020], SUI: ["Crypto", "Crypto", "Layer 1s", "mid", 2023], LINK: ["Crypto", "Crypto", "DeFi", "mid", 2017],
    LTC: ["Crypto", "Crypto", "Payments coins", "mid", 2011], BCH: ["Crypto", "Crypto", "Payments coins", "mid", 2017], TRX: ["Crypto", "Crypto", "Layer 1s", "large", 2017],
    AAVE: ["Crypto", "Crypto", "DeFi", "mid", 2020], UNI: ["Crypto", "Crypto", "DeFi", "mid", 2020], ENA: ["Crypto", "Crypto", "DeFi", "mid", 2024], PENDLE: ["Crypto", "Crypto", "DeFi", "small", 2021],
    kPEPE: ["Crypto", "Crypto", "Memes", "mid", 2023], PEPE: ["Crypto", "Crypto", "Memes", "mid", 2023], WIF: ["Crypto", "Crypto", "Memes", "small", 2023], kBONK: ["Crypto", "Crypto", "Memes", "small", 2022],
    FARTCOIN: ["Crypto", "Crypto", "Memes", "small", 2024], PUMP: ["Crypto", "Crypto", "Memes", "small", 2025], TRUMP: ["Crypto", "Crypto", "Memes", "small", 2025],
    TAO: ["Crypto", "Crypto", "AI coins", "mid", 2023], FET: ["Crypto", "Crypto", "AI coins", "small", 2019], VIRTUAL: ["Crypto", "Crypto", "AI coins", "small", 2024],
    NEAR: ["Crypto", "Crypto", "Layer 1s", "mid", 2020], APT: ["Crypto", "Crypto", "Layer 1s", "mid", 2022], SEI: ["Crypto", "Crypto", "Layer 1s", "small", 2023], TON: ["Crypto", "Crypto", "Layer 1s", "mid", 2021],
    ARB: ["Crypto", "Crypto", "Layer 2s", "small", 2023], OP: ["Crypto", "Crypto", "Layer 2s", "small", 2022], ZK: ["Crypto", "Crypto", "Layer 2s", "small", 2024],
    XMR: ["Crypto", "Crypto", "Privacy coins", "mid", 2014], ZEC: ["Crypto", "Crypto", "Privacy coins", "mid", 2016]
  };
  const ageOf = y => !y ? "n/a" : y >= 2019 ? "Young (listed 2019+)" : y >= 2000 ? "Middle (2000–2018)" : "Old (before 2000)";
  const capName = { mega: "Mega cap", large: "Large cap", mid: "Mid cap", small: "Small cap", private: "Pre-IPO", ETF: "Funds", index: "Indexes", macro: "Macro" };
  function tag(coin) {
    const s = String(coin).split(":").pop(), x = T[s] || T[s.replace(/^k/, "")];
    if (x) return { s, cls: x[0], sec: x[1], ind: x[2], cap: capName[x[3]] || x[3], yr: x[4], age: x[0] === "Stock" || x[0] === "Private" ? ageOf(x[4]) : "n/a", known: true };
    return String(coin).includes(":") ? { s, cls: "Stock", sec: "Other stocks", ind: "Other stocks", cap: "Unknown", yr: 0, age: "n/a", known: false }
      : { s, cls: "Crypto", sec: "Crypto", ind: "Alts", cap: "Small cap", yr: 0, age: "n/a", known: false };
  }
  window.Tax = { tag, T };
})();
