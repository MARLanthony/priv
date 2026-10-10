import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Clock,
  MessageSquarePlus,
  Scale,
  Trash2,
  XCircle,
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
  TextArea,
  Tr,
} from '../../components/UI';
import { listLegalServices } from '../../services';
import { toast, useAuthStore, useConsultationStore } from '../../stores';
import type { Consultation, ConsultationStatus, LegalService } from '../../types';
import { formatDate, relativeTime, shortName } from '../../utils/format';
import { AppointmentFormModal } from './AppointmentFormModal';

/**
 * Consultations workbench — the intake pipeline.
 *
 * A client submits a concern (`POST /consultations`), staff and lawyers review
 * it (`PATCH /consultations/:id/status`) and an approved consultation becomes
 * the anchor for a booked appointment.
 *
 * The `scope` prop picks the perspective, exactly like `CasesWorkbench`:
 *
 * - `firm`     → admin/staff: every request in the queue, KPIs and review tools
 * - `reviewer` → lawyer: the same queue, review tools and booking shortcut
 * - `self`     → client portal: only their own requests plus the request form
 */

const STATUS_TABS: { id: ConsultationStatus | ''; label: string }[] = [
  { id: '', label: 'All' },
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'declined', label: 'Declined' },
  { id: 'completed', label: 'Completed' },
];

const COLUMNS = [
  { key: 'client', label: 'Client' },
  { key: 'concern', label: 'Concern' },
  { key: 'service', label: 'Practice area' },
  { key: 'status', label: 'Status' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'actions', label: '', className: 'text-right' },
];

export type ConsultationScope = 'firm' | 'reviewer' | 'self';

export interface ConsultationsWorkbenchProps {
  title?: string;
  subtitle?: string;
  scope?: ConsultationScope;
  /** Client portal: keeps the rows to one client (the session's client record). */
  lockedClientId?: number;
  /** Hides the "New request" action (read-only embeds). */
  canCreate?: boolean;
}

