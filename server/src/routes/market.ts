import { Router, Request, Response } from "express";
import { getQuotes, getHistoricalData, getPrice30DaysAgo, getCachedPrice30DaysAgo } from "../services/yahooFinance";
import { getBookValueHistory, getCachedBookValueHistory } from "../services/alphaVantage";
import { getFiveYearInterestRate } from "../services/fred";
import { calculateFypm } from "../services/fypmCalculator";
import { SP500_TICKERS } from "../data/sp500Tickers";

const router = Router();

const BATCH_SIZE = 100;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedQuotes {
  data: ReturnType<typeof buildQuoteItem>[];
  expiresAt: number;
}

function buildQuoteItem(q: Awaited<ReturnType<typeof getQuotes>>[number]) {
  return {
    ticker: q.symbol,
    company_name: q.company_name,
    price: q.last_trade_price,
    change: q.change,
    change_pct: q.change_in_percent,
    dividend_yield: q.dividend_yield,
    prev_close: q.close,
  };
}

let quotesCache: CachedQuotes | null = null;

// ── FYPM Batch ────────────────────────────────────────────────────────────────

interface FypmBatchItem {
  ticker: string;
  derivative_fypm: number | null;
  linear_fypm: number | null;
  rate_fypm: number | null;
  daily_change: number | null;
  change_30d: number | null;
}

interface FypmBatchCache {
  data: FypmBatchItem[];
  expiresAt: number;
}

let fypmBatchCache: FypmBatchCache | null = null;
const FYPM_BATCH_TTL = 60 * 1000; // 60 s — short so prewarm progress shows quickly

// Background task: pre-warm Alpha Vantage (book values) and 30d price caches.
// Rate is controlled by AV_RATE_DELAY_MS (default 12 000 ms = 5 req/min, free tier safe).
// Set AV_RATE_DELAY_MS=800 for premium keys (~75 req/min).
const AV_DELAY_MS = parseInt(process.env.AV_RATE_DELAY_MS ?? "12000", 10);

(async () => {
  for (const ticker of SP500_TICKERS) {
    try {
      // Parallel: book value (Alpha Vantage) + 30d price (Yahoo Finance).
      // getCachedX returns instantly if already warm; only uncached tickers hit the network.
      await Promise.all([
        getBookValueHistory(ticker),
        getPrice30DaysAgo(ticker),
      ]);
    } catch { /* ignore individual failures */ }
    await new Promise<void>((r) => setTimeout(r, AV_DELAY_MS));
  }
})();

async function fetchAllQuotes() {
  const results: ReturnType<typeof buildQuoteItem>[] = [];
  for (let i = 0; i < SP500_TICKERS.length; i += BATCH_SIZE) {
    const batch = SP500_TICKERS.slice(i, i + BATCH_SIZE);
    try {
      const quotes = await getQuotes(batch);
      results.push(...quotes.filter((q) => q.last_trade_price > 0).map(buildQuoteItem));
    } catch {
      // skip failed batch
    }
  }
  return results;
}

