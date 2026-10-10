import React, { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, Select, TextArea } from '../../components/UI';
import { toast } from '../../stores';
import { createArticle, updateArticle } from '../../services';
import type { Article } from '../../types';

/** `['a','b']` → `'a, b'` for the comma-separated inputs below. */
const toCsv = (values: string[] | undefined): string => (values ?? []).join(', ');

/** `'a, b'` → `['a','b']`, dropping empty entries. */
const fromCsv = (value: string): string[] =>
  value
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean);

const statusOptions = [
  { value: 'published', label: 'Published — grounds AI answers' },
  { value: 'draft', label: 'Draft — internal only' },
];

export interface ArticleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Editing an existing knowledge-base entry; omit to add one. */
  article?: Article | null;
  /** Called after a successful write so the list can refresh. */
  onSaved?: () => void;
}

/**
 * Knowledge-base editor.
 *
 * Articles back the local NLP matcher, so extra care goes into the keyword
 * list and the services/attorney fields: they are what the recommender scores.
 */
export const ArticleFormModal: React.FC<ArticleFormModalProps> = ({
  isOpen,
  onClose,
  article = null,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [keywords, setKeywords] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [attorneySpecialist, setAttorneySpecialist] = useState('');
  const [servicesNeeded, setServicesNeeded] = useState('');
  const [status, setStatus] = useState<'published' | 'draft'>('published');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(article?.title ?? '');
    setCategory(article?.category ?? '');
    setKeywords(toCsv(article?.keywords));
    setSummary(article?.summary ?? '');
    setContent(article?.content ?? '');
    setAttorneySpecialist(article?.attorneySpecialist ?? '');
    setServicesNeeded(toCsv(article?.servicesNeeded));
    setStatus(article?.status ?? 'published');
  }, [isOpen, article]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim() || !summary.trim() || !content.trim()) {
      toast.error('A title, a summary and the article body are required.');
      return;
    }
    if (fromCsv(keywords).length === 0) {
      toast.error('Add at least one keyword — the AI matches intake text against them.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<Article> = {
        title: title.trim(),
        category: category.trim() || 'General',
        keywords: fromCsv(keywords),
        summary: summary.trim(),
        content: content.trim(),
        attorneySpecialist: attorneySpecialist.trim() || 'General Practice',
        servicesNeeded: fromCsv(servicesNeeded),
        status,
      };

      if (article) {
        await updateArticle(article.id, payload);
        toast.success('Article updated.');
      } else {
        await createArticle(payload);
        toast.success('Article added to the knowledge base.');
      }
      onSaved?.();
      onClose();
    } catch {
      toast.error('The article could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={article ? 'Edit article' : 'New knowledge-base article'}
      subtitle="Keywords, the specialist and the services feed the intake recommender."
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="article-form" loading={saving}>
            {article ? 'Save changes' : 'Add article'}
          </Button>
        </>
      }
    >
      <form id="article-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label="Title" required>
            <Input
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder="Unfair dismissal: your rights after termination"
            />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onChange={event => setStatus(event.target.value as 'published' | 'draft')}
              options={statusOptions}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" hint="e.g. Labor, Family, Property.">
            <Input value={category} onChange={event => setCategory(event.target.value)} placeholder="Labor" />
          </Field>
          <Field label="Attorney specialist" hint="Which practice group handles this topic.">
            <Input
              value={attorneySpecialist}
              onChange={event => setAttorneySpecialist(event.target.value)}
              placeholder="Employment Law"
            />
          </Field>
        </div>

        <Field label="Keywords" required hint="Comma separated. The matcher scores intake text against these.">
          <Input
            value={keywords}
            onChange={event => setKeywords(event.target.value)}
            placeholder="dismissal, termination, severance, wrongful"
          />
        </Field>

        <Field label="Services needed" hint="Comma separated — services the client likely needs.">
          <Input
            value={servicesNeeded}
            onChange={event => setServicesNeeded(event.target.value)}
            placeholder="Wrongful termination claim, Severance negotiation"
          />
        </Field>

        <Field label="Summary" required hint="Two or three sentences shown in the search results.">
          <TextArea rows={3} value={summary} onChange={event => setSummary(event.target.value)} />
        </Field>

        <Field label="Content" required hint="Full article body used to ground the AI answer.">
          <TextArea rows={8} value={content} onChange={event => setContent(event.target.value)} />
        </Field>
      </form>
    </Modal>
  );
};

export default ArticleFormModal;

