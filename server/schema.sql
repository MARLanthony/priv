-- ---------------------------------------------------------------------------
-- JurisFlow accounts table (MySQL / MariaDB)
--
-- Applied by `npm run db:setup`, which creates the database from DB_NAME first
-- and then runs these statements inside it. Re-runnable: nothing is dropped
-- unless you pass --reset.
--
-- To do it by hand instead:
--   CREATE DATABASE jurisflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
--   USE jurisflow;
--   <paste the CREATE TABLE below>
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  -- 190 keeps the unique index inside utf8mb4's index-size limit on older builds.
  email         VARCHAR(190) NOT NULL UNIQUE,
  phone         VARCHAR(40) NULL,
  -- Never a plain password: `scrypt$<salt-hex>$<hash-hex>` (see server/passwords.mjs).
  password_hash VARCHAR(255) NOT NULL,
  -- Only `user` is self-registered; staff roles are provisioned by the firm.
  role          ENUM('user', 'attorney', 'legal_secretary', 'system_admin') NOT NULL DEFAULT 'user',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Optional profile fields the UI already knows about.
  specialization VARCHAR(160) NULL,
  bar_number     VARCHAR(40) NULL,
  INDEX idx_users_role (role)
) ENGINE = InnoDB;
