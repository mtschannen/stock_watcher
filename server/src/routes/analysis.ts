import { Router, Request, Response } from "express";
import { runFypmBacktest } from "../services/fypmHistoricalAnalysis";

const router = Router();

/**
 * GET /api/analysis/fypm-backtest
 *
 * Query params:
 *   months  — number (default 24, max 36)
 *   tickers — "all" | comma-separated list  (default "all")
 */
router.get("/fypm-backtest", async (req: Request, res: Response) => {
  try {
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

    const result = await runFypmBacktest(tickers, months);
    res.json(result);
  } catch (err) {
    console.error("[Analysis] Route error:", err);
    res.status(500).json({ error: "Analysis failed", details: String(err) });
  }
});

export default router;
