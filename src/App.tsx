import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardLayout } from './components/DashboardLayout';

// Public
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';

// Admin
import { AdminDashboard } from './pages/admin/Dashboard';
import { TeamPage } from './pages/admin/TeamPage';
import { KnowledgeBasePage } from './pages/admin/KnowledgeBasePage';
import { KnowledgeBaseAddPage } from './pages/admin/KnowledgeBaseAddPage';

// Attorney
import { AttorneyDashboard } from './pages/attorney/Dashboard';

// Secretary
import { SecretaryDashboard } from './pages/secretary/Dashboard';
import { CalendarPage } from './pages/secretary/CalendarPage';

// User
import { UserDashboard } from './pages/user/Dashboard';
import { GetSuggestionsPage } from './pages/user/GetSuggestionsPage';
import { SuggestionsResultsPage } from './pages/user/SuggestionsResultsPage';
import { ArticlesPage } from './pages/user/ArticlesPage';
import { ArticleDetailPage } from './pages/user/ArticleDetailPage';
import { MessagesPage } from './pages/user/MessagesPage';
import { ProfilePage } from './pages/user/ProfilePage';

// Shared
import { CasesList } from './pages/shared/CasesList';
import { CaseDetail } from './pages/shared/CaseDetail';
import { DocumentsPage } from './pages/shared/DocumentsPage';
import { InboxPage } from './pages/shared/InboxPage';
import { AppointmentsPage } from './pages/shared/AppointmentsPage';
import { AvailabilityPage } from './pages/shared/AvailabilityPage';
import { SettingsPage } from './pages/shared/SettingsPage';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* System Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['system_admin']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="cases" element={<CasesList basePath="/admin/cases" canCreate canDelete canEdit />} />
          <Route path="cases/:id" element={<CaseDetail />} />
          <Route path="documents" element={<DocumentsPage canDelete canUpload />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="knowledge-base" element={<KnowledgeBasePage canManage basePath="/admin/knowledge-base" />} />
          <Route path="knowledge-base/add" element={<KnowledgeBaseAddPage />} />
          <Route path="appointments" element={<AppointmentsPage canCreate canDelete />} />
          <Route path="availability" element={<AvailabilityPage canEdit />} />
          <Route path="settings" element={<SettingsPage isAdmin />} />
        </Route>

        {/* Attorney Routes */}
        <Route path="/attorney" element={
          <ProtectedRoute allowedRoles={['attorney']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AttorneyDashboard />} />
          <Route path="cases" element={<CasesList basePath="/attorney/cases" />} />
          <Route path="cases/:id" element={<CaseDetail />} />
          <Route path="documents" element={<DocumentsPage canUpload />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="availability" element={<AvailabilityPage canEdit />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Legal Secretary Routes */}
        <Route path="/secretary" element={
          <ProtectedRoute allowedRoles={['legal_secretary']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<SecretaryDashboard />} />
          <Route path="cases" element={<CasesList basePath="/secretary/cases" />} />
          <Route path="cases/:id" element={<CaseDetail />} />
          <Route path="documents" element={<DocumentsPage canUpload />} />
          <Route path="inbox" element={<InboxPage />} />
          <Route path="appointments" element={<AppointmentsPage canCreate canDelete />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* User/Client Routes */}
        <Route path="/user" element={
          <ProtectedRoute allowedRoles={['user']}>
            <DashboardLayout />
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<UserDashboard />} />
          <Route path="get-suggestions" element={<GetSuggestionsPage />} />
          <Route path="suggestions/results" element={<SuggestionsResultsPage />} />
          <Route path="my-cases" element={<CasesList basePath="/user/my-cases" />} />
          <Route path="my-cases/:id" element={<CaseDetail />} />
          <Route path="articles" element={<ArticlesPage />} />
          <Route path="articles/:id" element={<ArticleDetailPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="appointments" element={<AppointmentsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
