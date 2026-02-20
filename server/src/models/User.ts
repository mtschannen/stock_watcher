import pool from "../config/database";

export interface User {
  id: number;
  username: string | null;
  firstname: string | null;
  lastname: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function findUserById(id: number): Promise<User | null> {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0] || null;
}

export async function createUser(
  username: string,
  firstname: string,
  lastname: string
): Promise<User> {
  const result = await pool.query(
    "INSERT INTO users (username, firstname, lastname) VALUES ($1, $2, $3) RETURNING *",
    [username, firstname, lastname]
  );
  return result.rows[0];
}
