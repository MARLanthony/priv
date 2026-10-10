import React from 'react';
import { AppointmentsWorkbench } from '../shared/AppointmentsWorkbench';
import { AvailabilityEditor } from '../shared/AvailabilityEditor';
import { CasesWorkbench } from '../shared/CasesWorkbench';
import { ClientsDirectory } from '../shared/ClientsDirectory';
import { ConsultationsWorkbench } from '../shared/ConsultationsWorkbench';
import { DashboardOverview } from '../shared/DashboardOverview';
import { DocumentsWorkbench } from '../shared/DocumentsWorkbench';
import { KnowledgeBaseWorkbench } from '../shared/KnowledgeBaseWorkbench';
import { SettingsPage } from '../shared/SettingsPage';

/**
 * Lawyer pages.
 *
 * The docket: only the matters, appointments and consultations that belong to
 * the signed-in lawyer (`scope="mine"` / `"reviewer"`), plus the two firm-wide
 * read surfaces (clients, knowledge base).
 */

export const LawyerDashboard: React.FC = () => <DashboardOverview role="lawyer" />;

export const LawyerCases: React.FC = () => (
  <CasesWorkbench
    title="My cases"
    subtitle="The matters where you are the lead attorney."
    scope="mine"
  />
);

export const LawyerClients: React.FC = () => (
  <ClientsDirectory
    title="Clients"
    subtitle="Read-only view of the client book — ask the front desk to open or edit a file."
    canWrite={false}
  />
);

export const LawyerConsultations: React.FC = () => (
  <ConsultationsWorkbench
    title="Consultations"
    subtitle="Review intake requests, then book the ones you accept."
    scope="reviewer"
  />
);

export const LawyerAppointments: React.FC = () => (
  <AppointmentsWorkbench
    title="My appointments"
    subtitle="Your diary for the coming weeks."
    scope="mine"
  />
);

export const LawyerAvailability: React.FC = () => <AvailabilityEditor />;

export const LawyerDocuments: React.FC = () => (
  <DocumentsWorkbench
    title="Documents"
    subtitle="Files on the matters you run — upload, review and annotate."
  />
);

export const LawyerKnowledgeBase: React.FC = () => (
  <KnowledgeBaseWorkbench
    title="Knowledge base"
    subtitle="Read the firm's guidance and add your own practice notes."
  />
);

export const LawyerSettings: React.FC = () => <SettingsPage />;

export default LawyerDashboard;
