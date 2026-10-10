-- ============================================================================
-- JurisFlow · 006 · appointments
-- ----------------------------------------------------------------------------
-- A booking on a lawyer's diary. `start_time`/`end_time` are `time` values
-- combined with `date`, which matches how the UI edits them (a day plus two
-- time inputs) and keeps the overlap check trivial.
-- ============================================================================

create table if not exists public.appointments (
  id               serial primary key,
  client_id        integer not null references public.clients (id) on delete cascade,
  consultation_id  integer references public.consultations (id) on delete set null,
  lawyer_id        integer not null references public.users (id) on delete cascade,
  date             date    not null,
  start_time       time    not null,
  end_time         time    not null,
  status           text    not null default 'scheduled'
                     check (status in ('scheduled', 'confirmed', 'rescheduled', 'completed', 'cancelled')),
  notes            text,
  cancel_reason    text,
  created_by       integer references public.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint appointments_time_order check (end_time > start_time)
);

comment on table public.appointments is
  'Consultation bookings. Status changes notify the client (see the notifications table).';

create index if not exists appointments_lawyer_date_idx on public.appointments (lawyer_id, date);
create index if not exists appointments_client_idx      on public.appointments (client_id);
create index if not exists appointments_status_idx      on public.appointments (status);
create index if not exists appointments_date_idx        on public.appointments (date);

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Double-booking guard
-- ---------------------------------------------------------------------------
-- The API already looks for a free slot, but two concurrent requests could
-- still both pass that check; this exclusion constraint makes the database the
-- final authority. Cancelled appointments are excluded so a slot frees up.
create extension if not exists "btree_gist";

alter table public.appointments
  drop constraint if exists appointments_no_overlap;

alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    lawyer_id with =,
    date with =,
    tsrange(date + start_time, date + end_time) with &&
  )
  where (status <> 'cancelled');

comment on constraint appointments_no_overlap on public.appointments is
  'A lawyer cannot be booked twice for overlapping times on the same day.';
