import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Pencil, Phone, Plus, ShieldCheck, Trash2, UserCheck, UserCog, UserX, Users } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  GlassCard,
  KPICard,
  PageHeader,
  PageLoader,
  SearchInput,
  Table,
  Tabs,
  Td,
  Tr,
} from '../../components/UI';
import { deleteUser, listUsers, setUserActive } from '../../services';
import { toast, useAuthStore, useDirectoryStore } from '../../stores';
import { ROLE_LABELS, type User, type UserRole } from '../../types';
import { formatDate, initialsOf } from '../../utils/format';
import { UserFormModal } from './UserFormModal';

/**
 * Team workbench (admin).
 *
 * The firm's staff accounts — lawyers and assistants — with the role matrix the
 * backend enforces. Disabling an account keeps its history; deleting removes
 * the login entirely, which the API only allows for the owner.
 */

const ROLE_TABS: { id: UserRole | '' | 'all' | 'inactive'; label: string }[] = [
  { id: 'all', label: 'Everyone' },
  { id: 'admin', label: 'Admins' },
  { id: 'lawyer', label: 'Lawyers' },
  { id: 'staff', label: 'Staff' },
  { id: 'inactive', label: 'Disabled' },
];

const COLUMNS = [
  { key: 'member', label: 'Member' },
  { key: 'role', label: 'Role' },
  { key: 'contact', label: 'Contact' },
  { key: 'status', label: 'Status' },
  { key: 'joined', label: 'Joined' },
  { key: 'actions', label: '', className: 'text-right' },
];

export const TeamWorkbench: React.FC = () => {
  const currentUser = useAuthStore(state => state.user);
  const canWrite = useAuthStore(state => state.hasPermission('users.write'));
  const loadDirectory = useDirectoryStore(state => state.loadUsers);

  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<UserRole | '' | 'all' | 'inactive'>('all');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [pendingDelete, setPendingDelete] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listUsers();
      setItems(rows.filter(entry => entry.role !== 'client'));
    } catch {
      toast.error('Could not load the team directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items
      .filter(entry => {
        if (tab === 'inactive') return !entry.isActive;
        if (tab === 'all' || tab === '') return true;
        return entry.role === tab && entry.isActive;
      })
      .filter(entry =>
        needle
          ? [entry.name, entry.email, entry.phone, entry.specialization, entry.barNumber]
              .filter(Boolean)
              .some(value => String(value).toLowerCase().includes(needle))
          : true,
      );
  }, [items, tab, query]);

  const counts = useMemo(
    () => ({
      total: items.length,
      lawyers: items.filter(entry => entry.role === 'lawyer').length,
      staff: items.filter(entry => entry.role === 'staff').length,
      inactive: items.filter(entry => !entry.isActive).length,
    }),
    [items],
  );

  const toggleActive = async (member: User) => {
    try {
      await setUserActive(member.id, !member.isActive);
      toast.success(`${member.name} is now ${member.isActive ? 'disabled' : 'active'}.`);
      await loadDirectory(true);
      await refresh();
    } catch {
      toast.error('Could not change the account status.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteUser(pendingDelete.id);
      toast.success(`${pendingDelete.name} was removed.`);
      setPendingDelete(null);
      await loadDirectory(true);
      await refresh();
    } catch {
      toast.error('Could not delete this account.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && items.length === 0) return <PageLoader label="Loading the team…" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        subtitle="Lawyers, assistants and administrators with access to JurisFlow."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={16} />
              Invite member
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Team members" value={counts.total} icon={Users} />
        <KPICard label="Lawyers" value={counts.lawyers} icon={UserCog} tone="info" />
        <KPICard label="Assistants" value={counts.staff} icon={UserCheck} tone="success" />
        <KPICard label="Disabled" value={counts.inactive} icon={UserX} tone="danger" />
      </div>

      <GlassCard className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            tabs={ROLE_TABS.map(entry => ({ id: String(entry.id), label: entry.label }))}
            active={String(tab)}
            onChange={id => setTab(id as UserRole | '' | 'all' | 'inactive')}
          />
          <SearchInput value={query} onChange={setQuery} placeholder="Search the team…" />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nobody to show"
            description={
              query
                ? 'No team member matches that search.'
                : 'Invite a lawyer or assistant to start.'
            }
          />
        ) : (
          <Table columns={COLUMNS}>
            {visible.map(member => (
              <Tr key={member.id}>
                <Td className="text-white font-medium">
                  <span className="inline-flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-full bg-gold/15 text-gold text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
                      {initialsOf(member.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate">{member.name}</span>
                      <span className="block text-[11px] text-text-muted truncate">
                        {member.specialization ?? member.barNumber ?? ROLE_LABELS[member.role]}
                      </span>
                    </span>
                  </span>
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
                    <ShieldCheck size={14} className="text-gold" />
                    {ROLE_LABELS[member.role]}
                  </span>
                </Td>
                <Td>
                  <span className="block text-xs">{member.email}</span>
                  {member.phone ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-text-muted mt-0.5">
                      <Phone size={11} />
                      {member.phone}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        member.isActive ? 'bg-success' : 'bg-danger'
                      }`}
                    />
                    <span className="text-xs">{member.isActive ? 'Active' : 'Disabled'}</span>
                  </span>
                </Td>
                <Td>{formatDate(member.createdAt)}</Td>
                <Td className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <a
                      href={`mailto:${member.email}`}
                      title="Send email"
                      className="p-2 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Mail size={16} />
                    </a>
                    {canWrite ? (
                      <>
                        <Button
                          variant="ghost"
                          title="Edit member"
                          onClick={() => {
                            setEditing(member);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          title={member.isActive ? 'Disable account' : 'Enable account'}
                          onClick={() => void toggleActive(member)}
                        >
                          {member.isActive ? <UserX size={16} /> : <UserCheck size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          title="Delete account"
                          disabled={member.id === currentUser?.id}
                          onClick={() => setPendingDelete(member)}
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

      <UserFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        user={editing}
        onSaved={() => {
          void loadDirectory(true);
          void refresh();
        }}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete account"
        message={`Delete ${pendingDelete?.name ?? 'this account'}? Their matters stay with the firm, but the login is removed for good.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default TeamWorkbench;
