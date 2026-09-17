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

export const worker = setupWorker(
  ...authHandlers,
  ...caseHandlers,
  ...documentHandlers,
  ...inboxHandlers,
  ...knowledgeHandlers,
  ...nlpHandlers,
  ...appointmentHandlers,
  ...availabilityHandlers,
  ...teamHandlers,
  ...settingsHandlers,
);
