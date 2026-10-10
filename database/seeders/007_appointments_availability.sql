-- ============================================================================
-- JurisFlow · seed 007 · availability and appointments
-- ----------------------------------------------------------------------------
-- Weekly grids for both lawyers, then a diary that spans past and future so the
-- Upcoming / Today / Next 7 days / Past range filters all return rows.
--
-- The exclusion constraint from migration 006 rejects overlapping bookings for
-- the same lawyer, so the slots below are deliberately distinct.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Availability (Mon–Fri 09:00–17:00, Sat 09:00–13:00)
-- ---------------------------------------------------------------------------
insert into public.availability (lawyer_id, day_of_week, start_time, end_time, is_available)
select l.id, seed.day, seed.start_time::time, seed.end_time::time, seed.is_available
  from (values
    ('Monday', '09:00', '17:00', true),
    ('Tuesday', '09:00', '17:00', true),
    ('Wednesday', '09:00', '17:00', true),
    ('Thursday', '09:00', '17:00', true),
    ('Friday', '09:00', '16:00', true),
    ('Saturday', '09:00', '13:00', true),
    ('Sunday', '09:00', '13:00', false)
  ) as seed(day, start_time, end_time, is_available)
  cross join (select id from public.users where role = 'lawyer') l
on conflict (lawyer_id, day_of_week) do nothing;

-- ---------------------------------------------------------------------------
-- Appointments
-- ---------------------------------------------------------------------------
insert into public.appointments (client_id, lawyer_id, date, start_time, end_time,
                                 status, notes, created_by, created_at)
select
  c.id, l.id, seed.appt_date, seed.start_time::time, seed.end_time::time,
  seed.status, seed.notes, a.id, now() - interval '3 days'
from (values
  -- past
  ('client@jurisflow.com', 'lawyer@jurisflow.com',  (current_date - 21), '10:00', '10:30',
   'completed', 'Initial consultation on the deposit dispute.',   'staff@jurisflow.com'),
  ('client2@jurisflow.com','lawyer2@jurisflow.com', (current_date - 14), '14:00', '14:30',
   'completed', 'Lease review and advice on early termination.',  'staff@jurisflow.com'),
  ('client2@jurisflow.com','lawyer@jurisflow.com',  (current_date - 7),  '11:00', '11:45',
   'completed', 'Contract review session; delivery notes examined.','staff@jurisflow.com'),
  -- today
  ('client@jurisflow.com', 'lawyer@jurisflow.com',   current_date,        '09:30', '10:00',
   'confirmed', 'Follow-up on the settlement offer.',             'staff@jurisflow.com'),
  -- upcoming
  ('client2@jurisflow.com','lawyer@jurisflow.com',  (current_date + 2),  '15:00', '15:30',
   'scheduled', 'Discuss the demand letter before sending.',      'staff@jurisflow.com'),
  ('client@jurisflow.com', 'lawyer2@jurisflow.com', (current_date + 4),  '10:00', '10:30',
   'scheduled', 'Employment dispute — bring payslips.',           'staff@jurisflow.com'),
  ('client@jurisflow.com', 'lawyer@jurisflow.com',  (current_date + 9),  '13:00', '13:30',
   'scheduled', 'Settlement negotiation strategy.',               'staff@jurisflow.com'),
  ('client2@jurisflow.com','lawyer2@jurisflow.com', (current_date + 12), '16:00', '16:30',
   'rescheduled', 'Moved from the earlier slot at the client''s request.', 'staff@jurisflow.com'),
  ('client@jurisflow.com', 'lawyer@jurisflow.com',  (current_date + 16), '11:30', '12:00',
   'cancelled', 'Client will rebook after travel.',               'staff@jurisflow.com')
) as seed(client_email, lawyer_email, appt_date, start_time, end_time, status, notes, staff_email)
join public.clients c on c.email = seed.client_email
join public.users l on l.email = seed.lawyer_email
left join public.users a on a.email = seed.staff_email
on conflict do nothing;

-- Set the cancelling client's reason so the UI detail panel has something to show.
update public.appointments
   set cancel_reason = 'Client travelling; will rebook.'
 where status = 'cancelled'
   and cancel_reason is null;

insert into public.activity_logs (user_id, action, details, created_at)
select u.id, 'appointment.create', 'Booked a consultation for a client.', now() - interval '3 days'
  from public.users u
 where u.email = 'staff@jurisflow.com';
