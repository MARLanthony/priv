-- ============================================================================
-- JurisFlow · seed 005 · cases
-- ----------------------------------------------------------------------------
-- Four matters spread across statuses/priorities and both lawyers, so every
-- tab of the cases workbench has something in it.
-- ============================================================================

insert into public.cases (client_id, case_number, title, type, status, priority,
                          assigned_lawyer_id, description, opened_at, created_by, created_at)
select
  c.id, seed.case_number, seed.title, seed.type, seed.status, seed.priority,
  l.id, seed.description, seed.opened_at::date, a.id, now() - seed.ago
from (values
  (
    'client@jurisflow.com', 'JF-2026-1001', 'Deposit recovery — Riverside lease',
    'Landlord & Tenant', 'active', 'high', 'lawyer@jurisflow.com',
    'Landlord withheld the deposit after the tenancy ended. Letter of demand served; negotiating a settlement.',
    (now() - interval '80 days')::date, interval '80 days'
  ),
  (
    'client@jurisflow.com', 'JF-2026-1002', 'Unfair dismissal — logistics company',
    'Employment', 'discovery', 'medium', 'lawyer2@jurisflow.com',
    'Client dismissed without notice after three years. Gathering payslips and the disciplinary record.',
    (now() - interval '45 days')::date, interval '45 days'
  ),
  (
    'client2@jurisflow.com', 'JF-2026-1003', 'Supply contract dispute — Bright Future Ltd',
    'Commercial', 'pending', 'high', 'lawyer@jurisflow.com',
    'Faulty delivery of industrial components. Contract review under way before issuing proceedings.',
    (now() - interval '21 days')::date, interval '21 days'
  ),
  (
    null, 'JF-2026-1004', 'Succession and probate — Wanjiru Kamau',
    'Probate & Estates', 'open', 'low', 'lawyer2@jurisflow.com',
    'Grant of representation for the estate; family agreement on record.',
    (now() - interval '9 days')::date, interval '9 days'
  )
) as seed(client_email, case_number, title, type, status, priority, lawyer_email,
          description, opened_at, ago)
join public.clients c on c.email = seed.client_email
join public.users l on l.email = seed.lawyer_email
left join public.users a on a.email = 'staff@jurisflow.com'
on conflict (case_number) do nothing;

-- The walk-in client has no e-mail match above; attach the probate file.
insert into public.cases (client_id, case_number, title, type, status, priority,
                          assigned_lawyer_id, description, opened_at, created_at)
select
  c.id, 'JF-2026-1004', 'Succession and probate — Wanjiru Kamau',
  'Probate & Estates', 'open', 'low', l.id,
  'Grant of representation for the estate; family agreement on record.',
  (now() - interval '9 days')::date, now() - interval '9 days'
from public.clients c
join public.users l on l.email = 'lawyer2@jurisflow.com'
where c.full_name = 'Wanjiru Kamau'
on conflict (case_number) do nothing;

-- Keep the generator ahead of the seeded numbers.
select setval('public.case_number_seq', greatest(2000, (select last_value from public.case_number_seq)), true);

insert into public.activity_logs (user_id, action, details, created_at)
select u.id, 'case.seed', seed.details, now() - seed.ago
  from (values
    ('lawyer@jurisflow.com',  'Opened JF-2026-1001 for Fatuma Hassan.', interval '80 days'),
    ('lawyer2@jurisflow.com', 'Opened JF-2026-1002 for Fatuma Hassan.', interval '45 days'),
    ('lawyer@jurisflow.com',  'Opened JF-2026-1003 for Bright Future Ltd.', interval '21 days')
  ) as seed(email, details, ago)
  join public.users u on u.email = seed.email;
