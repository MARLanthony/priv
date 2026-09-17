import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKnowledgeStore } from '../../stores/appStores';
import { PageHeader, GlassCard } from '../../components/UI';
import { BookOpen, Search, Tag, ArrowRight } from 'lucide-react';

export const ArticlesPage: React.FC = () => {
  const { articles, fetchArticles } = useKnowledgeStore();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => { fetchArticles(); }, []);

  const categories = ['all', ...new Set(articles.map(a => a.category))];
  const filtered = articles.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) || a.keywords.some(k => k.includes(search.toLowerCase()));
    const matchCat = categoryFilter === 'all' || a.category === categoryFilter;
    return matchSearch && matchCat && a.status === 'published';
  });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Legal Articles" subtitle="Browse our knowledge base for legal information" />

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 glass-input px-4 py-2 flex-1 min-w-[250px] max-w-md">
          <Search size={16} className="text-text-muted" />
          <input type="text" placeholder="Search articles..." value={search} onChange={e => setSearch(e.target.value)}
            className="bg-transparent border-none outline-none text-sm text-white w-full" />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${
                categoryFilter === cat ? 'bg-gold/20 text-gold border border-gold/30' : 'bg-white/5 text-text-secondary hover:bg-white/10 border border-transparent'
              }`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(article => (
          <GlassCard key={article.id} className="p-5 cursor-pointer group" hover onClick={() => navigate(`/user/articles/${article.id}`)}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                <BookOpen size={18} className="text-gold" />
              </div>
              <span className="text-xs text-text-muted">{article.category}</span>
            </div>
            <h3 className="text-base font-semibold text-white mb-2 group-hover:text-gold transition-colors">{article.title}</h3>
            <p className="text-sm text-text-secondary mb-3 line-clamp-2">{article.summary}</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {article.keywords.slice(0, 3).map(kw => (
                <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-text-muted">
                  <Tag size={8} /> {kw}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <span className="text-xs text-text-muted">By {article.attorneySpecialist}</span>
              <ArrowRight size={14} className="text-text-muted group-hover:text-gold transition-colors" />
            </div>
          </GlassCard>
        ))}
      </div>
    </div>
  );
};
