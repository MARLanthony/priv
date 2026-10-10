-- ============================================================================
-- JurisFlow · 011 · legal services, FAQs and notifications
-- ----------------------------------------------------------------------------
-- Three small catalogues that share nothing but their size:
--
--   * legal_services — the practice areas a client picks at intake
--   * faqs           — the client-facing question list
--   * notifications  — the per-user inbox behind the navbar bell
-- ============================================================================

create table if not exists public.legal_services (
  id          serial primary key,
  name        text    not null unique check (length(trim(name)) between 3 and 120),
  description text    not null default '',
  is_active   boolean not null default true,
  created_by  integer references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.legal_services is
  'Practice areas (pricing/consultation types). Referenced by consultations.service_id.';

create index if not exists legal_services_active_idx on public.legal_services (is_active);

drop trigger if exists legal_services_set_updated_at on public.legal_services;
create trigger legal_services_set_updated_at
  before update on public.legal_services
  for each row execute function public.set_updated_at();

-- The FK from 005 is added here because the table it points at only exists now.
alter table public.consultations
  drop constraint if exists consultations_service_id_fkey;
alter table public.consultations
  add constraint consultations_service_id_fkey
  foreign key (service_id) references public.legal_services (id) on delete set null;

-- ---------------------------------------------------------------------------
-- FAQs
-- ---------------------------------------------------------------------------
create table if not exists public.faqs (
  id          serial primary key,
  question    text not null check (length(trim(question)) between 5 and 300),
  answer      text not null check (length(trim(answer)) >= 10),
  category    text not null default 'General',
  created_by  integer references public.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.faqs is 'Client portal FAQ list; faqs.write holders maintain it.';

create index if not exists faqs_category_idx on public.faqs (lower(category));
create index if not exists faqs_question_idx on public.faqs (lower(question));

drop trigger if exists faqs_set_updated_at on public.faqs;
create trigger faqs_set_updated_at
  before update on public.faqs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         serial primary key,
  user_id    integer not null references public.users (id) on delete cascade,
  type       text    not null default 'system'
               check (type in ('consultation', 'appointment', 'case', 'document', 'system')),
  message    text    not null check (length(trim(message)) between 3 and 400),
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.notifications is
  'Per-user inbox. `GET /api/notifications/unread-count` drives the navbar badge.';

create index if not exists notifications_user_idx    on public.notifications (user_id, is_read);
create index if not exists notifications_created_idx on public.notifications (created_at desc);
