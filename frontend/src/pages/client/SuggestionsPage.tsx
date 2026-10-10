import React, { useEffect, useState } from 'react';
import { CalendarPlus, ClipboardList, RefreshCw, Sparkles } from 'lucide-react';
import { AIProcessingModal } from '../../components/AIProcessingModal';
import { LegalAnalysisPanel } from '../../components/LegalAnalysisPanel';
import { Button, EmptyState, Field, GlassCard, PageHeader, TextArea } from '../../components/UI';
import { analyzeLegalProblem } from '../../ai';
import type { AIProgress, LegalAnalysisResult } from '../../ai';
import { createConsultation, getMyClientProfile } from '../../services';
import { toast } from '../../stores';
import { AppointmentFormModal } from '../shared/AppointmentFormModal';

/**
 * Client "Get suggestions" page.
 *
 * Runs the AI intake pipeline in the browser (`analyzeLegalProblem`), shows real
 * progress while the model works, then lets the client turn the suggestion into
 * a consultation (which the firm reviews) or straight into a booking.
 */

const EXAMPLES = [
  'My landlord refuses to return my deposit after the lease ended.',
  'I was dismissed without notice after three years of service.',
  'My ex-partner keeps ignoring the custody arrangement we agreed.',
];

export const SuggestionsPage: React.FC = () => {
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<AIProgress | null>(null);
  const [result, setResult] = useState<LegalAnalysisResult | null>(null);
  const [clientId, setClientId] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getMyClientProfile();
        setClientId(profile.id);
      } catch {
        // A client without a file yet still gets suggestions; the API creates
        // the record when they submit the consultation.
      }
    };

    void load();
  }, []);

  const analyze = async (text: string) => {
    const value = text.trim();
    if (value.length < 20) {
      toast.error('Describe the situation in a little more detail (20+ characters).');
      return;
    }

    setBusy(true);
    setResult(null);
    setProgress(null);
    try {
      const analysis = await analyzeLegalProblem(value, { onProgress: setProgress });
      setResult(analysis);
      toast.success('Suggestions ready.');
    } catch {
      toast.error('The AI could not answer just now. Please try again.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const submitAsConcern = async () => {
    if (!problem.trim()) return;
    setSubmitting(true);
    try {
      await createConsultation({ clientId, concern: problem.trim() });
      toast.success('Your concern was sent to the firm for review.');
    } catch {
      toast.error('Could not submit the concern.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Get suggestions"
        subtitle="Describe your situation — JurisFlow suggests the practice area, urgency and next steps."
      />

      <GlassCard className="space-y-4">
        <Field
          label="What happened?"
          hint="Names, dates and amounts help. Never share passwords or card numbers."
          required
        >
          <TextArea
            rows={6}
            value={problem}
            onChange={event => setProblem(event.target.value)}
            placeholder="Tell us what happened and what you would like to achieve…"
          />
        </Field>

        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(example => (
            <button
              key={example}
              type="button"
              onClick={() => setProblem(example)}
              className="px-3 py-1.5 rounded-lg text-xs text-text-secondary border border-white/10 bg-white/5 hover:text-white hover:border-gold/25 transition-colors text-left"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {problem ? (
            <Button
              variant="ghost"
              onClick={() => {
                setProblem('');
                setResult(null);
              }}
            >
              <RefreshCw size={16} />
              Clear
            </Button>
          ) : null}
          <Button onClick={() => void analyze(problem)} loading={busy} disabled={busy}>
            <Sparkles size={16} />
            Get suggestions
          </Button>
        </div>
      </GlassCard>

      {result ? (
        <LegalAnalysisPanel
          analysis={result}
          actions={
            <>
              <Button variant="secondary" loading={submitting} onClick={() => void submitAsConcern()}>
                <ClipboardList size={16} />
                Submit as a concern
              </Button>
              <Button onClick={() => setBookingOpen(true)}>
                <CalendarPlus size={16} />
                Book a consultation
              </Button>
            </>
          }
        />
      ) : !busy ? (
        <GlassCard>
          <EmptyState
            icon={Sparkles}
            title="No suggestion yet"
            description="Describe your situation above and the AI will suggest where to start. It is guidance, not legal advice."
          />
        </GlassCard>
      ) : null}

      <AIProcessingModal isOpen={busy} progress={progress} />

      <AppointmentFormModal
        isOpen={bookingOpen}
        onClose={() => setBookingOpen(false)}
        lockedClientId={clientId}
      />
    </div>
  );
};

export default SuggestionsPage;
