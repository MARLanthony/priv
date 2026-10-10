import React from 'react';
import { AppointmentsWorkbench } from '../shared/AppointmentsWorkbench';
import { CasesWorkbench } from '../shared/CasesWorkbench';
import { ClientsDirectory } from '../shared/ClientsDirectory';
import { ConsultationsWorkbench } from '../shared/ConsultationsWorkbench';
import { DashboardOverview } from '../shared/DashboardOverview';
import { DocumentsWorkbench } from '../shared/DocumentsWorkbench';
import { SettingsPage } from '../shared/SettingsPage';

/**
 * Staff / lawyer's assistant pages.
 *
 * The front desk: intake, the firm-wide diary, the calendar and the filing
 * cabinet. Staff may not review consultations (`consultations.review` is not in
 * their matrix), so the workbench hides the decision buttons for them.
 */

export const StaffDashboard: React.FC = () => <DashboardOverview role="staff" />;

export const StaffConsultations: React.FC = () => (
  <ConsultationsWorkbench
    title="Intake queue"
    subtitle="New concerns from clients — triage them and schedule the ones the firm accepts."
    scope="firm"
  />
);

export const StaffAppointments: React.FC = () => (
  <AppointmentsWorkbench
    title="Appointments"
    subtitle="Book, move and cancel consultations for the whole firm."
    scope="firm"
  />
);

export const StaffCalendar: React.FC = () => (
  <AppointmentsWorkbench
    title="Calendar"
    subtitle="The week at a glance — click a booking to open it."
    scope="firm"
    initialView="calendar"
  />
);

export const StaffClients: React.FC = () => (
  <ClientsDirectory title="Clients" subtitle="Open a file, update contact details or add a login." />
);

export const StaffCases: React.FC = () => (
  <CasesWorkbench
    title="Cases"
    subtitle="Open matters, assign a lawyer and keep the status current."
    scope="firm"
  />
);

export const StaffDocuments: React.FC = () => (
  <DocumentsWorkbench
    title="Filing cabinet"
    subtitle="Everything clients have sent in, ready for review."
  />
);

export const StaffSettings: React.FC = () => <SettingsPage />;

export default StaffDashboard;
