import pool from "../config/database";

export interface Stock {
  id: number;
  ticker_symbol: string;
  company_name: string;
  user_id: string;
  stock_logo_filename: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function findStocksByUserId(userId: string): Promise<Stock[]> {
  const result = await pool.query(
    "SELECT * FROM stocks WHERE user_id = $1 ORDER BY ticker_symbol ASC",
    [userId]
  );
  return result.rows;
}

export async function findStockById(id: number): Promise<Stock | null> {
  const result = await pool.query("SELECT * FROM stocks WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function findStockByTickerAndUser(
  tickerSymbol: string,
  userId: string
): Promise<Stock | null> {
  const result = await pool.query(
    "SELECT * FROM stocks WHERE ticker_symbol = $1 AND user_id = $2",
    [tickerSymbol, userId]
  );
  return result.rows[0] || null;
}

export async function createStock(
  tickerSymbol: string,
  companyName: string,
  userId: string,
  stockLogoFilename: string | null
): Promise<Stock> {
  const result = await pool.query(
    "INSERT INTO stocks (ticker_symbol, company_name, user_id, stock_logo_filename) VALUES ($1, $2, $3, $4) RETURNING *",
    [tickerSymbol, companyName, userId, stockLogoFilename]
  );
  return result.rows[0];
}

export async function deleteStock(id: number): Promise<void> {
  await pool.query("DELETE FROM stocks WHERE id = $1", [id]);
}

export async function findAllStocks(): Promise<Stock[]> {
  const result = await pool.query("SELECT * FROM stocks");
  return result.rows;
}
