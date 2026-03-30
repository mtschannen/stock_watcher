import { Router, Request, Response } from "express";
import { runFypmBacktest, AnalysisResult } from "../services/fypmHistoricalAnalysis";

const router = Router();

// ── In-memory cache ────────────────────────────────────────────────────────────
// Note: This cache is per-process. In a clustered/multi-process deployment
// each worker maintains its own cache. Run a single instance or use a
// shared store (e.g., Redis) if multi-process cache coherency is required.
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const CACHE_MAX_SIZE = 20;            // evict oldest entries beyond this limit
const cache = new Map<string, { result: AnalysisResult; expiry: number }>();

function cacheSet(key: string, value: { result: AnalysisResult; expiry: number }): void {
  cache.delete(key); // ensure key is re-inserted at end for correct LRU eviction order
  cache.set(key, value);
  if (cache.size > CACHE_MAX_SIZE) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
}

// ── Concurrency guard ─────────────────────────────────────────────────────────
let analysisInProgress = false;

// ── Request timeout (5 minutes) ───────────────────────────────────────────────
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * GET /api/analysis/fypm-backtest
 *
 * Query params:
 *   months  — number (default 24, max 36)
 *   tickers — "all" | comma-separated list  (default "all")
 */
router.get("/fypm-backtest", async (req: Request, res: Response) => {
  const months = Math.min(36, Math.max(1, parseInt(String(req.query.months ?? "24")) || 24));

  const tickersParam = req.query.tickers;
  let tickers: "all" | string[];
  if (!tickersParam || tickersParam === "all") {
    tickers = "all";
  } else {
    tickers = String(tickersParam)
      .split(",")
      .map(t => t.trim().toUpperCase())
      .filter(Boolean);
  }

  const cacheKey = `${Array.isArray(tickers) ? tickers.join(",") : tickers}:${months}`;

  // Serve from cache if available
  const cached = cache.get(cacheKey);
  if (cached && cached.expiry > Date.now()) {
    return res.json(cached.result);
  }

  // Reject if another analysis is already running
  if (analysisInProgress) {
    return res.status(429).json({
      error: "An analysis is already in progress. Please try again shortly.",
    });
  }

  // Set a request-level timeout so the HTTP connection doesn't hang indefinitely.
  // The AbortController signal is passed into runFypmBacktest so it stops processing
  // tickers as soon as the timeout fires.
  const abortController = new AbortController();
  const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
    abortController.abort();
    if (!res.headersSent) {
      res.status(503).json({
        error: "Analysis timed out. Try a shorter lookback period or fewer tickers.",
      });
    }
  }, REQUEST_TIMEOUT_MS);

  analysisInProgress = true;
  try {
    const result = await runFypmBacktest(tickers, months, abortController.signal);
    if (!abortController.signal.aborted) {
      cacheSet(cacheKey, { result, expiry: Date.now() + CACHE_TTL_MS });
    }
    if (!res.headersSent) {
      res.json(result);
    }
  } catch (err) {
    console.error("[Analysis] Route error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Analysis failed" });
    }
  } finally {
    clearTimeout(timeoutId);
    analysisInProgress = false;
  }
});

export default router;