// GET /api/market/fypm-batch — FYPM for all S&P 500 tickers (cache-only, 15 min TTL)
// Uses only in-memory cached data so the response is always fast.
// Values are null for tickers whose book-value cache hasn't been populated yet.
router.get("/fypm-batch", async (_req: Request, res: Response) => {
  const now = Date.now();
  if (fypmBatchCache && now < fypmBatchCache.expiresAt) {
    return res.json(fypmBatchCache.data);
  }

  try {
    // Fetch quotes in batches (uses existing 5-min quote cache when warm).
    const quoteMap = new Map<string, { dividend_yield: number; price: number; prev_close: number }>();
    for (let i = 0; i < SP500_TICKERS.length; i += BATCH_SIZE) {
      const batch = SP500_TICKERS.slice(i, i + BATCH_SIZE);
      try {
        const quotes = await getQuotes(batch);
        for (const q of quotes) {
          if (q.last_trade_price > 0) {
            quoteMap.set(q.symbol, {
              dividend_yield: q.dividend_yield,
              price: q.last_trade_price,
              prev_close: q.close,
            });
          }
        }
      } catch { /* skip failed batch */ }
    }

    const interestRate = await getFiveYearInterestRate();

    const data: FypmBatchItem[] = SP500_TICKERS.map((ticker) => {
      const q = quoteMap.get(ticker);
      const bookValues = getCachedBookValueHistory(ticker);
      const price30d = getCachedPrice30DaysAgo(ticker);

      if (!q || !bookValues) {
        return { ticker, derivative_fypm: null, linear_fypm: null, rate_fypm: null, daily_change: null, change_30d: null };
      }

      const fypmNow  = calculateFypm(bookValues, q.dividend_yield, q.price,      interestRate);
      const fypmYest = calculateFypm(bookValues, q.dividend_yield, q.prev_close,  interestRate);

      const derNow  = typeof fypmNow.derivative_fypm  === "number" ? fypmNow.derivative_fypm  : null;
      const linNow  = typeof fypmNow.linear_fypm      === "number" ? fypmNow.linear_fypm      : null;
      const rateNow = typeof fypmNow.rate_fypm        === "number" ? fypmNow.rate_fypm        : null;
      const derYest = typeof fypmYest.derivative_fypm === "number" ? fypmYest.derivative_fypm : null;

      const daily_change = derNow !== null && derYest !== null ? derNow - derYest : null;

      let change_30d: number | null = null;
      if (price30d !== null && derNow !== null) {
        const fypm30d = calculateFypm(bookValues, q.dividend_yield, price30d, interestRate);
        const der30d  = typeof fypm30d.derivative_fypm === "number" ? fypm30d.derivative_fypm : null;
        if (der30d !== null) change_30d = derNow - der30d;
      }

      return { ticker, derivative_fypm: derNow, linear_fypm: linNow, rate_fypm: rateNow, daily_change, change_30d };
    });

    fypmBatchCache = { data, expiresAt: now + FYPM_BATCH_TTL };
    res.json(data);
  } catch (err) {
    console.error("Error computing FYPM batch:", err);
    res.status(500).json({ error: "Failed to compute FYPM batch" });
  }
});

// GET /api/market/quotes — all S&P 500 market quotes (cached 5 min)
router.get("/quotes", async (_req: Request, res: Response) => {
  const now = Date.now();
  if (quotesCache && now < quotesCache.expiresAt) {
    return res.json(quotesCache.data);
  }
  try {
    const data = await fetchAllQuotes();
    quotesCache = { data, expiresAt: now + CACHE_TTL };
    res.json(data);
  } catch (err) {
    console.error("Error fetching market quotes:", err);
    res.status(500).json({ error: "Failed to fetch market quotes" });
  }
});

