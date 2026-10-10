/* ==========================================================================
   MSW handler registry
   --------------------------------------------------------------------------
   Every mock blueprint is registered here, in the same order the Flask app
   registers its blueprints. Specific routes must come before parameterised
   ones inside a module (`/users/directory` before `/users/:id`), and modules
   are listed by how likely their paths collide, so the first match wins.
   ========================================================================== */

import { authHandlers } from './auth';
import { userHandlers } from './users';
import { clientHandlers } from './clients';
import { roleHandlers } from './roles';
import { caseHandlers } from './cases';
import { consultationHandlers } from './consultations';
import { appointmentHandlers } from './appointments';
import { documentHandlers } from './documents';
import { notificationHandlers } from './notifications';
import { faqHandlers, serviceHandlers } from './faqs';
import { analysisHandlers } from './analysis';
import { dashboardHandlers } from './dashboard';

/** Everything the mock API answers, in precedence order. */
export const handlers = [
  ...authHandlers,
  ...userHandlers,
  ...clientHandlers,
  ...roleHandlers,
  ...caseHandlers,
  ...consultationHandlers,
  ...appointmentHandlers,
  ...documentHandlers,
  ...notificationHandlers,
  ...faqHandlers,
  ...serviceHandlers,
  ...analysisHandlers,
  ...dashboardHandlers,
];

export {
  authHandlers,
  userHandlers,
  clientHandlers,
  roleHandlers,
  caseHandlers,
  consultationHandlers,
  appointmentHandlers,
  documentHandlers,
  notificationHandlers,
  faqHandlers,
  serviceHandlers,
  analysisHandlers,
  dashboardHandlers,
};

export default handlers;
