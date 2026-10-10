-- ============================================================================
-- JurisFlow · 004 · cases
-- ----------------------------------------------------------------------------
-- A matter: one client, one lead lawyer, a status and a priority. The case
-- number is generated (`JF-<year>-<serial>`) so it can be quoted in letters and
-- used to look a matter up without the internal id.
-- ============================================================================

create table if not exists public.cases (
  id                  serial primary key,
  client_id           integer not null references public.clients (id) on delete cascade,
  case_number         text    not null unique,
  title               text    not null check (length(trim(title)) between 3 and 200),
  type                text    not null default 'General',
  status              text    not null default 'open'
                        check (status in ('open', 'pending', 'active', 'discovery', 'closed', 'archived')),
  priority            text    not null default 'medium'
                        check (priority in ('high', 'medium', 'low')),
  assigned_lawyer_id  integer references public.users (id) on delete set null,
  description         text,
  opened_at           date    not null default current_date,
  closed_at           date,
  created_by          integer references public.users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.cases is 'A matter handled by the firm for one client.';
comment on column public.cases.status is
  'open | pending | active | discovery | closed | archived (see STATUS_TONES in the UI).';
comment on column public.cases.assigned_lawyer_id is
  'Lead attorney. A lawyer only ever sees cases where this equals their own id.';

create index if not exists cases_client_idx   on public.cases (client_id);
create index if not exists cases_lawyer_idx   on public.cases (assigned_lawyer_id);
create index if not exists cases_status_idx   on public.cases (status);
create index if not exists cases_priority_idx on public.cases (priority);
create index if not exists cases_updated_idx  on public.cases (updated_at desc);

drop trigger if exists cases_set_updated_at on public.cases;
create trigger cases_set_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Case number generator
-- ---------------------------------------------------------------------------
-- `JF-2026-0007`. The sequence is global, so numbers are unique forever, and
-- the year prefix makes them readable.
create sequence if not exists public.case_number_seq start 1000;

create or replace function public.next_case_number()
returns text
language sql
volatile
as $$
  select 'JF-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.case_number_seq')::text, 4, '0');
$$;

comment on function public.next_case_number() is
  'Case numbers look like JF-2026-1001; the API calls this when a case is opened.';
