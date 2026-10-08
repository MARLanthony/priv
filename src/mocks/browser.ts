import { setupWorker } from 'msw/browser';
import { authHandlers } from './handlers/auth';
import { caseHandlers } from './handlers/cases';
import { documentHandlers } from './handlers/documents';
import { inboxHandlers } from './handlers/inbox';
import { knowledgeHandlers } from './handlers/knowledge';
import { nlpHandlers } from './handlers/nlp';
import { appointmentHandlers } from './handlers/appointments';
import { availabilityHandlers } from './handlers/availability';
import { teamHandlers } from './handlers/team';
import { settingsHandlers } from './handlers/settings';
import { directoryHandlers } from './handlers/directory';

/**
 * With `VITE_AUTH_BACKEND=mysql` the auth routes are deliberately NOT mocked, so
 * registration and login reach the real API in `server/` — Express writing to
 * your local MySQL (Vite proxies `/api` there). Everything else stays mocked, so
 * the rest of the demo UI keeps working unchanged.
 *
 * Without that flag the bundled admin account drives /api/auth/* as before.
 */
const useMysqlAuth = import.meta.env.VITE_AUTH_BACKEND === 'mysql';

export const worker = setupWorker(
  ...(useMysqlAuth ? [] : authHandlers),
  ...caseHandlers,
  ...documentHandlers,
  ...inboxHandlers,
  ...knowledgeHandlers,
  ...nlpHandlers,
  ...appointmentHandlers,
  ...availabilityHandlers,
  ...teamHandlers,
  ...settingsHandlers,
  ...directoryHandlers,
);
