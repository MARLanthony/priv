/* ==========================================================================
   MSW — single import point
   --------------------------------------------------------------------------
   `startMockApi()` is awaited in `main.tsx` before React renders. It is a
   no-op when:

     • `VITE_USE_MOCKS=false` — every request goes to the Flask + Supabase
       backend instead (see `frontend/.env.example`), or
     • there is no `window` (SSR / unit tests), or
     • the browser has no service-worker support.

   Demo data lives in `./db` and is re-seeded on every reload, so the UI is
   always in a known state. Sign in with any of:

     admin@jurisflow.com · lawyer@jurisflow.com · staff@jurisflow.com ·
     client@jurisflow.com     (password: password123)
   ========================================================================== */

import { worker } from './browser';

export { worker } from './browser';
export { handlers } from './handlers';
export type { Database, MockUser } from './db';
export { db, DEMO_PASSWORD, newId, resetIds, settingsFor } from './db';

/** True when the bundled demo API should intercept `/api/*`. */
export function shouldUseMocks(): boolean {
  const flag = (import.meta.env.VITE_USE_MOCKS ?? '').trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;

  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

let started: Promise<void> | null = null;

/**
 * Starts the service worker exactly once. Safe to await from `main.tsx`;
 * resolving early (or rejecting) never blocks the app, because a failed
 * worker only means the real API answers instead.
 */
export function startMockApi(): Promise<void> {
  if (!started) {
    started = shouldUseMocks()
      ? worker
          .start({
            // Warn instead of throwing when a handler is missing.
            onUnhandledRequest: 'bypass',
            quiet: false,
            serviceWorker: { url: '/mockServiceWorker.js' },
          })
          .then(() => {
            console.info(
              '[JurisFlow] Demo API active (MSW). Sign in as admin/lawyer/staff/client' +
                '@jurisflow.com with password123, or set VITE_USE_MOCKS=false to use Flask.',
            );
          })
          .catch(error => {
            console.warn('[JurisFlow] MSW could not start; calls will reach the real API.', error);
          })
      : Promise.resolve();
  }

  return started;
}

export default startMockApi;
