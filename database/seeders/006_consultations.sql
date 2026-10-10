-- ============================================================================
-- JurisFlow · seed 006 · consultations
-- ----------------------------------------------------------------------------
-- The intake queue in each state, so the tabs (pending / approved / declined /
-- completed) and the reviewer buttons all have data.
--
-- `service_id` is filled in seeder 010, which loads the practice areas.
-- ============================================================================

insert into public.consultations (client_id, concern, status, review_note, reviewed_by,
                                  reviewed_at, created_at)
select
  c.id, seed.concern, seed.status, seed.review_note, r.id, seed.reviewed_at, now() - seed.ago
from (values
  (
    'client@jurisflow.com',
    'My landlord has refused to refund my deposit for two months after I moved out, and he is now claiming damages I did not cause.',
    'approved', 'Clear tenancy dispute — booked for an initial consultation.', 'lawyer@jurisflow.com',
    now() - interval '70 days', interval '78 days'
  ),
  (
    'client@jurisflow.com',
    'I was dismissed without notice after three years of service. The letter says gross misconduct but no hearing was held.',
    'pending', null, null, null, interval '6 days'
  ),
  (
    'client2@jurisflow.com',
    'A supplier delivered industrial components that do not match the specification and refuses either to replace them or to refund the invoice.',
    'approved', 'Contract and delivery notes reviewed; pursuing a refund.', 'lawyer@jurisflow.com',
    now() - interval '16 days', interval '19 days'
  ),
  (
    'client2@jurisflow.com',
    'I would like advice on whether I can terminate my shop lease early without paying the remaining six months.',
    'declined', 'Lease reviewed: no early-termination clause, so the balance remains payable.', 'lawyer2@jurisflow.com',
    now() - interval '12 days', interval '14 days'
  ),
  (
    null,
    'My late father left a house and two plots without a will; the family agrees on how to share them but we do not know the process.',
    'completed', 'Grant of representation obtained and the estate distributed.', 'lawyer2@jurisflow.com',
    now() - interval '4 days', interval '11 days'
  )
) as seed(client_email, concern, status, review_note, reviewer_email, reviewed_at, ago)
join public.clients c on c.email = seed.client_email
left join public.users r on r.email = seed.reviewer_email;

-- The walk-in client (no e-mail) gets the probate enquiry.
insert into public.consultations (client_id, concern, status, review_note, reviewed_by, reviewed_at, created_at)
select c.id,
  'My late father left a house and two plots without a will; the family agrees on how to share them but we do not know the process.',
  'completed', 'Grant of representation obtained and the estate distributed.',
  r.id, now() - interval '4 days', now() - interval '11 days'
from public.clients c
left join public.users r on r.email = 'lawyer2@jurisflow.com'
where c.full_name = 'Wanjiru Kamau'
  and not exists (
    select 1 from public.consultations x
     where x.client_id = c.id and x.status = 'completed'
  );

insert into public.activity_logs (user_id, action, details, created_at)
select u.id, 'consultation.review', seed.details, now() - seed.ago
  from (values
    ('lawyer@jurisflow.com',  'Approved an intake request from Fatuma Hassan.',   interval '70 days'),
    ('lawyer@jurisflow.com',  'Approved an intake request from Samuel Otieno.',   interval '16 days'),
    ('lawyer2@jurisflow.com', 'Declined a lease-termination request from Samuel Otieno.', interval '12 days')
  ) as seed(email, details, ago)
  join public.users u on u.email = seed.email;
