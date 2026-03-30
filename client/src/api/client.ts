import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export interface MarketStock {
  ticker: string;
  company_name: string;
  price: number;
  change: number;
  change_pct: string;
  dividend_yield: number;
  prev_close: number;
}

export interface FypmBatchItem {
  ticker: string;
  derivative_fypm: number | null;
  linear_fypm: number | null;
  rate_fypm: number | null;
  daily_change: number | null;
  change_30d: number | null;
}

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

export interface FypmData {
  derivative_fypm: number | "N/A";
  linear_fypm: number | "N/A";
  rate_fypm: number | "N/A";
  derivative_change: number | null;
  linear_change: number | null;
  rate_change: number | null;
}

export interface MarketInfo {
  ticker: string;
  quote: StockQuote;
  fypm: FypmData;
}

export interface HistoricalPoint {
  date: string;
  adjClose: number;
  derivative_fypm: number | null;
  linear_fypm: number | null;
  rate_fypm: number | null;
}

export interface TickerItem {
  label: string;
  symbol: string;
  last_trade_price: number;
  change: number;
  change_in_percent: string;
}

export interface Resource {
  title: string;
  url: string;
  description: string;
}

// Market (S&P 500 — no auth required)
export const getMarketQuotes = () => api.get<MarketStock[]>("/market/quotes");
export const getMarketFypmBatch = () => api.get<FypmBatchItem[]>("/market/fypm-batch");
export const getMarketInfo = (ticker: string) =>
  api.get<MarketInfo>(`/market/${ticker}/info`);
export const getMarketGraph = (ticker: string, months: number) =>
  api.get<HistoricalPoint[]>(`/market/${ticker}/graph?num_months=${months}`);

// Ticker tape
export const getTickerTape = () => api.get<TickerItem[]>("/stocks/ticker/tape");

// Alpha Vantage diagnostics
export interface AlphaVantageStatus {
  dailyCallCount: number;
  dailyLimit: number;
  remainingCalls: number;
  cacheSize: number;
  cacheEntries: { ticker: string; ageMs: number; expiresAt: number }[];
  lastRateLimited: boolean;
  lastCallTimestamp: string | null;
}
export const getAlphaVantageStatus = () =>
  api.get<AlphaVantageStatus>("/alpha-vantage/status");

// Resources
export const getResources = () => api.get<Resource[]>("/resources");

// FYPM Analysis
export interface FypmDataPoint {
  ticker: string;
  date: string;
  price: number;
  fypm_linear: number;
  fypm_derivative: number;
  fypm_rate: number;
  fypm_composite: number | null;
  return_30d: number | null;
  return_90d: number | null;
  return_180d: number | null;
}

export interface FypmCorrelationStats {
  r30d: number;
  r90d: number;
  r180d: number;
  r2_30d: number;
  r2_90d: number;
  r2_180d: number;
  n30d: number;
  n90d: number;
  n180d: number;
}

export interface FypmQuartileStats {
  fypmRange: [number, number];
  avg30d: number | null;
  avg90d: number | null;
  avg180d: number | null;
  median30d: number | null;
  median90d: number | null;
  median180d: number | null;
  count: number;
}

export interface FypmAnalysisResult {
  dataPoints: FypmDataPoint[];
  correlations: {
    linear: FypmCorrelationStats;
    derivative: FypmCorrelationStats;
    rate: FypmCorrelationStats;
    composite: FypmCorrelationStats;
  };
  quartiles: {
    linear: { q1: FypmQuartileStats; q2: FypmQuartileStats; q3: FypmQuartileStats; q4: FypmQuartileStats };
    derivative: { q1: FypmQuartileStats; q2: FypmQuartileStats; q3: FypmQuartileStats; q4: FypmQuartileStats };
    rate: { q1: FypmQuartileStats; q2: FypmQuartileStats; q3: FypmQuartileStats; q4: FypmQuartileStats };
    composite: { q1: FypmQuartileStats; q2: FypmQuartileStats; q3: FypmQuartileStats; q4: FypmQuartileStats };
  };
  meta: {
    tickersAnalyzed: number;
    totalDataPoints: number;
    dateRange: { start: string; end: string };
  };
}

export const getFypmBacktest = (months = 24, tickers: "all" | string = "all") =>
  api.get<FypmAnalysisResult>(`/analysis/fypm-backtest?months=${months}&tickers=${tickers}`);

// Stocks (authenticated)
export const createStock = (formData: FormData) =>
  api.post("/stocks", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
