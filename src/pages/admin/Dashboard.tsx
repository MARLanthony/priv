import React, { useEffect } from 'react';
import { useCaseStore } from '../../stores/caseStore';
import { useDocumentStore, useInboxStore, useAppointmentStore, useTeamStore } from '../../stores/appStores';
import { KPICard, GlassCard, StatusBadge, PageHeader } from '../../components/UI';
import { FolderOpen, FileText, Mail, Calendar, Users, TrendingUp, Clock, AlertTriangle } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { cases, fetchCases } = useCaseStore();
  const { documents, fetchDocuments } = useDocumentStore();
  const { messages, fetchMessages } = useInboxStore();
  const { appointments, fetchAppointments } = useAppointmentStore();
  const { members, fetchTeam } = useTeamStore();

  useEffect(() => {
    fetchCases(); fetchDocuments(); fetchMessages(); fetchAppointments(); fetchTeam();
  }, []);

  const activeCases = cases.filter(c => c.status === 'active').length;
  const pendingCases = cases.filter(c => c.status === 'pending').length;
  const unreadMsgs = messages.filter(m => !m.read).length;
  const upcomingAppts = appointments.filter(a => a.status === 'scheduled').length;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Admin Dashboard" subtitle="Complete system overview and analytics" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 stagger-children">
        <KPICard title="Total Cases" value={cases.length} icon={FolderOpen} trend="+12% this month" trendUp color="gold" />
        <KPICard title="Active Cases" value={activeCases} icon={TrendingUp} trend={`${pendingCases} pending`} trendUp color="blue" />
        <KPICard title="Documents" value={documents.length} icon={FileText} trend="+5 this week" trendUp color="green" />
        <KPICard title="Team Members" value={members.length} icon={Users} color="red" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Cases */}
        <GlassCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Recent Cases</h2>
            <StatusBadge status={`${cases.length} total`} />
          </div>
          <div className="space-y-3">
            {cases.slice(0, 5).map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{c.title}</p>
                  <p className="text-xs text-text-muted">{c.caseNumber} · {c.assignedToName}</p>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <StatusBadge status={c.priority} size="sm" />
                  <StatusBadge status={c.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Quick Stats */}
        <div className="space-y-4">
          <GlassCard>
            <div className="flex items-center gap-3 mb-3">
              <Mail size={18} className="text-gold" />
              <h3 className="text-sm font-semibold text-white">Inbox</h3>
            </div>
            <p className="text-2xl font-bold text-white">{unreadMsgs}</p>
            <p className="text-xs text-text-muted">unread messages</p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-3 mb-3">
              <Calendar size={18} className="text-gold" />
              <h3 className="text-sm font-semibold text-white">Appointments</h3>
            </div>
            <p className="text-2xl font-bold text-white">{upcomingAppts}</p>
            <p className="text-xs text-text-muted">upcoming this month</p>
          </GlassCard>

          <GlassCard>
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle size={18} className="text-warning" />
              <h3 className="text-sm font-semibold text-white">High Priority</h3>
            </div>
            <p className="text-2xl font-bold text-white">{cases.filter(c => c.priority === 'high').length}</p>
            <p className="text-xs text-text-muted">cases need attention</p>
          </GlassCard>
        </div>
      </div>
    </div>
  );
};
