-- ============================================================================
-- JurisFlow · 007 · availability
-- ----------------------------------------------------------------------------
-- The weekly grid a lawyer publishes. The API replaces the whole week in one
-- `PUT /api/availability` call, which is why the uniqueness rule is
-- (lawyer_id, day_of_week) rather than a surrogate key the client would have to
-- track.
--
-- The free slots the booking modal shows are derived from this grid minus the
-- appointments already on the diary, in 30-minute steps.
-- ============================================================================

create table if not exists public.availability (
  id           serial primary key,
  lawyer_id    integer not null references public.users (id) on delete cascade,
  day_of_week  text    not null
                 check (day_of_week in ('Monday', 'Tuesday', 'Wednesday', 'Thursday',
                                        'Friday', 'Saturday', 'Sunday')),
  start_time   time    not null,
  end_time     time    not null,
  is_available boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint availability_time_order check (end_time > start_time),
  constraint availability_one_row_per_day unique (lawyer_id, day_of_week)
);

comment on table public.availability is
  'Weekly opening hours per lawyer; PUT /api/availability replaces the whole grid.';
comment on column public.availability.is_available is
  'Kept as a flag (rather than deleting the row) so the UI can re-open a day without retyping the hours.';

create index if not exists availability_lawyer_idx on public.availability (lawyer_id);

drop trigger if exists availability_set_updated_at on public.availability;
create trigger availability_set_updated_at
  before update on public.availability
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Slot generation
-- ---------------------------------------------------------------------------
-- Returns the bookable 30-minute slots for one lawyer on one date: the
-- availability window minus the appointments that are already booked.
create or replace function public.free_slots(p_lawyer_id integer, p_date date)
returns table (slot_time time, is_available boolean)
language sql
stable
as $$
  with day as (
    select start_time, end_time
      from public.availability
     where lawyer_id = p_lawyer_id
       and is_available
       and day_of_week = trim(to_char(p_date, 'Day'))
  ),
  grid as (
    select generate_series(
             d.start_time::time,
             (d.end_time - interval '30 minutes')::time,
             interval '30 minutes'
           )::time as slot_time
      from day d
  )
  select g.slot_time,
         not exists (
           select 1
             from public.appointments a
            where a.lawyer_id = p_lawyer_id
              and a.date = p_date
              and a.status <> 'cancelled'
              and g.slot_time >= a.start_time
              and g.slot_time < a.end_time
         ) as is_available
    from grid g
   order by g.slot_time;
$$;

comment on function public.free_slots(integer, date) is
  'Backs GET /api/appointments/slots?lawyerId=&date= — 30-minute steps, booked slots flagged false.';
