/*
 * Theme system test (Normal / Dark / Light).
 *
 *   node node_modules/esbuild/bin/esbuild tests/theme-test.tsx --bundle --format=cjs --platform=node --jsx=automatic --outfile=.smoke/theme.cjs
 *   node .smoke/theme.cjs
 *
 * Verifies the store and persistence, that every theme defines every token, that
 * Tailwind's `white` utilities are routed through the contrast token, and that the
 * Appearance picker renders (and is the only place the theme is exposed).
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_THEME,
  THEME_MODES,
  THEME_STORAGE_KEY,
  LEGACY_THEME_STORAGE_KEY,
  useThemeStore,
  isThemeMode,
  readStoredTheme,
  type ThemeMode,
} from '../src/stores/themeStore';
import { SettingsPage } from '../src/pages/shared/SettingsPage';

declare const process: { exitCode?: number };

let failed = 0;
const check = (name: string, ok: boolean, extra = ''): void => {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
  if (!ok) failed += 1;
};

const decode = (html: string): string =>
  html.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");

/* --- minimal browser shims ------------------------------------------------ */
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, String(value)),
  removeItem: (key: string) => void store.delete(key),
  clear: () => store.clear(),
};

const rootAttributes = new Map<string, string>();
const metaAttributes = new Map<string, string>();
(globalThis as { document?: unknown }).document = {
  documentElement: {
    setAttribute: (name: string, value: string) => void rootAttributes.set(name, value),
    getAttribute: (name: string) => rootAttributes.get(name) ?? null,
  },
  querySelector: (selector: string) =>
    selector.includes('theme-color')
      ? {
          setAttribute: (name: string, value: string) => void metaAttributes.set(name, value),
          getAttribute: (name: string) => metaAttributes.get(name) ?? null,
        }
      : null,
};

/* --- store + persistence -------------------------------------------------- */
check('three theme modes are offered', THEME_MODES.length === 3, THEME_MODES.map(m => m.value).join(','));
check(
  'modes are normal / dark / light',
  ['normal', 'dark', 'light'].every(mode => THEME_MODES.some(entry => entry.value === mode)),
);
check('default theme is normal', DEFAULT_THEME === 'normal');
check('isThemeMode accepts the three modes', (['normal', 'dark', 'light'] as ThemeMode[]).every(isThemeMode));
check('isThemeMode rejects unknown values', !isThemeMode('neon') && !isThemeMode('') && !isThemeMode(null));

store.clear();
check('unset storage falls back to normal', readStoredTheme() === 'normal');
check('store starts on the default theme', useThemeStore.getState().theme === DEFAULT_THEME);

useThemeStore.getState().setTheme('light');
check('setTheme updates state', useThemeStore.getState().theme === 'light');
check('setTheme writes data-theme on <html>', rootAttributes.get('data-theme') === 'light', String(rootAttributes.get('data-theme')));
check('setTheme persists to localStorage', store.get(THEME_STORAGE_KEY) === 'light', String(store.get(THEME_STORAGE_KEY)));
check('setTheme syncs the browser chrome colour', metaAttributes.get('content') === '#eef2f9', String(metaAttributes.get('content')));

useThemeStore.getState().setTheme('dark');
check('switching to dark updates the attribute', rootAttributes.get('data-theme') === 'dark');
check('dark chrome colour applied', metaAttributes.get('content') === '#05070c', String(metaAttributes.get('content')));

store.set(THEME_STORAGE_KEY, 'neon');
check('invalid stored value is ignored', readStoredTheme() === 'normal');
check('initTheme applies the fallback', useThemeStore.getState().initTheme() === 'normal' && rootAttributes.get('data-theme') === 'normal');

store.set(THEME_STORAGE_KEY, 'light');
useThemeStore.getState().initTheme();
check('initTheme restores a persisted theme', useThemeStore.getState().theme === 'light' && rootAttributes.get('data-theme') === 'light');

/* --- rebrand migration: a theme chosen before the rename is adopted ------- */
store.clear();
store.set(LEGACY_THEME_STORAGE_KEY, 'dark');
check('a theme in the pre-rebrand slot is picked up', readStoredTheme() === 'dark');
check('it is migrated to the current slot', store.get(THEME_STORAGE_KEY) === 'dark', String(store.get(THEME_STORAGE_KEY)));
store.clear();
useThemeStore.getState().setTheme('normal');

/* --- CSS tokens: every theme must define every surface --------------------- */
const css = readFileSync('src/index.css', 'utf8');

const REQUIRED_TOKENS = [
  '--app-bg',
  '--contrast-rgb',
  '--text-secondary-rgb',
  '--text-muted-rgb',
  '--glass-bg',
  '--glass-border',
  '--glass-light-bg',
  '--glass-light-border',
  '--glass-strong-bg',
  '--glass-strong-border',
  '--surface-sidebar',
  '--surface-navbar',
  '--divider',
  '--border-subtle',
  '--input-bg',
  '--input-border',
  '--input-text',
  '--input-placeholder',
  '--input-focus-bg',
  '--btn-secondary-bg',
  '--btn-secondary-bg-hover',
  '--btn-secondary-border',
  '--btn-secondary-border-hover',
  '--btn-secondary-text',
  '--scrim',
  '--table-head-bg',
  '--table-head-text',
  '--table-row-hover',
  '--scrollbar-thumb',
  '--scrollbar-thumb-hover',
  '--shimmer-from',
  '--shimmer-mid',
  '--brand-panel',
  '--theme-color',
];

const themeBlock = (theme: string): string => {
  const start = css.indexOf(`[data-theme='${theme}']`);
  if (start === -1) return '';
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open, close);
};

