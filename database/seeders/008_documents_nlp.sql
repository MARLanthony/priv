-- ============================================================================
-- JurisFlow · seed 008 · documents and stored AI results
-- ----------------------------------------------------------------------------
-- Document rows point at objects in the private `documents` bucket. The seed
-- only writes the metadata (there are no bytes in a fresh storage bucket), so
-- the download route returns a placeholder until a real upload happens — which
-- is exactly what the MSW mock does in the browser.
-- ============================================================================

insert into public.documents (client_id, case_id, name, storage_path, mime_type, size_bytes,
                              status, uploaded_by, created_at)
select
  c.id, cs.id, seed.name,
  'clients/' || c.id || '/' || seed.name,
  seed.mime, seed.size, seed.status, u.id, now() - seed.ago
from (values
  ('client@jurisflow.com',  'JF-2026-1001', 'tenancy-agreement.pdf', 'application/pdf', 284120, 'processed', 'client@jurisflow.com',  interval '78 days'),
  ('client@jurisflow.com',  'JF-2026-1001', 'deposit-receipt.png',   'image/png',       512400, 'processed', 'client@jurisflow.com',  interval '77 days'),
  ('client@jurisflow.com',  'JF-2026-1002', 'dismissal-letter.pdf',  'application/pdf', 118300, 'reviewing', 'client@jurisflow.com',  interval '5 days'),
  ('client2@jurisflow.com', 'JF-2026-1003', 'supply-contract.docx',  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 74210, 'processed', 'lawyer@jurisflow.com', interval '20 days'),
  ('client2@jurisflow.com', 'JF-2026-1003', 'delivery-note.pdf',     'application/pdf', 96300,  'received',  'client2@jurisflow.com', interval '2 days')
) as seed(client_email, case_number, name, mime, size, status, uploader_email, ago)
join public.clients c on c.email = seed.client_email
join public.cases cs on cs.case_number = seed.case_number
left join public.users u on u.email = seed.uploader_email
where not exists (select 1 from public.documents d where d.name = seed.name and d.client_id = c.id);

-- ---------------------------------------------------------------------------
-- Stored analyses (the vault's "AI classification" panel)
-- ---------------------------------------------------------------------------
insert into public.nlp_results (document_id, client_id, kind, classification, urgency,
                                confidence, summary, result, model, source, latency_ms, created_at)
select
  d.id, d.client_id, 'document', seed.classification, seed.urgency, seed.confidence,
  seed.summary,
  jsonb_build_object(
    'documentType', seed.classification,
    'parties', seed.parties::jsonb,
    'dates', seed.dates::jsonb,
    'clauses', seed.clauses::jsonb,
    'summary', seed.summary,
    'risks', seed.risks::jsonb
  ),
  'deepseek/deepseek-r1:free', 'openrouter', seed.latency, now() - interval '1 day'
from (values
  (
    'tenancy-agreement.pdf', 'Property & Land', 'Low', 0.930,
    'Residential tenancy agreement for 12 Riverside Drive, twelve-month term with a refundable deposit.',
    array['Fatuma Hassan', 'Riverside Holdings Ltd'],
    array['2025-03-01', '2026-02-28'],
    array['Deposit held for 30 days after handover.', 'No early-termination clause.'],
    array['Deposit refund timing depends on the handover report.'],
    1840
  ),
  (
    'supply-contract.docx', 'Contract Review', 'Medium', 0.880,
    'Supply agreement for industrial components with a 30-day defect notification window.',
    array['Bright Future Ltd', 'Northgate Supplies'],
    array['2026-01-15'],
    array['Defects must be notified within 30 days.', 'Liability capped at the invoice value.'],
    array['The defect notification window has almost elapsed.'],
    2260
  )
) as seed(name, classification, urgency, confidence, summary, parties, dates, clauses, risks, latency)
join public.documents d on d.name = seed.name
where not exists (select 1 from public.nlp_results r where r.document_id = d.id);

insert into public.activity_logs (user_id, action, details, created_at)
select u.id, 'document.upload', 'Uploaded tenancy-agreement.pdf for Fatuma Hassan.', now() - interval '78 days'
  from public.users u where u.email = 'client@jurisflow.com';
