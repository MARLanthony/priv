import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNLPStore } from '../../stores/appStores';
import { PageHeader, GlassCard, LoadingSpinner } from '../../components/UI';
import { Sparkles, Send, Brain, BookOpen, ArrowRight, Lightbulb } from 'lucide-react';

export const GetSuggestionsPage: React.FC = () => {
  const [query, setQuery] = useState('');
  const { analyze, isLoading } = useNLPStore();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!query.trim()) return;
    await analyze(query);
    navigate('/user/suggestions/results');
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
            placeholder="Tell us about your legal situation in detail. For example: 'I was involved in a car accident yesterday and the other driver was at fault. I have medical bills and my car is damaged...'"
            className="glass-input w-full px-4 py-4 text-sm min-h-[150px] resize-none mb-4"
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
