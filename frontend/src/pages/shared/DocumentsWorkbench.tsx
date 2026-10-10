import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpenCheck,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  FolderOpen,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
  GlassCard,
  KPICard,
  LoadingSpinner,
  Modal,
  PageHeader,
  PageLoader,
  ProgressBar,
  SearchInput,
  Select,
  StatusBadge,
  Table,
  Tabs,
  Td,
  Tr,
} from '../../components/UI';
import { getDownloadUrl } from '../../services/documentService';
import { toast, useAuthStore, useCaseStore, useDirectoryStore, useDocumentStore } from '../../stores';
import type { Document, DocumentStatus } from '../../types';
import { formatDateTime, humanize, relativeTime } from '../../utils/format';

/**
 * Documents workbench.
 *
 * The firm's filing cabinet. `scope` decides the perspective, exactly like the
 * other workbenches:
 *
 * - `firm` → admin/staff/lawyer: every file the API returns, with review tools
 * - `self` → client portal: only their own uploads (`lockedClientId`)
 *
 * Uploads stream to `POST /documents` (multipart) through `useDocumentStore`,
 * which also exposes the 0-100 upload progress used by the progress bar.
 */

const STATUS_TABS: { id: DocumentStatus | ''; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'received', label: 'Received' },
  { id: 'reviewing', label: 'Under review' },
  { id: 'processed', label: 'Processed' },
  { id: 'rejected', label: 'Rejected' },
];

const STATUS_OPTIONS = STATUS_TABS.filter(tab => tab.id !== '').map(tab => ({
  value: tab.id as string,
  label: tab.label,
}));

const COLUMNS = [
  { key: 'name', label: 'Document' },
  { key: 'client', label: 'Client' },
  { key: 'case', label: 'Matter' },
  { key: 'status', label: 'Status' },
  { key: 'uploaded', label: 'Uploaded' },
  { key: 'actions', label: '', className: 'text-right' },
];

export type DocumentScope = 'firm' | 'self';

export interface DocumentsWorkbenchProps {
  title?: string;
  subtitle?: string;
  scope?: DocumentScope;
  /** Client portal: the client comes from the session. */
  lockedClientId?: number;
  /** Hides the upload button (read-only embeds). */
  canUpload?: boolean;
}

interface AnalysisRow {
  classification: string;
  summary: string;
  keywords: string[];
}

