import { getCachedBookValueHistory } from "./alphaVantage";
import { calculateFypm } from "./fypmCalculator";
import { getFiveYearInterestRate } from "./fred";
import { getQuotes, chart } from "./yahooFinance";
import { SP500_TICKERS } from "../data/sp500Tickers";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DataPoint {
  ticker: string;
  date: string;
  price: number;
  fypm_linear: number;
  fypm_derivative: number;
  fypm_rate: number;
  return_30d: number | null;
  return_90d: number | null;
  return_180d: number | null;
}

export interface CorrelationStats {
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

export interface QuartileStats {
  fypmRange: [number, number];
  avg30d: number | null;
  avg90d: number | null;
  avg180d: number | null;
  median30d: number | null;
  median90d: number | null;
  median180d: number | null;
  count: number;
}

export interface QuartileGroup {
  q1: QuartileStats;
  q2: QuartileStats;
  q3: QuartileStats;
  q4: QuartileStats;
}

export interface AnalysisResult {
  sampledDataPoints: DataPoint[];
  correlations: {
    linear: CorrelationStats;
    derivative: CorrelationStats;
    rate: CorrelationStats;
  };
  quartiles: {
    linear: QuartileGroup;
    derivative: QuartileGroup;
    rate: QuartileGroup;
  };
  meta: {
    tickersAnalyzed: number;
    totalDataPoints: number;
    dateRange: { start: string; end: string };
  };
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function pearsonR(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return 0;

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX  += xs[i];
    sumY  += ys[i];
    sumXY += xs[i] * ys[i];
    sumX2 += xs[i] ** 2;
    sumY2 += ys[i] ** 2;
  }

