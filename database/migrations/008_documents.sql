-- ============================================================================
-- JurisFlow · 008 · documents
-- ----------------------------------------------------------------------------
-- Metadata for the filing cabinet. The bytes live in Supabase Storage (bucket
-- `documents`); this table keeps the ownership, the optional case link and the
-- review status that the AI panel annotates.
-- ============================================================================

create table if not exists public.documents (
  id            serial primary key,
  client_id     integer not null references public.clients (id) on delete cascade,
  case_id       integer references public.cases (id) on delete set null,
  name          text    not null check (length(trim(name)) between 1 and 260),
  storage_path  text    not null,          -- e.g. clients/12/2026/lease.pdf
  file_url      text,                      -- signed or public URL, rebuilt on read
  mime_type     text,
  size_bytes    bigint check (size_bytes is null or size_bytes >= 0),
  status        text    not null default 'received'
                  check (status in ('received', 'reviewing', 'processed', 'rejected')),
  review_note   text,
  uploaded_by   integer references public.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table  public.documents is 'Uploaded files, one row per stored object.';
comment on column public.documents.storage_path is
  'Key inside the Supabase Storage bucket; the API signs it when serving a download.';
comment on column public.documents.status is
  'received | reviewing | processed | rejected — staff move files through review.';

create index if not exists documents_client_idx  on public.documents (client_id);
create index if not exists documents_case_idx    on public.documents (case_id);
create index if not exists documents_status_idx  on public.documents (status);
create index if not exists documents_created_idx on public.documents (created_at desc);

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Search
-- ----------------------------------------------------------------------------
-- The vault searches by name (the UI's search box) and by the AI keywords that
-- the NLP pass extracted for the document.
create index if not exists documents_name_idx on public.documents (lower(name));

-- ---------------------------------------------------------------------------
-- Storage bucket
-- ----------------------------------------------------------------------------
-- Supabase keeps buckets in `storage.buckets`. Creating it here means a fresh
-- database is upload-ready without any manual dashboard step.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  26214400,   -- 25 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'text/plain'
  ]
)
on conflict (id) do nothing;