export const DocumentsWorkbench: React.FC<DocumentsWorkbenchProps> = ({
  title = 'Documents',
  subtitle = 'Everything filed against the firm’s matters.',
  scope = 'firm',
  lockedClientId,
  canUpload = true,
}) => {
  const canWrite = useAuthStore(state => state.hasPermission('documents.write'));

  const items = useDocumentStore(state => state.items);
  const loading = useDocumentStore(state => state.loading);
  const uploading = useDocumentStore(state => state.uploading);
  const progress = useDocumentStore(state => state.progress);
  const fetchDocuments = useDocumentStore(state => state.fetchDocuments);
  const upload = useDocumentStore(state => state.upload);
  const setStatus = useDocumentStore(state => state.setStatus);
  const remove = useDocumentStore(state => state.remove);
  const loadAnalysis = useDocumentStore(state => state.loadAnalysis);

  const cases = useCaseStore(state => state.items);
  const fetchCases = useCaseStore(state => state.fetchCases);

  const clients = useDirectoryStore(state => state.clients);
  const loadClients = useDirectoryStore(state => state.loadClients);

  const [tab, setTab] = useState<DocumentStatus | ''>('');
  const [query, setQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [analysisFor, setAnalysisFor] = useState<Document | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisRow | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);
  const [busy, setBusy] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [clientId, setClientId] = useState('');
  const [caseId, setCaseId] = useState('');
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    void loadClients();
    void fetchCases();
  }, [loadClients, fetchCases]);

  useEffect(() => {
    void fetchDocuments(scope === 'self' ? { clientId: lockedClientId } : {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchDocuments, scope, lockedClientId]);

  const scoped = useMemo(() => {
    if (scope === 'self' && lockedClientId !== undefined) {
      return items.filter(entry => entry.clientId === lockedClientId);
    }
    return items;
  }, [items, scope, lockedClientId]);

  const counts = useMemo(
    () => ({
      total: scoped.length,
      received: scoped.filter(entry => entry.status === 'received').length,
      reviewing: scoped.filter(entry => entry.status === 'reviewing').length,
      processed: scoped.filter(entry => entry.status === 'processed').length,
    }),
    [scoped],
  );

  /* The API filters by status; the search box is applied locally. */
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scoped
      .filter(entry => (tab ? entry.status === tab : true))
      .filter(entry =>
        needle
          ? [entry.name, entry.clientName, entry.caseName, entry.uploadedByName]
              .filter(Boolean)
              .some(value => String(value).toLowerCase().includes(needle))
          : true,
      );
  }, [scoped, tab, query]);

  const changeTab = (id: string) => {
    setTab(id as DocumentStatus | '');
    void fetchDocuments({
      status: (id || undefined) as DocumentStatus | undefined,
      clientId: scope === 'self' ? lockedClientId : undefined,
    });
  };

  const resetUpload = () => {
    setFile(null);
    setClientId(scope === 'self' && lockedClientId !== undefined ? String(lockedClientId) : '');
    setCaseId('');
    if (fileInput.current) fileInput.current.value = '';
  };

  const openUpload = () => {
    resetUpload();
    setUploadOpen(true);
  };

  const submitUpload = async () => {
    if (!file) {
      toast.error('Choose a file to upload.');
      return;
    }
    const targetClient = scope === 'self' ? lockedClientId : Number(clientId);
    if (!targetClient) {
      toast.error('Choose the client this document belongs to.');
      return;
    }

    setBusy(true);
    try {
      await upload({ file, clientId: targetClient, caseId: caseId ? Number(caseId) : null });
      toast.success(`${file.name} was filed.`);
      setUploadOpen(false);
      resetUpload();
    } catch {
      toast.error('The upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const openAnalysis = async (record: Document) => {
    setAnalysisFor(record);
    setAnalysis(null);
    setAnalysisLoading(true);
    try {
      const result = await loadAnalysis(record.id);
      if (!result) {
        toast.info('This document has not been analysed yet.');
      } else {
        const raw = result.extractedInfo ?? {};
        const keywords = Array.isArray(raw.keywords) ? raw.keywords.map(String) : [];
        setAnalysis({
          classification: result.classification,
          summary: result.summary,
          keywords: keywords.slice(0, 12),
        });
      }
    } finally {
      setAnalysisLoading(false);
    }
  };

  const changeStatus = async (record: Document, status: DocumentStatus) => {
    try {
      await setStatus(record.id, status);
      toast.success(`${record.name} is now ${humanize(status).toLowerCase()}.`);
    } catch {
      toast.error('Could not update the document.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await remove(pendingDelete.id);
      toast.success(`${pendingDelete.name} was deleted.`);
      setPendingDelete(null);
    } catch {
      toast.error('Could not delete the document.');
    } finally {
      setBusy(false);
    }
  };

  const clientOptions = useMemo(
    () => clients.map(entry => ({ value: String(entry.id), label: entry.fullName })),
    [clients],
  );

  const caseOptions = useMemo(
    () =>
      cases
        .filter(entry => (clientId ? String(entry.clientId) === clientId : true))
        .map(entry => ({ value: String(entry.id), label: `${entry.caseNumber} · ${entry.title}` })),
    [cases, clientId],
  );

  if (loading && scoped.length === 0) return <PageLoader label="Opening the filing cabinet…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          canUpload && canWrite ? (
            <Button onClick={openUpload}>
              <Upload size={16} />
              Upload document
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Files" value={counts.total} icon={FileText} />
        <KPICard label="Received" value={counts.received} icon={FolderOpen} tone="info" />
        <KPICard label="Under review" value={counts.reviewing} icon={Clock} />
        <KPICard label="Processed" value={counts.processed} icon={CheckCircle2} tone="success" />
      </div>

      <GlassCard className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs tabs={STATUS_TABS} active={tab} onChange={changeTab} />
          <SearchInput value={query} onChange={setQuery} placeholder="Search documents…" />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents here"
            description={
              canUpload
                ? 'Upload the first file to start the paper trail.'
                : 'Files shared with this matter will appear here.'
            }
            action={
              canUpload && canWrite ? (
                <Button onClick={openUpload}>
                  <Upload size={16} />
                  Upload document
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table columns={COLUMNS}>
            {visible.map(record => (
              <Tr key={record.id}>
                <Td className="text-white font-medium">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <FileText size={16} className="text-gold flex-shrink-0" />
                    <span className="truncate">{record.name}</span>
                  </span>
                  <span className="block text-[11px] text-text-muted mt-0.5">
                    {record.uploadedByName ? `by ${record.uploadedByName}` : 'Uploaded'}
                  </span>
                </Td>
                <Td>{record.clientName ?? '—'}</Td>
                <Td>{record.caseName ?? '—'}</Td>
                <Td>
                  <StatusBadge status={record.status} />
                </Td>
                <Td>
                  <span title={formatDateTime(record.createdAt)}>
                    {relativeTime(record.createdAt)}
                  </span>
                </Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1.5 flex-wrap">
                    {canWrite && scope === 'firm' ? (
                      <Select
                        options={STATUS_OPTIONS}
                        value={record.status}
                        className="w-36"
                        onChange={event =>
                          void changeStatus(record, event.target.value as DocumentStatus)
                        }
                      />
                    ) : null}
                    <Button
                      variant="ghost"
                      onClick={() => void openAnalysis(record)}
                      title="View AI classification"
                    >
                      <BookOpenCheck size={16} />
                    </Button>
                    <a
                      href={getDownloadUrl(record.id, record.fileUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
                      title="Download"
                    >
                      <Download size={16} />
                    </a>
                    {canWrite ? (
                      <Button
                        variant="ghost"
                        onClick={() => setPendingDelete(record)}
                        title="Delete document"
                      >
                        <Trash2 size={16} />
                      </Button>
                    ) : null}
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </GlassCard>

      <Modal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload a document"
        subtitle="Files stream straight to the firm's storage and are filed against a client."
        footer={
          <>
            <Button variant="secondary" onClick={() => setUploadOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void submitUpload()} loading={busy || uploading}>
              <Upload size={16} />
              Upload
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="File" required hint="PDF, DOCX, images — anything the client sends or signs.">
            <input
              ref={fileInput}
              type="file"
              onChange={event => setFile(event.target.files?.[0] ?? null)}
              className="glass-input w-full px-3.5 py-2.5 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-gold/15 file:px-3 file:py-1.5 file:text-xs file:text-gold"
            />
          </Field>

          {scope === 'firm' ? (
            <Field label="Client" required>
              <Select
                options={clientOptions}
                placeholder="Choose a client…"
                value={clientId}
                onChange={event => {
                  setClientId(event.target.value);
                  setCaseId('');
                }}
              />
            </Field>
          ) : null}

          <Field label="Matter" hint="Optional — leave empty for a general file.">
            <Select
              options={caseOptions}
              placeholder="Not linked to a matter"
              value={caseId}
              onChange={event => setCaseId(event.target.value)}
            />
          </Field>

          {uploading ? (
            <div className="space-y-1.5">
              <p className="text-xs text-text-secondary">Uploading…</p>
              <ProgressBar value={progress} />
            </div>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={analysisFor !== null}
        onClose={() => setAnalysisFor(null)}
        title={analysisFor?.name ?? 'Document analysis'}
        subtitle="Stored AI classification for this file."
        maxWidth="max-w-xl"
      >
        {analysisLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={analysis.classification} />
            </div>
            <p className="text-sm text-text-secondary">{analysis.summary}</p>
            {analysis.keywords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {analysis.keywords.map(keyword => (
                  <span
                    key={keyword}
                    className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-text-muted"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">
            No analysis has been stored yet. Run the AI intake on this file to classify it.
          </p>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete document"
        message={`Delete “${pendingDelete?.name ?? ''}”? The stored analysis is removed with it.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default DocumentsWorkbench;

