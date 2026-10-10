-- ============================================================================
-- JurisFlow · 003 · clients
-- ----------------------------------------------------------------------------
-- The client *file* (as opposed to the login in `users`). A client account is
-- created either by staff from the front desk or by self-registration; either
-- way exactly one `clients` row carries the case-relevant identity and is what
-- every case, consultation, appointment and document hangs off.
-- ============================================================================

create table if not exists public.clients (
  id            serial primary key,
  user_id       integer unique references public.users (id) on delete set null,
  full_name     text        not null check (length(trim(full_name)) between 2 and 160),
  email         citext,
  contact       text        not null,
  address       text        not null,
  notes         text,
  created_by    integer     references public.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  public.clients is 'The client file: contact details and the anchor for all work.';
comment on column public.clients.user_id is
  'The login that may read this file (null for a walk-in client without a portal account).';

create index if not exists clients_user_idx  on public.clients (user_id);
create index if not exists clients_name_idx  on public.clients (lower(full_name));
create index if not exists clients_email_idx on public.clients (lower(email::text));

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- A client account always has a file
-- ---------------------------------------------------------------------------
-- Enforced in the API (registering creates both rows in one transaction), but
-- the invariant is documented here so reviewers can see the intent.
comment on constraint clients_user_id_key on public.clients is
  'One client file per login: self-registration and staff onboarding both upsert.';
