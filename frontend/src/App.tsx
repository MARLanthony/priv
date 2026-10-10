import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './components/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LandingPage } from './pages/LandingPage';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { SignUp } from './pages/SignUp';
import * as Admin from './pages/admin';
import * as Lawyer from './pages/lawyer';
import * as Staff from './pages/staff';
import * as Client from './pages/client';
import { useAuthStore } from './stores/authStore';
import { roleHome } from './utils/navigation';

/**
 * Routes.
 *
 * Layout: `ProtectedRoute` (session + role) wraps `DashboardLayout` (sidebar,
 * navbar, toasts), whose `<Outlet />` renders the role's page. Each role has its
 * own branch of the tree, and every branch repeats the same three-part shape:
 *
 *   /<role>            → the role's home route
 *   /<role>/<page>     → the page itself
 *
 * The sidebar (`utils/navigation`) and the guards read the same maps, so a nav
 * entry can never point at a route that does not exist.
 */

/** Sends an already-signed-in visitor from a generic path to their workspace. */
const RoleLanding: React.FC = () => {
  const user = useAuthStore(state => state.user);
  return <Navigate to={roleHome(user?.role)} replace />;
};

export const App: React.FC = () => (
  <BrowserRouter>
    <Routes>
      {/* Public */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Convenience redirects */}
      <Route path="/dashboard" element={<RoleLanding />} />
      <Route path="/app" element={<RoleLanding />} />
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/lawyer" element={<Navigate to="/lawyer/dashboard" replace />} />
      <Route path="/staff" element={<Navigate to="/staff/dashboard" replace />} />
      <Route path="/client" element={<Navigate to="/client/dashboard" replace />} />

      {/* Admin / owner */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/admin/dashboard" element={<Admin.AdminDashboard />} />
        <Route path="/admin/cases" element={<Admin.AdminCases />} />
        <Route path="/admin/clients" element={<Admin.AdminClients />} />
        <Route path="/admin/consultations" element={<Admin.AdminConsultations />} />
        <Route path="/admin/appointments" element={<Admin.AdminAppointments />} />
        <Route path="/admin/documents" element={<Admin.AdminDocuments />} />
        <Route path="/admin/team" element={<Admin.AdminTeam />} />
        <Route path="/admin/knowledge-base" element={<Admin.AdminKnowledgeBase />} />
        <Route path="/admin/services" element={<Admin.AdminServices />} />
        <Route path="/admin/settings" element={<Admin.AdminSettings />} />
      </Route>

      {/* Lawyer */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['lawyer']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/lawyer/dashboard" element={<Lawyer.LawyerDashboard />} />
        <Route path="/lawyer/cases" element={<Lawyer.LawyerCases />} />
        <Route path="/lawyer/clients" element={<Lawyer.LawyerClients />} />
        <Route path="/lawyer/consultations" element={<Lawyer.LawyerConsultations />} />
        <Route path="/lawyer/appointments" element={<Lawyer.LawyerAppointments />} />
        <Route path="/lawyer/availability" element={<Lawyer.LawyerAvailability />} />
        <Route path="/lawyer/documents" element={<Lawyer.LawyerDocuments />} />
        <Route path="/lawyer/knowledge-base" element={<Lawyer.LawyerKnowledgeBase />} />
        <Route path="/lawyer/settings" element={<Lawyer.LawyerSettings />} />
      </Route>

      {/* Staff / assistant */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['staff']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/staff/dashboard" element={<Staff.StaffDashboard />} />
        <Route path="/staff/consultations" element={<Staff.StaffConsultations />} />
        <Route path="/staff/appointments" element={<Staff.StaffAppointments />} />
        <Route path="/staff/calendar" element={<Staff.StaffCalendar />} />
        <Route path="/staff/clients" element={<Staff.StaffClients />} />
        <Route path="/staff/cases" element={<Staff.StaffCases />} />
        <Route path="/staff/documents" element={<Staff.StaffDocuments />} />
        <Route path="/staff/settings" element={<Staff.StaffSettings />} />
      </Route>

      {/* Client */}
      <Route
        element={
          <ProtectedRoute allowedRoles={['client']}>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/client/dashboard" element={<Client.ClientDashboard />} />
        <Route path="/client/suggestions" element={<Client.ClientSuggestions />} />
        <Route path="/client/cases" element={<Client.ClientCases />} />
        <Route path="/client/appointments" element={<Client.ClientAppointments />} />
        <Route path="/client/documents" element={<Client.ClientDocuments />} />
        <Route path="/client/faqs" element={<Client.ClientFaqs />} />
        <Route path="/client/inbox" element={<Client.ClientNotifications />} />
        <Route path="/client/profile" element={<Client.ClientProfile />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;
