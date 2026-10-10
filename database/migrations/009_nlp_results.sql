-- ============================================================================
-- JurisFlow · 009 · nlp_results
-- ----------------------------------------------------------------------------
-- The stored output of the AI layer. Two producers write here:
--
--   * `POST /api/documents/:id/analysis`  → a document classification
--   * `POST /api/nlp/analyze`             → a legal-intake suggestion
--
-- `result` keeps the raw structured payload (the model's JSON) so the UI can be
-- improved without re-running the model, and the flattened columns
-- (`classification`, `summary`, `urgency`) make the table queryable/reportable.
-- ============================================================================

create table if not exists public.nlp_results (
  id             serial primary key,
  document_id    integer references public.documents (id) on delete cascade,
  client_id      integer references public.clients (id) on delete cascade,
  kind           text    not null default 'document'
                   check (kind in ('document', 'intake', 'email_reply')),
  classification text,                       -- e.g. 'Property & Land', 'Employment'
  urgency        text check (urgency is null or urgency in ('High', 'Medium', 'Low')),
  confidence     numeric(4, 3) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  summary        text,
  result         jsonb   not null default '{}'::jsonb,
  model          text,                       -- openrouter model id that answered
  source         text check (source is null or source in ('openrouter', 'msw', 'fallback')),
  latency_ms     integer check (latency_ms is null or latency_ms >= 0),
  created_at     timestamptz not null default now()
);

comment on table  public.nlp_results is 'Stored AI output (document analysis, intake, e-mail drafts).';
comment on column public.nlp_results.result is
  'Raw structured payload from the model, kept for auditing and UI evolution.';
comment on column public.nlp_results.source is
  'openrouter (live model) | msw (demo API) | fallback (local heuristics).';

create index if not exists nlp_results_document_idx on public.nlp_results (document_id);
create index if not exists nlp_results_client_idx   on public.nlp_results (client_id);
create index if not exists nlp_results_kind_idx     on public.nlp_results (kind);
create index if not exists nlp_results_created_idx  on public.nlp_results (created_at desc);

-- The vault panel asks for "the analysis of this document": the newest row wins.
create index if not exists nlp_results_latest_doc_idx
  on public.nlp_results (document_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Keep only the newest analysis per document
-- ---------------------------------------------------------------------------
-- Re-analysing a file replaces the previous answer, which is what the UI
-- expects (`GET /api/documents/:id/analysis` returns a single object).
create or replace function public.replace_previous_analysis()
returns trigger
language plpgsql
as $$
begin
  if new.document_id is not null then
    delete from public.nlp_results
     where document_id = new.document_id
       and id <> new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists nlp_results_replace_previous on public.nlp_results;
create trigger nlp_results_replace_previous
  after insert on public.nlp_results
  for each row execute function public.replace_previous_analysis();
