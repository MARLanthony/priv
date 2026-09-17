import React, { useEffect, useState } from 'react';
import { useTeamStore } from '../../stores/appStores';
import { PageHeader, GlassCard, StatusBadge, Modal } from '../../components/UI';
import { Plus, Trash2, Edit, Users, Search } from 'lucide-react';

export const TeamPage: React.FC = () => {
  const { members, fetchTeam, addMember, updateMember, removeMember } = useTeamStore();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'attorney' as const, phone: '', department: 'Litigation', specialization: '' });

  useEffect(() => { fetchTeam(); }, []);

  const filtered = members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.role.includes(search.toLowerCase()));

  const roleLabels: Record<string, string> = {
    system_admin: 'Admin',
    attorney: 'Attorney',
    legal_secretary: 'Secretary',
    user: 'Client',
  };

  const handleSubmit = () => {
    if (editId) {
      updateMember(editId, form);
      setEditId(null);
    } else {
      addMember(form);
    }
    setShowAdd(false);
    setForm({ name: '', email: '', role: 'attorney', phone: '', department: 'Litigation', specialization: '' });
  };

  const startEdit = (member: typeof members[0]) => {
    setForm({ name: member.name, email: member.email, role: member.role as any, phone: member.phone, department: member.department, specialization: member.specialization || '' });
    setEditId(member.id);
    setShowAdd(true);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Team Management"
        subtitle={`${members.length} team members`}
        action={
          <button onClick={() => { setEditId(null); setShowAdd(true); }} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Member
          </button>
        }
      />

      <div className="flex items-center gap-2 glass-input px-4 py-2 max-w-md mb-6">
        <Search size={16} className="text-text-muted" />
        <input type="text" placeholder="Search team..." value={search} onChange={e => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-sm text-white w-full" />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(member => (
          <GlassCard key={member.id} className="p-5" hover>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-royal to-royal-light flex items-center justify-center text-lg font-bold text-gold">
                  {member.name.charAt(0)}
                </div>
                <div>
                  <p className="text-base font-semibold text-white">{member.name}</p>
                  <p className="text-xs text-text-muted">{member.email}</p>
                </div>
              </div>
              <StatusBadge status={member.status} size="sm" />
            </div>

            <div className="space-y-2 text-sm text-text-secondary mb-4">
              <div className="flex items-center justify-between">
                <span>Role</span>
                <span className="text-white font-medium">{roleLabels[member.role]}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Department</span>
                <span className="text-white">{member.department}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Joined</span>
                <span className="text-white">{member.joinDate}</span>
              </div>
              {member.specialization && (
                <div className="flex items-center justify-between">
                  <span>Specialization</span>
                  <span className="text-gold text-xs">{member.specialization}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-white/5">
              <button onClick={() => startEdit(member)} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1 flex-1 justify-center">
                <Edit size={12} /> Edit
              </button>
              <button onClick={() => removeMember(member.id)} className="btn-danger text-xs px-3 py-1.5 flex items-center gap-1 flex-1 justify-center">
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      <Modal isOpen={showAdd} onClose={() => { setShowAdd(false); setEditId(null); }} title={editId ? 'Edit Member' : 'Add Member'}>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary block mb-1">Full Name</label>
            <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Full name" />
          </div>
          <div>
            <label className="text-sm text-text-secondary block mb-1">Email</label>
            <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Email address" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value as any})} className="glass-input w-full px-4 py-2.5 text-sm">
                <option value="attorney">Attorney</option>
                <option value="legal_secretary">Legal Secretary</option>
                <option value="system_admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">Department</label>
              <input value={form.department} onChange={e => setForm({...form, department: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm text-text-secondary block mb-1">Phone</label>
            <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Phone number" />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => { setShowAdd(false); setEditId(null); }} className="btn-secondary">Cancel</button>
            <button onClick={handleSubmit} className="btn-primary">{editId ? 'Save Changes' : 'Add Member'}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
