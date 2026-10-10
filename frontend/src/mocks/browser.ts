/* ==========================================================================
   MSW browser worker
   --------------------------------------------------------------------------
   Created once and started from `main.tsx` before the app mounts, so no
   component ever fires a request before the service worker is listening.
   ========================================================================== */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

export default worker;
