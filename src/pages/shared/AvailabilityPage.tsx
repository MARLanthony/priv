import React, { useEffect, useState } from 'react';
import { useAvailabilityStore } from '../../stores/appStores';
import { useDirectoryStore } from '../../stores/directoryStore';
import { useAuthStore } from '../../stores/authStore';
import { PageHeader, GlassCard, Modal } from '../../components/UI';
import { Clock, Plus, Trash2, Check, X } from 'lucide-react';

interface AvailabilityPageProps {
  canEdit?: boolean;
}

export const AvailabilityPage: React.FC<AvailabilityPageProps> = ({ canEdit = true }) => {
  const { slots, fetchAvailability, createSlot, updateSlot, deleteSlot } = useAvailabilityStore();
  const { user } = useAuthStore();
  // Named `attorneyOptions` because this page already has a local `attorneys`:
  // the list of names found in the fetched slots (a different thing entirely).
  const { attorneys: attorneyOptions, fetchAttorneys } = useDirectoryStore();
  const [showAdd, setShowAdd] = useState(false);

  /*
   * An attorney publishes their OWN hours; the admin publishes for any attorney.
   * The dataset ships with no schedule, so nothing may be pre-filled with a demo
   * attorney (see src/mocks/handlers/directory.ts).
   */
  const isAttorney = user?.role === 'attorney';
  const [newSlot, setNewSlot] = useState(() => ({
    attorneyId: isAttorney ? (user?.id ?? 0) : 0,
    attorneyName: isAttorney ? (user?.name ?? '') : '',
    dayOfWeek: 'Monday', startTime: '09:00', endTime: '17:00', isAvailable: true,
  }));

  useEffect(() => {
    fetchAvailability();
    if (canEdit && !isAttorney) fetchAttorneys();
  }, []);

  const canSubmitSlot = Boolean(newSlot.attorneyId && newSlot.startTime && newSlot.endTime);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const attorneys = [...new Set(slots.map(s => s.attorneyName))];

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Availability"
        subtitle="Manage attorney schedules"
        action={canEdit ? (
          <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Add Slot
          </button>
        ) : undefined}
      />

      {attorneys.map(attorney => (
        <div key={attorney} className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-royal flex items-center justify-center text-xs font-bold text-gold">{attorney.charAt(0)}</div>
            {attorney}
          </h3>
          <div className="grid md:grid-cols-5 gap-3">
            {days.map(day => {
              const daySlots = slots.filter(s => s.attorneyName === attorney && s.dayOfWeek === day);
              return (
                <GlassCard key={day} className="p-4">
                  <p className="text-sm font-semibold text-white mb-2">{day}</p>
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-text-muted">No availability</p>
                  ) : (
                    daySlots.map(slot => (
                      <div key={slot.id} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          {slot.isAvailable ? (
                            <Check size={12} className="text-success" />
                          ) : (
                            <X size={12} className="text-danger" />
                          )}
                          <span className="text-xs text-text-secondary">{slot.startTime} - {slot.endTime}</span>
                        </div>
                        {canEdit && (
                          <button onClick={() => deleteSlot(slot.id)} className="p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400">
                            <Trash2 size={10} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </GlassCard>
              );
            })}
          </div>
        </div>
      ))}

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Availability Slot">
        <div className="space-y-4">
          {isAttorney ? (
            <div>
              <label className="text-sm text-text-secondary block mb-1">Attorney</label>
              <input value={newSlot.attorneyName} readOnly className="glass-input w-full px-4 py-2.5 text-sm opacity-70" />
            </div>
          ) : (
            <div>
              <label className="text-sm text-text-secondary block mb-1">Attorney</label>
              <select
                value={newSlot.attorneyId}
                onChange={e => {
                  const attorney = attorneyOptions.find(a => a.id === Number(e.target.value));
                  setNewSlot({ ...newSlot, attorneyId: attorney?.id ?? 0, attorneyName: attorney?.name ?? '' });
                }}
                className="glass-input w-full px-4 py-2.5 text-sm"
              >
                <option value={0}>Select an attorney…</option>
                {attorneyOptions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {attorneyOptions.length === 0 && (
                <p className="text-[11px] text-text-muted mt-1">No attorneys yet — add one in Team Management.</p>
              )}
            </div>
          )}
          <div>
            <label className="text-sm text-text-secondary block mb-1">Day of Week</label>
            <select value={newSlot.dayOfWeek} onChange={e => setNewSlot({...newSlot, dayOfWeek: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm">
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-text-secondary block mb-1">Start Time</label>
              <input type="time" value={newSlot.startTime} onChange={e => setNewSlot({...newSlot, startTime: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
            <div>
              <label className="text-sm text-text-secondary block mb-1">End Time</label>
              <input type="time" value={newSlot.endTime} onChange={e => setNewSlot({...newSlot, endTime: e.target.value})} className="glass-input w-full px-4 py-2.5 text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
            <button onClick={() => { if (!canSubmitSlot) return; createSlot(newSlot); setShowAdd(false); }} disabled={!canSubmitSlot} className="btn-primary disabled:opacity-50">Add Slot</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
