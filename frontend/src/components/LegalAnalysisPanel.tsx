import React from 'react';
import { AlertTriangle, BadgeCheck, BookOpen, CheckCircle2, Gauge, ListChecks, Scale, UserRound } from 'lucide-react';
import { LEGAL_DISCLAIMER } from '../ai';
import type { LegalAnalysisResult, LegalUrgency } from '../ai/types';
import { GlassCard, ProgressBar } from './UI';

const URGENCY_TONE: Record<LegalUrgency, string> = {
  High: 'bg-danger/15 text-danger border-danger/30',
  Medium: 'bg-warning/15 text-warning border-warning/30',
  Low: 'bg-success/15 text-success border-success/30',
};

export interface LegalAnalysisPanelProps {
  analysis: LegalAnalysisResult;
  /** Extra actions rendered at the bottom (booking, submitting as a concern…). */
  actions?: React.ReactNode;
}

/**
 * Renders the output of the legal-intake pipeline (`analyzeLegalProblem`).
 *
 * The panel mirrors the four answers the model is asked for — case type,
 * urgency, required services and next steps — and keeps the evidence visible
 * (`keyFacts`, matched articles, model/latency) so a suggestion can be judged
 * rather than trusted blindly.
 */
export const LegalAnalysisPanel: React.FC<LegalAnalysisPanelProps> = ({ analysis, actions }) => {
  const confidence = Math.round(Math.max(0, Math.min(1, analysis.confidence ?? 0)) * 100);
  const urgency: LegalUrgency = analysis.urgency ?? 'Medium';

  return (
    <div className="space-y-5">
      <GlassCard className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
              <Scale size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-text-muted">Suggested practice area</p>
              <h2 className="text-lg font-semibold text-white truncate">
                {analysis.suggestedCaseType || 'General enquiry'}
              </h2>
            </div>
          </div>
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${URGENCY_TONE[urgency]}`}
          >
            {urgency} urgency
          </span>
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-text-muted mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <Gauge size={13} /> Confidence
            </span>
            <span className="tabular-nums text-text-secondary">{confidence}%</span>
          </div>
          <ProgressBar value={confidence} />
        </div>

        {analysis.source === 'fallback' ? (
          <p className="flex items-start gap-2 text-[11px] text-warning bg-warning/10 border border-warning/25 rounded-lg px-3 py-2">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            Produced by the offline heuristic — the AI model was unavailable. Treat the case type as a rough hint and
            have a lawyer confirm it.
          </p>
        ) : (
          <p className="text-[11px] text-text-muted">
            Source: {analysis.source === 'openrouter' ? 'live model' : 'demo mocks'}
            {analysis.model ? ` · ${analysis.model}` : ''}
            {typeof analysis.latencyMs === 'number' ? ` · ${Math.round(analysis.latencyMs)} ms` : ''}
          </p>
        )}
      </GlassCard>

      {analysis.summary && (
        <GlassCard>
          <h3 className="text-sm font-semibold text-white mb-2">Assessment</h3>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{analysis.summary}</p>
        </GlassCard>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {analysis.extractedKeywords.length > 0 && (
          <GlassCard>
            <h3 className="text-sm font-semibold text-white mb-3">Detected keywords</h3>
            <div className="flex flex-wrap gap-1.5">
              {analysis.extractedKeywords.map(keyword => (
                <span
                  key={keyword}
                  className="px-2.5 py-1 rounded-full text-[11px] bg-royal/20 text-royal-light border border-royal-light/25"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </GlassCard>
        )}

        {analysis.keyFacts && analysis.keyFacts.length > 0 && (
          <GlassCard>
            <h3 className="text-sm font-semibold text-white mb-3">Facts detected</h3>
            <ul className="space-y-2">
              {analysis.keyFacts.map(fact => (
                <li key={fact} className="flex items-start gap-2 text-sm text-text-secondary">
                  <BadgeCheck size={15} className="mt-0.5 text-success flex-shrink-0" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        {analysis.requiredServices.length > 0 && (
          <GlassCard>
            <h3 className="text-sm font-semibold text-white mb-3">Services needed</h3>
            <ul className="space-y-2">
              {analysis.requiredServices.map(service => (
                <li key={service} className="flex items-start gap-2 text-sm text-text-secondary">
                  <CheckCircle2 size={15} className="mt-0.5 text-gold flex-shrink-0" />
                  <span>{service}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        {analysis.nextSteps.length > 0 && (
          <GlassCard>
            <h3 className="text-sm font-semibold text-white mb-3">Recommended next steps</h3>
            <ol className="space-y-2">
              {analysis.nextSteps.map((step, index) => (
                <li key={step} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="w-5 h-5 rounded-full bg-white/5 text-[11px] text-text-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </GlassCard>
        )}
      </div>

      {analysis.recommendedAttorney && (
        <GlassCard>
          <h3 className="text-sm font-semibold text-white mb-3">Recommended attorney</h3>
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-royal/20 text-royal-light flex items-center justify-center flex-shrink-0">
              <UserRound size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white">{analysis.recommendedAttorney.name}</p>
              <p className="text-xs text-text-muted">{analysis.recommendedAttorney.specialization}</p>
              {analysis.recommendedAttorney.availableSlots.length > 0 && (
                <p className="text-[11px] text-text-secondary mt-2">
                  Next availability:{' '}
                  {analysis.recommendedAttorney.availableSlots
                    .slice(0, 3)
                    .map(slot => `${slot.date} · ${slot.time}`)
                    .join('  •  ')}
                </p>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {analysis.matchedArticles.length > 0 && (
        <GlassCard>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
            <BookOpen size={15} className="text-gold" />
            Matching knowledge-base articles
          </h3>
          <div className="space-y-3">
            {analysis.matchedArticles.map(article => (
              <article key={article.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <h4 className="text-sm font-medium text-white">{article.title}</h4>
                  <span className="text-[10px] text-text-muted whitespace-nowrap">{article.category}</span>
                </div>
                <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{article.summary}</p>
                {article.attorneySpecialist && (
                  <p className="text-[11px] text-text-secondary mt-2">Specialist: {article.attorneySpecialist}</p>
                )}
              </article>
            ))}
          </div>
        </GlassCard>
      )}

      <div className="flex items-start gap-2 text-[11px] text-text-muted bg-white/[0.03] border border-white/10 rounded-xl px-3.5 py-3">
        <ListChecks size={14} className="mt-0.5 flex-shrink-0" />
        <p className="leading-relaxed">{LEGAL_DISCLAIMER}</p>
      </div>

      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}

    </div>
  );
};
