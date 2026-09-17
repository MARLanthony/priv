import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useKnowledgeStore } from '../../stores/appStores';
import { GlassCard, LoadingSpinner } from '../../components/UI';
import { ArrowLeft, BookOpen, User, Tag, Briefcase, CheckCircle } from 'lucide-react';

export const ArticleDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentArticle, fetchArticle } = useKnowledgeStore();

  useEffect(() => { if (id) fetchArticle(Number(id)); }, [id]);

  if (!currentArticle) return <LoadingSpinner />;

  return (
    <div className="animate-fade-in max-w-4xl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-sm mb-6">
        <ArrowLeft size={16} /> Back to Articles
      </button>

      <GlassCard className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center">
            <BookOpen size={24} className="text-gold" />
          </div>
          <div>
            <span className="text-xs text-gold font-semibold uppercase tracking-wider">{currentArticle.category}</span>
            <h1 className="text-2xl font-bold text-white">{currentArticle.title}</h1>
          </div>
        </div>

        <p className="text-text-secondary mb-6 text-base leading-relaxed">{currentArticle.summary}</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {currentArticle.keywords.map(kw => (
            <span key={kw} className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-xs text-gold">
              <Tag size={10} /> {kw}
            </span>
          ))}
        </div>

        <div className="prose prose-invert max-w-none">
          {currentArticle.content.split('\n\n').map((paragraph, i) => {
            if (paragraph.startsWith('## ')) {
              return <h2 key={i} className="text-xl font-semibold text-white mt-6 mb-3">{paragraph.replace('## ', '')}</h2>;
            }
            if (paragraph.startsWith('- ')) {
              const items = paragraph.split('\n').filter(l => l.startsWith('- '));
              return (
                <ul key={i} className="list-disc list-inside space-y-1 text-text-secondary text-sm mb-4">
                  {items.map((item, j) => <li key={j}>{item.replace('- ', '')}</li>)}
                </ul>
              );
            }
            if (paragraph.match(/^\d+\./)) {
              const items = paragraph.split('\n').filter(l => l.match(/^\d+\./));
              return (
                <ol key={i} className="list-decimal list-inside space-y-1 text-text-secondary text-sm mb-4">
                  {items.map((item, j) => <li key={j}>{item.replace(/^\d+\.\s*/, '')}</li>)}
                </ol>
              );
            }
            return <p key={i} className="text-text-secondary text-sm leading-relaxed mb-4">{paragraph}</p>;
          })}
        </div>
      </GlassCard>

      <div className="grid md:grid-cols-2 gap-4">
        <GlassCard>
          <div className="flex items-center gap-2 mb-3">
            <User size={18} className="text-gold" />
            <h3 className="text-sm font-semibold text-white">Specialist Attorney</h3>
          </div>
          <p className="text-base text-white font-medium">{currentArticle.attorneySpecialist}</p>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={18} className="text-gold" />
            <h3 className="text-sm font-semibold text-white">Services Needed</h3>
          </div>
          <div className="space-y-2">
            {currentArticle.servicesNeeded.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <CheckCircle size={12} className="text-success" />
                <span className="text-sm text-text-secondary">{s}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
