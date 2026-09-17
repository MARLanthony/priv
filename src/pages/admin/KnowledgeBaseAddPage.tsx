import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKnowledgeStore } from '../../stores/appStores';
import { PageHeader, GlassCard } from '../../components/UI';
import { ArrowLeft, Save } from 'lucide-react';

export const KnowledgeBaseAddPage: React.FC = () => {
  const { createArticle } = useKnowledgeStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', category: 'Criminal Law', keywords: '', summary: '', content: '',
    attorneySpecialist: '', servicesNeeded: '', status: 'draft' as const,
  });

  const handleSubmit = () => {
    createArticle({
      ...form,
      keywords: form.keywords.split(',').map(k => k.trim()),
      servicesNeeded: form.servicesNeeded.split(',').map(s => s.trim()),
    });
    navigate('/admin/knowledge-base');
  };

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors text-sm mb-4">
        <ArrowLeft size={16} /> Back to Knowledge Base
      </button>

      <PageHeader title="Add New Article" subtitle="Create a new knowledge base article" />

      <GlassCard className="max-w-3xl">
        <div className="space-y-5">
          <div>
            <label className="text-sm text-text-secondary block mb-1">Article Title</label>
            <input value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Article title" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Category</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm">
                <option>Criminal Law</option>
                <option>Intellectual Property</option>
                <option>Personal Injury</option>
                <option>Estate Law</option>
                <option>Corporate Law</option>
                <option>Family Law</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">Status</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value as any})} className="glass-input w-full px-4 py-2.5 text-sm">
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm text-text-secondary block mb-1">Keywords (comma-separated)</label>
            <input value={form.keywords} onChange={e => setForm({...form, keywords: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="assault, battery, criminal" />
          </div>

          <div>
            <label className="text-sm text-text-secondary block mb-1">Summary</label>
            <textarea value={form.summary} onChange={e => setForm({...form, summary: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm min-h-[80px] resize-none" placeholder="Brief summary..." />
          </div>

          <div>
            <label className="text-sm text-text-secondary block mb-1">Content</label>
            <textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm min-h-[200px] resize-none" placeholder="Full article content..." />
          </div>

          <div>
            <label className="text-sm text-text-secondary block mb-1">Attorney Specialist</label>
            <input value={form.attorneySpecialist} onChange={e => setForm({...form, attorneySpecialist: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="John Smith, Esq." />
          </div>

          <div>
            <label className="text-sm text-text-secondary block mb-1">Services Needed (comma-separated)</label>
            <input value={form.servicesNeeded} onChange={e => setForm({...form, servicesNeeded: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Legal Consultation, Case Filing" />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
            <button onClick={handleSubmit} className="btn-primary flex items-center gap-2"><Save size={14} /> Publish Article</button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};
