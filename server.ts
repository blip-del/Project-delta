import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

app.use(express.json());

// In-memory cache for options data (TTL: 90 seconds)
interface CacheEntry {
  timestamp: number;
  data: any;
}
const optionsCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 90 * 1000;

// Yahoo Finance authenticated session (cookie + crumb)
let yahooSession = {
  cookie: "",
  crumb: "",
  timestamp: 0,
};
const YSESSION_TTL_MS = 60 * 60 * 1000; // refresh session every 1 hour

async function getYahooSession(): Promise<{ cookie: string; crumb: string }> {
  const now = Date.now();
  if (yahooSession.cookie && yahooSession.crumb && (now - yahooSession.timestamp) < YSESSION_TTL_MS) {
    return { cookie: yahooSession.cookie, crumb: yahooSession.crumb };
  }

  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  try {
    // 1. Get A3 session cookie from fc.yahoo.com
    const fcRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": userAgent }
    });
    const setCookie = fcRes.headers.get("set-cookie") || "";
    const cookie = setCookie.split(";")[0];

    // 2. Obtain crumb with this cookie
    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": userAgent,
        "Cookie": cookie,
      }
    });

    if (crumbRes.ok) {
      const crumb = await crumbRes.text();
      if (crumb && !crumb.includes("<html>") && !crumb.includes("404")) {
        yahooSession = { cookie, crumb: crumb.trim(), timestamp: now };
        console.log("Yahoo Finance authentication initialized with live crumb:", crumb.trim());
        return { cookie, crumb: crumb.trim() };
      }
    }
  } catch (err) {
    console.warn("Failed to obtain Yahoo session crumb:", err);
  }

  return { cookie: yahooSession.cookie, crumb: yahooSession.crumb };
}

// Standard Normal CDF for Black-Scholes calculation
function normalCdf(x: number): number {
  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p = 0.2316419;
  const c = 0.39894228;

  if (x >= 0.0) {
    const k = 1.0 / (1.0 + p * x);
    return 1.0 - c * Math.exp(-x * x / 2.0) * k *
      (b1 + k * (b2 + k * (b3 + k * (b4 + k * b5))));
  } else {
    const k = 1.0 / (1.0 - p * x);
    return c * Math.exp(-x * x / 2.0) * k *
      (b1 + k * (b2 + k * (b3 + k * (b4 + k * b5))));
  }
}

// Normal probability density function
function normalPdf(x: number): number {
  return (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * x * x);
}

// Calculate Black-Scholes Greeks
function calculateGreeks(
  isCall: boolean,
  S: number, // underlying price
  K: number, // strike price
  T: number, // time in years (DTE / 365)
  r: number, // risk-free rate (approx 0.045)
  sigma: number // implied volatility (e.g. 0.35)
) {
  if (T <= 0 || sigma <= 0.001 || S <= 0 || K <= 0) {
    const intrinsic = isCall ? Math.max(0, S - K) : Math.max(0, K - S);
    const delta = isCall ? (S > K ? 1.0 : 0.0) : (S < K ? -1.0 : 0.0);
    return { delta, gamma: 0, theta: 0, vega: 0, theoreticalPrice: intrinsic };
  }

  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  let delta: number;
  let theoreticalPrice: number;
  if (isCall) {
    delta = normalCdf(d1);
    theoreticalPrice = S * normalCdf(d1) - K * Math.exp(-r * T) * normalCdf(d2);
  } else {
    delta = normalCdf(d1) - 1;
    theoreticalPrice = K * Math.exp(-r * T) * normalCdf(-d2) - S * normalCdf(-d1);
  }

  const gamma = normalPdf(d1) / (S * sigma * Math.sqrt(T));
  const vega = (S * normalPdf(d1) * Math.sqrt(T)) / 100; // 1% change in IV

  let theta: number;
  if (isCall) {
    theta = (- (S * normalPdf(d1) * sigma) / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCdf(d2)) / 365;
  } else {
    theta = (- (S * normalPdf(d1) * sigma) / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normalCdf(-d2)) / 365;
  }

  return {
    delta: Number(delta.toFixed(4)),
    gamma: Number(gamma.toFixed(4)),
    theta: Number(theta.toFixed(4)),
    vega: Number(vega.toFixed(4)),
    theoreticalPrice: Number(Math.max(0.01, theoreticalPrice).toFixed(2)),
  };
}

