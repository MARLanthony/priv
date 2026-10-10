import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Scale, Trash2 } from 'lucide-react';
import {
  Button,
  ConfirmDialog,
  EmptyState,
  GlassCard,
  KPICard,
  PageHeader,
  PageLoader,
} from '../../components/UI';
import { deleteLegalService, listLegalServices, updateLegalService } from '../../services';
import { toast, useAuthStore } from '../../stores';
import type { LegalService } from '../../types';
import { ServiceFormModal } from './ServiceFormModal';

/**
 * Legal services catalogue (admin).
 *
 * The practice areas a client picks from when they submit a concern. The AI
 * intake maps its suggestions back onto these names, so keeping the list tidy
 * keeps the recommendations tidy too.
 */

export const ServicesWorkbench: React.FC = () => {
  const canWrite = useAuthStore(state => state.hasPermission('settings.manage'));

  const [items, setItems] = useState<LegalService[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LegalService | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LegalService | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const rows = await listLegalServices(false);
      setItems(rows);
    } catch {
      toast.error('Could not load the services catalogue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const toggleActive = async (service: LegalService) => {
    try {
      await updateLegalService(service.id, { isActive: !service.isActive });
      toast.success(`${service.name} is now ${service.isActive ? 'retired' : 'offered'}.`);
      await refresh();
    } catch {
      toast.error('Could not update this practice area.');
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await deleteLegalService(pendingDelete.id);
      toast.success(`${pendingDelete.name} was deleted.`);
      setPendingDelete(null);
      await refresh();
    } catch {
      toast.error('Could not delete this practice area.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && items.length === 0) return <PageLoader label="Loading practice areas…" />;

  const active = items.filter(entry => entry.isActive).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Legal services"
        subtitle="The practice areas offered to clients during intake."
        actions={
          canWrite ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={16} />
              New service
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard label="Practice areas" value={items.length} icon={Scale} />
        <KPICard label="Currently offered" value={active} icon={Scale} tone="success" />
        <KPICard label="Retired" value={items.length - active} icon={Scale} tone="info" />
      </div>

      {items.length === 0 ? (
        <GlassCard>
          <EmptyState
            icon={Scale}
            title="No practice areas yet"
            description="Add the areas the firm takes on — clients pick one when they describe their concern."
          />
        </GlassCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map(service => (
            <GlassCard key={service.id} hover className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white font-semibold truncate">{service.name}</p>
                  <p className="text-[11px] uppercase tracking-wide text-text-muted mt-0.5">
                    {service.isActive ? 'Offered' : 'Retired'}
                  </p>
                </div>
                <span
                  className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    service.isActive ? 'bg-success' : 'bg-text-muted'
                  }`}
                />
              </div>
              <p className="text-sm text-text-secondary flex-1">{service.description}</p>
              {canWrite ? (
                <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-white/5">
                  <Button variant="ghost" onClick={() => void toggleActive(service)}>
                    {service.isActive ? 'Retire' : 'Offer'}
                  </Button>
                  <Button
                    variant="ghost"
                    title="Edit"
                    onClick={() => {
                      setEditing(service);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" title="Delete" onClick={() => setPendingDelete(service)}>
                    <Trash2 size={16} />
                  </Button>
                </div>
              ) : null}
            </GlassCard>
          ))}
        </div>
      )}

      <ServiceFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        service={editing}
        onSaved={() => void refresh()}
      />

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Delete practice area"
        message={`Delete “${pendingDelete?.name ?? ''}”? Existing matters keep it in their history.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
};

export default ServicesWorkbench;
