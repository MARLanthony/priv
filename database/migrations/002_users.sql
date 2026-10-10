-- ============================================================================
-- JurisFlow · 002 · users
-- ----------------------------------------------------------------------------
-- One row per login: the admin/owner, lawyers, staff and clients all live here.
-- `role` is what the whole application keys off (navigation, RBAC, dashboards).
-- Clients additionally get a `clients` row (003); the two are linked by
-- `clients.user_id`.
-- ============================================================================

create table if not exists public.users (
  id             serial primary key,
  auth_user_id   uuid unique references auth.users (id) on delete set null,
  name           text        not null check (length(trim(name)) between 2 and 120),
  email          citext      not null unique,
  password_hash  text        not null,
  role           text        not null check (role in ('admin', 'lawyer', 'staff', 'client')),
  phone          text,
  address        text,
  avatar         text,
  specialization text,       -- lawyers: practice area used by the AI recommender
  bar_number     text,       -- lawyers
  is_active      boolean     not null default true,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table  public.users is 'Every account that can sign in to JurisFlow.';
comment on column public.users.role is 'admin (owner) | lawyer | staff (assistant) | client.';
comment on column public.users.auth_user_id is
  'Supabase Auth subject, when the row is mirrored into auth.users.';

create index if not exists users_role_idx       on public.users (role);
create index if not exists users_is_active_idx  on public.users (is_active);
create index if not exists users_email_lower_idx on public.users (lower(email::text));

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Convenience view: the safe projection the API returns (never the hash)
-- ---------------------------------------------------------------------------
create or replace view public.users_safe as
  select id, name, email, role, phone, address, avatar, specialization,
         bar_number, is_active, last_login_at, created_at, updated_at
    from public.users;

comment on view public.users_safe is
  'User rows without password_hash — what GET /api/users and /api/auth/me return.';