// Fallback data generator for high-reliability demo mode when Yahoo Finance is unreachable
function generateFallbackOptionChain(ticker: string, targetDateTimestamp?: number) {
  const symbol = ticker.toUpperCase();
  const basePrices: Record<string, { price: number; name: string; iv: number }> = {
    NVDA: { price: 217.49, name: "NVIDIA Corporation", iv: 0.36 },
    AAPL: { price: 232.15, name: "Apple Inc.", iv: 0.22 },
    TSLA: { price: 248.80, name: "Tesla, Inc.", iv: 0.48 },
    SPY: { price: 565.40, name: "SPDR S&P 500 ETF Trust", iv: 0.14 },
    MSFT: { price: 428.60, name: "Microsoft Corporation", iv: 0.24 },
    ORCL: { price: 150.06, name: "Oracle Corporation", iv: 0.32 },
    AMD: { price: 156.30, name: "Advanced Micro Devices, Inc.", iv: 0.41 },
    AMZN: { price: 188.50, name: "Amazon.com, Inc.", iv: 0.28 },
    META: { price: 520.10, name: "Meta Platforms, Inc.", iv: 0.33 },
  };

  const info = basePrices[symbol] || {
    price: 150.0,
    name: `${symbol} Equity`,
    iv: 0.30,
  };

  const S = info.price;
  const now = new Date();
  
  // Generate realistic expiration dates (weekly and monthly)
  const expirationDates: number[] = [];
  for (let days of [7, 14, 21, 30, 45, 60, 90, 120, 180, 365]) {
    const expDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    // set to Friday 4 PM UTC
    const dayOfWeek = expDate.getDay();
    const diff = (5 - dayOfWeek + 7) % 7;
    expDate.setDate(expDate.getDate() + diff);
    expDate.setHours(20, 0, 0, 0);
    const ts = Math.floor(expDate.getTime() / 1000);
    if (!expirationDates.includes(ts)) {
      expirationDates.push(ts);
    }
  }
  expirationDates.sort((a, b) => a - b);

  const selectedTimestamp = targetDateTimestamp && expirationDates.includes(targetDateTimestamp)
    ? targetDateTimestamp
    : expirationDates[3] || expirationDates[0];

  const nowSec = Math.floor(Date.now() / 1000);
  const dte = Math.max(1, Math.round((selectedTimestamp - nowSec) / 86400));
  const T = dte / 365;

  // Generate strike prices around S
  const step = S > 200 ? 5 : S > 50 ? 2.5 : 1;
  const minStrike = Math.floor((S * 0.8) / step) * step;
  const maxStrike = Math.ceil((S * 1.2) / step) * step;

  const strikes: number[] = [];
  for (let k = minStrike; k <= maxStrike; k += step) {
    strikes.push(Number(k.toFixed(2)));
  }

  const calls: any[] = [];
  const puts: any[] = [];

  strikes.forEach((K) => {
    // Volatility smile: IV increases for OTM strikes
    const moneyness = Math.log(K / S);
    const smileIv = info.iv + 0.15 * Math.pow(moneyness, 2);

    const callGreeks = calculateGreeks(true, S, K, T, 0.045, smileIv);
    const putGreeks = calculateGreeks(false, S, K, T, 0.045, smileIv);

    const callMid = Math.max(0.05, callGreeks.theoreticalPrice);
    const putMid = Math.max(0.05, putGreeks.theoreticalPrice);
    const spread = Math.max(0.05, Number((callMid * 0.03).toFixed(2)));

    // Generate call contract
    calls.push({
      contractSymbol: `${symbol}${new Date(selectedTimestamp * 1000).toISOString().slice(2, 10).replace(/-/g, "")}C${String(Math.round(K * 1000)).padStart(8, "0")}`,
      strike: K,
      currency: "USD",
      lastPrice: Number((callMid + (Math.random() * 0.1 - 0.05)).toFixed(2)),
      change: Number(((Math.random() - 0.5) * 0.8).toFixed(2)),
      percentChange: Number(((Math.random() - 0.5) * 8).toFixed(2)),
      volume: Math.floor(100 + Math.random() * 4500),
      openInterest: Math.floor(500 + Math.random() * 9500),
      bid: Number(Math.max(0.01, callMid - spread / 2).toFixed(2)),
      ask: Number((callMid + spread / 2).toFixed(2)),
      impliedVolatility: Number((smileIv * 100).toFixed(1)),
      inTheMoney: S > K,
      delta: callGreeks.delta,
      gamma: callGreeks.gamma,
      theta: callGreeks.theta,
      vega: callGreeks.vega,
    });

    // Generate put contract
    puts.push({
      contractSymbol: `${symbol}${new Date(selectedTimestamp * 1000).toISOString().slice(2, 10).replace(/-/g, "")}P${String(Math.round(K * 1000)).padStart(8, "0")}`,
      strike: K,
      currency: "USD",
      lastPrice: Number((putMid + (Math.random() * 0.1 - 0.05)).toFixed(2)),
      change: Number(((Math.random() - 0.5) * 0.8).toFixed(2)),
      percentChange: Number(((Math.random() - 0.5) * 8).toFixed(2)),
      volume: Math.floor(80 + Math.random() * 3800),
      openInterest: Math.floor(400 + Math.random() * 8500),
      bid: Number(Math.max(0.01, putMid - spread / 2).toFixed(2)),
      ask: Number((putMid + spread / 2).toFixed(2)),
      impliedVolatility: Number((smileIv * 100).toFixed(1)),
      inTheMoney: S < K,
      delta: putGreeks.delta,
      gamma: putGreeks.gamma,
      theta: putGreeks.theta,
      vega: putGreeks.vega,
    });
  });

  return {
    symbol,
    quote: {
      symbol,
      shortName: info.name,
      regularMarketPrice: S,
      regularMarketChange: 0.85,
      regularMarketChangePercent: 0.39,
      regularMarketDayHigh: Number((S * 1.015).toFixed(2)),
      regularMarketDayLow: Number((S * 0.985).toFixed(2)),
      regularMarketVolume: 42500000,
      fiftyTwoWeekHigh: Number((S * 1.25).toFixed(2)),
      fiftyTwoWeekLow: Number((S * 0.72).toFixed(2)),
      marketCap: 2800000000000,
      exchange: "NASDAQ",
    },
    expirationDates,
    selectedExpiration: selectedTimestamp,
    dte,
    strikes,
    options: [
      {
        expirationDate: selectedTimestamp,
        hasMiniOptions: false,
        calls,
        puts,
      },
    ],
    isFallback: true,
  };
}

