-- ============================================================================
-- JurisFlow · 001 · Extensions and shared helpers
-- ----------------------------------------------------------------------------
-- Supabase runs PostgreSQL 15 with the usual extensions already available; this
-- migration only makes the ones the schema depends on explicit and installs the
-- two helper functions every other migration reuses.
--
-- Run with: supabase db push   (or psql -f database/migrations/001_*.sql)
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid(), crypt(), digest()
create extension if not exists "citext";     -- case-insensitive e-mail columns

-- ---------------------------------------------------------------------------
-- updated_at housekeeping
-- ---------------------------------------------------------------------------
-- Every table with an `updated_at` column gets this trigger, so the API never
-- has to remember to stamp it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger: keeps updated_at in sync without application code.';

-- ---------------------------------------------------------------------------
-- Role helpers (used by the row level security policies in 012_*)
-- ---------------------------------------------------------------------------
-- `auth.uid()` is the Supabase JWT subject; the Flask API authenticates the same
-- users with its own JWTs, so these helpers resolve the *application* user row
-- from the Supabase user id when the request comes through PostgREST.
create or replace function public.current_app_user_id()
returns integer
language sql
stable
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1;
$$;

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select role from public.users where auth_user_id = auth.uid() limit 1;
$$;

comment on function public.current_app_role() is
  'Role of the signed-in Supabase user (admin | lawyer | staff | client).';
