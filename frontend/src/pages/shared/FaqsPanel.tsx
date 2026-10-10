import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, HelpCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  GlassCard,
  PageHeader,
  PageLoader,
  SearchInput,
} from '../../components/UI';
import { deleteFaq, listFaqs } from '../../services';
import { toast, useAuthStore } from '../../stores';
import type { FAQ } from '../../types';
import { FaqFormModal } from './FaqFormModal';

/**
 * Frequently asked questions.
 *
 * The client portal reads them; staff and lawyers with `faqs.write` maintain
 * them from the same screen, so the answer a client sees is the one the firm
 * just wrote.
 */

export interface FaqsPanelProps {
  title?: string;
  subtitle?: string;
  /** Shows the create/edit/delete actions (faqs.write holders). */
  canManage?: boolean;
}

export const FaqsPanel: React.FC<FaqsPanelProps> = ({
  title = 'FAQs',
  subtitle = 'Answers the firm is asked for most often.',
  canManage = false,
}) => {
  const canWrite = useAuthStore(state => state.hasPermission('faqs.write'));

  const [items, setItems] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FAQ | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FAQ | null>(null);
  const [busy, setBusy] = useState(false);

  const writable = canManage && canWrite;

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listFaqs();
      setItems(rows);
    } catch {
      toast.error('Could not load the FAQs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(items.map(entry => entry.category).filter(Boolean))).sort(),
    [items],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter(entry => (category ? entry.category === category : true))
      .filter(entry =>
        needle
          ? [entry.question, entry.answer].some(value => value.toLowerCase().includes(needle))
          : true,
      );
  }, [items, query, category]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteFaq(pendingDelete.id);
      toast.success('The question was removed.');
      setPendingDelete(null);
      await refresh();
    } catch {
      toast.error('Could not delete this question.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && items.length === 0) return <PageLoader label="Loading the FAQs…" />;

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
              New question
            </Button>
          ) : undefined
        }
      />

      <GlassCard className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {['', ...categories].map(entry => (
              <button
                key={entry || 'all'}
                type="button"
                onClick={() => setCategory(entry)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  category === entry
                    ? 'bg-gold/15 text-gold border-gold/30'
                    : 'text-text-secondary border-transparent hover:bg-white/5'
                }`}
              >
                {entry || 'All'}
              </button>
            ))}
          </div>
          <SearchInput value={query} onChange={setQuery} placeholder="Search questions…" />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={HelpCircle}
            title="No questions found"
            description={
              query || category
                ? 'Try another search or category.'
                : 'The firm has not published any FAQs yet.'
            }
          />
        ) : (
          <div className="space-y-2.5">
            {visible.map(entry => {
              const open = openId === entry.id;
              return (
                <div
                  key={entry.id}
                  className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : entry.id)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-white">{entry.question}</span>
                      <span className="block text-[11px] text-text-muted">{entry.category}</span>
                    </span>
                    <ChevronDown
                      size={17}
                      className={`text-text-muted flex-shrink-0 transition-transform ${
                        open ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {open ? (
                    <div className="px-4 pb-4 space-y-3">
                      <p className="text-sm text-text-secondary whitespace-pre-wrap">
                        {entry.answer}
                      </p>
                      {writable ? (
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditing(entry);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil size={16} />
                            Edit
                          </Button>
                          <Button variant="ghost" onClick={() => setPendingDelete(entry)}>
                            <Trash2 size={16} />
                            Delete
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>

      <FaqFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        faq={editing}
        onSaved={() => void refresh()}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete question"
        message={`Delete “${pendingDelete?.question ?? ''}”?`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default FaqsPanel;