// Fetch live options chain from Yahoo Finance with fallback support
async function fetchYahooOptionsChain(ticker: string, dateTimestamp?: number) {
  const cleanTicker = ticker.trim().toUpperCase();
  const cacheKey = `${cleanTicker}_${dateTimestamp || "default"}`;

  const cached = optionsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  try {
    const session = await getYahooSession();
    let url = `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(cleanTicker)}`;
    const params = new URLSearchParams();
    if (session.crumb) {
      params.append("crumb", session.crumb);
    }
    if (dateTimestamp) {
      params.append("date", String(dateTimestamp));
    }
    const queryString = params.toString();
    if (queryString) {
      url += `?${queryString}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const headers: Record<string, string> = {
      "User-Agent": userAgent,
      "Accept": "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    };
    if (session.cookie) {
      headers["Cookie"] = session.cookie;
    }

    const response = await fetch(url, {
      signal: controller.signal,
      headers,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Yahoo Finance returned status ${response.status} for ${cleanTicker}. Using calculated option model.`);
      const fallback = generateFallbackOptionChain(cleanTicker, dateTimestamp);
      optionsCache.set(cacheKey, { timestamp: Date.now(), data: fallback });
      return fallback;
    }

    const json: any = await response.json();
    const result = json?.optionChain?.result?.[0];

    if (!result || !result.quote) {
      console.warn(`Yahoo Finance returned empty result for ${cleanTicker}. Using fallback.`);
      const fallback = generateFallbackOptionChain(cleanTicker, dateTimestamp);
      optionsCache.set(cacheKey, { timestamp: Date.now(), data: fallback });
      return fallback;
    }

    const quote = result.quote;
    const S = quote.regularMarketPrice || quote.ask || 100;
    const expirationDates = result.expirationDates || [];
    const selectedExpiration = dateTimestamp || (result.options?.[0]?.expirationDate) || expirationDates[0];

    const nowSec = Math.floor(Date.now() / 1000);
    const dte = Math.max(1, Math.round((selectedExpiration - nowSec) / 86400));
    const T = dte / 365;

    // Process calls and puts, ensuring complete Greeks
    const rawOptions = result.options?.[0] || { calls: [], puts: [] };
    
    const processOption = (opt: any, isCall: boolean) => {
      const strike = opt.strike;
      let iv = opt.impliedVolatility || 0.3;
      if (iv > 5) iv = iv / 100; // normalize percentage if needed

      const greeks = calculateGreeks(isCall, S, strike, T, 0.045, iv > 0 ? iv : 0.3);

      return {
        contractSymbol: opt.contractSymbol,
        strike,
        currency: opt.currency || "USD",
        lastPrice: opt.lastPrice || 0,
        change: opt.change || 0,
        percentChange: opt.percentChange || 0,
        volume: opt.volume || 0,
        openInterest: opt.openInterest || 0,
        bid: opt.bid || 0,
        ask: opt.ask || 0,
        impliedVolatility: Number((iv * 100).toFixed(1)),
        inTheMoney: opt.inTheMoney !== undefined ? opt.inTheMoney : (isCall ? S > strike : S < strike),
        delta: opt.delta !== undefined ? opt.delta : greeks.delta,
        gamma: opt.gamma !== undefined ? opt.gamma : greeks.gamma,
        theta: opt.theta !== undefined ? opt.theta : greeks.theta,
        vega: opt.vega !== undefined ? opt.vega : greeks.vega,
      };
    };

    const calls = (rawOptions.calls || []).map((c: any) => processOption(c, true));
    const puts = (rawOptions.puts || []).map((p: any) => processOption(p, false));

    const processedData = {
      symbol: result.underlyingSymbol || cleanTicker,
      quote: {
        symbol: quote.symbol || cleanTicker,
        shortName: quote.shortName || quote.longName || cleanTicker,
        regularMarketPrice: S,
        regularMarketChange: quote.regularMarketChange || 0,
        regularMarketChangePercent: quote.regularMarketChangePercent || 0,
        regularMarketDayHigh: quote.regularMarketDayHigh || S,
        regularMarketDayLow: quote.regularMarketDayLow || S,
        regularMarketVolume: quote.regularMarketVolume || 0,
        fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh || S * 1.2,
        fiftyTwoWeekLow: quote.fiftyTwoWeekLow || S * 0.8,
        marketCap: quote.marketCap || 0,
        exchange: quote.exchange || "NYSE/NASDAQ",
      },
      expirationDates,
      selectedExpiration,
      dte,
      strikes: result.strikes || [],
      options: [
        {
          expirationDate: selectedExpiration,
          calls,
          puts,
        },
      ],
      isFallback: false,
    };

    optionsCache.set(cacheKey, { timestamp: Date.now(), data: processedData });
    return processedData;
  } catch (err) {
    console.error(`Error querying Yahoo Finance for ${cleanTicker}:`, err);
    const fallback = generateFallbackOptionChain(cleanTicker, dateTimestamp);
    optionsCache.set(cacheKey, { timestamp: Date.now(), data: fallback });
    return fallback;
  }
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Options Chain endpoint
app.get("/api/options/:ticker", async (req, res) => {
  try {
    const { ticker } = req.params;
    const dateParam = req.query.date ? Number(req.query.date) : undefined;
    if (!ticker) {
      return res.status(400).json({ error: "Ticker symbol is required" });
    }

    const data = await fetchYahooOptionsChain(ticker, dateParam);
    return res.json(data);
  } catch (error: any) {
    console.error("API error fetching options:", error);
    return res.status(500).json({ error: error.message || "Failed to fetch options data" });
  }
});

