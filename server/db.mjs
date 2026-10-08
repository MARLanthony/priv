/*
 * MySQL connection pool for the JurisFlow API.
 *
 * Configuration comes from `.env` (loaded by `node --env-file-if-exists=.env`).
 * These variables deliberately have NO `VITE_` prefix, so Vite never inlines the
 * database credentials into the browser bundle.
 *
 *   DB_HOST      (default 127.0.0.1)
 *   DB_PORT      (default 3306)
 *   DB_USER      (default root - the XAMPP default)
 *   DB_PASSWORD  (default empty - the XAMPP default)
 *   DB_NAME      (default jurisflow)
 */
import { createPool } from 'mysql2/promise';

export const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'jurisflow',
};

/** Single shared pool: mysql2 keeps the sockets open between requests. */
export const pool = createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 8,
  charset: 'utf8mb4_unicode_ci',
});

/** `true` when the server is reachable AND the schema exists. */
export async function ping() {
  await pool.query('SELECT 1 FROM users LIMIT 1');
  return true;
}

export async function closePool() {
  await pool.end();
}

/** Short human-readable target, used in log lines (never prints the password). */
export const describeTarget = () =>
  `${dbConfig.host}:${dbConfig.port}/${dbConfig.database} as ${dbConfig.user}`;
