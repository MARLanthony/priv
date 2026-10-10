import type {
  DocumentAnalysis,
  DocumentClause,
  EmailReply,
  EmailTone,
  LegalAnalysis,
  LegalUrgency,
} from '../types';

/**
 * Safe parsing helpers for AI responses.
 * Models often wrap JSON in markdown fences or add commentary, so every
 * parser degrades gracefully instead of throwing.
 */

/** Removes ```json ... ``` / ``` ... ``` fences around a model answer. */
export function stripCodeFences(raw: string): string {
  const fenced = raw.match(/```(?:json|javascript|js)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}

/** Removes trailing commas, line comments and block comments that break JSON.parse. */
export function repairJson(candidate: string): string {
  return candidate
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"'])\/\/[^\n\r]*/g, '$1')
    .replace(/,\s*([}\]])/g, '$1')
    .trim();
}

/** Extracts the most likely JSON payload (object or array) from a raw answer. */
export function extractJson(raw: string): string | null {
  if (!raw || !raw.trim()) return null;

  const fenced = raw.match(/```(?:json|javascript|js)?\s*([\s\S]*?)```/i);
  const source = fenced ? fenced[1].trim() : raw.trim();

  const firstBrace = source.indexOf('{');
  const lastBrace = source.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) return source.slice(firstBrace, lastBrace + 1);

  const firstBracket = source.indexOf('[');
  const lastBracket = source.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) return source.slice(firstBracket, lastBracket + 1);

  return null;
}

/** `JSON.parse` that never throws. Returns `null` when the text is not valid JSON. */
export function safeParseJson<T = unknown>(raw: string): T | null {
  if (!raw || !raw.trim()) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Parses a JSON payload out of an AI answer, repairing the common issues
 * (code fences, commentary, trailing commas) before giving up.
 */
export function parseJsonResponse<T = unknown>(raw: string, fallback: T | null = null): T | null {
  if (!raw || !raw.trim()) return fallback;

  const candidate = extractJson(raw) ?? stripCodeFences(raw);
  const direct = safeParseJson<T>(candidate);
  if (direct !== null) return direct;

  const repaired = safeParseJson<T>(repairJson(candidate));
  return repaired !== null ? repaired : fallback;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    const parsed = safeParseJson<Record<string, unknown>>(extractJson(value) ?? value);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Coerces a value into an array of non-empty strings. */
export function toStringArray(value: unknown, max = 10): string[] {
  if (value === null || value === undefined) return [];

  if (typeof value === 'string') {
    return value
      .split(/[,;\n]/)
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, max);
  }

  if (!Array.isArray(value)) return [];

  return value
    .map(item => {
      if (typeof item === 'string') return item.trim();
      if (item === null || item === undefined) return '';
      if (typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const preferred = record.title ?? record.name ?? record.label ?? record.value;
        return typeof preferred === 'string' ? preferred.trim() : JSON.stringify(record);
      }
      return String(item).trim();
    })
    .filter(item => item.length > 0)
    .slice(0, max);
}

/** Clamps a confidence value into the 0-100 integer range. */
export function clampConfidence(value: unknown, fallback = 50): number {
  const numeric = typeof value === 'string' ? Number(value.replace(/[^0-9.]/g, '')) : Number(value);
  if (!Number.isFinite(numeric)) return fallback;

  // Models sometimes answer with a 0-1 probability (0.85) instead of 0-100.
  const scaled = numeric > 0 && numeric < 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

export function normalizeUrgency(value: unknown): LegalUrgency {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized.startsWith('high') || normalized === 'urgent' || normalized === 'critical') return 'High';
  if (normalized.startsWith('low')) return 'Low';
  return 'Medium';
}

function normalizeTone(value: unknown, fallback: EmailTone = 'professional'): EmailTone {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return normalized === 'friendly' || normalized === 'formal' || normalized === 'professional'
    ? normalized
    : fallback;
}

function normalizeClauses(value: unknown, max = 10): DocumentClause[] {
  if (!Array.isArray(value)) {
    return toStringArray(value, max).map(title => ({ title, text: '' }));
  }

  return value
    .map(item => {
      if (typeof item === 'string') return { title: item.trim(), text: '' };

      const record = asRecord(item);
      if (!record) return { title: String(item ?? '').trim(), text: '' };

      const title = record.title ?? record.name ?? record.clause ?? 'Clause';
      return {
        title: typeof title === 'string' ? title.trim() : 'Clause',
        text: typeof record.text === 'string' ? record.text.trim() : '',
        risk: record.risk !== undefined ? normalizeUrgency(record.risk) : undefined,
      };
    })
    .filter(clause => clause.title.length > 0)
    .slice(0, max);
}

/** Maps a raw AI payload onto the `LegalAnalysis` contract used by the app. */
export function normalizeLegalAnalysis(raw: unknown): LegalAnalysis | null {
  const record = asRecord(raw);
  if (!record) return null;

  const caseTypeSource = record.caseType ?? record.case_type ?? record.suggestedCaseType;
  const caseType = typeof caseTypeSource === 'string' && caseTypeSource.trim()
    ? caseTypeSource.trim()
    : 'General Legal Consultation';

  const summary = typeof record.summary === 'string' ? record.summary.trim() : '';

  return {
    caseType,
    confidence: clampConfidence(record.confidence, 50),
    urgency: normalizeUrgency(record.urgency),
    articles: toStringArray(record.articles ?? record.topics, 8),
    services: toStringArray(record.services ?? record.requiredServices, 8),
    nextSteps: toStringArray(record.nextSteps ?? record.next_steps, 8),
    keyFacts: toStringArray(record.keyFacts ?? record.key_facts ?? record.facts, 6),
    summary: summary || undefined,
  };
}

/** Maps a raw AI payload onto the `DocumentAnalysis` contract. */
export function normalizeDocumentAnalysis(raw: unknown): DocumentAnalysis | null {
  const record = asRecord(raw);
  if (!record) return null;

  const documentTypeSource = record.documentType ?? record.document_type;
  const summary = typeof record.summary === 'string' ? record.summary.trim() : '';

  return {
    documentType: typeof documentTypeSource === 'string' && documentTypeSource.trim()
      ? documentTypeSource.trim()
      : undefined,
    parties: toStringArray(record.parties, 15),
    dates: toStringArray(record.dates, 15),
    clauses: normalizeClauses(record.clauses),
    summary,
    risks: toStringArray(record.risks, 10),
  };
}

/** Maps a raw AI payload onto the `EmailReply` contract. */
export function normalizeEmailReply(raw: unknown): EmailReply | null {
  const record = asRecord(raw);
  if (!record) return null;

  const body = typeof record.body === 'string' ? record.body.trim() : '';
  if (!body) return null;

  return {
    subject: typeof record.subject === 'string' && record.subject.trim() ? record.subject.trim() : 'Re: Your message',
    body,
    tone: normalizeTone(record.tone),
  };
}
