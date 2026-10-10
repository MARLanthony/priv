import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Briefcase,
  CalendarClock,
  Download,
  FileText,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  UserCog,
} from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  Field,
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
import { getDownloadUrl } from '../../services/documentService';
import {
  toast,
  useAppointmentStore,
  useAuthStore,
  useCaseStore,
  useDirectoryStore,
  useDocumentStore,
} from '../../stores';
import type { Case, CasePriority, CaseStatus, User } from '../../types';
import { formatDate, humanize, relativeTime } from '../../utils/format';
import { CaseFormModal } from './CaseFormModal';

/**
 * Cases workbench.
 *
 * One component powers the admin "All cases" screen, the lawyer docket, the
 * staff intake queue and the client portal — the `scope` prop narrows the rows:
 *
 * - `firm`  → everything the API returns for the signed-in role (admin/staff)
 * - `mine`  → only matters where the signed-in lawyer is the lead attorney
 * - `self`  → only the signed-in client's own matters (`lockedClientId`)
 *
 * Filtering is hybrid: the search box and the status tabs live in the store
 * (and therefore hit the API), while priority/lawyer are applied locally so the
 * table reacts instantly. Writes go through `useCaseStore`.
 */

const STATUS_TABS: { id: CaseStatus | ''; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Pending' },
  { id: 'active', label: 'Active' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'closed', label: 'Closed' },
  { id: 'archived', label: 'Archived' },
];

const STATUS_OPTIONS = STATUS_TABS.filter(tab => tab.id !== '').map(tab => ({
  value: tab.id as string,
  label: tab.label,
}));

