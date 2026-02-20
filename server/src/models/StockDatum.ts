import pool from "../config/database";

export interface StockDatum {
  id: number;
  ticker_symbol: string;
  date: Date | null;
  derivative_fypm: number | null;
  linear_fypm: number | null;
  rate_fypm: number | null;
  created_at: Date;
  updated_at: Date;
}

export async function getLatestFypmByTicker(
  tickerSymbol: string
): Promise<StockDatum | null> {
  const result = await pool.query(
    "SELECT * FROM stock_data WHERE ticker_symbol = $1 ORDER BY created_at DESC LIMIT 1",
    [tickerSymbol]
  );
  return result.rows[0] || null;
}

export async function createStockDatum(
  tickerSymbol: string,
  derivativeFypm: number | string,
  linearFypm: number | string,
  rateFypm: number | string
): Promise<StockDatum> {
  const result = await pool.query(
    "INSERT INTO stock_data (ticker_symbol, derivative_fypm, linear_fypm, rate_fypm) VALUES ($1, $2, $3, $4) RETURNING *",
    [
      tickerSymbol,
      typeof derivativeFypm === "number" ? derivativeFypm : null,
      typeof linearFypm === "number" ? linearFypm : null,
      typeof rateFypm === "number" ? rateFypm : null,
    ]
  );
  return result.rows[0];
}