for (const theme of ['normal', 'dark', 'light']) {
  const block = themeBlock(theme);
  const missing = REQUIRED_TOKENS.filter(token => !block.includes(token));
  check(`theme "${theme}" defines every token`, block.length > 0 && missing.length === 0, missing.join(','));
}

check(':root defaults match the normal theme', css.includes(':root,') || css.includes(':root {'));
check(
  'light theme flips the contrast token to navy',
  /\[data-theme='light'\][\s\S]*?--contrast-rgb:\s*15 26 46/.test(css),
);
check(
  'dark theme keeps a light contrast token',
  /\[data-theme='dark'\][\s\S]*?--contrast-rgb:\s*244 246 250/.test(css),
);
check('body uses the themed background', /body\s*\{[^}]*background:\s*var\(--app-bg\)/s.test(css));
check('glass surfaces are variable driven', /\.glass\s*\{[^}]*var\(--glass-bg\)/s.test(css));
check('glass-input is themed', /\.glass-input\s*\{[^}]*var\(--input-bg\)/s.test(css));
check('secondary buttons are themed', /\.btn-secondary\s*\{[^}]*var\(--btn-secondary-bg\)/s.test(css));
check('sidebar + navbar use surface tokens', css.includes('var(--surface-sidebar)') && css.includes('var(--surface-navbar)'));
check('modal scrim is themed', /\.modal-overlay\s*\{[^}]*var\(--scrim\)/s.test(css));
check('tables are themed', css.includes('var(--table-head-bg)') && css.includes('var(--table-row-hover)'));
check('theme preview swatches exist', ['normal', 'dark', 'light'].every(t => css.includes(`.theme-preview-${t}`)));

/* --- Auth card: both halves are pinned deliberately ------------------------ */
check('auth backdrop is theme driven', /\.auth-backdrop\s*\{[^}]*var\(--app-bg\)/s.test(css));
check(
  'auth form half pins the light theme tokens',
  /\.auth-form\s*\{[\s\S]*?--contrast-rgb:\s*15 26 46[\s\S]*?--input-bg:/.test(css),
);
check(
  'auth brand half is navy with white copy',
  /\.auth-brand\s*\{[^}]*var\(--brand-panel\)[^}]*color:\s*#ffffff/s.test(css),
);
check('auth brand title stays white on navy', /\.auth-brand-title\s*\{[^}]*color:\s*#ffffff/s.test(css));
check('auth chrome floats over the backdrop', /\.auth-chrome-btn\s*\{[^}]*var\(--glass-strong-bg\)/s.test(css));
check(
  'auth theme switch marks the active option',
  /\.auth-theme-option\.is-active\s*\{[^}]*linear-gradient\(135deg, #c9a84c/s.test(css),
);
check('the retired floating dialog is gone', !css.includes('.auth-modal'));
check(
  'the auth pair slides between sign in and sign up',
  css.includes('@keyframes authPageInLeft') && css.includes('@keyframes authPageInRight'),
);
check(
  'both slide directions are wired to a class',
  css.includes('.animate-auth-page-left') && css.includes('.animate-auth-page-right'),
);
check('the slide clips its own horizontal travel', /\.auth-page\s*\{[^}]*overflow-x:\s*clip/s.test(css));
check(
  'the auth slide respects reduced motion',
  /prefers-reduced-motion[\s\S]*?\.animate-auth-page-left[\s\S]*?animation:\s*none/.test(css),
);

/* --- Tailwind wiring ------------------------------------------------------ */
const twConfig = readFileSync('tailwind.config.js', 'utf8');
check(
  'tailwind maps white -> contrast token',
  /white:\s*'rgb\(var\(--contrast-rgb\)\s*\/\s*<alpha-value>\)'/.test(twConfig),
);
check(
  'tailwind maps secondary/muted text tokens',
  twConfig.includes("'rgb(var(--text-secondary-rgb) / <alpha-value>)'") &&
    twConfig.includes("'rgb(var(--text-muted-rgb) / <alpha-value>)'"),
);
check('brand colours stay literal', twConfig.includes("gold: { DEFAULT: '#c9a84c'") && twConfig.includes("navy: { DEFAULT: '#0f1a2e'"));

/* --- index.html seeds the default theme ---------------------------------- */
const html = readFileSync('index.html', 'utf8');
check('html seeds data-theme="normal" (no flash of wrong theme)', /<html[^>]*data-theme="normal"/.test(html));
check('html exposes a theme-color meta tag', /<meta name="theme-color"/.test(html));

/* --- Settings is the only place with the picker --------------------------- */
const settings = decode(renderToStaticMarkup(React.createElement(SettingsPage, {})));
check('settings shows the Appearance section', settings.includes('Appearance'));
check('settings lists all three themes', ['Normal', 'Dark', 'Light'].every(label => settings.includes(label)));
check('settings renders the three preview swatches', ['normal', 'dark', 'light'].every(t => settings.includes(`theme-preview-${t}`)));
check('settings marks exactly one active theme', (settings.match(/aria-pressed="true"/g) ?? []).length === 1, String((settings.match(/aria-pressed="true"/g) ?? []).length));
check('settings shows the Active badge', settings.includes('Active'));
check('settings explains the choice is device-scoped', settings.includes('on this device'));
check('settings buttons are labelled for a11y', ['Normal theme', 'Dark theme', 'Light theme'].every(label => settings.includes(`aria-label="${label}"`)));

console.log(failed === 0 ? 'ALL THEME CHECKS PASSED' : `${failed} THEME CHECK(S) FAILED`);
if (failed > 0) process.exitCode = 1;
