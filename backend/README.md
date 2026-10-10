# JurisFlow API (Flask + Supabase)

REST API behind the JurisFlow frontend. Every route under `/api` implements the
same contract the browser's MSW mocks serve, so the UI works identically against
the demo API and the real backend.

- **Language / framework:** Python 3.12, Flask 3 (application factory + blueprints)
- **Database:** PostgreSQL 15 (Supabase), accessed with `psycopg2` and a small
  connection pool
- **Storage:** Supabase Storage bucket `documents` (falls back to `uploads/` locally)
- **AI:** OpenRouter, proxied so the key never reaches the browser

---

## Layout

```
backend/
├── app/
│   ├── __init__.py          create_app(): config, CORS, blueprints, JSON errors
│   ├── config.py            environment-driven settings (Config / ProductionConfig)
│   ├── extensions.py        Postgres pool, Supabase client, storage helpers
│   ├── version.py           API version string
│   ├── utils/
│   │   ├── rbac.py          role → permission matrix (mirrors frontend + SQL seed)
│   │   ├── security.py      bcrypt hashing, JWT issue/verify
│   │   ├── decorators.py    @auth_required, @permission_required, audit logging
│   │   └── responses.py     ok()/error() helpers + body parsing
│   └── blueprints/
│       ├── auth.py          /auth        login, register, profile, password, settings
│       ├── users.py         /users       team management, /users/directory
│       ├── clients.py       /clients     client book, /clients/me
│       ├── cases.py         /cases       matters, status, assignment
│       ├── consultations.py /consultations  intake + review
│       ├── appointments.py  /appointments, /availability, /appointments/slots
│       ├── documents.py     /documents   upload, review, download, analysis
│       ├── notifications.py /notifications  inbox + preferences
│       ├── faqs.py          /faqs, /services
│       ├── knowledge.py     /knowledge/articles
│       ├── roles.py         /permissions, /roles/:role/permissions
│       ├── dashboard.py     /dashboard/stats, /dashboard/overview, /activity
│       └── ai.py            /ai/chat, /nlp/analyze, /nlp/results, /nlp/email-reply
├── requirements.txt
├── .env.example
└── wsgi.py                  gunicorn wsgi:app
```

---

## Run it

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -r requirements.txt
copy .env.example .env                              # fill in the values
python -m flask --app wsgi:app run --debug          # http://127.0.0.1:5000
```

Production:

```bash
gunicorn --bind 0.0.0.0:5000 --workers 3 wsgi:app
```

Apply the schema first (see `database/README.md`), otherwise `/api/health` is the
only endpoint that answers.

### Health check

```bash
curl http://127.0.0.1:5000/api/health
# {"status":"ok","service":"jurisflow-api","version":"2.0.0","storage":"local","ai":true}
```

---

## Authentication

`POST /api/auth/login` returns a JWT signed with `JWT_SECRET`:

```json
{ "user": { "...": "..." }, "token": "eyJ...", "permissions": ["cases.read"] }
```

Send it on every other call:

```
Authorization: Bearer <token>
```

Tokens are stateless and expire after `JWT_EXPIRY_HOURS` (default 12). Downloads
open in a new tab, where no header can be attached, so `/documents/:id/download`
also accepts `?token=`.

Passwords are bcrypt (`$2a$`, 12 rounds) — the same scheme the SQL seeder
produces with pgcrypto, so seeded demo accounts and API-created accounts are
interchangeable.

## Permissions

`app/utils/rbac.py` is the authority:

| Permission | admin | lawyer | staff | client |
| --- | :-: | :-: | :-: | :-: |
| `users.*`, `roles.manage`, `settings.manage` | yes | — | — | — |
| `clients.*`, `cases.*` | yes | yes | yes | read own |
| `consultations.read` | yes | yes | yes | own |
| `consultations.review` | yes | yes | — | — |
| `appointments.*`, `documents.*` | yes | yes | yes | own |
| `nlp.run`, `faqs.read` | yes | yes | yes | yes |
| `faqs.write` | yes | yes | — | — |
| `activity.read` | yes | yes | yes | — |

Declare it on a route: `@permission_required("cases.write")`. The admin can edit
the matrix at runtime from *Settings → Roles & permissions*; the built-in matrix
is the fallback for a fresh database.

---

## Endpoint reference

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/login` \| `/register` \| `/logout` | session |
| GET | `/api/auth/me`, `/api/auth/settings` | profile + preferences |
| PUT | `/api/auth/profile`, `/api/auth/settings` | self-service edits |
| POST | `/api/auth/password` | verifies the current password |
| GET | `/api/users`, `/api/users/directory`, `/api/users/:id/activity` | team |
| POST/PUT/PATCH/DELETE | `/api/users` · `/api/users/:id` · `/api/users/:id/status` | admin |
| GET/POST/PUT/DELETE | `/api/clients` · `/api/clients/:id` · `/api/clients/me` | client book |
| GET/POST/PUT/DELETE | `/api/cases` | `PATCH /:id/status`, `PATCH /:id/assign` |
| GET/POST/PUT/DELETE | `/api/consultations` | `PATCH /:id/status` = review |
| GET/POST/PUT/DELETE | `/api/appointments` | `PATCH /:id/status`, `GET /slots` |
| GET/PUT | `/api/availability` | replaces a lawyer's whole week |
| GET/POST/PATCH/DELETE | `/api/documents` | `GET /:id/download`, `GET /:id/analysis` |
| GET/POST/PATCH/DELETE | `/api/notifications` | `GET /unread-count`, `POST /read-all` |
| GET/POST/PUT/DELETE | `/api/faqs`, `/api/services` | reference data |
| GET/POST/PUT/DELETE | `/api/knowledge/articles` | knowledge base |
| GET/PUT | `/api/permissions`, `/api/roles/:role/permissions` | admin matrix |
| GET | `/api/dashboard/stats`, `/api/dashboard/overview`, `/api/activity` | dashboards |
| POST | `/api/ai/chat`, `/api/nlp/analyze`, `/api/nlp/email-reply` | AI proxy |

### Errors

Every failure answers with the same shape, and the HTTP status carries the meaning:

```json
{ "error": "Missing permission: cases.write.", "status": 403 }
```

`400` validation · `401` not signed in · `403` wrong role · `404` missing row ·
`409` conflict (duplicate e-mail, double-booked slot) · `502` AI provider down.

---

## Business rules worth knowing

- **Case numbers** come from `public.next_case_number()` → `JF-2026-1001`.
- **Double bookings** are refused twice: the API checks availability, and the
  database has an exclusion constraint as the final authority.
- **Availability** is replaced as a whole week (`PUT`), never patched per day.
- **A client** is always scoped to their own file by the token; the `clientId`
  they put in a query string is ignored for client accounts.
- **Deleting** a client with open cases, a user who still leads cases, or a case
  that still holds documents is refused with an explanation instead of cascading.
- **Notifications** are written by the API, never by the browser: an approved
  consultation, a moved appointment and a reviewed document all notify the client.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Database pool is not initialised` | `create_app()` was not used, or `init_extensions` failed |
| `psycopg2.OperationalError: could not connect` | wrong `DATABASE_URL`, or Supabase is not running |
| `401` on every call | missing/expired token — sign in again |
| `502 The AI provider is unavailable` | `OPENROUTER_API_KEY` missing or the provider returned 5xx |
| Uploads land in `backend/uploads/` | no `SUPABASE_SERVICE_KEY` configured (local mode) |
| `RuntimeError: OPENROUTER_API_KEY is not configured` | set it in `backend/.env` |
