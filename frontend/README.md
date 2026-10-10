# JurisFlow frontend

React 19 + Vite + TypeScript single-page app for the JurisFlow law-firm platform.
It runs entirely on its own thanks to an in-browser mock API (MSW), or against
the Flask + Supabase backend — nothing in the code changes except one env flag.

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # tsc --noEmit
npm run build      # tsc --noEmit && vite build  -> dist/
npm run preview    # serve the production build on :4173
```

## Troubleshooting `npm run dev`

**1. Run it from `frontend/`.** `package.json`, `vite.config.ts` and
`node_modules/` all live here. Running `npm run dev` in the repository root used to
fail with `npm error code ENOENT … open 'C:\…\priv attorney\package.json'`, because
the root had no `package.json`. It now has a zero-dependency launcher that forwards
to this folder, so either location works:

```powershell
cd frontend
npm run dev

# …or, from the repository root
npm run dev          # root package.json -> "cd frontend && npm run dev"
```

**2. `npm : File C:\Program Files\nodejs\npm.ps1 cannot be loaded because running
scripts is disabled on this system.`** — this is Windows PowerShell's execution
policy, not a project problem. `npm` is a `.ps1` shim on Windows, and the default
policy is `Restricted`. Pick one:

```powershell
# a) use the .cmd shim (no settings touched)
npm.cmd run dev
npm.cmd install

# b) allow locally-signed scripts for your user only (once)
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

# c) use a shell that is not affected
cmd /c "npm run dev"
```

**3. The command looks like it "hangs" after printing the banner.** That is normal —
the dev server owns that terminal and stays in the foreground until you stop it.
Press `q` + Enter to quit it, `h` + Enter for the shortcut list, or Ctrl+C. Leave the
terminal open (minimised is fine) while you use the app.

**4. Where is the `Local:` URL?** It is printed by Vite a moment after start-up, as
the last thing on screen:

```
  VITE v5.4.21  ready in 509 ms
  ➜  Local:   http://localhost:5173/
```

In the VS Code terminal **Ctrl+Click** (Cmd+Click on macOS) that `http://localhost:5173/`
line to open it in the browser, or type the address yourself. Alternative: open the
**Ports** panel (View → Ports) — VS Code detects 5173 and offers a "Open in Browser"
globe icon. Nothing is served until you see that banner.

**5. Port 5173 is busy.** `vite.config.ts` sets `strictPort: false`, so Vite does
not fail — it prints `Port 5173 is in use, trying another one...` and silently
moves to **5174** (or the next free port). If you open 5173 and see a stale/other
app, read the `Local:` line for the real port. To pin a port explicitly:
`npm run dev -- --port 5180`.

**6. The page loads but the console shows `/api/*` failures.** `VITE_USE_MOCKS=true`
in `.env` keeps the demo API in the browser, so no backend is needed. If you set it
to `false`, start Flask first (`python wsgi.py` in `backend/`) — the proxy in
`vite.config.ts` forwards `/api` to `http://127.0.0.1:5000`.

## Demo accounts

Password for all of them: `password123`.

| Role | E-mail |
| --- | --- |
| Admin / owner | `admin@jurisflow.com` |
| Lawyer | `lawyer@jurisflow.com` |
| Lawyer | `lawyer2@jurisflow.com` |
| Staff / assistant | `staff@jurisflow.com` |
| Client | `client@jurisflow.com` |
| Client | `client2@jurisflow.com` |

## Environment

Copy `.env.example` to `.env` when you need to change something:

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_USE_MOCKS` | `true` | `false` sends every `/api/*` call to Flask instead |
| `VITE_API_BASE_URL` | `/api` | where the real API lives (`http://127.0.0.1:5000/api`) |
| `VITE_AI_BASE_URL` | backend `/api/ai` | AI proxy base URL |

## Layout

```
src/
├── App.tsx                 routes: public | /admin | /lawyer | /staff | /client
├── main.tsx                theme -> startMockApi() -> loadSession() -> render
├── components/
│   ├── UI.tsx              design system: GlassCard, Table, Modal, Toaster, …
│   ├── DashboardLayout.tsx shell (sidebar + navbar + toasts) with <Outlet/>
│   ├── ProtectedRoute.tsx  session guard (waits for loadSession)
│   ├── RoleGuard.tsx       inline permission gate + usePermissionGate()
│   ├── Sidebar.tsx         NAV_ITEMS -> links (NAV_ICONS maps the icon keys)
│   └── Navbar.tsx          search, notification bell, theme, profile menu
├── pages/
│   ├── shared/             workbenches + form modals reused by every role
│   ├── admin/  index.tsx   10 thin role pages
│   ├── lawyer/ index.tsx    9
│   ├── staff/  index.tsx    8
│   └── client/ index.tsx    8  + SuggestionsPage (the AI intake)
├── stores/                 zustand: auth, case, consultation, appointment,
│                           document, notification, directory, theme, ui
├── services/               one module per API blueprint (typed, bearer token)
├── ai/                     intake/document/e-mail pipelines + local fallback
├── mocks/                  MSW handlers + in-memory demo database
├── types/                  the shared contracts (mirrors the SQL columns)
└── utils/                  format helpers, navigation map, RBAC, password policy
```

## How a page is built

Every resource screen is **one component with a `scope` prop**, e.g.
`CasesWorkbench scope="firm" | "mine" | "self"`. The role folders are thin
wrappers that choose the scope, the copy and the actions:

```tsx
// pages/admin/index.tsx
export const AdminCases = () => <CasesWorkbench scope="firm" title="All cases" />;

// pages/client/index.tsx
export const ClientCases = () => {
  const clientId = useMyClientId();
  return <CasesWorkbench scope="self" lockedClientId={clientId} canCreate={false} />;
};
```

That is why there is one implementation of the case table, the appointment
diary, the document vault and the intake queue rather than four.

## Permissions

`utils/rbac.ts` mirrors the server matrix: `ROLE_PERMISSIONS[role]`. Use
`RoleGuard` (or `usePermissionGate()`) to hide controls, and remember it is only
cosmetic — the API re-checks every request. `NAV_ITEMS` in `utils/navigation.ts`
drives the sidebar, so a role never sees a link it cannot open.

## The AI layer

`ai/services/nlpService.ts` runs `analyzeLegalProblem()`, which:

1. calls the backend proxy (`/api/ai/chat`) with the intake prompt,
2. streams real progress into `AIProcessingModal` (stage, elapsed, estimate),
3. retries with a fallback model when the provider throttles or times out,
4. falls back to a local heuristic answer (and says so) when nothing answers,
5. caches per query for the session so repeat questions are instant.

The result type (`LegalAnalysisResult`) is rendered by `LegalAnalysisPanel`;
`DocumentAnalysisPanel` does the same for file analysis.

## Mock API

`src/mocks` contains a full demo backend: the same routes, the same RBAC, an
in-memory database (`db.ts`) that is re-seeded on every reload, and realistic
latency. `src/mocks/index.ts` exposes `startMockApi()`, which `main.tsx` awaits
before rendering — so no request ever races the service worker.
