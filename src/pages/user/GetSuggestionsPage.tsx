import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeLegalProblem } from '../../ai';
import { useNLPStore } from '../../stores/appStores';
import { AIProcessingModal } from '../../components/AIProcessingModal';
import { PageHeader, GlassCard } from '../../components/UI';
import { Sparkles, Brain, ArrowRight, Lightbulb, AlertCircle } from 'lucide-react';

export const GetSuggestionsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const { setResult, setLoading, setError, setProgress, isLoading, error, progress } = useNLPStore();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    const problemText = query.trim();
    if (!problemText) return;

    setProgress(null);
    setLoading(true);

    try {
      // OpenRouter first, then MSW mock data, then a local fallback — all
      // handled inside the AI service, which streams real progress events.
      const analysis = await analyzeLegalProblem(problemText, { onProgress: setProgress });
      setResult(analysis);

      // Let the modal show its completed state before moving on.
      await new Promise(resolve => setTimeout(resolve, 400));
      navigate('/user/suggestions/results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
    } finally {
      setProgress(null);
    }
  };

  const sampleQueries = [
    'I was assaulted at a bar last night and need legal help',
    'Someone is using my patent without permission',
    'I was injured in a car accident and need compensation',
    'My father passed away and I need help with his estate',
    'I was arrested and need a criminal defense lawyer',
  ];

  return (
    <div className="animate-fade-in">
      {/* Real-progress modal: stages + elapsed/estimated seconds from the AI service */}
      <AIProcessingModal isOpen={isLoading} progress={progress} />

      <PageHeader title="Get Legal Suggestions" subtitle="Describe your legal issue and our AI will help you find the right resources" />

      <div className="max-w-3xl mx-auto">
        {/* Main Input */}
        <GlassCard className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <Brain size={22} className="text-gold" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Describe Your Legal Issue</h2>
              <p className="text-xs text-text-muted">Our AI will analyze your situation and provide recommendations</p>
            </div>
          </div>

          <textarea
            value={query}
            onChange={e => setQuery(e.target.value)}
            disabled={isLoading}
            placeholder="Tell us about your legal situation in detail. For example: 'I was involved in a car accident yesterday and the other driver was at fault. I have medical bills and my car is damaged...'"
            className="glass-input w-full px-4 py-4 text-sm min-h-[150px] resize-none mb-4 disabled:opacity-60"
          />

          <button
            onClick={handleSubmit}
            disabled={!query.trim() || isLoading}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-navy/30 border-t-navy rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles size={18} />
                Analyze My Situation
              </>
            )}
          </button>

          {error && (
            <div className="flex items-center gap-2 mt-4 px-4 py-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm animate-fade-in">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <p className="text-[11px] text-text-muted mt-3 text-center">
            Analysis usually takes a few seconds. Re-running the same description returns instantly.
          </p>
        </GlassCard>

        {/* Sample Queries */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb size={16} className="text-gold" />
            <h3 className="text-sm font-semibold text-text-secondary">Try these examples</h3>
          </div>
          <div className="space-y-2">
            {sampleQueries.map((sq, i) => (
              <GlassCard
                key={i}
                className="p-3 cursor-pointer flex items-center justify-between group"
                hover
                onClick={() => setQuery(sq)}
              >
                <p className="text-sm text-text-secondary group-hover:text-white transition-colors">{sq}</p>
                <ArrowRight size={14} className="text-text-muted group-hover:text-gold transition-colors" />
              </GlassCard>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
