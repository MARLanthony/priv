import React, { useEffect } from 'react';
import { useAppointmentStore } from '../../stores/appStores';
import { PageHeader, GlassCard, StatusBadge } from '../../components/UI';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 8AM - 5PM

export const CalendarPage: React.FC = () => {
  const { appointments, fetchAppointments } = useAppointmentStore();

  useEffect(() => { fetchAppointments(); }, []);

  // Generate current week dates
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() + 1);

  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d;
  });

  return (
    <div className="animate-fade-in">
      <PageHeader title="Calendar" subtitle="Weekly view" />

      <GlassCard className="p-0 overflow-hidden">
        <div className="grid grid-cols-6">
          {/* Time Column */}
          <div className="border-r border-white/5">
            <div className="h-16 border-b border-white/5 flex items-center justify-center">
              <span className="text-xs text-text-muted">Time</span>
            </div>
            {HOURS.map(hour => (
              <div key={hour} className="h-16 border-b border-white/5 flex items-center justify-center">
                <span className="text-xs text-text-muted">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Day Columns */}
          {weekDates.map((date, i) => {
            const dateStr = date.toISOString().split('T')[0];
            const dayAppts = appointments.filter(a => a.date === dateStr);
            const isToday = date.toDateString() === today.toDateString();

            return (
              <div key={i} className="border-r border-white/5 last:border-r-0">
                <div className={`h-16 border-b border-white/5 flex flex-col items-center justify-center ${isToday ? 'bg-gold/5' : ''}`}>
                  <span className="text-xs text-text-muted">{DAYS[date.getDay()]}</span>
                  <span className={`text-sm font-semibold ${isToday ? 'text-gold' : 'text-white'}`}>{date.getDate()}</span>
                </div>
                {HOURS.map(hour => {
                  const hourAppt = dayAppts.find(a => parseInt(a.time.split(':')[0]) === hour);
                  return (
                    <div key={hour} className={`h-16 border-b border-white/5 p-1 ${isToday ? 'bg-gold/2' : ''}`}>
                      {hourAppt && (
                        <div className="bg-gold/15 border border-gold/20 rounded-lg p-1.5 h-full">
                          <p className="text-[10px] font-medium text-gold truncate">{hourAppt.title}</p>
                          <p className="text-[9px] text-text-muted truncate">{hourAppt.time}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
};
