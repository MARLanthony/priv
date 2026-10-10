-- ============================================================================
-- JurisFlow · 012 · audit trail, permission matrix, preferences, RLS
-- ============================================================================
-- The last migration: the tables that describe *who may do what* and *who did
-- what*, plus the row level security policies that mirror `utils/rbac.ts` and
-- `backend/app/utils/rbac.py` for direct PostgREST/Supabase access.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Activity log (audit trail)
-- ---------------------------------------------------------------------------
create table if not exists public.activity_logs (
  id         serial primary key,
  user_id    integer references public.users (id) on delete set null,
  action     text    not null,               -- e.g. 'case.create', 'document.status'
  details    text    not null default '',
  ip_address inet,
  created_at timestamptz not null default now()
);

comment on table public.activity_logs is
  'Append-only audit trail. Admins read everything; other roles see their own rows.';

create index if not exists activity_user_idx    on public.activity_logs (user_id);
create index if not exists activity_action_idx  on public.activity_logs (action);
create index if not exists activity_created_idx on public.activity_logs (created_at desc);

-- ---------------------------------------------------------------------------
-- Permissions catalogue + role matrix
-- ---------------------------------------------------------------------------
create table if not exists public.permissions (
  code        text primary key,               -- 'cases.write'
  label       text not null,
  group_label text not null
);

comment on table public.permissions is
  'Catalogue of every permission the API checks; mirrors the Permission union in the UI.';

create table if not exists public.role_permissions (
  id         serial primary key,
  role       text not null check (role in ('admin', 'lawyer', 'staff', 'client')),
  permission text not null references public.permissions (code) on delete cascade,
  created_at timestamptz not null default now(),
  unique (role, permission)
);

comment on table public.role_permissions is
  'Role → permission matrix. The browser copy lives in src/utils/rbac.ts and must match.';

create index if not exists role_permissions_role_idx on public.role_permissions (role);

-- ---------------------------------------------------------------------------
-- Notification preferences (one row per user)
-- ---------------------------------------------------------------------------
create table if not exists public.notification_settings (
  user_id       integer primary key references public.users (id) on delete cascade,
  email         boolean not null default true,
  in_app        boolean not null default true,
  consultations boolean not null default true,
  appointments  boolean not null default true,
  documents     boolean not null default true,
  updated_at    timestamptz not null default now()
);

comment on table public.notification_settings is
  'Per-user notification preferences edited on the settings page.';

drop trigger if exists notification_settings_set_updated_at on public.notification_settings;
create trigger notification_settings_set_updated_at
  before update on public.notification_settings
  for each row execute function public.set_updated_at();

-- Every new login gets a preferences row without the API having to remember.
create or replace function public.create_default_notification_settings()
returns trigger
language plpgsql
as $$
begin
  insert into public.notification_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists users_create_notification_settings on public.users;
create trigger users_create_notification_settings
  after insert on public.users
  for each row execute function public.create_default_notification_settings();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
-- The Flask API talks to Postgres as the service role (bypassing RLS), but the
-- frontend may also read `users_safe`/`knowledge_articles` through PostgREST.
-- These policies keep that path safe without duplicating the Python RBAC.
-- ---------------------------------------------------------------------------
alter table public.users              enable row level security;
alter table public.clients            enable row level security;
alter table public.cases              enable row level security;
alter table public.consultations      enable row level security;
alter table public.appointments       enable row level security;
alter table public.documents          enable row level security;
alter table public.notifications      enable row level security;
alter table public.knowledge_articles enable row level security;
alter table public.faqs               enable row level security;
alter table public.legal_services     enable row level security;

-- Staff, lawyers and the owner read the whole firm; a client reads their own row.
drop policy if exists users_read_scope on public.users;
create policy users_read_scope on public.users
  for select using (
    public.current_app_role() in ('admin', 'lawyer', 'staff')
    or id = public.current_app_user_id()
  );

drop policy if exists clients_read_scope on public.clients;
create policy clients_read_scope on public.clients
  for select using (
    public.current_app_role() in ('admin', 'lawyer', 'staff')
    or user_id = public.current_app_user_id()
  );

drop policy if exists cases_read_scope on public.cases;
create policy cases_read_scope on public.cases
  for select using (
    public.current_app_role() in ('admin', 'staff')
    or assigned_lawyer_id = public.current_app_user_id()
    or client_id in (
         select id from public.clients where user_id = public.current_app_user_id()
       )
  );

drop policy if exists consultations_read_scope on public.consultations;
create policy consultations_read_scope on public.consultations
  for select using (
    public.current_app_role() in ('admin', 'lawyer', 'staff')
    or client_id in (
         select id from public.clients where user_id = public.current_app_user_id()
       )
  );

drop policy if exists appointments_read_scope on public.appointments;
create policy appointments_read_scope on public.appointments
  for select using (
    public.current_app_role() in ('admin', 'staff')
    or lawyer_id = public.current_app_user_id()
    or client_id in (
         select id from public.clients where user_id = public.current_app_user_id()
       )
  );

drop policy if exists documents_read_scope on public.documents;
create policy documents_read_scope on public.documents
  for select using (
    public.current_app_role() in ('admin', 'lawyer', 'staff')
    or client_id in (
         select id from public.clients where user_id = public.current_app_user_id()
       )
  );

drop policy if exists notifications_read_own on public.notifications;
create policy notifications_read_own on public.notifications
  for select using (user_id = public.current_app_user_id());

drop policy if exists knowledge_public_read on public.knowledge_articles;
create policy knowledge_public_read on public.knowledge_articles
  for select using (status = 'published' or public.current_app_role() in ('admin', 'lawyer'));

drop policy if exists faqs_read_all on public.faqs;
create policy faqs_read_all on public.faqs for select using (true);

drop policy if exists services_read_all on public.legal_services;
create policy services_read_all on public.legal_services for select using (true);
