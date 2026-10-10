import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { roleHome } from '../utils/navigation';
import type { UserRole } from '../types';
import { PageLoader } from './UI';

/**
 * Route guard.
 *
 * * Waits for the session bootstrap (`loadSession`) before deciding, so a
 *   refresh on a deep link does not bounce the user to `/login`.
 * * `allowedRoles` is optional: omit it to require any signed-in user.
 */

export interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const status = useAuthStore(state => state.status);
  const user = useAuthStore(state => state.user);
  const location = useLocation();

  if (status === 'idle' || status === 'loading') {
    return <PageLoader label="Checking your session…" />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return <>{children}</>;
};
