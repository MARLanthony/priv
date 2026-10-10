# Database — schema, migrations and demo data

PostgreSQL 15 (Supabase). Twelve migrations build the schema, ten seeders load a
working demo firm; both are idempotent, so re-running them is safe.

```
database/
├── migrations/          001 → 012, applied in filename order
├── seeders/             001 → 010, applied after the migrations
├── supabase/
│   ├── config.toml      `supabase start` project config
│   └── .env.example     connection values for backend/.env
└── README.md
```

---

## Option A — Supabase CLI (recommended)

```bash
supabase start                 # Docker: Postgres 54322, API 54321, Studio 54323
supabase db reset              # runs migrations/ then seeders/ from scratch
supabase status                # prints the keys for backend/.env
```

`supabase db reset` applies every file in `migrations/` and then every file in
`seeders/`, in filename order — that is why they are numbered.

## Option B — plain psql

```bash
export PGPASSWORD=postgres
for f in database/migrations/*.sql; do psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f "$f"; done
for f in database/seeders/*.sql;   do psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f "$f"; done
```

PowerShell:

```powershell
Get-ChildItem database/migrations/*.sql | ForEach-Object { psql -h 127.0.0.1 -U postgres -d postgres -f $_.FullName }
Get-ChildItem database/seeders/*.sql    | ForEach-Object { psql -h 127.0.0.1 -U postgres -d postgres -f $_.FullName }
```

---

## Migrations

| # | File | What it creates |
| --- | --- | --- |
| 001 | `extensions_and_helpers` | `pgcrypto`, `citext`, `set_updated_at()`, Supabase role helpers |
| 002 | `users` | logins for all four roles + `users_safe` view |
| 003 | `clients` | the client file, linked to a login |
| 004 | `cases` | matters, `next_case_number()` → `JF-2026-1001` |
| 005 | `consultations` | intake pipeline + review stamping trigger |
| 006 | `appointments` | diary + no-overlap exclusion constraint (`btree_gist`) |
| 007 | `availability` | weekly grid + `free_slots(lawyerId, date)` |
| 008 | `documents` | file metadata + the private `documents` storage bucket |
| 009 | `nlp_results` | stored AI output (one row per document, newest wins) |
| 010 | `knowledge_articles` | AI grounding + generated `tsvector` search column |
| 011 | `services_faqs_notifications` | practice areas, FAQs, per-user inbox |
| 012 | `activity_permissions_rls` | audit trail, permission matrix, preferences, RLS |

### Design decisions

- **`timestamptz` everywhere** — a firm works across time zones; only
  `appointments.date` + `start_time`/`end_time` are wall-clock, because a 09:00
  hearing is 09:00 locally.
- **Status columns are `text` + `CHECK`**, not enums, so adding a status is a
  small migration rather than a type rewrite (and PostgREST handles them better).
- **Money-free schema** — billing is out of scope; nothing pretends otherwise.
- **`set_updated_at()` trigger** on every mutable table: the API never has to
  remember to stamp it.
- **`appointments_no_overlap`** is an exclusion constraint on
  `(lawyer_id, date, tsrange(...))` excluding cancelled rows, so two concurrent
  bookings cannot both pass the API check.
- **Row level security** mirrors `utils/rbac.ts` / `rbac.py` for direct
  PostgREST access; the Flask API connects as the service role and enforces the
  same rules in Python.

## Seeders

| # | File | Data |
| --- | --- | --- |
| 001 | `permissions` | the 21 permissions with labels and groups |
| 002 | `role_permissions` | the four-role matrix (asserts clients never get admin rights) |
| 003 | `users` | admin, two lawyers, staff, two clients — password `password123` |
| 004 | `clients` | the two portal clients + two walk-in files |
| 005 | `cases` | four matters across statuses/priorities |
| 006 | `consultations` | one request in each state |
| 007 | `appointments_availability` | weekly grids + past/today/upcoming diary |
| 008 | `documents_nlp` | five files and two stored analyses |
| 009 | `knowledge_articles` | five published articles + one draft |
| 010 | `services_faqs_notifications` | practice areas, FAQs, notifications |

### Demo accounts

| Role | E-mail | Password |
| --- | --- | --- |
| Admin / owner | `admin@jurisflow.com` | `password123` |
| Lawyer | `lawyer@jurisflow.com` | `password123` |
| Lawyer | `lawyer2@jurisflow.com` | `password123` |
| Staff | `staff@jurisflow.com` | `password123` |
| Client | `client@jurisflow.com` | `password123` |
| Client | `client2@jurisflow.com` | `password123` |

Hashes are produced inside Postgres with `crypt(password, gen_salt('bf', 12))`,
i.e. standard bcrypt — the same algorithm the API verifies with `bcrypt`.

---

## Useful queries

```sql
-- Who may do what?
select role, count(*) from public.role_permissions group by role order by role;

-- Today's diary
select a.date, a.start_time, u.name as lawyer, c.full_name as client, a.status
  from public.appointments a
  join public.users u   on u.id = a.lawyer_id
  join public.clients c on c.id = a.client_id
 where a.date = current_date
 order by a.start_time;

-- Free slots for a lawyer (backs GET /api/appointments/slots)
select * from public.free_slots(2, current_date + 2);

-- Reset the demo data only
-- supabase db reset        (migrations + seeders)
```

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `relation "public.users" does not exist` | migrations were not applied, or applied out of order |
| `functions in index expression must be marked IMMUTABLE` | a `knowledge_articles` row was inserted before 010 finished; re-run 010 |
| `conflicting key value violates exclusion constraint` | the appointment overlaps an existing booking (by design) |
| `new row for relation "clients" violates check constraint` | `full_name` shorter than 2 characters |
| Login fails with a seeded account | the `password_hash` was inserted without `pgcrypto`; check `create extension pgcrypto` |
