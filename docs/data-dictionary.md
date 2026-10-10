# Data dictionary

Every table in `database/migrations/`, with the type that matters, the rules the
database enforces and the TypeScript type the frontend uses. Keep it in sync when
a column changes: `frontend/src/types/index.ts` and the SQL must agree.

Conventions: `timestamptz` is UTC with a zone; `serial` is a 32-bit identity;
`citext` compares case-insensitively; every mutable table carries `created_at`,
`updated_at` (kept current by `set_updated_at()`).

---

## users — `002_users.sql` → `User`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `auth_user_id` | uuid | unique, FK `auth.users` | Supabase native auth, when used |
| `name` | text | 2–120 chars | shown everywhere |
| `email` | citext | unique, not null | the login name |
| `password_hash` | text | not null | bcrypt `$2a$` (12 rounds) |
| `role` | text | `admin` \| `lawyer` \| `staff` \| `client` | drives RBAC + navigation |
| `phone` | text | | |
| `address` | text | | |
| `avatar` | text | | URL |
| `specialization` | text | | lawyers: used by the AI recommender |
| `bar_number` | text | | lawyers |
| `is_active` | boolean | default true | disable instead of delete |
| `last_login_at` | timestamptz | | stamped on login |
| `created_at` / `updated_at` | timestamptz | not null | |

View: **`users_safe`** — the same row without `password_hash`; every API response
uses it. Indexes: `role`, `is_active`, `lower(email)`.

## clients — `003_clients.sql` → `Client`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `user_id` | integer | unique, FK users, nullable | the portal login (null = walk-in) |
| `full_name` | text | 2–160 chars | |
| `email` | citext | | |
| `contact` | text | not null | phone or preferred contact |
| `address` | text | not null | |
| `notes` | text | | internal only |
| `created_by` | integer | FK users | staff who opened the file |

Deleting a client cascades to cases, consultations, appointments and documents —
which is why the API refuses while cases are open.

## cases — `004_cases.sql` → `Case`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `client_id` | integer | FK clients, not null, cascade | |
| `case_number` | text | unique, not null | from `next_case_number()` → `JF-2026-1001` |
| `title` | text | 3–200 chars | |
| `type` | text | default `General` | practice area label |
| `status` | text | open \| pending \| active \| discovery \| closed \| archived | |
| `priority` | text | high \| medium \| low | |
| `assigned_lawyer_id` | integer | FK users, nullable | the lead attorney |
| `description` | text | | |
| `opened_at` | date | default current_date | |
| `closed_at` | date | | set when the status becomes closed/archived |
| `created_by` | integer | FK users | |

Indexes: `client_id`, `assigned_lawyer_id`, `status`, `priority`, `updated_at desc`.
A lawyer's visibility is `assigned_lawyer_id = me` — enforced in the API *and* by RLS.

## consultations — `005_consultations.sql` → `Consultation`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `client_id` | integer | FK clients, not null | who raised it |
| `service_id` | integer | FK legal_services, nullable | practice area |
| `concern` | text | ≥ 20 chars | free text / AI intake text |
| `status` | text | pending \| approved \| declined \| completed | default `pending` |
| `review_note` | text | | the reviewer's reason |
| `reviewed_by` | integer | FK users | |
| `reviewed_at` | timestamptz | | stamped by trigger when leaving `pending` |

Only `consultations.review` holders (admin, lawyer) may leave `pending`; a client
may only withdraw their own pending request.

## appointments — `006_appointments.sql` → `Appointment`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `client_id` | integer | FK clients, cascade | |
| `consultation_id` | integer | FK consultations, nullable, set null | the request it fulfils |
| `lawyer_id` | integer | FK users, cascade | whose diary |
| `date` | date | not null | wall-clock day |
| `start_time` / `end_time` | time | `end_time > start_time` | |
| `status` | text | scheduled \| confirmed \| rescheduled \| completed \| cancelled | |
| `notes` | text | | |
| `cancel_reason` | text | | captured on cancel |
| `created_by` | integer | FK users | usually the front desk |

Constraint **`appointments_no_overlap`**: `EXCLUDE USING gist (lawyer_id WITH =,
date WITH =, tsrange(date + start_time, date + end_time) WITH &&) WHERE (status
<> 'cancelled')` — the database's final word on double-booking. Indexes on
`(lawyer_id, date)`, `client_id`, `status`, `date`.

## availability — `007_availability.sql` → `Availability`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `lawyer_id` | integer | FK users, cascade | |
| `day_of_week` | text | Monday … Sunday | unique per lawyer |
| `start_time` / `end_time` | time | `end_time > start_time` | |
| `is_available` | boolean | default true | false = closed (row kept) |

Function **`free_slots(lawyer_id, date)`** returns the bookable 30-minute slots
(grid minus non-cancelled appointments) and backs
`GET /api/appointments/slots?lawyerId=&date=`. `PUT /availability` replaces the
whole week, so uniqueness is `(lawyer_id, day_of_week)`.