// Ticker search/suggestions
app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "").toUpperCase().trim();
  const POPULAR_TICKERS = [
    { symbol: "NVDA", name: "NVIDIA Corporation", price: 217.49, category: "Semiconductors" },
    { symbol: "AAPL", name: "Apple Inc.", price: 232.15, category: "Mega-Cap Tech" },
    { symbol: "TSLA", name: "Tesla, Inc.", price: 248.80, category: "Automotive/EV" },
    { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", price: 565.40, category: "Indices & ETFs" },
    { symbol: "MSFT", name: "Microsoft Corporation", price: 428.60, category: "Software/Cloud" },
    { symbol: "ORCL", name: "Oracle Corporation", price: 150.06, category: "Enterprise Tech" },
    { symbol: "AMD", name: "Advanced Micro Devices", price: 156.30, category: "Semiconductors" },
    { symbol: "AMZN", name: "Amazon.com, Inc.", price: 188.50, category: "E-Commerce/Cloud" },
    { symbol: "META", name: "Meta Platforms, Inc.", price: 520.10, category: "Social Media" },
    { symbol: "GOOGL", name: "Alphabet Inc.", price: 178.20, category: "Tech & Search" },
    { symbol: "MSTR", name: "MicroStrategy Incorporated", price: 135.40, category: "Crypto Proxy" },
    { symbol: "QQQ", name: "Invesco QQQ Trust", price: 485.20, category: "Indices & ETFs" },
  ];

  if (!q) {
    return res.json(POPULAR_TICKERS);
  }

  const filtered = POPULAR_TICKERS.filter(
    (t) => t.symbol.includes(q) || t.name.toUpperCase().includes(q)
  );

  // If user searched for custom ticker not in quick list, add it as first match
  if (!filtered.some((t) => t.symbol === q) && /^[A-Z0-9.\-]{1,6}$/.test(q)) {
    filtered.unshift({ symbol: q, name: `${q} Stock`, price: 0, category: "Custom" });
  }

  return res.json(filtered);
});

// Clear cache endpoint
app.post("/api/cache/clear", (_req, res) => {
  optionsCache.clear();
  return res.json({ message: "Cache cleared successfully" });
});

// ----------------------------------------------------
// VITE MIDDLEWARE & SERVER STARTUP
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Options Analyzer Terminal] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
