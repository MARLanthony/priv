/*
 * Prints the accounts that are actually stored in MySQL.
 *
 *   npm run db:users
 *
 * The quickest way to confirm that registering in the app really saved a row.
 */
import { closePool, dbConfig, pool } from './db.mjs';

const asDate = value => (value instanceof Date ? value.toISOString().replace('T', ' ').slice(0, 19) : String(value));

try {
  const [rows] = await pool.query(
    'SELECT id, name, email, phone, role, created_at FROM users ORDER BY id',
  );

  console.log(`[db] ${rows.length} account(s) in ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
  console.log('[db]  id  role             email                      name                 created');
  for (const row of rows) {
    console.log(
      `     ${String(row.id).padStart(2)}  ${String(row.role).padEnd(15)}  ${String(row.email).padEnd(25)}  ${String(row.name).padEnd(20)} ${asDate(row.created_at)}`,
    );
  }
  const clients = rows.filter(row => row.role === 'user').length;
  console.log(`[db] ${clients} client account(s), ${rows.length - clients} staff account(s)`);
} catch (error) {
  console.error(`[db] cannot read accounts: ${error.code ?? error.message}`);
  console.error('[db] start MySQL (XAMPP Control Panel), then: npm run db:setup');
  process.exitCode = 1;
} finally {
  await closePool();
}
