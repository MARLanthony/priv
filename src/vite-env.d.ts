/// <reference types="vite/client" />

/**
 * Typed Vite environment variables used by the JurisFlow AI layer.
 * Values are supplied through `.env` (see `.env.example`).
 */
interface ImportMetaEnv {
  /** OpenRouter API key — https://openrouter.ai/keys */
  readonly VITE_OPENROUTER_API_KEY?: string;
  /** Overrides the default base URL (https://openrouter.ai/api/v1). */
  readonly VITE_OPENROUTER_BASE_URL?: string;
  /** Sent as the HTTP-Referer header to OpenRouter. */
  readonly VITE_OPENROUTER_HTTP_REFERER?: string;
  /** Sent as the X-Title header to OpenRouter. */
  readonly VITE_OPENROUTER_TITLE?: string;
  /**
   * Where accounts live: `mysql` sends /api/auth/* to the real API in `server/`
   * (Express + your local MySQL), anything else uses the bundled MSW demo data.
   */
  readonly VITE_AUTH_BACKEND?: string;
  /** Request timeout in milliseconds (default 60000). */
  readonly VITE_OPENROUTER_TIMEOUT_MS?: string;
  /** Extra retry attempts per model (default 1). */
  readonly VITE_OPENROUTER_MAX_RETRIES?: string;
  /** Start the next model in parallel after N ms (default 0 = off). */
  readonly VITE_OPENROUTER_HEDGE_AFTER_MS?: string;
  /** Hard budget for the whole fallback chain in ms (default 120000). */
  readonly VITE_OPENROUTER_TOTAL_TIMEOUT_MS?: string;
}
