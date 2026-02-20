import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middleware/auth";
import {
  findStocksByUserId,
  findStockById,
  findStockByTickerAndUser,
  createStock,
  deleteStock,
} from "../models/Stock";
import { getLatestFypmByTicker } from "../models/StockDatum";
import {
  getQuotes,
  isValidTicker,
  getHistoricalData,
} from "../services/yahooFinance";
import { getBookValueHistory } from "../services/quandl";
import { getFiveYearInterestRate } from "../services/fred";
import { calculateFypm } from "../services/fypmCalculator";
import { runDataCollection } from "../jobs/updateStockData";

const router = Router();

// Set up multer for file uploads
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|svg/;
    const extOk = allowed.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimeOk = allowed.test(file.mimetype);
    cb(null, extOk && mimeOk);
  },
});

// GET /api/stocks - list all stocks for current user
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session.currentUserId!;
    const stocks = await findStocksByUserId(userId);

    // Get change data for each stock
    if (stocks.length > 0) {
      const tickers = stocks.map((s) => s.ticker_symbol);
      const quotes = await getQuotes(tickers);

      const stocksWithChange = stocks.map((stock, i) => ({
        ...stock,
        change: quotes[i]?.change || 0,
      }));

      return res.json(stocksWithChange);
    }

    res.json([]);
  } catch (err) {
    console.error("Error fetching stocks:", err);
    res.status(500).json({ error: "Failed to fetch stocks" });
  }
});

// POST /api/stocks - create a new stock
router.post(
  "/",
  requireAuth,
  upload.single("stock_logo"),
  async (req: Request, res: Response) => {
    try {
      const tickerSymbol = (req.body.ticker_symbol || "").toUpperCase();
      const companyName = req.body.company_name || "";
      const userId = req.session.currentUserId!;

      // Validate ticker exists
      const valid = await isValidTicker(tickerSymbol);
      if (!valid) {
        return res
          .status(400)
          .json({ error: "Cannot find the given ticker" });
      }

      // Check for duplicates
      const duplicate = await findStockByTickerAndUser(tickerSymbol, userId);
      if (duplicate) {
        return res
          .status(409)
          .json({ error: "You are already tracking this stock!" });
      }

      const logoFilename = req.file ? req.file.filename : null;
      const stock = await createStock(
        tickerSymbol,
        companyName,
        userId,
        logoFilename
      );
      res.status(201).json(stock);
    } catch (err) {
      console.error("Error creating stock:", err);
      res.status(500).json({ error: "Unknown Error" });
    }
  }
);

// DELETE /api/stocks/:id
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    await deleteStock(parseInt(req.params.id));
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting stock:", err);
    res.status(500).json({ error: "Failed to delete stock" });
  }
});

// GET /api/stocks/:id/info - get basic stock info and FYPM
router.get("/:id/info", async (req: Request, res: Response) => {
  try {
    const stock = await findStockById(parseInt(req.params.id));
    if (!stock) return res.status(404).json({ error: "Stock not found" });

    const quotes = await getQuotes([stock.ticker_symbol]);
    if (!quotes.length) {
      return res.status(500).json({ error: "Failed to fetch quote" });
    }

    const quote = quotes[0];

    // Fetch book value and interest rate data
    const bookValues = await getBookValueHistory(stock.ticker_symbol);
    const interestRate = await getFiveYearInterestRate();

    let fypmData: {
      derivative_fypm: number | "N/A";
      linear_fypm: number | "N/A";
      rate_fypm: number | "N/A";
      derivative_change: number | null;
      linear_change: number | null;
      rate_change: number | null;
    } = {
      derivative_fypm: "N/A",
      linear_fypm: "N/A",
      rate_fypm: "N/A",
      derivative_change: null,
      linear_change: null,
      rate_change: null,
    };

    if (bookValues) {
      const fypm = calculateFypm(
        bookValues,
        quote.dividend_yield,
        quote.last_trade_price,
        interestRate
      );

      fypmData.derivative_fypm = fypm.derivative_fypm;
      fypmData.linear_fypm = fypm.linear_fypm;
      fypmData.rate_fypm = fypm.rate_fypm;

      // Get change from previous day
      const lastFypm = await getLatestFypmByTicker(stock.ticker_symbol);
      if (lastFypm && lastFypm.linear_fypm && lastFypm.rate_fypm && lastFypm.derivative_fypm) {
        if (typeof fypm.linear_fypm === "number") {
          fypmData.linear_change =
            (fypm.linear_fypm / lastFypm.linear_fypm - 1) * 100;
        }
        if (typeof fypm.rate_fypm === "number") {
          fypmData.rate_change =
            (fypm.rate_fypm / lastFypm.rate_fypm - 1) * 100;
        }
        if (typeof fypm.derivative_fypm === "number") {
          fypmData.derivative_change =
            (fypm.derivative_fypm / lastFypm.derivative_fypm - 1) * 100;
        }
      }
    }

    res.json({
      stock,
      quote,
      fypm: fypmData,
    });
  } catch (err) {
    console.error("Error fetching stock info:", err);
    res.status(500).json({ error: "Failed to fetch stock info" });
  }
});

// GET /api/stocks/:id/graph - get historical graph data
router.get("/:id/graph", async (req: Request, res: Response) => {
  try {
    const stock = await findStockById(parseInt(req.params.id));
    if (!stock) return res.status(404).json({ error: "Stock not found" });

    const months = parseInt((req.query.num_months as string) || "3");
    const data = await getHistoricalData(stock.ticker_symbol, months);
    res.json(data);
  } catch (err) {
    console.error("Error fetching graph data:", err);
    res.status(500).json({ error: "Failed to fetch graph data" });
  }
});

// GET /api/ticker - get ticker tape info (market indices + commodities)
router.get("/ticker/tape", async (_req: Request, res: Response) => {
  try {
    const quotes = await getQuotes([
      "^GSPC",
      "^IXIC",
      "CL=F",
      "GC=F",
      "EURUSD=X",
    ]);

    const labels = ["S&P 500", "NASDAQ", "OIL", "GOLD", "EUR/USD"];
    const tickerData = quotes.map((q, i) => ({
      label: labels[i],
      ...q,
    }));

    res.json(tickerData);
  } catch (err) {
    console.error("Error fetching ticker tape:", err);
    res.status(500).json({ error: "Failed to fetch ticker data" });
  }
});

// POST /api/stocks/collect - run one-time data collection
router.post("/collect", requireAuth, async (_req: Request, res: Response) => {
  try {
    await runDataCollection();
    res.json({ message: "Data collection just performed!" });
  } catch (err) {
    console.error("Error running data collection:", err);
    res.status(500).json({ error: "Data collection failed" });
  }
});

export default router;
