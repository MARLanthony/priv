/*
 * Starts the JurisFlow auth API on API_PORT (default 4001).
 *
 *   npm run api      ->  node --env-file-if-exists=.env server/index.mjs
 *
 * Vite proxies `/api` here while `VITE_AUTH_BACKEND=mysql`, so the browser talks
 * to this process and this process talks to MySQL.
 */
import { createApp } from './app.mjs';
import { closePool, dbConfig, describeTarget, ping } from './db.mjs';

const port = Number(process.env.API_PORT || 4001);
const app = createApp();

const server = app.listen(port, () => {
  console.log(`[api] listening on http://127.0.0.1:${port}`);
  console.log(`[api] accounts -> MySQL ${describeTarget()}`);
  if (!process.env.AUTH_TOKEN_SECRET) {
    console.log('[api] AUTH_TOKEN_SECRET is unset - using the dev default (fine locally only).');
  }

  ping()
    .then(() => console.log('[api] database OK, schema present'))
    .catch(error => {
      console.log(`[api] ! cannot use MySQL at ${describeTarget()}`);
      console.log(`[api]   ${error.code ?? error.message}`);
      console.log('[api]   start MySQL (XAMPP Control Panel) and run: npm run db:setup');
    });
});

const shutdown = async () => {
  server.close();
  await closePool().catch(() => {});
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export { app, dbConfig, port };
