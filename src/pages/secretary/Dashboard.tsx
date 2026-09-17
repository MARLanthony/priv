import React, { useEffect } from 'react';
import { useCaseStore } from '../../stores/caseStore';
import { useDocumentStore, useInboxStore, useAppointmentStore } from '../../stores/appStores';
import { KPICard, GlassCard, StatusBadge, PageHeader } from '../../components/UI';
import { FolderOpen, FileText, Mail, Calendar } from 'lucide-react';

export const SecretaryDashboard: React.FC = () => {
  const { cases, fetchCases } = useCaseStore();
  const { documents, fetchDocuments } = useDocumentStore();
  const { messages, fetchMessages } = useInboxStore();
  const { appointments, fetchAppointments } = useAppointmentStore();

  useEffect(() => { fetchCases(); fetchDocuments(); fetchMessages(); fetchAppointments(); }, []);

  return (
    <div className="animate-fade-in">
      <PageHeader title="Dashboard" subtitle="Office overview" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
        <KPICard title="Total Cases" value={cases.length} icon={FolderOpen} color="gold" />
        <KPICard title="Documents" value={documents.length} icon={FileText} color="blue" />
        <KPICard title="Messages" value={messages.length} icon={Mail} color="green" />
        <KPICard title="Appointments" value={appointments.filter(a => a.status === 'scheduled').length} icon={Calendar} color="red" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard>
          <h2 className="text-lg font-semibold text-white mb-4">All Active Cases</h2>
          <div className="space-y-3">
            {cases.filter(c => c.status !== 'closed').map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-white/3">
                <div>
                  <p className="text-sm font-medium text-white">{c.title}</p>
                  <p className="text-xs text-text-muted">{c.caseNumber} · Attorney: {c.assignedToName}</p>
                </div>
                <StatusBadge status={c.status} size="sm" />
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold text-white mb-4">Today's Schedule</h2>
          <div className="space-y-3">
            {appointments.filter(a => a.status === 'scheduled').map(a => (
              <div key={a.id} className="p-3 rounded-xl bg-white/3">
                <p className="text-sm font-medium text-white">{a.title}</p>
                <p className="text-xs text-text-muted">{a.date} at {a.time} · {a.attorneyName} with {a.clientName}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};