## documents — `008_documents.sql` → `Document`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `client_id` | integer | FK clients, cascade | |
| `case_id` | integer | FK cases, nullable, set null | optional matter link |
| `name` | text | 1–260 chars | sanitised original filename |
| `storage_path` | text | not null | key inside the storage bucket |
| `file_url` | text | | signed on read, not stored long-term |
| `mime_type` | text | | |
| `size_bytes` | bigint | ≥ 0 | |
| `status` | text | received \| reviewing \| processed \| rejected | |
| `review_note` | text | | |
| `uploaded_by` | integer | FK users | client or staff |

Bucket `documents` is created here: private, 25 MB limit, PDF/DOCX/DOC/PNG/JPEG/TXT.

## nlp_results — `009_nlp_results.sql` → `NLPResult`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `document_id` | integer | FK documents, cascade, nullable | document analyses |
| `client_id` | integer | FK clients, cascade, nullable | intake analyses |
| `kind` | text | document \| intake \| email_reply | |
| `classification` | text | | e.g. `Property & Land` |
| `urgency` | text | High \| Medium \| Low | |
| `confidence` | numeric(4,3) | 0–1 | |
| `summary` | text | | |
| `result` | jsonb | default `{}` | raw model payload, kept for auditing |
| `model` | text | | OpenRouter model id |
| `source` | text | openrouter \| msw \| fallback | transparency in the UI |
| `latency_ms` | integer | ≥ 0 | |

Trigger `replace_previous_analysis`: inserting a row for a document deletes the
older ones, so `GET /documents/:id/analysis` returns exactly one answer.

## knowledge_articles — `010_knowledge_articles.sql` → `Article`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `title` | text | 4–200 chars | |
| `category` | text | | |
| `keywords` | text[] | default `{}` | GIN-indexed; scored by the matcher |
| `summary` | text | | |
| `content` | text | | |
| `attorney_specialist` | text | | who to recommend |
| `services_needed` | text[] | | mapped onto `legal_services.name` |
| `status` | text | published \| draft | clients only read published |
| `match_count` | integer | ≥ 0 | how often the AI cited it |
## legal_services — `011_services_faqs_notifications.sql` → `LegalService`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `name` | text | unique, 3–120 chars | the practice area the client picks |
| `description` | text | default `''` | |
| `is_active` | boolean | default true | retired areas stay readable |
| `created_by` | integer | FK users | admin |

`consultations.service_id` references this table with `ON DELETE SET NULL`, so
retiring an area never breaks history.

## faqs — `011_…` → `FAQ`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `question` | text | 5–300 chars | |
| `answer` | text | ≥ 10 chars | |
| `category` | text | default `General` | the portal groups by this |
| `created_by` | integer | FK users | |

## notifications — `011_…` → `Notification`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `user_id` | integer | FK users, cascade | the recipient |
| `type` | text | consultation \| appointment \| case \| document \| system | icon + tone in the UI |
| `message` | text | 3–400 chars | |
| `link` | text | | deep link into the portal |
| `is_read` | boolean | default false | the bell badge counts `false` |

## notification_settings — `012_…` → `NotificationSettings`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `user_id` | integer | PK, FK users, cascade | one row per login |
| `email` | boolean | default true | maps to `email` in the API |
| `in_app` | boolean | default true | maps to `inApp` |
| `consultations` / `appointments` / `documents` | boolean | default true | per-topic toggles |

A trigger creates the row for every new user, so the settings screen always has
something to show.

## activity_logs — `012_…` → `ActivityLog`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `id` | serial | PK | |
| `user_id` | integer | FK users, set null | |
| `action` | text | not null | dotted id, e.g. `case.create`, `document.status` |
| `details` | text | default `''` | human-readable sentence |
| `ip_address` | inet | | from `X-Forwarded-For` when present |

Append-only. Admins read everything (`GET /activity`); other roles see their own
rows only.

## permissions / role_permissions — `012_…` → `Permission`, `RolePermission`

| Column | Type | Rules | Notes |
| --- | --- | --- | --- |
| `permissions.code` | text | PK | `cases.write` |
| `permissions.label` | text | | `Create / edit cases` |
| `permissions.group_label` | text | | the settings screen's section |
| `role_permissions.role` | text | admin \| lawyer \| staff \| client | |
| `role_permissions.permission` | text | FK permissions, cascade | |
| — | — | unique `(role, permission)` | |

Three copies of the same matrix must stay identical:

1. `frontend/src/utils/rbac.ts` — hides UI (cosmetic),
2. `backend/app/utils/rbac.py` — authorises every request (authority),
3. `database/seeders/002_role_permissions.sql` — what the admin edits.

---

## Type mapping (SQL → TypeScript)

| SQL | TypeScript |
| --- | --- |
| `serial` | `number` |
| `citext`, `text` | `string` |
| `boolean` | `boolean` |
| `timestamptz` | ISO `string` |
| `date` | `string` (`YYYY-MM-DD`) |
| `time` | `string` (`HH:MM`) |
| `numeric`, `integer`, `bigint` | `number` |
| `text[]` | `string[]` |
| `jsonb` | `Record<string, unknown>` (narrowed per endpoint) |

Snake case is kept in SQL; the API and the browser speak camelCase
(`assigned_lawyer_id` → `assignedLawyerId`).
