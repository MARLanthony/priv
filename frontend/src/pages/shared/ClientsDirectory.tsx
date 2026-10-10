import React, { useEffect, useMemo, useState } from 'react';
import { Briefcase, Mail, MapPin, Pencil, Phone, Plus, Trash2, UserRound, Users } from 'lucide-react';
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
  Table,
  Td,
  Tr,
} from '../../components/UI';
import { deleteClient, listClients } from '../../services';
import { toast, useAuthStore, useCaseStore } from '../../stores';
import type { Client } from '../../types';
import { formatDate, initialsOf } from '../../utils/format';
import { ClientFormModal } from './ClientFormModal';

/**
 * Client book.
 *
 * Shared by admin (full book), lawyer (read-only view) and staff (front desk).
 * Writes go through `ClientFormModal`, which talks to `/clients` and refreshes
 * the directory cache; this component only needs the list and the delete call.
 */

const COLUMNS = [
  { key: 'client', label: 'Client' },
  { key: 'contact', label: 'Contact' },
  { key: 'address', label: 'Address' },
  { key: 'matters', label: 'Matters' },
  { key: 'since', label: 'Client since' },
  { key: 'actions', label: '', className: 'text-right' },
];

export interface ClientsDirectoryProps {
  title?: string;
  subtitle?: string;
  /** Hides the create/edit/delete actions (lawyer view). */
  canWrite?: boolean;
}

export const ClientsDirectory: React.FC<ClientsDirectoryProps> = ({
  title = 'Clients',
  subtitle = 'Everyone the firm acts for.',
  canWrite = true,
}) => {
  const canWritePermission = useAuthStore(state => state.hasPermission('clients.write'));

  const cases = useCaseStore(state => state.items);
  const fetchCases = useCaseStore(state => state.fetchCases);

  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [detail, setDetail] = useState<Client | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [busy, setBusy] = useState(false);

  const writable = canWrite && canWritePermission;

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listClients();
      setItems(rows);
    } catch {
      toast.error('Could not load the client book.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    void fetchCases();
  }, [fetchCases]);

  const mattersFor = (clientId: number) => cases.filter(entry => entry.clientId === clientId);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(entry =>
      [entry.fullName, entry.email, entry.contact, entry.address]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(needle)),
    );
  }, [items, query]);

  const counts = useMemo(() => {
    const withMatters = items.filter(entry => mattersFor(entry.id).length > 0).length;
    const thisMonth = items.filter(entry => {
      const created = new Date(entry.createdAt);
      const now = new Date();
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
    return { total: items.length, withMatters, thisMonth };
  }, [items, cases]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteClient(pendingDelete.id);
      toast.success(`${pendingDelete.fullName} was removed from the client book.`);
      setPendingDelete(null);
      await refresh();
    } catch {
      toast.error('Could not delete this client.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && items.length === 0) return <PageLoader label="Loading the client book…" />;

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
              New client
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard label="Clients" value={counts.total} icon={Users} />
        <KPICard label="With open matters" value={counts.withMatters} icon={Briefcase} tone="info" />
        <KPICard
          label="Onboarded this month"
          value={counts.thisMonth}
          icon={UserRound}
          tone="success"
        />
      </div>

      <GlassCard className="space-y-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search by name, email or phone…"
        />

        {visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No clients found"
            description={
              query ? 'Nothing matches that search.' : 'Add the first client to get started.'
            }
            action={
              writable && !query ? (
                <Button
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                >
                  <Plus size={16} />
                  New client
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table columns={COLUMNS}>
            {visible.map(client => (
              <Tr key={client.id}>
                <Td className="text-white font-medium">
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-gold/15 text-gold text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
                      {initialsOf(client.fullName)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{client.fullName}</span>
                      {client.email ? (
                        <span className="block text-[11px] text-text-muted truncate">
                          {client.email}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Td>
                <Td>{client.contact}</Td>
                <Td className="max-w-[220px] truncate">{client.address}</Td>
                <Td className="tabular-nums">{mattersFor(client.id).length}</Td>
                <Td>{formatDate(client.createdAt)}</Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button variant="ghost" onClick={() => setDetail(client)} title="Open profile">
                      <UserRound size={16} />
                    </Button>
                    {writable ? (
                      <>
                        <Button
                          variant="ghost"
                          title="Edit client"
                          onClick={() => {
                            setEditing(client);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          title="Delete client"
                          onClick={() => setPendingDelete(client)}
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

      <ClientFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        client={editing}
        onSaved={() => void refresh()}
      />

      <Modal
        isOpen={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.fullName ?? 'Client'}
        subtitle="Contact card and open work."
        maxWidth="max-w-xl"
      >
        {detail ? (
          <div className="space-y-5">
            <div className="space-y-2 text-sm">
              {detail.email ? (
                <p className="flex items-center gap-2 text-text-secondary">
                  <Mail size={15} className="text-gold" />
                  {detail.email}
                </p>
              ) : null}
              <p className="flex items-center gap-2 text-text-secondary">
                <Phone size={15} className="text-gold" />
                {detail.contact}
              </p>
              <p className="flex items-center gap-2 text-text-secondary">
                <MapPin size={15} className="text-gold" />
                {detail.address}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-text-muted">Matters</p>
              {mattersFor(detail.id).length === 0 ? (
                <p className="text-sm text-text-secondary">No matters opened yet.</p>
              ) : (
                <ul className="space-y-2">
                  {mattersFor(detail.id).map(matter => (
                    <li
                      key={matter.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm text-white truncate">{matter.title}</span>
                        <span className="block text-[11px] text-text-muted">
                          {matter.caseNumber}
                        </span>
                      </span>
                      <span className="text-[11px] text-text-muted uppercase">{matter.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete client"
        message={`Remove ${pendingDelete?.fullName ?? 'this client'} from the client book? Their matters are kept.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default ClientsDirectory;