  const num = n * sumXY - sumX * sumY;
  const den = Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  return den === 0 ? 0 : num / den;
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ── Forward-return lookup ─────────────────────────────────────────────────────

interface PriceBar {
  date: string;
  price: number;
  ts: number;
}

function binarySearchFirstAtOrAfter(
  bars: PriceBar[],
  startIdx: number,
  targetTs: number
): number {
  let lo = startIdx;
  let hi = bars.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (bars[mid].ts < targetTs) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function findForwardReturn(
  bars: PriceBar[],
  fromIdx: number,
  daysAhead: number,
  fromPrice: number
): number | null {
  const millisPerDay = 24 * 60 * 60 * 1000;
  const targetTs = bars[fromIdx].ts + daysAhead * millisPerDay;
  const maxScanTs = targetTs + 7 * millisPerDay;

  let best: PriceBar | null = null;
  let bestDiff = Infinity;

  const startSearchIdx = fromIdx + 1;
  if (startSearchIdx >= bars.length) return null;

  const idx = binarySearchFirstAtOrAfter(bars, startSearchIdx, targetTs);

  const prevIdx = idx - 1;
  if (prevIdx >= startSearchIdx) {
    const prevBar = bars[prevIdx];
    if (prevBar.ts <= maxScanTs) {
      bestDiff = Math.abs(prevBar.ts - targetTs);
      best = prevBar;
    }
  }

  for (let j = idx; j < bars.length; j++) {
    const bar = bars[j];
    if (bar.ts > maxScanTs) break;
    const diff = Math.abs(bar.ts - targetTs);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = bar;
    }
  }

  if (!best) return null;
  if (bestDiff > 10 * millisPerDay) return null;
  return ((best.price - fromPrice) / fromPrice) * 100;
}

// ── Correlation computation ───────────────────────────────────────────────────

function computeCorrelations(
  points: DataPoint[],
  fypmKey: "fypm_linear" | "fypm_derivative" | "fypm_rate"
): CorrelationStats {
  const valid30 = points.filter(p => p.return_30d  !== null);
  const valid90 = points.filter(p => p.return_90d  !== null);
  const valid180 = points.filter(p => p.return_180d !== null);

  const r30  = pearsonR(valid30.map(p => p[fypmKey]),  valid30.map(p => p.return_30d!)  );
  const r90  = pearsonR(valid90.map(p => p[fypmKey]),  valid90.map(p => p.return_90d!)  );
  const r180 = pearsonR(valid180.map(p => p[fypmKey]), valid180.map(p => p.return_180d!));

  return {
    r30d:   r30,
    r90d:   r90,
    r180d:  r180,
    r2_30d:  r30  ** 2,
    r2_90d:  r90  ** 2,
    r2_180d: r180 ** 2,
    n30d:   valid30.length,
    n90d:   valid90.length,
    n180d:  valid180.length,
  };
}

// ── Quartile computation ──────────────────────────────────────────────────────

function buildQuartileStatsByKey(
  bucket: DataPoint[],
  fypmKey: "fypm_linear" | "fypm_derivative" | "fypm_rate"
): QuartileStats {
  if (bucket.length === 0) {
    return { fypmRange: [0, 0], avg30d: null, avg90d: null, avg180d: null, median30d: null, median90d: null, median180d: null, count: 0 };
  }
  const fypmVals = bucket.map(p => p[fypmKey]);
  const r30  = bucket.filter(p => p.return_30d  !== null).map(p => p.return_30d!);
  const r90  = bucket.filter(p => p.return_90d  !== null).map(p => p.return_90d!);
  const r180 = bucket.filter(p => p.return_180d !== null).map(p => p.return_180d!);
  return {
    fypmRange: [
      fypmVals.reduce((m, v) => v < m ? v : m, Infinity),
      fypmVals.reduce((m, v) => v > m ? v : m, -Infinity),
    ],
    avg30d:    avg(r30),
    avg90d:    avg(r90),
    avg180d:   avg(r180),
    median30d: median(r30),
    median90d: median(r90),
    median180d:median(r180),
    count:     bucket.length,
  };
}

function computeQuartileGroup(
  points: DataPoint[],
  fypmKey: "fypm_linear" | "fypm_derivative" | "fypm_rate"
): QuartileGroup {
  const sorted = [...points].sort((a, b) => a[fypmKey] - b[fypmKey]);
  const n = sorted.length;
  const q = Math.floor(n / 4);
  return {
    q1: buildQuartileStatsByKey(sorted.slice(0,        q),     fypmKey),
    q2: buildQuartileStatsByKey(sorted.slice(q,        q * 2), fypmKey),
    q3: buildQuartileStatsByKey(sorted.slice(q * 2,    q * 3), fypmKey),
    q4: buildQuartileStatsByKey(sorted.slice(q * 3),           fypmKey),
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runFypmBacktest(
  tickerParam: "all" | string[],
  months: number,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const universe = tickerParam === "all" ? SP500_TICKERS : tickerParam;

  // 1. Filter to tickers that have cached book values
  const tickersWithData = universe.filter(t => getCachedBookValueHistory(t) !== null);

  console.log(`[Analysis] Processing ${tickersWithData.length} tickers (${months} months lookback)...`);

  // 2. Batch-fetch current quotes for dividend yields
  const QUOTE_BATCH_SIZE = 100;
  const allQuotes: Awaited<ReturnType<typeof getQuotes>> = [];
  for (let i = 0; i < tickersWithData.length; i += QUOTE_BATCH_SIZE) {
    const batch = tickersWithData.slice(i, i + QUOTE_BATCH_SIZE);
    try {
      const batchQuotes = await getQuotes(batch);
      if (batchQuotes && batchQuotes.length) {
        allQuotes.push(...batchQuotes);
      }
    } catch (err) {
      console.error(
        `[Analysis] Failed to fetch quotes for batch ${Math.floor(i / QUOTE_BATCH_SIZE) + 1} (${batch.length} tickers):`,
        err
      );
    }
  }
  const quoteMap = new Map(allQuotes.map(q => [q.symbol, q]));

  // 3. Single interest rate call
  const interestRate = await getFiveYearInterestRate();

  // 4. Date range setup
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - months);
  const now = Date.now();
  const cutoff180 = now - 180 * 24 * 60 * 60 * 1000;

  const allDataPoints: DataPoint[] = [];
  const CONCURRENCY = 5;

  // 5. Process tickers with concurrency limiting
  let tickerIndex = 0;
  let processedCount = 0;

  async function processTicker(ticker: string): Promise<void> {
    try {
      if (signal?.aborted) return;

      const bookValues = getCachedBookValueHistory(ticker);
      if (!bookValues) return;

      const quote = quoteMap.get(ticker);
      const divYield = quote?.dividend_yield ?? 0;

      // Fetch full daily price history (not downsampled)
      const result = await chart(ticker, {
        period1: startDate,
        period2: new Date(),
        interval: "1d",
      });

      if (signal?.aborted) return;

      const rawQuotes = result.quotes ?? [];
      if (rawQuotes.length < 30) return;

      // Build sorted price bar array
      const bars: PriceBar[] = rawQuotes
        .map(q => {
          const d = new Date(q.date);
          const price = (q as { adjclose?: number | null; close?: number | null }).adjclose
            ?? (q as { close?: number | null }).close
            ?? 0;
          return { date: d.toISOString().split("T")[0], price, ts: d.getTime() };
        })
        .filter(b => b.price > 0);

      if (bars.length < 30) return;

      // For each date with at least 180 days of future data
      for (let i = 0; i < bars.length; i++) {
        if (signal?.aborted) return;

        const bar = bars[i];

        // Skip dates within the last 180 days (no 180d return possible)
        if (bar.ts > cutoff180) break;

        // Calculate FYPM using this bar's price + current book values + current rates
        const fypm = calculateFypm(bookValues, divYield, bar.price, interestRate);
        if (
          fypm.derivative_fypm === "N/A" ||
          fypm.linear_fypm === "N/A" ||
          fypm.rate_fypm === "N/A"
        ) continue;

        const ret30d  = findForwardReturn(bars, i, 30,  bar.price);
        const ret90d  = findForwardReturn(bars, i, 90,  bar.price);
        const ret180d = findForwardReturn(bars, i, 180, bar.price);

        allDataPoints.push({
          ticker,
          date:            bar.date,
          price:           bar.price,
          fypm_linear:     fypm.linear_fypm as number,
          fypm_derivative: fypm.derivative_fypm as number,
          fypm_rate:       fypm.rate_fypm as number,
          return_30d:      ret30d,
          return_90d:      ret90d,
          return_180d:     ret180d,
        });
      }
    } catch (err) {
      console.error(`[Analysis] Error processing ${ticker}:`, err);
    }
  }

  async function worker(): Promise<void> {
    // JavaScript is single-threaded: tickerIndex++ is safe across concurrent async workers
    while (tickerIndex < tickersWithData.length) {
      if (signal?.aborted) break;
      const idx = tickerIndex++;
      const ticker = tickersWithData[idx];
      await processTicker(ticker);
      processedCount++;
      if (processedCount % 20 === 0) {
        console.log(`[Analysis] Progress: ${processedCount}/${tickersWithData.length} tickers processed, ${allDataPoints.length} data points so far`);
      }
    }
  }

  await Promise.allSettled(Array.from({ length: CONCURRENCY }, () => worker()));

  console.log(`[Analysis] Done. ${tickersWithData.length} tickers → ${allDataPoints.length} data points`);

  // 6. Compute correlations
  const correlations = {
    linear:     computeCorrelations(allDataPoints, "fypm_linear"),
    derivative: computeCorrelations(allDataPoints, "fypm_derivative"),
    rate:       computeCorrelations(allDataPoints, "fypm_rate"),
  };

  // 7. Compute quartiles
  const quartiles = {
    linear:     computeQuartileGroup(allDataPoints, "fypm_linear"),
    derivative: computeQuartileGroup(allDataPoints, "fypm_derivative"),
    rate:       computeQuartileGroup(allDataPoints, "fypm_rate"),
  };

  // 8. Sample data points for the response (cap at 2000 to avoid huge payloads)
  const MAX_RESPONSE_POINTS = 2000;
  const sampledDataPoints: DataPoint[] =
    allDataPoints.length <= MAX_RESPONSE_POINTS
      ? allDataPoints
      : Array.from(
          { length: MAX_RESPONSE_POINTS },
          (_, i) => allDataPoints[Math.floor((i * allDataPoints.length) / MAX_RESPONSE_POINTS)]
        );

  // 9. Meta
  const sortedDates = allDataPoints.map(d => d.date).sort();

  return {
    sampledDataPoints,
    correlations,
    quartiles,
    meta: {
      tickersAnalyzed:  tickersWithData.length,
      totalDataPoints:  allDataPoints.length,
      dateRange: {
        start: sortedDates[0]                   ?? "",
        end:   sortedDates[sortedDates.length - 1] ?? "",
      },
    },
  };
}