// GET /api/market/:ticker/fypm-stats?months=24
// Returns per-ticker FYPM historical statistics (mean, std, z-score of current value).
// Used by the stock detail page to show FYPM stickiness / mean-reversion context.
router.get("/:ticker/fypm-stats", async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const months = Math.min(36, Math.max(3, parseInt(String(req.query.months ?? "24")) || 24));

    const [data, bookValues, interestRate, quotes] = await Promise.all([
      getHistoricalData(ticker, months),
      Promise.resolve(getCachedBookValueHistory(ticker)),
      getFiveYearInterestRate(),
      getQuotes([ticker]),
    ]);

    if (!data.length || !bookValues) {
      return res.status(503).json({ error: "Book value data not yet cached for this ticker; please try again once data has been loaded" });
    }

    const dividendYield = quotes[0]?.dividend_yield ?? 0;
    const currentPrice  = quotes[0]?.last_trade_price ?? 0;

    // Build historical linear FYPM series
    const fypmSeries: number[] = [];
    for (const d of data) {
      const fypm = calculateFypm(bookValues, dividendYield, d.adjClose, interestRate);
      if (typeof fypm.linear_fypm === "number") {
        fypmSeries.push(fypm.linear_fypm);
      }
    }

    if (fypmSeries.length < 5) {
      return res.status(404).json({ error: "Insufficient FYPM history" });
    }

    const mean     = fypmSeries.reduce((s, v) => s + v, 0) / fypmSeries.length;
    const variance = fypmSeries.reduce((s, v) => s + (v - mean) ** 2, 0) / fypmSeries.length;
    const std      = Math.sqrt(variance);
    let cv = 0;
    if (mean !== 0) {
      const rawCv = std / Math.abs(mean);
      if (Number.isFinite(rawCv)) {
        cv = rawCv;
      }
    }

    let currentFypm: number | null = null;
    if (currentPrice > 0) {
      const f = calculateFypm(bookValues, dividendYield, currentPrice, interestRate);
      if (typeof f.linear_fypm === "number") currentFypm = f.linear_fypm;
    }

    const zScore     = currentFypm !== null && std > 0 ? (currentFypm - mean) / std : null;
    const below      = currentFypm !== null ? fypmSeries.filter(v => v <= currentFypm!).length : null;
    const percentile = below !== null ? (below / fypmSeries.length) * 100 : null;

    const histMin = fypmSeries.reduce((m, v) => v < m ? v : m, Infinity);
    const histMax = fypmSeries.reduce((m, v) => v > m ? v : m, -Infinity);

    res.json({
      ticker,
      variant:      "linear",
      mean:         +mean.toFixed(3),
      std:          +std.toFixed(3),
      cv:           +cv.toFixed(3),
      currentFypm:  currentFypm !== null ? +currentFypm.toFixed(3) : null,
      zScore:       zScore     !== null ? +zScore.toFixed(2)      : null,
      percentile:   percentile !== null ? +percentile.toFixed(1)  : null,
      historicalMin: +histMin.toFixed(3),
      historicalMax: +histMax.toFixed(3),
      dataPoints:   fypmSeries.length,
      lookbackMonths: months,
    });
  } catch (err) {
    console.error("Error computing FYPM stats:", err);
    res.status(500).json({ error: "Failed to compute FYPM stats" });
  }
});

// GET /api/market/:ticker/info — quote + FYPM for a specific ticker
router.get("/:ticker/info", async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const quotes = await getQuotes([ticker]);
    if (!quotes.length || quotes[0].last_trade_price === 0) {
      return res.status(404).json({ error: "Ticker not found" });
    }
    const quote = quotes[0];

    const bookValues = await getBookValueHistory(ticker);
    const interestRate = await getFiveYearInterestRate();

    let fypm = {
      derivative_fypm: "N/A" as number | "N/A",
      linear_fypm: "N/A" as number | "N/A",
      rate_fypm: "N/A" as number | "N/A",
      derivative_change: null as number | null,
      linear_change: null as number | null,
      rate_change: null as number | null,
    };

    if (bookValues) {
      const result = calculateFypm(
        bookValues,
        quote.dividend_yield,
        quote.last_trade_price,
        interestRate
      );
      fypm.derivative_fypm = result.derivative_fypm;
      fypm.linear_fypm = result.linear_fypm;
      fypm.rate_fypm = result.rate_fypm;
    }

    res.json({ ticker, quote, fypm });
  } catch (err) {
    console.error("Error fetching market info:", err);
    res.status(500).json({ error: "Failed to fetch info" });
  }
});

// GET /api/market/:ticker/graph — historical price + FYPM overlay
router.get("/:ticker/graph", async (req: Request, res: Response) => {
  try {
    const ticker = req.params.ticker.toUpperCase();
    const months = parseInt((req.query.num_months as string) || "3");

    const [data, bookValues, interestRate, quotes] = await Promise.all([
      getHistoricalData(ticker, months),
      getBookValueHistory(ticker),
      getFiveYearInterestRate(),
      getQuotes([ticker]),
    ]);

    const dividendYield = quotes[0]?.dividend_yield ?? 0;

    const result = data.map((d) => {
      if (!bookValues) {
        return { ...d, derivative_fypm: null, linear_fypm: null, rate_fypm: null };
      }
      const fypm = calculateFypm(bookValues, dividendYield, d.adjClose, interestRate);
      return {
        ...d,
        derivative_fypm: typeof fypm.derivative_fypm === "number" ? fypm.derivative_fypm : null,
        linear_fypm: typeof fypm.linear_fypm === "number" ? fypm.linear_fypm : null,
        rate_fypm: typeof fypm.rate_fypm === "number" ? fypm.rate_fypm : null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Error fetching market graph:", err);
    res.status(500).json({ error: "Failed to fetch graph data" });
  }
});

export default router;
