import { Pool } from "pg";

const pool = new Pool({
  user: process.env.DB_USER || "pguser",
  password: process.env.DB_PASSWORD || "password",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "stock_watcher_development",
});

export default pool;
