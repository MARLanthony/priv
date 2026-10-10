import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { EmptyState } from './UI';
import type { Permission, UserRole } from '../types';

/**
 * Inline permission gate.
 *
 * `ProtectedRoute` covers whole pages; this covers the buttons, tabs and panels
 * inside a page. Give it a `role`, a single `permission`, or a list of
 * `anyPermission` — the children render only when the check passes.
 */

export interface RoleGuardProps {
  roles?: UserRole[];
  permission?: Permission;
  anyPermission?: Permission[];
  /** Rendered instead of the children when the check fails. Defaults to nothing. */
  fallback?: React.ReactNode;
  /** Renders a standard "no access" block instead of the children. */
  silent?: boolean;
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  roles,
  permission,
  anyPermission,
  fallback = null,
  silent = false,
  children,
}) => {
  const user = useAuthStore(state => state.user);
  const hasRole = useAuthStore(state => state.hasRole);
  const hasPermission = useAuthStore(state => state.hasPermission);
  const hasAnyPermission = useAuthStore(state => state.hasAnyPermission);

  const allowed =
    (!roles || hasRole(roles)) &&
    (!permission || hasPermission(permission)) &&
    (!anyPermission || anyPermission.length === 0 || hasAnyPermission(anyPermission));

  if (allowed) return <>{children}</>;
  if (fallback !== null) return <>{fallback}</>;

  return silent || !user ? null : (
    <EmptyState
      icon={ShieldAlert}
      title="Restricted area"
      description="Your role does not include access to this section. Contact the firm administrator if you need it."
    />
  );
};

/** Hook form for the same checks, for imperative logic inside handlers. */
export function usePermissionGate(): {
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  role: UserRole | null;
} {
  const user = useAuthStore(state => state.user);
  const hasPermission = useAuthStore(state => state.hasPermission);
  const hasAnyPermission = useAuthStore(state => state.hasAnyPermission);

  return { can: hasPermission, canAny: hasAnyPermission, role: user?.role ?? null };
}
