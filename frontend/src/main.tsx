import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { startMockApi } from './mocks';
import { useAuthStore } from './stores/authStore';
import { useThemeStore } from './stores/themeStore';

/**
 * Boot sequence.
 *
 * 1. Apply the saved theme before the first paint, so there is no flash of the
 *    wrong palette.
 * 2. Start the demo API (MSW) — a no-op when `VITE_USE_MOCKS=false`, so the
 *    requests simply reach the Flask backend instead.
 * 3. Rehydrate the session from the stored token; `ProtectedRoute` shows a
 *    loader until this resolves, which is what makes a refresh on a deep link
 *    work.
 */

async function bootstrap(): Promise<void> {
  useThemeStore.getState().initTheme();

  await startMockApi();

  try {
    await useAuthStore.getState().loadSession();
  } catch {
    // A failed bootstrap only means "signed out"; the login page handles it.
  }

  const container = document.getElementById('root');
  if (!container) throw new Error('JurisFlow: #root element is missing from index.html.');

  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
