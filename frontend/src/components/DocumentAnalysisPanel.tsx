import React from 'react';
import { AlertTriangle, CalendarClock, FileText, Users } from 'lucide-react';
import type { DocumentAnalysis, LegalUrgency } from '../ai/types';
import { GlassCard } from './UI';

const RISK_TONE: Record<LegalUrgency, string> = {
  High: 'bg-danger/15 text-danger border-danger/30',
  Medium: 'bg-warning/15 text-warning border-warning/30',
  Low: 'bg-white/5 text-text-secondary border-white/10',
};

export interface DocumentAnalysisPanelProps {
  analysis: DocumentAnalysis;
}

/**
 * Renders the structured output of `analyzeDocument`: what the file is, who is
 * named in it, the dates that matter, the clauses worth reading twice and the
 * risks flagged by the model. Used by the law-firm document vault.
 */
export const DocumentAnalysisPanel: React.FC<DocumentAnalysisPanelProps> = ({ analysis }) => (
  <div className="space-y-5">
    <GlassCard className="space-y-3">
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-xl bg-gold/10 text-gold flex items-center justify-center flex-shrink-0">
          <FileText size={19} />
        </span>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-text-muted">Document type</p>
          <h2 className="text-lg font-semibold text-white">{analysis.documentType || 'Unclassified document'}</h2>
        </div>
      </div>
      {analysis.summary && <p className="text-sm text-text-secondary leading-relaxed">{analysis.summary}</p>}
    </GlassCard>

    <div className="grid gap-5 lg:grid-cols-2">
      {analysis.parties.length > 0 && (
        <GlassCard>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
            <Users size={15} className="text-royal-light" /> Parties
          </h3>
          <ul className="space-y-1.5">
            {analysis.parties.map(party => (
              <li key={party} className="text-sm text-text-secondary">
                {party}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {analysis.dates.length > 0 && (
        <GlassCard>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
            <CalendarClock size={15} className="text-info" /> Key dates
          </h3>
          <ul className="space-y-1.5">
            {analysis.dates.map(date => (
              <li key={date} className="text-sm text-text-secondary tabular-nums">
                {date}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}
    </div>

    {analysis.clauses.length > 0 && (
      <GlassCard>
        <h3 className="text-sm font-semibold text-white mb-3">Clauses & provisions</h3>
        <div className="space-y-3">
          {analysis.clauses.map((clause, index) => (
            <article key={`${clause.title}-${index}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-medium text-white">{clause.title}</h4>
                {clause.risk && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] border ${RISK_TONE[clause.risk]}`}>
                    {clause.risk} risk
                  </span>
                )}
              </div>
              <p className="text-xs text-text-muted mt-1.5 leading-relaxed">{clause.text}</p>
            </article>
          ))}
        </div>
      </GlassCard>
    )}

    {analysis.risks.length > 0 && (
      <GlassCard className="border-danger/25">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
          <AlertTriangle size={15} className="text-danger" /> Risks flagged
        </h3>
        <ul className="space-y-2">
          {analysis.risks.map(risk => (
            <li key={risk} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-danger mt-2 flex-shrink-0" />
              <span>{risk}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    )}
  </div>
);
