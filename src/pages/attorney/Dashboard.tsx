import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCaseStore } from '../../stores/caseStore';
import { useDocumentStore, useInboxStore, useAppointmentStore } from '../../stores/appStores';
import { KPICard, GlassCard, StatusBadge, PageHeader } from '../../components/UI';
import { FolderOpen, FileText, Mail, Calendar, Eye } from 'lucide-react';

export const AttorneyDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { cases, fetchCases } = useCaseStore();
  const { documents, fetchDocuments } = useDocumentStore();
  const { messages, fetchMessages } = useInboxStore();
  const { appointments, fetchAppointments } = useAppointmentStore();
  const navigate = useNavigate();

  useEffect(() => { fetchCases(); fetchDocuments(); fetchMessages(); fetchAppointments(); }, []);

  const activeCases = cases.filter(c => c.status === 'active').length;
  const unread = messages.filter(m => !m.read).length;
  const upcoming = appointments.filter(a => a.status === 'scheduled').length;

  return (
    <div className="animate-fade-in">
      <PageHeader title={`Welcome, ${user?.name}`} subtitle="Your personal dashboard" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
        <KPICard title="My Cases" value={cases.length} icon={FolderOpen} trend={`${activeCases} active`} trendUp color="gold" />
        <KPICard title="Documents" value={documents.length} icon={FileText} color="blue" />
        <KPICard title="Unread Messages" value={unread} icon={Mail} color="green" />
        <KPICard title="Upcoming Appts" value={upcoming} icon={Calendar} color="red" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard>
          <h2 className="text-lg font-semibold text-white mb-4">My Active Cases</h2>
          <div className="space-y-3">
            {cases.filter(c => c.status !== 'closed').slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => navigate(`/attorney/cases/${c.id}`)}>
                <div>
                  <p className="text-sm font-medium text-white">{c.title}</p>
                  <p className="text-xs text-text-muted">{c.caseNumber} · {c.clientName}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={c.status} size="sm" />
                  <Eye size={14} className="text-text-muted" />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold text-white mb-4">Upcoming Appointments</h2>
          <div className="space-y-3">
            {appointments.filter(a => a.status === 'scheduled').map(a => (
              <div key={a.id} className="p-3 rounded-xl bg-white/3">
                <p className="text-sm font-medium text-white">{a.title}</p>
                <p className="text-xs text-text-muted">{a.date} at {a.time} · {a.clientName}</p>
                <p className="text-xs text-text-muted">{a.location}</p>
              </div>
            ))}
            {appointments.filter(a => a.status === 'scheduled').length === 0 && (
              <p className="text-sm text-text-muted py-4">No upcoming appointments</p>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
