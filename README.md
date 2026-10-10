# JurisFlow 2.0

Legal advice and consultation platform for a law firm: a client portal that
turns a description of a problem into the right practice area, a booking and a
filed matter — and the internal tools (lawyers, staff, the owner) that handle
everything after that.

```
frontend/   React 19 + Vite + TypeScript  (browser app + in-browser demo API)
backend/    Flask 3 + psycopg2             (REST API, AI proxy)
database/   Supabase / PostgreSQL          (12 migrations, 10 seeders)
docs/       flowchart, block diagram, ERD, data dictionary
```

---

## The four roles

| Role | Lands on | Can do |
| --- | --- | --- |
| **Admin / owner** | `/admin/dashboard` | everything: the firm's cases, the client book, the team, the knowledge base, the role matrix |
| **Lawyer / attorney** | `/lawyer/dashboard` | their docket: assigned cases, intake review, their diary and availability, document review |
| **Staff / assistant** | `/staff/dashboard` | the front desk: intake triage, scheduling for the whole firm, clients, filing |
| **Client / user** | `/client/dashboard` | their own matter only: AI suggestions, bookings, uploads, FAQs, notifications |

The whole flow: a client describes a problem → the AI suggests a practice area,
urgency and next steps → the client submits it as a consultation → staff triage →
a lawyer approves → an appointment is booked inside the lawyer's published hours
→ the matter is opened, documented and reviewed.

---

## Quick start (demo mode, no backend needed)

The frontend ships with an in-browser mock API (MSW), so the whole product runs
without Flask, Postgres or an OpenRouter key.

```bash
npm run setup        # npm install in frontend/ + pip install -r backend/requirements.txt
npm run dev          # http://localhost:5173
```

`npm run dev` works from the repository root **and** from `frontend/` — the root
`package.json` is a dependency-free launcher (`"dev": "cd frontend && npm run dev"`)
that just forwards to the real app. When the server is up, Vite prints:

```
  VITE v5.4.21  ready in 500 ms
  ➜  Local:   http://localhost:5173/
```

In VS Code, Ctrl+Click that `Local:` line (or open the Ports panel) to open the app;
if 5173 is taken, Vite prints `Port 5173 is in use, trying another one...` and
serves the next free port — read the `Local:` line for the real address.

Sign in with any of (password `password123`):

| Role | E-mail |
| --- | --- |
| Admin / owner | `admin@jurisflow.com` |
| Lawyer | `lawyer@jurisflow.com` |
| Lawyer | `lawyer2@jurisflow.com` |
| Staff | `staff@jurisflow.com` |
| Client | `client@jurisflow.com` |
| Client | `client2@jurisflow.com` |

The demo data is re-seeded on every reload, so the UI is always in a known state.

## Full stack

```bash
# 1. database (Docker via Supabase CLI)
supabase start
supabase db reset                       # applies migrations/ then seeders/

# 2. backend
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env                  # fill in Supabase + OpenRouter values
python -m flask --app wsgi:app run --debug      # http://127.0.0.1:5000

# 3. frontend, pointed at Flask instead of the mocks
cd ../frontend
echo VITE_USE_MOCKS=false > .env
npm run dev
```

Each piece has its own README with the detail:
[`frontend/README.md`](frontend/README.md) ·
[`backend/README.md`](backend/README.md) ·
[`database/README.md`](database/README.md) ·
[`docs/data-dictionary.md`](docs/data-dictionary.md)

---

## What is where

### Frontend (`frontend/src`)

- `pages/shared/*Workbench.tsx` — one component per resource, reused by every
  role through a `scope` prop (`firm` \| `mine` \| `reviewer` \| `self`). This is
  why the admin "All cases" screen and the client "My cases" screen are the same
  code with a different perspective.
- `pages/{admin,lawyer,staff,client}/index.tsx` — thin wrappers that set the
  scope, the title and the actions for each role.
- `components/UI.tsx` — the design system (glass cards, tables, modals, toasts).
- `stores/*` — zustand: auth, cases, consultations, appointments, documents,
  notifications, directory, theme, UI.
- `services/*` — one module per blueprint, all through `apiClient` (bearer token,
  normalised errors).
- `ai/*` — the intake pipeline (`analyzeLegalProblem`), document analysis,
  e-mail drafts, streaming progress, retries and a local-heuristic fallback so
  the product still answers when the provider is down.
