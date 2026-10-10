import React, { useEffect, useMemo, useState } from 'react';
import { Save } from 'lucide-react';
import { Button, LoadingSpinner, Select } from '../../components/UI';
import { listRolePermissions, saveRolePermissions } from '../../services';
import { toast } from '../../stores';
import { ROLE_LABELS, USER_ROLES, type Permission, type UserRole } from '../../types';
import { PERMISSION_GROUPS, PERMISSION_LABELS, ROLE_PERMISSIONS } from '../../utils/rbac';

/**
 * Role → permission matrix (admin).
 *
 * The browser's copy of `backend/app/utils/rbac.py`. It is loaded from
 * `GET /roles/permissions`, edited locally, then written back per role with
 * `PUT /roles/:role/permissions` — the API re-checks every request against the
 * stored matrix, so this screen only ever *shows* the rules.
 */

type Matrix = Record<UserRole, Permission[]>;

const buildDefaultMatrix = (): Matrix => ({
  admin: [...ROLE_PERMISSIONS.admin],
  lawyer: [...ROLE_PERMISSIONS.lawyer],
  staff: [...ROLE_PERMISSIONS.staff],
  client: [...ROLE_PERMISSIONS.client],
});

const sameSet = (a: Permission[], b: Permission[]): boolean =>
  a.length === b.length && a.every(entry => b.includes(entry));

export const PermissionsPanel: React.FC = () => {
  const [matrix, setMatrix] = useState<Matrix>(buildDefaultMatrix);
  const [original, setOriginal] = useState<Matrix>(buildDefaultMatrix);
  const [focus, setFocus] = useState<UserRole>('lawyer');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const rows = await listRolePermissions();
        const next = buildDefaultMatrix();
        USER_ROLES.forEach(role => {
          const granted = rows.filter(entry => entry.role === role).map(entry => entry.permission);
          if (granted.length > 0) next[role] = granted;
        });
        setMatrix(next);
        setOriginal(next);
      } catch {
        toast.error('Could not load the role matrix.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const dirtyRoles = useMemo(
    () => USER_ROLES.filter(role => !sameSet(matrix[role], original[role])),
    [matrix, original],
  );

  const toggle = (role: UserRole, permission: Permission) => {
    setMatrix(current => {
      const granted = current[role].includes(permission);
      return {
        ...current,
        [role]: granted
          ? current[role].filter(entry => entry !== permission)
          : [...current[role], permission],
      };
    });
  };

  const save = async () => {
    if (dirtyRoles.length === 0) {
      toast.info('Nothing to save.');
      return;
    }

    setSaving(true);
    try {
      for (const role of dirtyRoles) {
        await saveRolePermissions(role, matrix[role]);
      }
      setOriginal(matrix);
      toast.success(`Updated ${dirtyRoles.length} role${dirtyRoles.length > 1 ? 's' : ''}.`);
    } catch {
      toast.error('Could not save the role matrix.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-full max-w-xs">
          <Select
            options={USER_ROLES.map(role => ({ value: role, label: ROLE_LABELS[role] }))}
            value={focus}
            onChange={event => setFocus(event.target.value as UserRole)}
          />
        </div>
        <Button onClick={() => void save()} loading={saving} disabled={dirtyRoles.length === 0}>
          <Save size={16} />
          Save {dirtyRoles.length > 0 ? `${dirtyRoles.length} change(s)` : 'changes'}
        </Button>
      </div>

      <div className="space-y-4">
        {PERMISSION_GROUPS.map(group => (
          <div key={group.label} className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-text-muted">{group.label}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.permissions.map(permission => {
                const granted = matrix[focus].includes(permission);
                return (
                  <label
                    key={permission}
                    className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors ${
                      granted ? 'border-gold/25 bg-gold/5' : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={granted}
                      onChange={() => toggle(focus, permission)}
                      className="mt-0.5 w-4 h-4 accent-gold flex-shrink-0"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm text-white">{permission}</span>
                      <span className="block text-[11px] text-text-muted">
                        {PERMISSION_LABELS[permission]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PermissionsPanel;
