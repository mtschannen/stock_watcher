import axios from "axios";
import fs from "fs";
import path from "path";

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";
const DAILY_LIMIT = 25;
const PERSISTENT_TTL_DAYS = 90;
const PERSISTENT_TTL_MS = PERSISTENT_TTL_DAYS * 24 * 60 * 60 * 1000;

const BOOK_VALUES_FILE = path.join(process.cwd(), "data", "book_values.json");

// ── Persistent store types ────────────────────────────────────────────────────

export interface BookValueEntry {
  lastUpdated: string; // "YYYY-MM-DD"
  source: string;
  history: [string, number][];
}

export interface BookValueData {
  data: [string, number][];
}

// ── Daily call tracking ───────────────────────────────────────────────────────

let _dailyCallCount = 0;
let _dailyCallDate = new Date().toDateString();
let _lastRateLimited = false;
let _lastCallTimestamp: string | null = null;

function incrementDailyCount(): void {
  const today = new Date().toDateString();
  if (today !== _dailyCallDate) {
    _dailyCallCount = 0;
    _dailyCallDate = today;
    console.log(`[AlphaVantage] Daily call counter reset for ${today}`);
  }
  _dailyCallCount++;
}

// ── Persistent book value store ───────────────────────────────────────────────

let bookValueStore: Record<string, BookValueEntry> = {};

function loadStoreFromDisk(): Record<string, BookValueEntry> {
  try {
    if (!fs.existsSync(BOOK_VALUES_FILE)) return {};
    const raw = JSON.parse(fs.readFileSync(BOOK_VALUES_FILE, "utf8"));
    console.log(`[AlphaVantage] Loaded ${Object.keys(raw).length} book-value entries from ${BOOK_VALUES_FILE}`);
    return raw;
  } catch {
    return {};
  }
}

function saveStoreToDisk(): void {
  try {
    fs.mkdirSync(path.dirname(BOOK_VALUES_FILE), { recursive: true });
    fs.writeFileSync(BOOK_VALUES_FILE, JSON.stringify(bookValueStore, null, 2));
  } catch (err) {
    console.error("[AlphaVantage] Failed to write book_values.json:", err);
  }
}

function isStale(entry: BookValueEntry): boolean {
  return Date.now() - new Date(entry.lastUpdated).getTime() > PERSISTENT_TTL_MS;
}

// Load on module initialization
bookValueStore = loadStoreFromDisk();

// ── Status exports ────────────────────────────────────────────────────────────

export interface AlphaVantageStatus {
  dailyCallCount: number;
  dailyLimit: number;
  remainingCalls: number;
  storeSize: number;
  lastRateLimited: boolean;
  lastCallTimestamp: string | null;
}

export function getAlphaVantageStatus(): AlphaVantageStatus {
  return {
    dailyCallCount: _dailyCallCount,
    dailyLimit: DAILY_LIMIT,
    remainingCalls: Math.max(0, DAILY_LIMIT - _dailyCallCount),
    storeSize: Object.keys(bookValueStore).length,
    lastRateLimited: _lastRateLimited,
    lastCallTimestamp: _lastCallTimestamp,
  };
}

export interface BookValueStoreStatus {
  allTickers: number;
  totalInStore: number;
  missing: number;
  stale: number;
  oldestLastUpdated: string | null;
}

export function getBookValueStoreStatus(allTickers: string[]): BookValueStoreStatus {
  const presentTickers = new Set(Object.keys(bookValueStore));
  let staleCount = 0;
  let oldest: string | null = null;

  for (const entry of Object.values(bookValueStore)) {
    if (isStale(entry)) staleCount++;
    if (!oldest || entry.lastUpdated < oldest) oldest = entry.lastUpdated;
  }

  return {
    allTickers: allTickers.length,
    totalInStore: presentTickers.size,
    missing: allTickers.filter((t) => !presentTickers.has(t)).length,
    stale: staleCount,
    oldestLastUpdated: oldest,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns cached book value data synchronously — never triggers an API call. */
export function getCachedBookValueHistory(ticker: string): BookValueData | null {
  const entry = bookValueStore[ticker];
  if (!entry || isStale(entry)) return null;
  return { data: entry.history };
}

export async function getBookValueHistory(
  ticker: string
): Promise<BookValueData | null> {
  // Check persistent store first (90-day TTL) — no API call needed
  const stored = bookValueStore[ticker];
  if (stored && !isStale(stored)) {
    const ageDays = Math.round(
      (Date.now() - new Date(stored.lastUpdated).getTime()) / (24 * 60 * 60 * 1000)
    );
    console.log(
      `[AlphaVantage] Store HIT for ${ticker} (lastUpdated: ${stored.lastUpdated}, age: ${ageDays}d)`
    );
    return { data: stored.history };
  }

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    console.warn("[AlphaVantage] ALPHA_VANTAGE_API_KEY is not set — cannot fetch book values");
    return null;
  }

  const timestamp = new Date().toISOString();
  _lastCallTimestamp = timestamp;
  incrementDailyCount();
  console.log(
    `[AlphaVantage] API CALL #${_dailyCallCount}/${DAILY_LIMIT} at ${timestamp} — ticker: ${ticker}, endpoint: BALANCE_SHEET`
  );

  try {
    const url = `${ALPHA_VANTAGE_BASE}?function=BALANCE_SHEET&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
    const response = await axios.get(url);

    console.log(`[AlphaVantage] HTTP ${response.status} for ${ticker}`);

    const body = response.data as Record<string, unknown>;

    if (body?.Note) {
      _lastRateLimited = true;
      console.warn(`[AlphaVantage] RATE LIMITED for ${ticker} — Note: ${body.Note}`);
      return null;
    }
    if (body?.Information) {
      _lastRateLimited = true;
      console.warn(`[AlphaVantage] API LIMIT/INFO for ${ticker} — Information: ${body.Information}`);
      return null;
    }

    _lastRateLimited = false;

    const annualReports = body?.annualReports as Record<string, string>[] | undefined;

    if (!Array.isArray(annualReports) || annualReports.length === 0) {
      console.warn(
        `[AlphaVantage] No annual reports for ${ticker} (response keys: ${Object.keys(body).join(", ")})`
      );
      return null;
    }

    const history: [string, number][] = annualReports
      .slice(0, 5)
      .map((report): [string, number] => {
        const equity = parseFloat(report.totalShareholderEquity);
        const shares = parseFloat(report.commonStockSharesOutstanding);
        const bvps =
          !isNaN(equity) && !isNaN(shares) && shares > 0 ? equity / shares : 0;
        return [report.fiscalDateEnding, bvps];
      })
      .filter(([, bvps]) => bvps > 0);

    if (history.length === 0) {
      console.warn(`[AlphaVantage] No valid BVPS data computed for ${ticker}`);
      return null;
    }

    const today = new Date().toISOString().split("T")[0];
    bookValueStore[ticker] = {
      lastUpdated: today,
      source: "alpha_vantage",
      history,
    };
    saveStoreToDisk();

    console.log(
      `[AlphaVantage] SUCCESS for ${ticker} — ${history.length} annual reports saved to persistent store`
    );
    return { data: history };
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 429) {
      _lastRateLimited = true;
      console.error(`[AlphaVantage] HTTP 429 RATE LIMITED for ${ticker}`);
    } else {
      console.error(`[AlphaVantage] API error for ${ticker} (HTTP ${status ?? "unknown"}):`, err);
    }
    return null;
  }
}
