-- ============================================================================
-- JurisFlow · 010 · knowledge_articles
-- ----------------------------------------------------------------------------
-- The firm's knowledge base. These rows are what grounds the AI answers: the
-- local matcher scores a client's description against `keywords`, `services`
-- and `attorney_specialist`, and the results panel links back to the article.
-- ============================================================================

create table if not exists public.knowledge_articles (
  id                   serial primary key,
  title                text    not null check (length(trim(title)) between 4 and 200),
  category             text    not null default 'General',
  keywords             text[]  not null default '{}',
  summary              text    not null default '',
  content              text    not null default '',
  attorney_specialist  text    not null default '',
  services_needed      text[]  not null default '{}',
  status               text    not null default 'published'
                         check (status in ('published', 'draft')),
  match_count          integer not null default 0 check (match_count >= 0),
  created_by           integer references public.users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

comment on table  public.knowledge_articles is
  'Firm guidance used by the AI recommender (matchArticles) and shown in the reading panel.';
comment on column public.knowledge_articles.keywords is
  'Lower-cased search terms scored against the client query (GIN-indexed).';
comment on column public.knowledge_articles.match_count is
  'How often the article has been recommended — surfaced as "AI matches" in the admin table.';

create index if not exists knowledge_status_idx   on public.knowledge_articles (status);
create index if not exists knowledge_category_idx on public.knowledge_articles (lower(category));
create index if not exists knowledge_keywords_idx on public.knowledge_articles using gin (keywords);
create index if not exists knowledge_services_idx on public.knowledge_articles using gin (services_needed);
create index if not exists knowledge_title_idx    on public.knowledge_articles (lower(title));

drop trigger if exists knowledge_set_updated_at on public.knowledge_articles;
create trigger knowledge_set_updated_at
  before update on public.knowledge_articles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Full-text search across title + summary + content
-- ---------------------------------------------------------------------------
alter table public.knowledge_articles
  add column if not exists search_document tsvector
  generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) stored;

create index if not exists knowledge_search_idx
  on public.knowledge_articles using gin (search_document);

comment on column public.knowledge_articles.search_document is
  'Generated tsvector backing GET /api/knowledge/articles?q= (websearch_to_tsquery).';
