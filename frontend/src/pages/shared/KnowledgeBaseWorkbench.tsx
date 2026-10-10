import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Eye, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  GlassCard,
  KPICard,
  Modal,
  PageHeader,
  PageLoader,
  SearchInput,
  Select,
  StatusBadge,
  Table,
  Tabs,
  Td,
  Tr,
} from '../../components/UI';
import { deleteArticle, listArticles, updateArticle } from '../../services';
import { toast, useAuthStore } from '../../stores';
import type { Article } from '../../types';
import { formatDate, humanize } from '../../utils/format';
import { ArticleFormModal } from './ArticleFormModal';

/**
 * Knowledge base.
 *
 * The articles that ground the AI intake: the local matcher scores a client's
 * description against each entry's keywords, services and specialist, so the
 * AI suggestions page links back here. Admin and lawyers curate it; staff and
 * the client portal read it.
 */

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Draft' },
];

const COLUMNS = [
  { key: 'title', label: 'Article' },
  { key: 'category', label: 'Category' },
  { key: 'keywords', label: 'Keywords' },
  { key: 'status', label: 'Status' },
  { key: 'matches', label: 'AI matches' },
  { key: 'updated', label: 'Updated' },
  { key: 'actions', label: '', className: 'text-right' },
];

export interface KnowledgeBaseWorkbenchProps {
  title?: string;
  subtitle?: string;
  canWrite?: boolean;
}

export const KnowledgeBaseWorkbench: React.FC<KnowledgeBaseWorkbenchProps> = ({
  title = 'Knowledge Base',
  subtitle = 'The firm’s articles — they ground every AI suggestion.',
  canWrite = true,
}) => {
  const canWritePermission = useAuthStore(state => state.hasPermission('faqs.write'));

  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [reading, setReading] = useState<Article | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Article | null>(null);
  const [busy, setBusy] = useState(false);

  const writable = canWrite && canWritePermission;

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listArticles({
        status: (status || undefined) as 'published' | 'draft' | undefined,
        category: category || undefined,
        q: query || undefined,
      });
      setItems(rows);
    } catch {
      toast.error('Could not load the knowledge base.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, category]);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(items.map(entry => entry.category).filter(Boolean)));
    return [
      { value: '', label: 'All categories' },
      ...unique.map(value => ({ value, label: value })),
    ];
  }, [items]);

  const counts = useMemo(
    () => ({
      total: items.length,
      published: items.filter(entry => entry.status === 'published').length,
      drafts: items.filter(entry => entry.status === 'draft').length,
      matches: items.reduce((sum, entry) => sum + (entry.matchCount ?? 0), 0),
    }),
    [items],
  );

  const togglePublished = async (article: Article) => {
    try {
      await updateArticle(article.id, {
        status: article.status === 'published' ? 'draft' : 'published',
      });
      toast.success(
        article.status === 'published'
          ? `${article.title} is now a draft.`
          : `${article.title} is published.`,
      );
      await refresh();
    } catch {
      toast.error('Could not change the article status.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteArticle(pendingDelete.id);
      toast.success(`${pendingDelete.title} was deleted.`);
      setPendingDelete(null);
      await refresh();
    } catch {
      toast.error('Could not delete this article.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && items.length === 0) return <PageLoader label="Opening the knowledge base…" />;

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? items.filter(entry =>
        [entry.title, entry.summary, entry.category, entry.attorneySpecialist, ...entry.keywords]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(needle)),
      )
    : items;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          writable ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={16} />
              New article
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Articles" value={counts.total} icon={BookOpen} />
        <KPICard label="Published" value={counts.published} icon={Eye} tone="success" />
        <KPICard label="Drafts" value={counts.drafts} icon={Pencil} tone="info" />
        <KPICard label="AI matches" value={counts.matches} icon={Sparkles} />
      </div>

      <GlassCard className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              options={STATUS_OPTIONS}
              value={status}
              className="w-40"
              onChange={event => setStatus(event.target.value)}
            />
            <Select
              options={categories}
              value={category}
              className="w-48"
              onChange={event => setCategory(event.target.value)}
            />
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Search articles…" />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No articles found"
            description={
              query || status || category
                ? 'Nothing matches those filters.'
                : 'Curate the first article so the AI can cite the firm’s own guidance.'
            }
            action={
              writable ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus size={16} />
                  New article
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table columns={COLUMNS}>
            {visible.map(article => (
              <Tr key={article.id}>
                <Td className="text-white font-medium">
                  <span className="block max-w-[280px] truncate">{article.title}</span>
                  <span className="block text-[11px] text-text-muted truncate">
                    {article.attorneySpecialist || 'General practice'}
                  </span>
                </Td>
                <Td>{article.category}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1 max-w-[240px]">
                    {article.keywords.slice(0, 3).map(keyword => (
                      <span
                        key={keyword}
                        className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-text-muted"
                      >
                        {keyword}
                      </span>
                    ))}
                    {article.keywords.length > 3 ? (
                      <span className="text-[10px] text-text-muted">
                        +{article.keywords.length - 3}
                      </span>
                    ) : null}
                  </span>
                </Td>
                <Td>
                  <StatusBadge status={article.status} />
                </Td>
                <Td className="tabular-nums">{article.matchCount ?? 0}</Td>
                <Td>{formatDate(article.updatedAt ?? article.createdAt)}</Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button variant="ghost" title="Read" onClick={() => setReading(article)}>
                      <Eye size={16} />
                    </Button>
                    {writable ? (
                      <>
                        <Button
                          variant="ghost"
                          title="Edit"
                          onClick={() => {
                            setEditing(article);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          title={article.status === 'published' ? 'Unpublish' : 'Publish'}
                          onClick={() => void togglePublished(article)}
                        >
                          <BookOpen size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          title="Delete"
                          onClick={() => setPendingDelete(article)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </GlassCard>

      <ArticleFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        article={editing}
        onSaved={() => void refresh()}
      />

      <Modal
        isOpen={reading !== null}
        onClose={() => setReading(null)}
        title={reading?.title ?? 'Article'}
        subtitle={reading ? `${reading.category} · ${humanize(reading.status)}` : undefined}
        maxWidth="max-w-2xl"
      >
        {reading ? (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">{reading.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {reading.keywords.map(keyword => (
                <span
                  key={keyword}
                  className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-text-muted"
                >
                  {keyword}
                </span>
              ))}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-text-secondary whitespace-pre-wrap">
              {reading.content}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 text-xs text-text-muted">
              <p>
                <span className="text-text-secondary">Specialist:</span>{' '}
                {reading.attorneySpecialist || 'General practice'}
              </p>
              <p>
                <span className="text-text-secondary">Services:</span>{' '}
                {reading.servicesNeeded.join(', ') || '—'}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete article"
        message={`Delete “${pendingDelete?.title ?? ''}”? The AI will stop citing it.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default KnowledgeBaseWorkbench;