const PRIORITY_FILTERS = [
  { value: '', label: 'Any priority' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const COLUMNS = [
  { key: 'matter', label: 'Matter' },
  { key: 'client', label: 'Client' },
  { key: 'lawyer', label: 'Lead lawyer' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'updated', label: 'Updated' },
  { key: 'actions', label: '', className: 'text-right' },
];

export type CaseScope = 'firm' | 'mine' | 'self';

export interface CasesWorkbenchProps {
  title?: string;
  subtitle?: string;
  scope?: CaseScope;
  /** Client portal: the client is implied by the session, so the rows filter to it. */
  lockedClientId?: number;
  /** Staff creating a matter on behalf of a specific lawyer. */
  defaultLawyerId?: number;
  /** Hides the "New matter" action (read-only embeds, e.g. dashboards). */
  canCreate?: boolean;
}

export const CasesWorkbench: React.FC<CasesWorkbenchProps> = ({
  title = 'Cases',
  subtitle = 'Every matter the firm is handling.',
  scope = 'firm',
  lockedClientId,
  defaultLawyerId,
  canCreate = true,
}) => {
  const user = useAuthStore(state => state.user);
  const canWrite = useAuthStore(state => state.hasPermission('cases.write'));

  const items = useCaseStore(state => state.items);
  const filters = useCaseStore(state => state.filters);
  const loading = useCaseStore(state => state.loading);
  const fetchCases = useCaseStore(state => state.fetchCases);
  const removeCase = useCaseStore(state => state.removeCase);
  const setStatus = useCaseStore(state => state.setStatus);
  const assignCase = useCaseStore(state => state.assignCase);

  const users = useDirectoryStore(state => state.users);
  const loadUsers = useDirectoryStore(state => state.loadUsers);

  const [query, setQuery] = useState(filters.q);
  const [priority, setPriority] = useState<CasePriority | ''>('');
  const [lawyerId, setLawyerId] = useState('');
  const [selected, setSelected] = useState<Case | null>(null);
  const [editing, setEditing] = useState<Case | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Case | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  /* Debounced search — the store keeps the query so returning restores it. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchCases({ q: query });
    }, query ? 350 : 0);
    return () => window.clearTimeout(timer);
  }, [query, fetchCases]);

  const lawyers = useMemo(() => users.filter(entry => entry.role === 'lawyer'), [users]);

  const lawyerOptions = useMemo(
    () => lawyers.map(entry => ({ value: String(entry.id), label: entry.name })),
    [lawyers],
  );

  const scoped = useMemo(() => {
    if (scope === 'mine' && user) return items.filter(entry => entry.assignedLawyerId === user.id);
    if (scope === 'self' && lockedClientId !== undefined) {
      return items.filter(entry => entry.clientId === lockedClientId);
    }
    return items;
  }, [items, scope, user, lockedClientId]);

  const visible = useMemo(
    () =>
      scoped.filter(
        entry =>
          (priority ? entry.priority === priority : true) &&
          (lawyerId ? String(entry.assignedLawyerId) === lawyerId : true),
      ),
    [scoped, priority, lawyerId],
  );

  const counts = useMemo(
    () => ({
      total: scoped.length,
      high: scoped.filter(entry => entry.priority === 'high').length,
      unassigned: scoped.filter(entry => entry.assignedLawyerId === null).length,
      closed: scoped.filter(
        entry => entry.status === 'closed' || entry.status === 'archived',
      ).length,
    }),
    [scoped],
  );

  const tabs = useMemo(
    () =>
      STATUS_TABS.map(tab => ({
        id: tab.id,
        label: tab.label,
        count:
          tab.id === '' ? scoped.length : scoped.filter(entry => entry.status === tab.id).length,
      })),
    [scoped],
  );

  /* --------------------------------------------------------------- handlers */

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (item: Case) => {
    setSelected(null);
    setEditing(item);
    setFormOpen(true);
  };

  const changeStatus = async (item: Case, status: CaseStatus) => {
    if (item.status === status) return;
    try {
      const updated = await setStatus(item.id, status);
      setSelected(prev => (prev && prev.id === updated.id ? updated : prev));
      toast.success(`${item.caseNumber} is now ${humanize(status).toLowerCase()}.`);
    } catch {
      toast.error('Could not change the case status.');
    }
  };

  const changeLawyer = async (item: Case, value: string) => {
    try {
      const updated = await assignCase(item.id, value ? Number(value) : null);
      setSelected(prev => (prev && prev.id === updated.id ? updated : prev));
      toast.success(
        value ? `${item.caseNumber} reassigned.` : `${item.caseNumber} is now unassigned.`,
      );
    } catch {
      toast.error('Could not update the assignment.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await removeCase(pendingDelete.id);
      toast.success(`${pendingDelete.caseNumber} was deleted.`);
      setPendingDelete(null);
      setSelected(null);
    } catch {
      toast.error('Could not delete the case.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          canCreate && canWrite ? (
            <Button icon={Plus} onClick={openCreate}>
              New matter
            </Button>
          ) : undefined
        }
      />

      {scope !== 'self' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard label="Matters" value={counts.total} icon={Briefcase} />
          <KPICard label="High priority" value={counts.high} icon={AlertTriangle} tone="danger" />
          <KPICard
            label="Unassigned"
            value={counts.unassigned}
            icon={UserCog}
            tone="info"
            hint="Waiting for a lead lawyer"
          />
          <KPICard label="Closed / archived" value={counts.closed} icon={FolderOpen} tone="success" />
        </div>
      )}

      <GlassCard className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search by case number, title or client…"
            className="lg:flex-1"
          />
          <Select
            value={priority}
            onChange={event => setPriority(event.target.value as CasePriority | '')}
            options={PRIORITY_FILTERS}
            aria-label="Filter by priority"
            className="lg:w-44"
          />
          <Select
            value={lawyerId}
            onChange={event => setLawyerId(event.target.value)}
            options={lawyerOptions}
            placeholder="Any lawyer"
            aria-label="Filter by lead lawyer"
            className="lg:w-52"
            disabled={lawyerOptions.length === 0}
          />
        </div>

        <Tabs
          tabs={tabs}
          active={filters.status}
          onChange={id => void fetchCases({ status: id as CaseStatus | '' })}
        />
      </GlassCard>

      <GlassCard>
        {loading && items.length === 0 ? (
          <PageLoader label="Loading matters…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No matters found"
            description={
              query || priority || lawyerId || filters.status
                ? 'Nothing matches the current filters. Try clearing them.'
                : 'Open the first matter to start tracking filings, deadlines and documents.'
            }
            action={
              canCreate && canWrite ? (
                <Button icon={Plus} onClick={openCreate}>
                  New matter
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table columns={COLUMNS}>
            {visible.map(item => (
              <Tr key={item.id} onClick={() => setSelected(item)}>
                <Td>
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-royal/20 text-royal-light flex items-center justify-center flex-shrink-0">
                      <Briefcase size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.title}</p>
                      <p className="text-[11px] text-text-muted">
                        {item.caseNumber} · {humanize(item.type)}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td>{item.clientName ?? '—'}</Td>
                <Td>
                  {item.assignedLawyerName ?? (
                    <span className="text-warning text-xs font-medium">Unassigned</span>
                  )}
                </Td>
                <Td>
                  <StatusBadge status={item.status} />
                </Td>
                <Td>
                  <StatusBadge status={item.priority} />
                </Td>
                <Td className="text-xs whitespace-nowrap text-text-muted">
                  {relativeTime(item.updatedAt)}
                </Td>
                <Td className="text-right">
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={event => event.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      aria-label={`Edit ${item.caseNumber}`}
                      className="p-2 rounded-lg text-text-muted hover:text-gold hover:bg-white/5 transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => setPendingDelete(item)}
                        aria-label={`Delete ${item.caseNumber}`}
                        className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-white/5 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </GlassCard>

      <CaseFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        caseItem={editing}
        lockedClientId={lockedClientId}
        defaultLawyerId={defaultLawyerId ?? (scope === 'mine' ? user?.id : undefined)}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete matter"
        message={`Delete ${pendingDelete?.caseNumber ?? 'this matter'}? Documents and appointments stay in the system but lose the case link.`}
        confirmLabel="Delete matter"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <CaseDetailModal
        caseItem={selected}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        canWrite={canWrite}
        lawyers={lawyers}
        onStatus={changeStatus}
        onAssign={changeLawyer}
      />

    </div>
  );
};

interface CaseDetailModalProps {
  caseItem: Case | null;
  onClose: () => void;
  onEdit: (item: Case) => void;
  canWrite: boolean;
  lawyers: User[];
  onStatus: (item: Case, status: CaseStatus) => Promise<void>;
  onAssign: (item: Case, lawyerId: string) => Promise<void>;
}

/** Read-only summary of a matter with its filings and hearings. */
const CaseDetailModal: React.FC<CaseDetailModalProps> = ({
  caseItem,
  onClose,
  onEdit,
  canWrite,
  lawyers,
  onStatus,
  onAssign,
}) => {
  const documents = useDocumentStore(state => state.items);
  const fetchDocuments = useDocumentStore(state => state.fetchDocuments);
  const appointments = useAppointmentStore(state => state.items);
  const fetchAppointments = useAppointmentStore(state => state.fetchAppointments);

  const caseId = caseItem?.id ?? null;
  const clientId = caseItem?.clientId ?? null;

  useEffect(() => {
    if (caseId !== null) void fetchDocuments({ caseId });
  }, [caseId, fetchDocuments]);

  useEffect(() => {
    if (clientId !== null) void fetchAppointments({ clientId });
  }, [clientId, fetchAppointments]);

  if (!caseItem) return null;

  const item = caseItem;
  const filings = documents.filter(entry => entry.caseId === item.id);
  const hearings = appointments.filter(entry => entry.clientId === item.clientId);
  const lawyerChoices = lawyers.map(entry => ({ value: String(entry.id), label: entry.name }));

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={item.title}
      subtitle={`${item.caseNumber} · opened ${formatDate(item.createdAt)}`}
      maxWidth="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canWrite && (
            <Button icon={Pencil} onClick={() => onEdit(item)}>
              Edit matter
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={item.status} />
          <StatusBadge status={item.priority} />
          <span className="text-xs text-text-muted">Updated {relativeTime(item.updatedAt)}</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <DetailRow label="Client" value={item.clientName ?? '—'} />
          <DetailRow label="Lead lawyer" value={item.assignedLawyerName ?? 'Unassigned'} />
          <DetailRow label="Practice area" value={humanize(item.type)} />
          <DetailRow label="Case number" value={item.caseNumber} />
        </div>

        {item.description && (
          <div>
            <h3 className="text-xs font-medium text-text-secondary mb-1.5">Brief</h3>
            <p className="text-sm text-text-secondary whitespace-pre-line">{item.description}</p>
          </div>
        )}

        {canWrite && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Status" hint="Moving a matter forward updates the client's view.">
              <Select
                value={item.status}
                onChange={event => void onStatus(item, event.target.value as CaseStatus)}
                options={STATUS_OPTIONS}
              />
            </Field>
            <Field label="Lead lawyer">
              <Select
                value={item.assignedLawyerId === null ? '' : String(item.assignedLawyerId)}
                onChange={event => void onAssign(item, event.target.value)}
                options={lawyerChoices}
                placeholder="Unassigned"
              />
            </Field>
          </div>
        )}

        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
            <FileText size={15} className="text-gold" />
            Documents
            <span className="text-xs font-normal text-text-muted">({filings.length})</span>
          </h3>
          {filings.length === 0 ? (
            <p className="text-xs text-text-muted">
              No documents have been filed for this matter yet.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filings.map(doc => (
                <li key={doc.id} className="glass-light flex items-center gap-3 px-3.5 py-2.5">
                  <FileText size={15} className="text-text-muted flex-shrink-0" />
                  <span className="text-sm text-white truncate flex-1">{doc.name}</span>
                  <StatusBadge status={doc.status} />
                  <a
                    href={getDownloadUrl(doc.id, doc.fileUrl)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Download ${doc.name}`}
                    className="p-1.5 rounded-lg text-text-muted hover:text-gold hover:bg-white/5 transition-colors"
                  >
                    <Download size={15} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
            <CalendarClock size={15} className="text-gold" />
            Appointments
            <span className="text-xs font-normal text-text-muted">({hearings.length})</span>
          </h3>
          {hearings.length === 0 ? (
            <p className="text-xs text-text-muted">Nothing on the calendar for this client.</p>
          ) : (
            <ul className="space-y-1.5">
              {hearings.map(entry => (
                <li
                  key={entry.id}
                  className="glass-light flex items-center gap-3 px-3.5 py-2.5 flex-wrap"
                >
                  <CalendarClock size={15} className="text-text-muted flex-shrink-0" />
                  <span className="text-sm text-white">{formatDate(entry.date)}</span>
                  <span className="text-xs text-text-secondary tabular-nums">
                    {entry.startTime} – {entry.endTime}
                  </span>
                  <span className="text-xs text-text-muted flex-1 truncate">
                    {entry.lawyerName ?? 'Unassigned'}
                  </span>
                  <StatusBadge status={entry.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </Modal>
  );
};

/** Small key/value tile used by the detail modal above. */
const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="glass-light px-3.5 py-2.5">
    <p className="text-[11px] uppercase tracking-wide text-text-muted">{label}</p>
    <p className="text-sm text-white mt-0.5">{value}</p>
  </div>
);

