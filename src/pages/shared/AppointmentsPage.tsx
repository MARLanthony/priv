import React, { useEffect, useState } from 'react';
import { useAppointmentStore } from '../../stores/appStores';
import { useDirectoryStore } from '../../stores/directoryStore';
import { useAuthStore } from '../../stores/authStore';
import { PageHeader, GlassCard, StatusBadge, Modal } from '../../components/UI';
import { Calendar, Clock, MapPin, Plus, Trash2, Search } from 'lucide-react';

interface AppointmentsPageProps {
  canCreate?: boolean;
  canDelete?: boolean;
}

export const AppointmentsPage: React.FC<AppointmentsPageProps> = ({ canCreate = true, canDelete = true }) => {
  const { appointments, fetchAppointments, createAppointment, deleteAppointment } = useAppointmentStore();
  const { user } = useAuthStore();
  const { attorneys, clients, fetchAttorneys, fetchClients } = useDirectoryStore();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  /*
   * The dataset ships with no people, so the two parties are always read from the
   * firm directory instead of a demo attorney/client (see
   * src/mocks/handlers/directory.ts): an attorney books on their own diary, a
   * client books with a real attorney, the admin/secretary pick both.
   */
  const isAttorney = user?.role === 'attorney';
  const isClient = user?.role === 'user';

  const [newAppt, setNewAppt] = useState(() => ({
    title: '',
    clientId: isClient ? (user?.id ?? 0) : 0,
    clientName: isClient ? (user?.name ?? '') : '',
    attorneyId: isAttorney ? (user?.id ?? 0) : 0,
    attorneyName: isAttorney ? (user?.name ?? '') : '',
    date: '', time: '10:00', duration: 60, type: 'consultation' as const, notes: '', location: 'Conference Room A',
  }));

  useEffect(() => {
    fetchAppointments();
    if (canCreate) {
      fetchAttorneys();
      if (!isClient) fetchClients();
    }
  }, []);

  const canSubmitAppt = Boolean(newAppt.title.trim() && newAppt.date && newAppt.attorneyId && newAppt.clientId);

  const filtered = appointments.filter(a => a.title.toLowerCase().includes(search.toLowerCase()) || a.clientName.toLowerCase().includes(search.toLowerCase()));
  const upcoming = filtered.filter(a => a.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date));
  const past = filtered.filter(a => a.status !== 'scheduled');

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Appointments"
        subtitle={`${upcoming.length} upcoming appointments`}
        action={canCreate ? (
          <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Appointment
          </button>
        ) : undefined}
      />

      <div className="flex items-center gap-2 glass-input px-4 py-2 max-w-md mb-6">
        <Search size={16} className="text-text-muted" />
        <input type="text" placeholder="Search appointments..." value={search} onChange={e => setSearch(e.target.value)}
          className="bg-transparent border-none outline-none text-sm text-white w-full" />
      </div>

      {upcoming.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Upcoming</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {upcoming.map(appt => (
              <GlassCard key={appt.id} className="p-5" hover>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-base font-semibold text-white">{appt.title}</h4>
                    <p className="text-xs text-text-muted capitalize mt-0.5">{appt.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={appt.status} size="sm" />
                    {canDelete && (
                      <button onClick={() => deleteAppointment(appt.id)} className="p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Calendar size={14} className="text-gold" /> {appt.date}
                  </div>
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Clock size={14} className="text-gold" /> {appt.time} ({appt.duration} min)
                  </div>
                  {appt.location && (
                    <div className="flex items-center gap-2 text-text-secondary">
                      <MapPin size={14} className="text-gold" /> {appt.location}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5 text-xs text-text-muted">
                  <span>Attorney: {appt.attorneyName}</span>
                  <span>Client: {appt.clientName}</span>
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">Past</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {past.map(appt => (
              <GlassCard key={appt.id} className="p-5 opacity-60">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-white">{appt.title}</h4>
                  <StatusBadge status={appt.status} size="sm" />
                </div>
                <p className="text-xs text-text-muted">{appt.date} at {appt.time} · {appt.attorneyName}</p>
              </GlassCard>
            ))}
          </div>
        </>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Appointment" size="lg">
        <div className="space-y-4">
          <div>
            <label className="text-sm text-text-secondary block mb-1">Title</label>
            <input value={newAppt.title} onChange={e => setNewAppt({...newAppt, title: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Appointment title" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Attorney</label>
              {isAttorney ? (
                <input value={newAppt.attorneyName} readOnly className="glass-input w-full px-4 py-2.5 text-sm opacity-70" />
              ) : (
                <>
                  <select
                    value={newAppt.attorneyId}
                    onChange={e => {
                      const attorney = attorneys.find(a => a.id === Number(e.target.value));
                      setNewAppt({ ...newAppt, attorneyId: attorney?.id ?? 0, attorneyName: attorney?.name ?? '' });
                    }}
                    className="glass-input w-full px-4 py-2.5 text-sm"
                  >
                    <option value={0}>Select an attorney…</option>
                    {attorneys.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {attorneys.length === 0 && (
                    <p className="text-[11px] text-text-muted mt-1">No attorneys yet — add one in Team Management.</p>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">Client</label>
              {isClient ? (
                <input value={newAppt.clientName} readOnly className="glass-input w-full px-4 py-2.5 text-sm opacity-70" />
              ) : (
                <>
                  <select
                    value={newAppt.clientId}
                    onChange={e => {
                      const client = clients.find(c => c.id === Number(e.target.value));
                      setNewAppt({ ...newAppt, clientId: client?.id ?? 0, clientName: client?.name ?? '' });
                    }}
                    className="glass-input w-full px-4 py-2.5 text-sm"
                  >
                    <option value={0}>Select a client…</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {clients.length === 0 && (
                    <p className="text-[11px] text-text-muted mt-1">No clients yet — clients create their own account from sign-up.</p>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Date</label>
              <input type="date" value={newAppt.date} onChange={e => setNewAppt({...newAppt, date: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">Time</label>
              <input type="time" value={newAppt.time} onChange={e => setNewAppt({...newAppt, time: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Duration (min)</label>
              <input type="number" value={newAppt.duration} onChange={e => setNewAppt({...newAppt, duration: Number(e.target.value)})} className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">Type</label>
              <select value={newAppt.type} onChange={e => setNewAppt({...newAppt, type: e.target.value as any})} className="glass-input w-full px-4 py-2.5 text-sm">
                <option value="consultation">Consultation</option>
                <option value="hearing">Hearing</option>
                <option value="meeting">Meeting</option>
                <option value="deposition">Deposition</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm text-text-secondary block mb-1">Location</label>
            <input value={newAppt.location} onChange={e => setNewAppt({...newAppt, location: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" placeholder="Location" />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => { if (!canSubmitAppt) return; createAppointment(newAppt); setShowCreate(false); }} disabled={!canSubmitAppt} className="btn-primary disabled:opacity-50">Schedule</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
