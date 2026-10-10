import React, { useEffect, useMemo, useState } from 'react';
import { Button, Field, Input, Modal, Select, TextArea } from '../../components/UI';
import { toast, useCaseStore, useDirectoryStore } from '../../stores';
import type { Case, CasePriority, CaseStatus } from '../../types';
import { humanize } from '../../utils/format';

const STATUSES: CaseStatus[] = ['open', 'pending', 'active', 'discovery', 'closed', 'archived'];
const PRIORITIES: CasePriority[] = ['high', 'medium', 'low'];

const statusOptions = STATUSES.map(value => ({ value, label: humanize(value) }));
const priorityOptions = PRIORITIES.map(value => ({ value, label: humanize(value) }));

export interface CaseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Editing an existing matter; omit to open an empty form. */
  caseItem?: Case | null;
  /** Client portal: the client is implied by the session, so the picker locks. */
  lockedClientId?: number;
  /** Pre-selects the signed-in lawyer when staff open a matter for them. */
  defaultLawyerId?: number;
}

/**
 * Create / edit a matter.
 *
 * Writing goes through `useCaseStore`, so the list behind the modal updates
 * itself (the store patches the row on update and prepends it on create).
 */
export const CaseFormModal: React.FC<CaseFormModalProps> = ({
  isOpen,
  onClose,
  caseItem = null,
  lockedClientId,
  defaultLawyerId,
}) => {
  const createCase = useCaseStore(state => state.createCase);
  const updateCase = useCaseStore(state => state.updateCase);
  const saving = useCaseStore(state => state.saving);

  const users = useDirectoryStore(state => state.users);
  const clients = useDirectoryStore(state => state.clients);
  const loadUsers = useDirectoryStore(state => state.loadUsers);
  const loadClients = useDirectoryStore(state => state.loadClients);

  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState<CaseStatus>('open');
  const [priority, setPriority] = useState<CasePriority>('medium');
  const [lawyerId, setLawyerId] = useState('');
  const [description, setDescription] = useState('');

  const lawyers = useMemo(() => users.filter(user => user.role === 'lawyer'), [users]);

  const clientOptions = useMemo(
    () => clients.map(client => ({ value: String(client.id), label: client.fullName })),
    [clients],
  );
  const lawyerOptions = useMemo(
    () => lawyers.map(lawyer => ({ value: String(lawyer.id), label: lawyer.name })),
    [lawyers],
  );

  useEffect(() => {
    if (!isOpen) return;
    void loadUsers();
    if (lockedClientId === undefined) void loadClients();

    setClientId(String(caseItem?.clientId ?? lockedClientId ?? ''));
    setTitle(caseItem?.title ?? '');
    setType(caseItem?.type ?? '');
    setStatus(caseItem?.status ?? 'open');
    setPriority(caseItem?.priority ?? 'medium');
    setLawyerId(String(caseItem?.assignedLawyerId ?? defaultLawyerId ?? ''));
    setDescription(caseItem?.description ?? '');
  }, [isOpen, caseItem, lockedClientId, defaultLawyerId, loadUsers, loadClients]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    const resolvedClientId = lockedClientId ?? Number(clientId);
    if (!resolvedClientId) {
      toast.error('Choose the client this matter belongs to.');
      return;
    }
    if (!title.trim() || !type.trim()) {
      toast.error('A title and a practice area are required.');
      return;
    }

    const payload = {
      clientId: resolvedClientId,
      title: title.trim(),
      type: type.trim(),
      status,
      priority,
      assignedLawyerId: lawyerId ? Number(lawyerId) : null,
      description: description.trim() || undefined,
    };

    try {
      if (caseItem) {
        await updateCase(caseItem.id, payload);
        toast.success('Matter updated.');
      } else {
        const created = await createCase(payload);
        toast.success(`Matter ${created.caseNumber} opened.`);
      }
      onClose();
    } catch {
      toast.error('The matter could not be saved. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={caseItem ? `Edit ${caseItem.caseNumber}` : 'Open a new matter'}
      subtitle={
        caseItem
          ? 'Update the docket entry — changes are written to the audit trail.'
          : 'Pick the client, describe the dispute and assign the handling lawyer.'
      }
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="case-form" loading={saving}>
            {caseItem ? 'Save changes' : 'Open matter'}
          </Button>
        </>
      }
    >
      <form id="case-form" onSubmit={submit} className="space-y-4" noValidate>
        {lockedClientId === undefined ? (
          <Field label="Client" required hint="Only clients in the directory can own a matter.">
            <Select
              value={clientId}
              onChange={event => setClientId(event.target.value)}
              options={clientOptions}
              placeholder="Select a client…"
            />
          </Field>
        ) : (
          <Field label="Client">
            <Input
              value={clients.find(client => client.id === lockedClientId)?.fullName ?? 'Your account'}
              disabled
            />
          </Field>
        )}

        <Field label="Matter title" required>
          <Input
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="e.g. Breach of employment contract"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Practice area / type" required hint="e.g. Family Law, Labor, Criminal Defence.">
            <Input value={type} onChange={event => setType(event.target.value)} placeholder="Civil Litigation" />
          </Field>
          <Field label="Assigned lawyer">
            <Select
              value={lawyerId}
              onChange={event => setLawyerId(event.target.value)}
              options={lawyerOptions}
              placeholder="Unassigned"
            />
          </Field>
          <Field label="Status">
            <Select
              value={status}
              onChange={event => setStatus(event.target.value as CaseStatus)}
              options={statusOptions}
            />
          </Field>
          <Field label="Priority">
            <Select
              value={priority}
              onChange={event => setPriority(event.target.value as CasePriority)}
              options={priorityOptions}
            />
          </Field>
        </div>

        <Field label="Background" hint="Facts, opposing party, filing deadlines — the more the clearer.">
          <TextArea
            rows={4}
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="What happened, when, and what outcome the client wants."
          />
        </Field>
      </form>
    </Modal>
  );
};

export default CaseFormModal;

