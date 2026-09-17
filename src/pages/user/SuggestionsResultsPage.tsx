import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useNLPStore } from '../../stores/appStores';
import { PageHeader, GlassCard } from '../../components/UI';
import { ArrowLeft, Brain, BookOpen, User, Calendar, CheckCircle, Tag, Briefcase, ArrowRight, Sparkles } from 'lucide-react';

export const SuggestionsResultsPage: React.FC = () => {
  const { result } = useNLPStore();
  const navigate = useNavigate();

  if (!result) {
    return (
      <div className="animate-fade-in text-center py-20">
        <p className="text-text-muted mb-4">No analysis results found.</p>
        <button onClick={() => navigate('/user/get-suggestions')} className="btn-primary">Get Suggestions</button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate('/user/get-suggestions')} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-sm mb-4">
        <ArrowLeft size={16} /> New Analysis
      </button>

      <PageHeader title="Analysis Results" subtitle="Based on your description, here's what we found" />

      {/* Query Summary */}
      <GlassCard className="mb-6 bg-gradient-to-r from-gold/5 to-transparent border-gold/15">
        <div className="flex items-start gap-3">
          <Brain size={20} className="text-gold mt-0.5" />
          <div>
            <p className="text-xs text-gold font-semibold uppercase tracking-wider mb-1">Your Query</p>
            <p className="text-sm text-text-secondary">{result.query}</p>
          </div>
        </div>
      </GlassCard>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Case Type */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={18} className="text-gold" />
            <h3 className="text-sm font-semibold text-white">Suggested Case Type</h3>
          </div>
          <p className="text-xl font-bold text-white mb-2">{result.suggestedCaseType}</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-1000" style={{ width: `${result.confidence}%` }} />
            </div>
            <span className="text-sm font-semibold text-gold">{result.confidence}%</span>
          </div>
          <p className="text-xs text-text-muted mt-1">Confidence Score</p>
        </GlassCard>

        {/* Recommended Attorney */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <User size={18} className="text-gold" />
            <h3 className="text-sm font-semibold text-white">Recommended Attorney</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-royal to-royal-light flex items-center justify-center text-lg font-bold text-gold">
              {result.recommendedAttorney.name.charAt(0)}
            </div>
            <div>
              <p className="text-base font-semibold text-white">{result.recommendedAttorney.name}</p>
              <p className="text-xs text-text-muted">{result.recommendedAttorney.specialization}</p>
            </div>
          </div>
        </GlassCard>

        {/* Keywords */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Tag size={18} className="text-gold" />
            <h3 className="text-sm font-semibold text-white">Extracted Keywords</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.extractedKeywords.map(kw => (
              <span key={kw} className="px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-xs text-gold">
                {kw}
              </span>
            ))}
            {result.extractedKeywords.length === 0 && <p className="text-xs text-text-muted">No specific keywords extracted</p>}
          </div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Matched Articles */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-gold" />
            <h3 className="text-sm font-semibold text-white">Related Articles ({result.matchedArticles.length})</h3>
          </div>
          <div className="space-y-3">
            {result.matchedArticles.map(article => (
              <div key={article.id} className="p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => navigate(`/user/articles/${article.id}`)}>
                <p className="text-sm font-medium text-white">{article.title}</p>
                <p className="text-xs text-text-muted mt-1">{article.category} · {article.matchCount} matches</p>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">{article.summary}</p>
              </div>
            ))}
            {result.matchedArticles.length === 0 && <p className="text-xs text-text-muted">No articles matched</p>}
          </div>
        </GlassCard>

        {/* Available Slots */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={18} className="text-gold" />
            <h3 className="text-sm font-semibold text-white">Available Appointment Slots</h3>
          </div>
          <div className="space-y-2">
            {result.recommendedAttorney.availableSlots.slice(0, 6).map((slot, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-xl bg-white/3 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-2">
                  <Calendar size={12} className="text-gold" />
                  <span className="text-sm text-white">{slot.date}</span>
                  <span className="text-xs text-text-muted">at {slot.time}</span>
                </div>
                <button className="text-xs text-gold hover:text-gold-light transition-colors font-medium">Book</button>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Required Services */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Briefcase size={18} className="text-gold" />
            <h3 className="text-sm font-semibold text-white">Required Services</h3>
          </div>
          <div className="space-y-2">
            {result.requiredServices.map((service, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/3">
                <CheckCircle size={14} className="text-success" />
                <span className="text-sm text-text-secondary">{service}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Next Steps */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={18} className="text-gold" />
            <h3 className="text-sm font-semibold text-white">Recommended Next Steps</h3>
          </div>
          <div className="space-y-2">
            {result.nextSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 p-2">
                <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs text-gold font-bold">{i + 1}</span>
                </div>
                <p className="text-sm text-text-secondary">{step}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
