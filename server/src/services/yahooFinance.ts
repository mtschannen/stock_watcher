import YahooFinance from "yahoo-finance2";

const yf = new YahooFinance({ suppressNotices: ["ripHistorical"] });

export interface StockQuote {
  symbol: string;
  company_name: string;
  last_trade_price: number;
  change: number;
  change_in_percent: string;
  open: number;
  high: number;
  low: number;
  close: number;
  dividend_yield: number;
}

export interface HistoricalDataPoint {
  date: string;
  adjClose: number;
}

export async function getQuotes(symbols: string[]): Promise<StockQuote[]> {
  try {
    const quotes = await yf.quote(symbols);
    return quotes.map((q) => ({
      symbol: q.symbol || "",
      company_name: q.longName || q.shortName || q.symbol || "",
      last_trade_price: q.regularMarketPrice || 0,
      change: q.regularMarketChange || 0,
      change_in_percent: `${(q.regularMarketChangePercent || 0).toFixed(2)}%`,
      open: q.regularMarketOpen || 0,
      high: q.regularMarketDayHigh || 0,
      low: q.regularMarketDayLow || 0,
      close: q.regularMarketPreviousClose || 0,
      dividend_yield: (q.trailingAnnualDividendYield || 0) * 100,
    }));
  } catch (err) {
    console.error("Yahoo Finance quote error:", err);
    return symbols.map((s) => ({
      symbol: s,
      company_name: "",
      last_trade_price: 0,
      change: 0,
      change_in_percent: "0.00%",
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      dividend_yield: 0,
    }));
  }
}

const price30dCache = new Map<string, { price: number; expiresAt: number }>();

/** Returns the cached ~30-day-ago price synchronously — never triggers an API call. */
export function getCachedPrice30DaysAgo(symbol: string): number | null {
  const now = Date.now();
  const cached = price30dCache.get(symbol);
  return cached && cached.expiresAt > now ? cached.price : null;
}

/** Fetches the closing price from ~30 days ago (window: 35–28 days ago). Caches 24 h. */
export async function getPrice30DaysAgo(symbol: string): Promise<number | null> {
  const now = Date.now();
  const cached = price30dCache.get(symbol);
  if (cached && cached.expiresAt > now) return cached.price;

  try {
    const period2 = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
    const period1 = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    const result = await yf.chart(symbol, { period1, period2, interval: "1d" });
    const quotes = result.quotes ?? [];
    if (!quotes.length) return null;
    const last = quotes[quotes.length - 1];
    const price = last.adjclose ?? last.close ?? null;
    if (!price) return null;
    price30dCache.set(symbol, { price, expiresAt: now + 24 * 60 * 60 * 1000 });
    return price;
  } catch {
    return null;
  }
}

export async function isValidTicker(symbol: string): Promise<boolean> {
  try {
    const quotes = await getQuotes([symbol]);
    return quotes.length > 0 && quotes[0].last_trade_price > 0;
  } catch {
    return false;
  }
}

export async function getHistoricalData(
  symbol: string,
  months: number
): Promise<HistoricalDataPoint[]> {
  try {
    const endDate = new Date();
    const startDate = new Date(
      Date.now() - months * 30 * 24 * 60 * 60 * 1000
    );

    const result = await yf.chart(symbol, {
      period1: startDate,
      period2: endDate,
      interval: "1d",
    });

    const quotes = result.quotes ?? [];
    const totalPoints = quotes.length;
    const step = Math.max(1, Math.floor(totalPoints / 150));

    return quotes
      .filter((_point, i) => step <= 1 || i % step === 0)
      .map((point) => ({
        date: new Date(point.date).toISOString().split("T")[0],
        adjClose: point.adjclose ?? point.close ?? 0,
      }));
  } catch (err) {
    console.error("Yahoo Finance chart data error:", err);
    return [];
  }
}
