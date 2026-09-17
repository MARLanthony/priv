import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, getRoleBasePath } from '../stores/authStore';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={getRoleBasePath(user.role) + '/dashboard'} replace />;
  }

  return <>{children}</>;
};
