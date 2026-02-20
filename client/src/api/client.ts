import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export interface Stock {
  id: number;
  ticker_symbol: string;
  company_name: string;
  user_id: string;
  stock_logo_filename: string | null;
  change?: number;
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

export interface FypmData {
  derivative_fypm: number | "N/A";
  linear_fypm: number | "N/A";
  rate_fypm: number | "N/A";
  derivative_change: number | null;
  linear_change: number | null;
  rate_change: number | null;
}

export interface StockInfo {
  stock: Stock;
  quote: StockQuote;
  fypm: FypmData;
}

export interface HistoricalPoint {
  date: string;
  adjClose: number;
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

export interface SessionInfo {
  loggedIn: boolean;
  userId: string | null;
  firstname: string | null;
}

// Session
export const getSession = () => api.get<SessionInfo>("/users/session");
export const login = () => api.post<{ success: boolean }>("/users/login");
export const logout = () => api.post<{ success: boolean }>("/users/logout");

// Stocks
export const getStocks = () => api.get<Stock[]>("/stocks");
export const createStock = (formData: FormData) =>
  api.post<Stock>("/stocks", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
export const deleteStockApi = (id: number) => api.delete(`/stocks/${id}`);
export const getStockInfo = (id: number) =>
  api.get<StockInfo>(`/stocks/${id}/info`);
export const getGraphData = (id: number, months: number) =>
  api.get<HistoricalPoint[]>(`/stocks/${id}/graph?num_months=${months}`);
export const getTickerTape = () => api.get<TickerItem[]>("/stocks/ticker/tape");
export const runDataCollection = () => api.post("/stocks/collect");

// Resources
export const getResources = () => api.get<Resource[]>("/resources");
