-- ============================================================================
-- JurisFlow · seed 010 · legal services, FAQs, notifications
-- ----------------------------------------------------------------------------
-- The last seed: the practice-area catalogue (referenced by consultations),
-- the client-facing FAQ list and a realistic notification inbox.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Practice areas
-- ---------------------------------------------------------------------------
insert into public.legal_services (name, description, is_active, created_by)
select seed.name, seed.description, seed.is_active, u.id
from (values
  ('Landlord & Tenant',  'Leases, deposits, evictions, rent arrears and handover disputes.', true),
  ('Employment',         'Dismissals, redundancy, unpaid wages, disciplinary procedures and contracts.', true),
  ('Family Law',         'Divorce, custody, maintenance, adoption and domestic agreements.', true),
  ('Commercial',         'Supply and service contracts, company disputes and debt recovery.', true),
  ('Probate & Estates',  'Wills, intestacy, grants of representation and estate distribution.', true),
  ('Conveyancing',       'Purchase, sale and transfer of land, searches and stamp duty.', true),
  ('Litigation',         'Court and tribunal representation for contested matters.', true),
  ('General Consultation','First appointment for matters that do not fit another category.', true),
  ('Immigration (paused)','Work and residence permits — not accepting new instructions this quarter.', false)
) as seed(name, description, is_active)
left join public.users u on u.email = 'admin@jurisflow.com'
on conflict (name) do nothing;

-- Link the seeded consultations to the matching practice area.
update public.consultations c
   set service_id = s.id
  from public.legal_services s
 where c.service_id is null
   and (
     (s.name = 'Landlord & Tenant' and c.concern ilike '%deposit%')
     or (s.name = 'Employment' and c.concern ilike '%dismissed%')
     or (s.name = 'Commercial' and c.concern ilike '%supplier%')
     or (s.name = 'Landlord & Tenant' and c.concern ilike '%lease%')
     or (s.name = 'Probate & Estates' and c.concern ilike '%will%')
   );

-- ---------------------------------------------------------------------------
-- FAQs
-- ---------------------------------------------------------------------------
insert into public.faqs (question, answer, category, created_by)
select seed.question, seed.answer, seed.category, u.id
from (values
  (
    'How do I book a consultation?',
    'Sign in to the client portal, open Get suggestions or Appointments and pick one of the free slots the firm publishes. You will receive a confirmation in your notifications.',
    'Appointments', 'staff@jurisflow.com'
  ),
  (
    'What should I bring to the first meeting?',
    'Anything that records the facts: contracts, letters, receipts, payslips, photographs and any messages exchanged. Uploading them beforehand saves time.',
    'Appointments', 'staff@jurisflow.com'
  ),
  (
    'How much will my case cost?',
    'Fees depend on the practice area and the stage the matter reaches. The lawyer explains the basis (fixed fee, hourly or a staged estimate) at the first consultation before any work starts.',
    'Fees', 'admin@jurisflow.com'
  ),
  (
    'Is the AI suggestion legal advice?',
    'No. It is an automated first look at your description that points you to the right practice area and the likely next steps. A lawyer must review the facts before any advice is given.',
    'Using JurisFlow', 'admin@jurisflow.com'
  ),
  (
    'Can the firm see documents I upload?',
    'Only your lawyer and the staff handling your file. Files are stored privately and every download is signed and logged.',
    'Documents', 'staff@jurisflow.com'
  ),
  (
    'Can I cancel or move an appointment?',
    'Yes — from Appointments, up to 24 hours before the slot. Later changes mean the time is usually billed because it was reserved for you.',
    'Appointments', 'staff@jurisflow.com'
  ),
  (
    'How long does a case take?',
    'Negotiated matters often settle within weeks; contested court matters can take months. Your lawyer gives a realistic estimate once the facts and the court diary are known.',
    'Cases', 'lawyer@jurisflow.com'
  )
) as seed(question, answer, category, author_email)
left join public.users u on u.email = seed.author_email
where not exists (select 1 from public.faqs f where f.question = seed.question);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
insert into public.notifications (user_id, type, message, link, is_read, created_at)
select u.id, seed.type, seed.message, seed.link, seed.is_read, now() - seed.ago
  from (values
    ('client@jurisflow.com',  'appointment',  'Your appointment on the deposit dispute is confirmed.',   '/client/appointments',   false, interval '3 hours'),
    ('client@jurisflow.com',  'document',     'tenancy-agreement.pdf has been marked as processed.',     '/client/documents',      false, interval '2 days'),
    ('client@jurisflow.com',  'consultation', 'Your intake request was approved — book a consultation.', '/client/appointments',   true,  interval '70 days'),
    ('client2@jurisflow.com', 'case',         'JF-2026-1003 moved to pending review.',                   '/client/cases',          false, interval '1 day'),
    ('client2@jurisflow.com', 'appointment',  'Your lease-review appointment was completed.',            '/client/appointments',   true,  interval '14 days'),
    ('lawyer@jurisflow.com',  'consultation', 'New intake request from Samuel Otieno.',                  '/lawyer/consultations',  true,  interval '19 days'),
    ('lawyer@jurisflow.com',  'document',     'A new document was uploaded to JF-2026-1003.',            '/lawyer/documents',      false, interval '2 days'),
    ('staff@jurisflow.com',   'appointment',  'Two bookings today — check the calendar before 09:00.',   '/staff/calendar',        false, interval '5 hours'),
    ('admin@jurisflow.com',   'system',       'Weekly firm summary is ready.',                           '/admin/dashboard',       false, interval '1 day')
  ) as seed(email, type, message, link, is_read, ago)
  join public.users u on u.email = seed.email
 where not exists (
   select 1 from public.notifications n where n.user_id = u.id and n.message = seed.message
 );
