-- ============================================================================
-- JurisFlow · seed 003 · users
-- ----------------------------------------------------------------------------
-- Demo firm. Every account signs in with the password `password123`, hashed
-- with pgcrypto's bcrypt (`crypt(..., gen_salt('bf', 12))`) — the same `$2a$`
-- scheme the Flask API verifies with the `bcrypt` package, so a seeded row and
-- an API-created row are interchangeable.
--
--   admin@jurisflow.com   — Admin / Owner
--   lawyer@jurisflow.com  — Lawyer
--   lawyer2@jurisflow.com — second lawyer (assignment/recommender demos)
--   staff@jurisflow.com   — Lawyer's Assistant
--   client@jurisflow.com  — Client
--   client2@jurisflow.com — second client
-- ============================================================================

insert into public.users (name, email, password_hash, role, phone, address,
                          specialization, bar_number, is_active, created_at)
values
  (
    'Amara Okonkwo', 'admin@jurisflow.com',
    crypt('password123', gen_salt('bf', 12)), 'admin',
    '+254 700 100 001', 'JurisFlow Chambers, 4th Floor, Nairobi',
    'Firm management', null, true, now() - interval '400 days'
  ),
  (
    'Daniel Mwangi', 'lawyer@jurisflow.com',
    crypt('password123', gen_salt('bf', 12)), 'lawyer',
    '+254 700 100 002', 'JurisFlow Chambers, 4th Floor, Nairobi',
    'Litigation & Employment', 'BAR-2018-4471', true, now() - interval '320 days'
  ),
  (
    'Grace Kimani', 'lawyer2@jurisflow.com',
    crypt('password123', gen_salt('bf', 12)), 'lawyer',
    '+254 700 100 003', 'JurisFlow Chambers, 4th Floor, Nairobi',
    'Family & Probate', 'BAR-2020-5512', true, now() - interval '280 days'
  ),
  (
    'Peter Njoroge', 'staff@jurisflow.com',
    crypt('password123', gen_salt('bf', 12)), 'staff',
    '+254 700 100 004', 'JurisFlow Chambers, 4th Floor, Nairobi',
    'Front desk & records', null, true, now() - interval '240 days'
  ),
  (
    'Fatuma Hassan', 'client@jurisflow.com',
    crypt('password123', gen_salt('bf', 12)), 'client',
    '+254 711 200 100', '12 Riverside Drive, Nairobi',
    null, null, true, now() - interval '90 days'
  ),
  (
    'Samuel Otieno', 'client2@jurisflow.com',
    crypt('password123', gen_salt('bf', 12)), 'client',
    '+254 722 300 200', '48 Kilimani Road, Nairobi',
    null, null, true, now() - interval '60 days'
  )
on conflict (email) do nothing;

-- The preferences rows are created by the trigger in 012; backfill in case the
-- trigger was added after these users already existed.
insert into public.notification_settings (user_id)
select id from public.users
on conflict (user_id) do nothing;

-- A short audit trail so the admin dashboard has something to show.
insert into public.activity_logs (user_id, action, details, created_at)
select u.id, seed.action, seed.details, now() - seed.ago
  from (values
    ('admin@jurisflow.com',  'auth.seed',        'Seeded the demo firm.',                     interval '2 days'),
    ('lawyer@jurisflow.com', 'case.update',      'Moved JF-2026-1001 to active.',             interval '26 hours'),
    ('staff@jurisflow.com',  'client.create',    'Opened a client file for Samuel Otieno.',   interval '9 hours'),
    ('lawyer@jurisflow.com', 'document.status',  'Marked lease.pdf as processed.',            interval '4 hours')
  ) as seed(email, action, details, ago)
  join public.users u on u.email = seed.email;
