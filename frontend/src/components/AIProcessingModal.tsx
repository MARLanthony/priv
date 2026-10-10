import React, { useEffect, useMemo, useState } from 'react';
import { Brain, CheckCircle2, Loader2, ShieldCheck, Zap } from 'lucide-react';
import type { AIProgress, AIProgressStage } from '../ai';

/**
 * Blocking modal shown while the AI analyses a concern.
 *
 * Progress is real: stages, elapsed time and the model come from the AI service
 * (`onProgress`), and the remaining-seconds countdown is based on the measured
 * average duration of recent analyses, interpolated with the live elapsed time.
 */

/** Mirrors the progress floors used by the AI service. */
const STAGE_FLOOR: Record<AIProgressStage, number> = {
  preparing: 8,
  requesting: 15,
  retrying: 22,
  received: 82,
  parsing: 88,
  enriching: 92,
  fallback: 55,
  done: 100,
};

/** The real pipeline mapped onto four user-visible steps. */
const STEPS: { label: string; stages: AIProgressStage[] }[] = [
  { label: 'Reading your description', stages: ['preparing'] },
  { label: 'Consulting the AI legal model', stages: ['requesting', 'retrying'] },
  { label: 'Matching knowledge base & lawyer', stages: ['received', 'parsing', 'enriching', 'fallback'] },
  { label: 'Preparing recommendations', stages: ['done'] },
];

function stepIndex(stage: AIProgressStage): number {
  const index = STEPS.findIndex(step => step.stages.includes(stage));
  return index === -1 ? 0 : index;
}

export interface AIProcessingModalProps {
  isOpen: boolean;
  progress: AIProgress | null;
}

export const AIProcessingModal: React.FC<AIProcessingModalProps> = ({ isOpen, progress }) => {
  const active = isOpen && progress !== null;
  const [nowMs, setNowMs] = useState(0);
  const [receivedAt, setReceivedAt] = useState(0);

  // Restart the local clock whenever a new progress event arrives.
  useEffect(() => {
    if (!progress) return;
    setReceivedAt(Date.now());
    setNowMs(Date.now());
  }, [progress]);

  useEffect(() => {
    if (!active) return;

    const id = window.setInterval(() => setNowMs(Date.now()), 120);
    return () => window.clearInterval(id);
  }, [active]);

  const view = useMemo(() => {
    if (!progress) {
      return { percent: 0, elapsedMs: 0, remainingSec: 0, overtime: false };
    }

    // Real elapsed time: the last reported value plus time since it arrived.
    const elapsedMs = progress.elapsedMs + Math.max(0, nowMs - receivedAt);
    const estimate = progress.estimatedMs > 0 ? progress.estimatedMs : 0;
    const floor = STAGE_FLOOR[progress.stage];

    // Interpolate between stage floors using the measured estimate.
    const timed = estimate > 0 ? Math.min(95, (elapsedMs / estimate) * 95) : 0;
    const percent = progress.stage === 'done' ? 100 : Math.max(floor, timed);
    const remainingMs = estimate - elapsedMs;

    return {
      percent: Math.max(0, Math.min(100, percent)),
      elapsedMs,
      remainingSec: Math.max(0, Math.ceil(remainingMs / 1000)),
      overtime: remainingMs <= 0 && progress.stage !== 'done',
    };
  }, [progress, nowMs, receivedAt]);

  if (!active || !progress) return null;

  const currentStep = stepIndex(progress.stage);
  const isDone = progress.stage === 'done';
  const modelLabel = progress.model ? progress.model.split('/').pop() : null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-busy={!isDone} aria-live="polite">
      <div className="glass-strong p-6 w-full max-w-md mx-4 animate-scale-in">
        {/* Header */}
        <div className="flex items-center gap-4 mb-5">
          <div className="relative w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center flex-shrink-0">
            <Brain size={24} className="text-gold" />
            {!isDone && <span className="absolute inset-0 rounded-2xl border border-gold/40 animate-ping" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white">
              {isDone ? 'Analysis complete' : 'Analyzing your concern'}
            </h2>
            <p className="text-xs text-text-muted truncate">
              {isDone ? 'Opening your recommendations…' : 'Our AI is reviewing your legal matter'}
            </p>
          </div>
        </div>

        {/* Status + percentage */}
        <div className="flex items-end justify-between mb-2 gap-3">
          <span className="text-xs text-text-secondary">{progress.message}</span>
          <span className="text-sm font-bold text-gold tabular-nums">{Math.round(view.percent)}%</span>
        </div>

        {/* Progress bar */}
        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-300 ease-out"
            style={{ width: `${view.percent}%` }}
          />
        </div>

        {/* Real timing: elapsed + estimated remaining */}
        <div className="flex items-center justify-between text-[11px] mt-2 mb-5">
          <span className="text-text-muted tabular-nums">{(view.elapsedMs / 1000).toFixed(1)}s elapsed</span>
          <span className={`tabular-nums ${view.overtime ? 'text-warning' : 'text-text-secondary'}`}>
            {isDone ? 'Done' : view.overtime ? 'Finishing up…' : `~${view.remainingSec}s remaining`}
          </span>
        </div>

        {/* Real pipeline steps */}
        <div className="space-y-2 mb-4">
          {STEPS.map((step, index) => {
            const complete = isDone || index < currentStep;
            const current = !isDone && index === currentStep;

            return (
              <div key={step.label} className="flex items-center gap-2.5">
                {complete ? (
                  <CheckCircle2 size={14} className="text-success flex-shrink-0" />
                ) : current ? (
                  <Loader2 size={14} className="text-gold animate-spin flex-shrink-0" />
                ) : (
                  <span className="w-3.5 h-3.5 rounded-full border border-white/15 flex-shrink-0" />
                )}
                <span
                  className={`text-xs ${
                    complete ? 'text-text-secondary' : current ? 'text-white font-medium' : 'text-text-muted'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Model + estimate footer */}
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/10">
          <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <Zap size={11} className="text-gold" />
            {modelLabel ?? 'Selecting model…'}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <ShieldCheck size={11} className="text-success" />
            Est. total {Math.round(progress.estimatedMs / 1000)}s
          </span>
        </div>
      </div>
    </div>
  );
};