- `mocks/*` — the MSW demo API: the same endpoints as Flask, an in-memory
  database and the same RBAC rules.

### Backend (`backend/app`)

Application factory + 14 blueprints (`auth`, `users`, `clients`, `cases`,
`consultations`, `appointments`, `documents`, `notifications`, `faqs`,
`services`, `knowledge`, `roles`, `dashboard`, `ai`), a shared `utils` package
(RBAC matrix, bcrypt + JWT, decorators, response helpers) and a Postgres pool.

### Database (`database`)

Twelve migrations (helpers → users → clients → cases → consultations →
appointments → availability → documents → nlp_results → knowledge_articles →
services/FAQs/notifications → activity/permissions/RLS) and ten seeders that load
a demo firm. Constraints do real work: one client file per login, one availability
row per weekday, no overlapping appointments for a lawyer, `updated_at` kept by
trigger, and a full-text index for the knowledge base.

- `clients.user_id` is unique — a login owns exactly one client file.
- `availability` is unique per `(lawyer_id, day_of_week)`.
- `appointments_no_overlap` — an exclusion constraint stops double-booking a
  lawyer even if two requests race.
- `documents`, `cases`, `consultations` and `appointments` cascade from
  `clients`, so deleting a file is deliberate and guarded.
- `set_updated_at()` on every mutable table; `stamp_consultation_review()` records
  who decided an intake; `replace_previous_analysis()` keeps one analysis per file.

---

## How the pieces talk

```
browser -- services/*.ts --> /api/* --> MSW (demo)  or  Flask --> Supabase Postgres
   |                                        |
   +-- ai/*.ts --> /api/ai/chat ------------+------------------> OpenRouter
```

- **One contract.** `frontend/src/services/*` and `backend/app/blueprints/*` are
  1:1 modules; every failure is `{ "error": string, "status": number }`.
- **One permission matrix, three copies.** `utils/rbac.ts` (hides UI),
  `utils/rbac.py` (authorises), `seeders/002_role_permissions.sql` (what the
  admin edits). The API never trusts the browser.
- **One source of types.** `frontend/src/types/index.ts` mirrors the SQL columns;
  the API answers in camelCase.

## Security notes

- Passwords are bcrypt (12 rounds). The SQL seeder hashes with pgcrypto, so
  seeded and API-created accounts use the same scheme.
- Tokens are JWTs signed with `JWT_SECRET`, expiring after `JWT_EXPIRY_HOURS`.
  Downloads additionally accept `?token=` because a new tab cannot send headers.
- The OpenRouter key lives only in `backend/.env`; the browser calls `/api/ai/chat`.
- Document downloads are signed per request (Supabase) or streamed from the
  server; nothing is public.
- Row level security mirrors the API rules for direct PostgREST access.
- `.env` is git-ignored; the `.env.example` files document every variable.

## Quality gates

```bash
npm run check:web                    # cd frontend && tsc --noEmit
npm run typecheck                    # same thing, kept for muscle memory
npm run build                        # cd frontend && tsc --noEmit && vite build -> frontend/dist
npm run check:api                    # python -m compileall backend
python -m compileall backend         # identical, run from anywhere
```

Every root script is a one-line forwarder, so the equivalent `cd frontend && npm …`
form always works too. Run `npm run` (no argument) to list them.

## Documentation

| File | What it explains |
| --- | --- |
| `docs/system-flowchart.txt` | the runtime flow, role by role, with the API call at each step |
| `docs/system-block-diagram.txt` | layers, modules and the contracts between them |
| `docs/data-dictionary.md` | every table, column, constraint and TypeScript type |
| `docs/erd.txt` | the entity relationships on one page |
| `backend/README.md` | endpoints, permissions, business rules, troubleshooting |
| `database/README.md` | migrations, seeders, demo accounts, useful queries |

## Notes and limits

- The UI ships with the demo API on by default (`VITE_USE_MOCKS`); set it to
  `false` to talk to Flask. Nothing else changes.
- Seeded documents are metadata only — the storage bucket starts empty, so a
  download returns a placeholder until a real upload happens.
- Billing, e-signature, e-mail delivery and client-facing chat are deliberately
  out of scope; the schema does not pretend to model them.
