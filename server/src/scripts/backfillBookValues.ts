/**
 * Backfill script: populates server/data/book_values.json with BVPS history
 * for all tickers that are missing or stale (>90 days old).
 *
 * Run from the server/ directory:
 *   npx tsx src/scripts/backfillBookValues.ts
 *
 * Fetches up to 20 tickers per run to stay within the 25 calls/day free tier.
 * Run again tomorrow if tickers remain.
 *
 * Output path is resolved relative to this script file, so it always writes
 * to the correct server/data/book_values.json regardless of cwd.
 */

import "dotenv/config";
import path from "path";
import fs from "fs";
import axios from "axios";
import { SP500_TICKERS } from "../data/sp500Tickers";

// Resolve output path relative to this file: src/scripts/ → ../../data/
const BOOK_VALUES_FILE = path.resolve(__dirname, "../../data", "book_values.json");

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";
const MAX_CALLS_PER_RUN = 20;
const DELAY_MS = 12_000; // 12s between calls — safe for the 5 req/min free tier
const PERSISTENT_TTL_DAYS = 90;

interface BookValueEntry {
  lastUpdated: string; // "YYYY-MM-DD"
  source: string;
  history: [string, number][];
}

// ── Store helpers ─────────────────────────────────────────────────────────────

function loadStore(): Record<string, BookValueEntry> {
  try {
    if (!fs.existsSync(BOOK_VALUES_FILE)) return {};
    return JSON.parse(fs.readFileSync(BOOK_VALUES_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveStore(store: Record<string, BookValueEntry>): void {
  fs.mkdirSync(path.dirname(BOOK_VALUES_FILE), { recursive: true });
  fs.writeFileSync(BOOK_VALUES_FILE, JSON.stringify(store, null, 2));
}

function needsUpdate(store: Record<string, BookValueEntry>, ticker: string): boolean {
  const entry = store[ticker];
  if (!entry) return true;
  const ageDays = (Date.now() - new Date(entry.lastUpdated).getTime()) / (24 * 60 * 60 * 1000);
  return ageDays > PERSISTENT_TTL_DAYS;
}

// ── Alpha Vantage fetch ───────────────────────────────────────────────────────

async function fetchBVPS(
  ticker: string,
  apiKey: string
): Promise<[string, number][] | null> {
  const url = `${ALPHA_VANTAGE_BASE}?function=BALANCE_SHEET&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey}`;
  const response = await axios.get(url);
  const body = response.data as Record<string, unknown>;

  if (body?.Note) {
    console.error(`[Backfill] Rate limited — Note: ${body.Note}`);
    return null;
  }
  if (body?.Information) {
    console.error(`[Backfill] API limit/info — ${body.Information}`);
    return null;
  }

  const annualReports = body?.annualReports as Record<string, string>[] | undefined;
  if (!Array.isArray(annualReports) || annualReports.length === 0) return null;

  const history: [string, number][] = annualReports
    .slice(0, 5)
    .map((r): [string, number] => {
      const equity = parseFloat(r.totalShareholderEquity);
      const shares = parseFloat(r.commonStockSharesOutstanding);
      const bvps = !isNaN(equity) && !isNaN(shares) && shares > 0 ? equity / shares : 0;
      return [r.fiscalDateEnding, bvps];
    })
    .filter(([, bvps]) => bvps > 0);

  return history.length > 0 ? history : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    // Try to load from the main repo .env as fallback (handles worktree scenarios)
    const envPath = path.resolve(__dirname, "../../.env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf8");
      const match = envContent.match(/^ALPHA_VANTAGE_API_KEY=(.+)$/m);
      if (match) {
        process.env.ALPHA_VANTAGE_API_KEY = match[1].trim();
        console.log("[Backfill] Loaded API key from script-relative .env");
      }
    }
  }

  const finalApiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!finalApiKey) {
    console.error("[Backfill] ALPHA_VANTAGE_API_KEY not set — cannot proceed");
    process.exit(1);
  }

  console.log(`[Backfill] Writing to: ${BOOK_VALUES_FILE}`);

  const store = loadStore();
  const needsData = SP500_TICKERS.filter((t) => needsUpdate(store, t));

  console.log(
    `[Backfill] ${SP500_TICKERS.length} total tickers | ` +
    `${Object.keys(store).length} in store | ` +
    `${needsData.length} missing or stale`
  );

  if (needsData.length === 0) {
    console.log("[Backfill] All tickers are up to date. Nothing to do.");
    return;
  }

  const toFetch = needsData.slice(0, MAX_CALLS_PER_RUN);
  console.log(`[Backfill] Fetching ${toFetch.length} tickers this run...\n`);

  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < toFetch.length; i++) {
    const ticker = toFetch[i];
    process.stdout.write(`[Backfill] [${i + 1}/${toFetch.length}] ${ticker} ... `);

    try {
      const history = await fetchBVPS(ticker, finalApiKey);
      if (history) {
        store[ticker] = {
          lastUpdated: new Date().toISOString().split("T")[0],
          source: "alpha_vantage",
          history,
        };
        saveStore(store);
        fetched++;
        console.log(`OK (${history.length} years)`);
      } else {
        failed++;
        console.log("SKIP (no data)");
      }
    } catch (err: unknown) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`FAIL — ${msg}`);
    }

    if (i < toFetch.length - 1) {
      process.stdout.write(`[Backfill] Waiting ${DELAY_MS / 1000}s...\r`);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  const remaining = needsData.length - toFetch.length;
  console.log(`\n[Backfill] Finished: ${fetched} saved, ${failed} failed`);
  console.log(`[Backfill] Store now has ${Object.keys(store).length} entries`);

  if (remaining > 0) {
    console.log(
      `[Backfill] ${remaining} tickers still need data. Run again tomorrow.`
    );
  } else {
    console.log("[Backfill] All tickers have been backfilled!");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[Backfill] Fatal error:", err);
    process.exit(1);
  });
