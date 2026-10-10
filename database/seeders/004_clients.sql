-- ============================================================================
-- JurisFlow · seed 004 · clients
-- ----------------------------------------------------------------------------
-- Client files for the two demo client logins plus two walk-in clients (no
-- portal account), so the admin/staff screens show a mixed book.
-- ============================================================================

insert into public.clients (user_id, full_name, email, contact, address, notes, created_at)
select
  u.id,
  'Fatuma Hassan',
  'client@jurisflow.com',
  '+254 711 200 100',
  '12 Riverside Drive, Nairobi',
  'Referred by a former client. Prefers afternoon appointments.',
  now() - interval '90 days'
from public.users u
where u.email = 'client@jurisflow.com'
  and not exists (select 1 from public.clients c where c.email = 'client@jurisflow.com');

insert into public.clients (user_id, full_name, email, contact, address, notes, created_at)
select
  u.id,
  'Samuel Otieno',
  'client2@jurisflow.com',
  '+254 722 300 200',
  '48 Kilimani Road, Nairobi',
  'Small-business dispute; documents shared through the portal.',
  now() - interval '60 days'
from public.users u
where u.email = 'client2@jurisflow.com'
  and not exists (select 1 from public.clients c where c.email = 'client2@jurisflow.com');

insert into public.clients (user_id, full_name, email, contact, address, notes, created_at)
values
  (
    null, 'Wanjiru Kamau', 'wanjiru.kamau@example.com',
    '+254 733 400 300', '7 Lavington Green, Nairobi',
    'Walk-in client — no portal account yet; staff handle the file.',
    now() - interval '30 days'
  ),
  (
    null, 'Bright Future Ltd', 'legal@brightfuture.example',
    '+254 744 500 400', 'Industrial Area, Enterprise Road, Nairobi',
    'Corporate client. Two directors sign jointly.',
    now() - interval '18 days'
  )
on conflict (user_id) do nothing;
