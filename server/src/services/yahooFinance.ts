import axios from "axios";

const YAHOO_FINANCE_BASE = "https://query1.finance.yahoo.com/v8/finance";

interface QuoteResult {
  symbol: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketOpen: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketPreviousClose: number;
  trailingAnnualDividendYield: number;
}

export interface StockQuote {
  symbol: string;
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
    const symbolStr = symbols.join(",");
    const response = await axios.get(
      `${YAHOO_FINANCE_BASE}/quote?symbols=${encodeURIComponent(symbolStr)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      }
    );

    const results: QuoteResult[] =
      response.data?.quoteResponse?.result || [];
    return results.map((q) => ({
      symbol: q.symbol,
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
    const endDate = Math.floor(Date.now() / 1000);
    const startDate = Math.floor(
      (Date.now() - months * 30 * 24 * 60 * 60 * 1000) / 1000
    );

    const response = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${startDate}&period2=${endDate}&interval=1d`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      }
    );

    const result = response.data?.chart?.result?.[0];
    if (!result) return [];

    const timestamps: number[] = result.timestamp || [];
    const closes: number[] =
      result.indicators?.adjclose?.[0]?.adjclose ||
      result.indicators?.quote?.[0]?.close ||
      [];

    const data: HistoricalDataPoint[] = [];
    const totalPoints = timestamps.length;
    const step = Math.max(1, Math.floor(totalPoints / 150));

    for (let i = 0; i < totalPoints; i++) {
      if (step <= 1 || i % step === 0) {
        if (timestamps[i] && closes[i] != null) {
          const date = new Date(timestamps[i] * 1000);
          data.push({
            date: date.toISOString().split("T")[0],
            adjClose: closes[i],
          });
        }
      }
    }

    return data;
  } catch (err) {
    console.error("Yahoo Finance historical data error:", err);
    return [];
  }
}
