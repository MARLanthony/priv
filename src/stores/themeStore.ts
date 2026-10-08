import { create } from 'zustand';

/**
 * Theme modes for JurisFlow.
 *
 * - `normal` — the default navy + gold JurisFlow look
 * - `dark`   — deeper neutral charcoal for low-light work
 * - `light`  — paper-white surfaces with navy text
 *
 * The active theme is applied as `data-theme` on <html>, which drives the CSS
 * variables in src/index.css (and, through `--contrast-rgb`, every Tailwind
 * `white`-based utility used in the app).
 */
export type ThemeMode = 'normal' | 'dark' | 'light';

export const THEME_STORAGE_KEY = 'jurisflow.theme';
/** Pre-rebrand slot, read once so an already-chosen theme survives the rename. */
export const LEGACY_THEME_STORAGE_KEY = 'legalflow.theme';
export const DEFAULT_THEME: ThemeMode = 'normal';

export const THEME_MODES: { value: ThemeMode; label: string; description: string }[] = [
  { value: 'normal', label: 'Normal', description: 'The classic JurisFlow navy and gold look.' },
  { value: 'dark', label: 'Dark', description: 'Deeper, neutral tones for low-light environments.' },
  { value: 'light', label: 'Light', description: 'Bright paper-white surfaces with navy text.' },
];

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'normal' || value === 'dark' || value === 'light';
}

/**
 * Reads the persisted theme, falling back to the default for unknown values.
 * A choice saved under the pre-rebrand slot is adopted and moved forward.
 */
export function readStoredTheme(): ThemeMode {
  try {
    const storage = globalThis.localStorage;
    if (!storage) return DEFAULT_THEME;

    const current = storage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(current)) return current;

    const legacy = storage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (isThemeMode(legacy)) {
      storage.setItem?.(THEME_STORAGE_KEY, legacy);
      return legacy;
    }
    return DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Applies the theme to <html> and syncs the browser chrome colour. */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;

  document.documentElement.setAttribute('data-theme', theme);

  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) {
    const swatch: Record<ThemeMode, string> = {
      normal: '#0f1a2e',
      dark: '#05070c',
      light: '#eef2f9',
    };
    themeColor.setAttribute('content', swatch[theme]);
  }
}

export interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  /** Applies the persisted theme; called once on startup before first paint. */
  initTheme: () => ThemeMode;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: DEFAULT_THEME,

  setTheme: (theme) => {
    const next = isThemeMode(theme) ? theme : DEFAULT_THEME;
    applyTheme(next);
    try {
      globalThis.localStorage?.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable (private mode) — the theme still applies for this session */
    }
    set({ theme: next });
  },

  initTheme: () => {
    const stored = readStoredTheme();
    applyTheme(stored);
    set({ theme: stored });
    return stored;
  },
}));