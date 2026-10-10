-- ============================================================================
-- JurisFlow · seed 009 · knowledge base
-- ----------------------------------------------------------------------------
-- The articles that ground the AI intake. The `keywords`, `services_needed` and
-- `attorney_specialist` columns are what `matchArticles()` (frontend) and the
-- backend recommender score a client's description against, so they are written
-- the way a client would phrase the problem — not the way a lawyer would.
-- ============================================================================

insert into public.knowledge_articles
  (title, category, keywords, summary, content, attorney_specialist,
   services_needed, status, match_count, created_by, created_at)
select
  seed.title, seed.category, seed.keywords::text[], seed.summary, seed.content,
  seed.specialist, seed.services::text[], seed.status, seed.matches, u.id,
  now() - seed.ago
from (values
  (
    'Tenancy deposits: when must a landlord refund?',
    'Property & Land',
    array['landlord','tenant','deposit','lease','tenancy','refund','rent','eviction','house'],
    'A landlord must refund a deposit within the period stated in the lease (commonly 30 days) once the tenant has handed over and any agreed deductions are documented.',
    E'Key points\n\n1. The lease governs the deadline. Where it is silent, the statutory default applies.\n2. Deductions must be itemised and supported by evidence (photos, invoices, a handover report).\n3. Normal wear and tear is not a deductible loss.\n4. A letter of demand is usually enough; if it is ignored, the claim goes to the small-claims or magistrate court depending on the amount.',
    'Landlord & Tenant Law',
    array['Contract Review','Litigation'], 'published', 12, interval '300 days'
  ),
  (
    'Dismissal without notice: what the employer must prove',
    'Employment',
    array['dismissal','employment','notice','gross misconduct','hearing','salary','termination','employee','redundancy'],
    'A no-notice dismissal is only lawful where the employer can show gross misconduct and followed a fair procedure, including a hearing.',
    E'Key points\n\n1. The employer carries the burden of proving the misconduct.\n2. A hearing (or a documented opportunity to be heard) is required before dismissal.\n3. Remedies include reinstatement, compensation and unpaid benefits.\n4. Keep payslips, the contract, the dismissal letter and any messages about the process.',
    'Employment Law',
    array['Litigation','Contract Review'], 'published', 9, interval '260 days'
  ),
  (
    'Custody arrangements that hold up',
    'Family Law',
    array['custody','children','divorce','maintenance','family','access','parenting','marriage','separation'],
    'Courts look at the best interests of the child first: stability, schooling and each parent''s involvement usually decide the arrangement.',
    E'Key points\n\n1. Put any agreement in writing, even before it is filed.\n2. Record the practical details: drop-offs, holidays and communication.\n3. Where agreement is impossible, mediation is usually the first step.\n4. Maintenance is assessed against income and the child''s needs, not a fixed formula.',
    'Family Law',
    array['Family Law Consultation','Mediation'], 'published', 7, interval '210 days'
  ),
  (
    'Faulty goods and refunds under a supply contract',
    'Commercial',
    array['supplier','contract','goods','refund','invoice','defective','delivery','commercial','company'],
    'A buyer must notify defects within the contractual window (often 30 days); after that the right to reject can be lost even where the goods are plainly faulty.',
    E'Key points\n\n1. Check the notification clause before writing anything else.\n2. Notify in writing, describing the defect and the remedy you want.\n3. Keep the delivery note, the invoice and photographs.\n4. Liability caps in the contract limit what can be recovered.',
    'Commercial Law',
    array['Contract Review','Litigation'], 'published', 5, interval '150 days'
  ),
  (
    'Probate without a will: the family agreement route',
    'Probate & Estates',
    array['will','probate','estate','inheritance','succession','deceased','land','family'],
    'Where there is no will, the estate is distributed under the intestacy rules, but a written family agreement speeds up the grant of representation.',
    E'Key points\n\n1. List every asset and liability before anything is distributed.\n2. The grant of representation is what lets the estate be transferred.\n3. A written family agreement avoids later disputes between beneficiaries.\n4. Land transfers need the grant plus a survey and the land registry forms.',
    'Probate & Estates',
    array['Probate & Estates Consultation','Conveyancing'], 'published', 4, interval '110 days'
  )
) as seed(title, category, keywords, summary, content, specialist, services, status, matches, ago)
left join public.users u on u.email = 'admin@jurisflow.com'
where not exists (select 1 from public.knowledge_articles k where k.title = seed.title);

-- A draft entry so the admin table has something to publish.
insert into public.knowledge_articles
  (title, category, keywords, summary, content, attorney_specialist,
   services_needed, status, match_count, created_by)
select
  'Small claims court: is it worth it?',
  'Litigation',
  array['small claims','court','debt','fees','process','claim'],
  'Draft note on the cost and speed of the small-claims track for low-value money claims.',
  'Outline: eligibility threshold, filing fees, timelines, enforcement of a judgment.',
  'Litigation',
  array['Litigation'], 'draft', 0, u.id
from public.users u
where u.email = 'lawyer@jurisflow.com'
  and not exists (select 1 from public.knowledge_articles k where k.title = 'Small claims court: is it worth it?');