export const ConsultationsWorkbench: React.FC<ConsultationsWorkbenchProps> = ({
  title = 'Consultations',
  subtitle = 'Intake requests from clients, waiting for review.',
  scope = 'firm',
  lockedClientId,
  canCreate = true,
}) => {
  const canReview = useAuthStore(state => state.hasPermission('consultations.review'));

  const items = useConsultationStore(state => state.items);
  const status = useConsultationStore(state => state.status);
  const loading = useConsultationStore(state => state.loading);
  const fetchConsultations = useConsultationStore(state => state.fetchConsultations);
  const review = useConsultationStore(state => state.review);
  const remove = useConsultationStore(state => state.remove);

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Consultation | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Consultation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [booking, setBooking] = useState<Consultation | null>(null);

  /* The status tab lives in the store, so every change hits the API. */
  useEffect(() => {
    void fetchConsultations();
  }, [fetchConsultations]);

  const changeTab = (id: string) => {
    void fetchConsultations(id as ConsultationStatus | '');
  };

  const scoped = useMemo(() => {
    if (scope === 'self' && lockedClientId !== undefined) {
      return items.filter(entry => entry.clientId === lockedClientId);
    }
    return items;
  }, [items, scope, lockedClientId]);

  /* The API only filters by status, so free text is applied locally. */
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return scoped;
    return scoped.filter(entry =>
      [entry.concern, entry.clientName, entry.serviceName]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(needle)),
    );
  }, [scoped, query]);

  const counts = useMemo(
    () => ({
      total: scoped.length,
      pending: scoped.filter(entry => entry.status === 'pending').length,
      approved: scoped.filter(entry => entry.status === 'approved').length,
      declined: scoped.filter(entry => entry.status === 'declined').length,
      completed: scoped.filter(entry => entry.status === 'completed').length,
    }),
    [scoped],
  );

  const tabs = useMemo(
    () =>
      STATUS_TABS.map(tab => ({
        id: tab.id,
        label: tab.label,
        count: tab.id === '' ? scoped.length : scoped.filter(entry => entry.status === tab.id).length,
      })),
    [scoped],
  );

  /* --------------------------------------------------------------- handlers */

  const applyReview = async (item: Consultation, next: ConsultationStatus) => {
    if (item.status === next) return;
    try {
      const updated = await review(item.id, next);
      setSelected(prev => (prev && prev.id === updated.id ? updated : prev));
      toast.success(`${shortName(item.clientName)}'s request is now ${next}.`);
    } catch {
      toast.error('Could not update the consultation.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await remove(pendingDelete.id);
      toast.success('Consultation deleted.');
      setPendingDelete(null);
      setSelected(null);
    } catch {
      toast.error('Could not delete the consultation.');
    } finally {
      setDeleting(false);
    }
  };

  if (loading && scoped.length === 0) return <PageLoader label="Loading the intake queue…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          canCreate && scope === 'self' ? (
            <Button icon={MessageSquarePlus} onClick={() => setRequestOpen(true)}>
              Request a consultation
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label={scope === 'self' ? 'My requests' : 'Requests'}
          value={counts.total}
          icon={ClipboardList}
        />
        <KPICard
          label={scope === 'self' ? 'Awaiting review' : 'Pending review'}
          value={counts.pending}
          icon={Clock}
          tone="info"
        />
        <KPICard label="Approved" value={counts.approved} icon={CheckCircle2} tone="success" />
        <KPICard
          label={scope === 'self' ? 'Completed' : 'Declined'}
          value={scope === 'self' ? counts.completed : counts.declined}
          icon={scope === 'self' ? Scale : XCircle}
          tone={scope === 'self' ? 'gold' : 'danger'}
        />
      </div>

      <GlassCard className="space-y-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by concern, client or practice area…"
        />

        <Tabs tabs={tabs} active={status} onChange={changeTab} />

        {loading ? (
          <PageLoader label="Refreshing…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={query ? 'No matching requests' : 'Nothing in the queue'}
            description={
              query
                ? 'Try a different search term, or clear the box to see everything.'
                : scope === 'self'
                  ? 'Describe your legal concern and the firm will review it.'
                  : 'New client requests land here for review.'
            }
            action={
              scope === 'self' && canCreate ? (
                <Button icon={MessageSquarePlus} onClick={() => setRequestOpen(true)}>
                  Request a consultation
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table columns={COLUMNS}>
            {visible.map(item => (
              <Tr key={item.id} onClick={() => setSelected(item)}>
                <Td className="text-white font-medium whitespace-nowrap">
                  {item.clientName ?? `Client #${item.clientId}`}
                </Td>
                <Td className="max-w-[22rem]">
                  <span className="line-clamp-2">{item.concern}</span>
                </Td>
                <Td className="whitespace-nowrap">{item.serviceName ?? '—'}</Td>
                <Td>
                  <StatusBadge status={item.status} />
                </Td>
                <Td className="text-xs whitespace-nowrap text-text-muted">
                  {relativeTime(item.createdAt)}
                </Td>
                <Td className="text-right">
                  <div
                    className="flex items-center justify-end gap-1"
                    onClick={event => event.stopPropagation()}
                  >
                    {canReview && item.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => void applyReview(item, 'approved')}
                          aria-label="Approve request"
                          title="Approve"
                          className="p-2 rounded-lg text-text-muted hover:text-success hover:bg-white/5 transition-colors"
                        >
                          <CheckCircle2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void applyReview(item, 'declined')}
                          aria-label="Decline request"
                          title="Decline"
                          className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-white/5 transition-colors"
                        >
                          <XCircle size={15} />
                        </button>
                      </>
                    )}
                    {canReview && (
                      <button
                        type="button"
                        onClick={() => setPendingDelete(item)}
                        aria-label="Delete request"
                        title="Delete"
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

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete consultation"
        message={`Delete the request from ${shortName(pendingDelete?.clientName) || 'this client'}? This cannot be undone.`}
        confirmLabel="Delete request"
        danger
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <ConsultationDetailModal
        consultation={selected}
        canReview={canReview}
        canBook={scope !== 'self'}
        onClose={() => setSelected(null)}
        onReview={applyReview}
        onBook={item => {
          setSelected(null);
          setBooking(item);
        }}
      />

      <RequestConsultationModal isOpen={requestOpen} onClose={() => setRequestOpen(false)} />

      <AppointmentFormModal
        isOpen={booking !== null}
        onClose={() => setBooking(null)}
        lockedClientId={booking?.clientId ?? lockedClientId}
        consultationId={booking?.id ?? null}
      />
    </div>
  );
};

/* --------------------------------------------------------------- sub-views */

interface ConsultationDetailModalProps {
  consultation: Consultation | null;
  canReview: boolean;
  canBook: boolean;
  onClose: () => void;
  onReview: (item: Consultation, status: ConsultationStatus) => Promise<void>;
  onBook: (item: Consultation) => void;
}

/** Read-only summary of one intake request with the review actions. */
const ConsultationDetailModal: React.FC<ConsultationDetailModalProps> = ({
  consultation: item,
  canReview,
  canBook,
  onClose,
  onReview,
  onBook,
}) => (
  <Modal
    isOpen={item !== null}
    onClose={onClose}
    title={item ? `Request from ${shortName(item.clientName) || 'client'}` : 'Consultation'}
    subtitle={item ? `Submitted ${formatDate(item.createdAt)}` : undefined}
    maxWidth="max-w-xl"
    footer={
      item ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canReview && item.status === 'pending' && (
            <>
              <Button variant="ghost" icon={XCircle} onClick={() => void onReview(item, 'declined')}>
                Decline
              </Button>
              <Button icon={CheckCircle2} onClick={() => void onReview(item, 'approved')}>
                Approve
              </Button>
            </>
          )}
          {canReview && item.status === 'approved' && (
            <Button
              variant="secondary"
              icon={CheckCircle2}
              onClick={() => void onReview(item, 'completed')}
            >
              Mark completed
            </Button>
          )}
          {canBook && item.status === 'approved' && (
            <Button icon={CalendarPlus} onClick={() => onBook(item)}>
              Book appointment
            </Button>
          )}
        </div>
      ) : undefined
    }
  >
    {item && (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={item.status} />
          <span className="text-xs text-text-muted">{relativeTime(item.createdAt)}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <SummaryRow label="Client" value={item.clientName ?? `Client #${item.clientId}`} />
          <SummaryRow label="Practice area" value={item.serviceName ?? 'Not specified'} />
          <SummaryRow
            label="Reviewed by"
            value={item.reviewedByName ?? 'Awaiting review'}
            className="col-span-2"
          />
        </div>

        <div>
          <p className="text-xs font-medium text-text-secondary mb-1.5">The client's concern</p>
          <p className="text-sm text-text-secondary glass-input px-3.5 py-3 whitespace-pre-wrap">
            {item.concern}
          </p>
        </div>
      </div>
    )}
  </Modal>
);

/** Small definition row used by the detail modal. */
const SummaryRow: React.FC<{ label: string; value: string; className?: string }> = ({
  label,
  value,
  className = '',
}) => (
  <div className={`glass-input px-3 py-2 ${className}`}>
    <p className="text-[11px] uppercase tracking-wide text-text-muted">{label}</p>
    <p className="text-sm text-white mt-0.5">{value}</p>
  </div>
);

interface RequestConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Client-facing intake form (`POST /consultations`). */
const RequestConsultationModal: React.FC<RequestConsultationModalProps> = ({ isOpen, onClose }) => {
  const submit = useConsultationStore(state => state.submit);
  const saving = useConsultationStore(state => state.saving);

  const [services, setServices] = useState<LegalService[]>([]);
  const [concern, setConcern] = useState('');
  const [serviceId, setServiceId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setConcern('');
    setServiceId('');
    void listLegalServices()
      .then(setServices)
      .catch(() => setServices([]));
  }, [isOpen]);

  const serviceOptions = useMemo(
    () => services.map(service => ({ value: String(service.id), label: service.name })),
    [services],
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (concern.trim().length < 10) {
      toast.error('Tell us a little more about your situation.');
      return;
    }
    try {
      await submit({
        concern: concern.trim(),
        serviceId: serviceId ? Number(serviceId) : null,
      });
      toast.success('Request sent — the firm will review it shortly.');
      onClose();
    } catch {
      toast.error('Could not submit your request.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Request a consultation"
      subtitle="A lawyer reviews every request before anything is scheduled."
      maxWidth="max-w-xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="consultation-request" loading={saving}>
            Send request
          </Button>
        </div>
      }
    >
      <form id="consultation-request" onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field
          label="What do you need help with?"
          required
          hint="Include the people, dates and documents involved so we can route it correctly."
        >
          <TextArea
            rows={6}
            value={concern}
            onChange={event => setConcern(event.target.value)}
            placeholder="e.g. I was dismissed after reporting a safety issue at work…"
          />
        </Field>

        <Field label="Practice area" hint="Optional — leave it to the firm if you are not sure.">
          <Select
            value={serviceId}
            onChange={event => setServiceId(event.target.value)}
            options={serviceOptions}
            placeholder="Let the firm decide"
          />
        </Field>
      </form>
    </Modal>
  );
};

export default ConsultationsWorkbench;
