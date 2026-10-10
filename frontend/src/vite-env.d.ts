/// <reference types="vite/client" />

/**
 * Typed Vite environment variables used by JurisFlow.
 * Values are supplied through `.env` (see `.env.example`).
 */
interface ImportMetaEnv {
  /**
   * Base URL of the Flask backend. Defaults to `/api`, which the dev server
   * proxies to `http://127.0.0.1:${API_PORT}`.
   */
  readonly VITE_API_BASE_URL?: string;
  /**
   * `false` disables the bundled MSW demo data so every request reaches the
   * Flask API. Anything else (or unset) keeps the mocks in front of it.
   */
  readonly VITE_USE_MOCKS?: string;
  /** Overrides the AI proxy endpoint (defaults to `${API_BASE_URL}/ai`). */
  readonly VITE_AI_BASE_URL?: string;
  /** Sent as the X-Title header by the backend when it calls OpenRouter. */
  readonly VITE_AI_TITLE?: string;
  /** Per-attempt AI timeout in milliseconds (default 60000). */
  readonly VITE_AI_TIMEOUT_MS?: string;
  /** Extra retry attempts per model (default 1). */
  readonly VITE_AI_MAX_RETRIES?: string;
  /** Start the next model in parallel after N ms (default 0 = off). */
  readonly VITE_AI_HEDGE_AFTER_MS?: string;
  /** Hard budget for the whole fallback chain in ms (default 120000). */
  readonly VITE_AI_TOTAL_TIMEOUT_MS?: string;
  /** Port of the Flask dev server used by the Vite proxy (default 5000). */
  readonly API_PORT?: string;
}
