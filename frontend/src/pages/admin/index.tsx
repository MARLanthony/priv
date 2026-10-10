import React from 'react';
import { AppointmentsWorkbench } from '../shared/AppointmentsWorkbench';
import { CasesWorkbench } from '../shared/CasesWorkbench';
import { ClientsDirectory } from '../shared/ClientsDirectory';
import { ConsultationsWorkbench } from '../shared/ConsultationsWorkbench';
import { DashboardOverview } from '../shared/DashboardOverview';
import { DocumentsWorkbench } from '../shared/DocumentsWorkbench';
import { KnowledgeBaseWorkbench } from '../shared/KnowledgeBaseWorkbench';
import { ServicesWorkbench } from '../shared/ServicesWorkbench';
import { SettingsPage } from '../shared/SettingsPage';
import { TeamWorkbench } from '../shared/TeamWorkbench';

/**
 * Admin / owner pages.
 *
 * Every screen is a thin wrapper around a shared workbench with `scope="firm"`:
 * the admin sees the whole firm, and the store/RBAC layers already hide the
 * actions their role does not grant.
 */

export const AdminDashboard: React.FC = () => <DashboardOverview role="admin" />;

export const AdminCases: React.FC = () => (
  <CasesWorkbench
    title="All cases"
    subtitle="Every matter the firm is handling, across all lawyers."
    scope="firm"
  />
);

export const AdminClients: React.FC = () => (
  <ClientsDirectory title="Clients" subtitle="The firm's client book." />
);

export const AdminConsultations: React.FC = () => (
  <ConsultationsWorkbench
    title="Consultations"
    subtitle="Intake requests from clients, waiting for review."
    scope="firm"
  />
);

export const AdminAppointments: React.FC = () => (
  <AppointmentsWorkbench
    title="Appointments"
    subtitle="The firm-wide diary — every lawyer, every client."
    scope="firm"
  />
);

export const AdminDocuments: React.FC = () => (
  <DocumentsWorkbench
    title="Documents"
    subtitle="The firm's filing cabinet, across every matter."
  />
);

export const AdminTeam: React.FC = () => <TeamWorkbench />;

export const AdminKnowledgeBase: React.FC = () => (
  <KnowledgeBaseWorkbench
    title="Knowledge base"
    subtitle="Curate the articles the AI cites when it answers clients."
  />
);

export const AdminServices: React.FC = () => <ServicesWorkbench />;

export const AdminSettings: React.FC = () => (
  <SettingsPage
    subtitle="Your account, the notification preferences and the firm's role matrix."
    showPermissions
  />
);

export default AdminDashboard;
