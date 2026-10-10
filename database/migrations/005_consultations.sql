-- ============================================================================
-- JurisFlow · 005 · consultations
-- ----------------------------------------------------------------------------
-- The intake pipeline. A client submits a "concern" (optionally after running
-- the AI suggestions page), staff or a lawyer reviews it, and an *approved*
-- consultation is what the appointment booking hangs off
-- (`appointments.consultation_id`).
-- ============================================================================

create table if not exists public.consultations (
  id           serial primary key,
  client_id    integer not null references public.clients (id) on delete cascade,
  service_id   integer,                -- FK added in 011 (legal_services)
  concern      text    not null check (length(trim(concern)) >= 20),
  status       text    not null default 'pending'
                 check (status in ('pending', 'approved', 'declined', 'completed')),
  review_note  text,
  reviewed_by  integer references public.users (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.consultations is
  'Client intake requests. Only consultations.review or admin may move a row out of pending.';
comment on column public.consultations.concern is
  'Free text the client wrote (or the AI intake text they submitted).';

create index if not exists consultations_client_idx  on public.consultations (client_id);
create index if not exists consultations_status_idx  on public.consultations (status);
create index if not exists consultations_created_idx on public.consultations (created_at desc);

drop trigger if exists consultations_set_updated_at on public.consultations;
create trigger consultations_set_updated_at
  before update on public.consultations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Review bookkeeping
-- ---------------------------------------------------------------------------
-- Whenever the status changes away from `pending`, stamp who decided and when.
-- The API also writes an activity log row; the trigger keeps the data correct
-- even for a manual psql update.
create or replace function public.stamp_consultation_review()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status and new.status <> 'pending' then
    new.reviewed_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists consultations_stamp_review on public.consultations;
create trigger consultations_stamp_review
  before update on public.consultations
  for each row execute function public.stamp_consultation_review();
