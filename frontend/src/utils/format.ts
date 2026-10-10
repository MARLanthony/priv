/**
 * Small date/number formatting helpers used by the tables, detail pages and
 * notifications. Everything takes ISO strings from the API and degrades
 * gracefully when a value is missing or unparseable.
 */

const DATE_TIME: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
};

const TIME: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
};

function parse(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `12 Mar 2026` */
export function formatDate(value: string | Date | null | undefined): string {
  const date = parse(value);
  return date ? date.toLocaleDateString(undefined, DATE_TIME) : '—';
}

/** `12 Mar 2026, 14:30` */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = parse(value);
  return date ? `${date.toLocaleDateString(undefined, DATE_TIME)}, ${date.toLocaleTimeString(undefined, TIME)}` : '—';
}

/** `14:30` */
export function formatTime(value: string | Date | null | undefined): string {
  const date = parse(value);
  return date ? date.toLocaleTimeString(undefined, TIME) : '—';
}

/** `just now`, `4m ago`, `3h ago`, `2d ago`, then a plain date. */
export function relativeTime(value: string | Date | null | undefined): string {
  const date = parse(value);
  if (!date) return '—';

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.round(seconds / 86400)}d ago`;
  return formatDate(date);
}

/** `1.4 MB` */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** `J. Rivera` — used for compact table cells. */
export function shortName(name: string | null | undefined): string {
  if (!name) return '—';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0][0].toUpperCase()}. ${parts[parts.length - 1]}`;
}

/** Two-letter initials for avatars. */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Turns `in_progress` / `in-progress` into `In progress`. */
export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  const spaced = value.replace(/[_-]+/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
