import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCaseStore } from '../../stores/caseStore';
import { useAppointmentStore } from '../../stores/appStores';
import { KPICard, GlassCard, StatusBadge, PageHeader } from '../../components/UI';
import { FolderOpen, Calendar, Sparkles, ArrowRight } from 'lucide-react';

export const UserDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { cases, fetchCases } = useCaseStore();
  const { appointments, fetchAppointments } = useAppointmentStore();
  const navigate = useNavigate();

  useEffect(() => { fetchCases(); fetchAppointments(); }, []);

  const activeCases = cases.filter(c => c.status !== 'closed').length;
  const upcomingAppts = appointments.filter(a => a.status === 'scheduled').length;

  return (
    <div className="animate-fade-in">
      <PageHeader title={`Welcome, ${user?.name}`} subtitle="Your legal dashboard" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 stagger-children">
        <KPICard title="My Cases" value={cases.length} icon={FolderOpen} trend={`${activeCases} active`} trendUp color="gold" />
        <KPICard title="Appointments" value={upcomingAppts} icon={Calendar} color="blue" />
        <div className="glass p-5 bg-gradient-to-br from-gold/20 to-gold/5 border-gold/20 cursor-pointer hover:bg-gold/25 transition-all" onClick={() => navigate('/user/get-suggestions')}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-text-secondary text-sm font-medium">Get Legal Help</span>
            <Sparkles size={20} className="text-gold" />
          </div>
          <p className="text-lg font-bold text-white">AI Suggestions</p>
          <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">Describe your issue <ArrowRight size={12} /></p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <GlassCard>
          <h2 className="text-lg font-semibold text-white mb-4">My Cases</h2>
          <div className="space-y-3">
            {cases.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-white/3 hover:bg-white/5 transition-colors cursor-pointer"
                onClick={() => navigate(`/user/my-cases/${c.id}`)}>
                <div>
                  <p className="text-sm font-medium text-white">{c.title}</p>
                  <p className="text-xs text-text-muted">{c.caseNumber} · {c.assignedToName}</p>
                </div>
                <StatusBadge status={c.status} size="sm" />
              </div>
            ))}
            {cases.length === 0 && <p className="text-sm text-text-muted py-4">No cases found</p>}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="text-lg font-semibold text-white mb-4">Upcoming Appointments</h2>
          <div className="space-y-3">
            {appointments.filter(a => a.status === 'scheduled').map(a => (
              <div key={a.id} className="p-3 rounded-xl bg-white/3">
                <p className="text-sm font-medium text-white">{a.title}</p>
                <p className="text-xs text-text-muted">{a.date} at {a.time} · {a.attorneyName}</p>
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
