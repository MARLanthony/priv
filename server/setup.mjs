/*
 * Creates the database + `users` table and provisions the administrator account.
 *
 *   npm run db:setup          create schema, then seed (safe to re-run)
 *   npm run db:setup -- reset drop the table first, then create + seed
 *
 * A fresh install has exactly one account: the system administrator
 * (admin@firm.com / password123), which is the same single account the mock
 * dataset ships (src/mocks/data.ts). Clients create their own account from the
 * sign-up form, and the firm's attorneys/secretaries are added by the admin.
 *
 * NOTE — this API only serves login/register, so a staff account the admin adds
 * in the app (Team Management, answered by MSW) lives in the browser, not in this
 * table. To sign such a member in against MySQL, insert the row here as well.
 */
import { readFileSync } from 'node:fs';
import { createConnection } from 'mysql2/promise';
import { hashPassword } from './passwords.mjs';
import { dbConfig } from './db.mjs';

const DEMO_PASSWORD = 'password123';

/** The single account a fresh install starts with (mirrors src/mocks/data.ts). */
const DEMO_USERS = [
  { id: 1, name: 'Admin User', email: 'admin@firm.com', role: 'system_admin', phone: '(555) 100-0001' },
];

/** Strips `--` comments, then splits on the statement terminators. */
function statementsFrom(sql) {
  return sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
}

const reset = process.argv.includes('--reset');

const connection = await createConnection({ ...dbConfig, database: undefined });
const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

try {
  // The database name comes from DB_NAME, so the same setup also works on a
  // throwaway database (the MySQL auth test uses `jurisflow_test`).
  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\`
       CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  await connection.query(`USE \`${dbConfig.database}\``);
  console.log(`[db] database ready -> ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

  if (reset) {
    await connection.query('DROP TABLE IF EXISTS users');
    console.log('[db] table dropped');
  }

  for (const statement of statementsFrom(schema)) {
    await connection.query(statement);
  }
  console.log('[db] schema ready (users table + unique email index)');

  const hash = hashPassword(DEMO_PASSWORD);
  for (const user of DEMO_USERS) {
    await connection.execute(
      `INSERT INTO users (id, name, email, phone, password_hash, role, specialization, bar_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         phone = VALUES(phone),
         role = VALUES(role),
         specialization = VALUES(specialization),
         bar_number = VALUES(bar_number)`,
      [
        user.id,
        user.name,
        user.email,
        user.phone ?? null,
        hash,
        user.role,
        user.specialization ?? null,
        user.barNumber ?? null,
      ],
    );
  }
  console.log(`[db] provisioned ${DEMO_USERS.length} account(s) (password: ${DEMO_PASSWORD})`);

  const [rows] = await connection.query('SELECT id, name, email, role FROM users ORDER BY id');
  console.log(`[db] ${rows.length} account(s) total:`);
  for (const row of rows) {
    console.log(`      #${row.id}  ${row.email.padEnd(24)} ${row.role.padEnd(15)} ${row.name}`);
  }
  console.log('[db] start the API with: npm run api');
} finally {
  await connection.end();
}
