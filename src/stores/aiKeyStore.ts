import { create } from 'zustand';
import {
  AI_KEY_STORAGE_KEY,
  getApiKeySource,
  openRouterConfig,
  readStoredApiKey,
  setOpenRouterApiKey,
  type ApiKeySource,
} from '../ai/config/openrouter';

/**
 * The OpenRouter key held on this device.
 *
 * `.env` is the documented home for the key, but a file is easy to lose —
 * wildcard cleanups, cloud-sync reverts, a fresh clone. When that happens the
 * app silently drops back to demo data, so Settings keeps a device copy in
 * localStorage: paste the key once and it keeps working without a rebuild.
 *
 * Precedence: device copy → `VITE_OPENROUTER_API_KEY` → none.
 */
export interface AiKeyState {
  /** The device copy exactly as saved ('' when there is none). */
  storedKey: string;
  /** The key actually used for requests (device copy, else `.env`). */
  apiKey: string;
  /** Where `apiKey` came from, for the status line. */
  source: ApiKeySource;
  isConfigured: boolean;
  /** Saves the device copy and applies it to the client immediately. */
  saveKey: (key: string) => void;
  /** Forgets the device copy and falls back to `.env`. */
  clearKey: () => void;
}

/** Snapshots the client config so the UI never shows a stale status. */
const snapshot = (): Pick<AiKeyState, 'storedKey' | 'apiKey' | 'source' | 'isConfigured'> => ({
  storedKey: readStoredApiKey(),
  apiKey: openRouterConfig.apiKey,
  source: getApiKeySource(),
  isConfigured: openRouterConfig.apiKey.length > 0,
});

const persist = (key: string): void => {
  try {
    if (key) globalThis.localStorage?.setItem(AI_KEY_STORAGE_KEY, key);
    else globalThis.localStorage?.removeItem(AI_KEY_STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode) — the key still applies for this session */
  }
};

export const useAiKeyStore = create<AiKeyState>((set) => ({
  ...snapshot(),

  saveKey: (key) => {
    const trimmed = key.trim();
    persist(trimmed);
    setOpenRouterApiKey(trimmed);
    set(snapshot());
  },

  clearKey: () => {
    persist('');
    setOpenRouterApiKey('');
    set(snapshot());
  },
}));
