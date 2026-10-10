import React, { useEffect, useState } from 'react';
import { AppointmentsWorkbench } from '../shared/AppointmentsWorkbench';
import { CasesWorkbench } from '../shared/CasesWorkbench';
import { DashboardOverview } from '../shared/DashboardOverview';
import { DocumentsWorkbench } from '../shared/DocumentsWorkbench';
import { FaqsPanel } from '../shared/FaqsPanel';
import { NotificationsPanel } from '../shared/NotificationsPanel';
import { SettingsPage } from '../shared/SettingsPage';
import { getMyClientProfile } from '../../services';
import { SuggestionsPage } from './SuggestionsPage';

/**
 * Client portal pages.
 *
 * A client only ever sees their own matter: the API scopes every query by the
 * client id behind the token, and `lockedClientId` keeps the local filtering in
 * step with it.
 */

/** Resolves the signed-in client's own `clients.id` for the scoped workbenches. */
function useMyClientId(): number | undefined {
  const [clientId, setClientId] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const profile = await getMyClientProfile();
        if (!cancelled) setClientId(profile.id);
      } catch {
        // No client file yet — the API returns only what exists.
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return clientId;
}

export const ClientDashboard: React.FC = () => <DashboardOverview role="client" />;

export const ClientSuggestions: React.FC = () => <SuggestionsPage />;

export const ClientCases: React.FC = () => {
  const clientId = useMyClientId();
  return (
    <CasesWorkbench
      title="My cases"
      subtitle="Your matters and where they stand."
      scope="self"
      lockedClientId={clientId}
      canCreate={false}
    />
  );
};

export const ClientAppointments: React.FC = () => {
  const clientId = useMyClientId();
  return (
    <AppointmentsWorkbench
      title="My appointments"
      subtitle="Consultations you have booked with the firm."
      scope="self"
      lockedClientId={clientId}
    />
  );
};

export const ClientDocuments: React.FC = () => {
  const clientId = useMyClientId();
  return (
    <DocumentsWorkbench
      title="My documents"
      subtitle="Upload what the firm asked for and download anything they share."
      scope="self"
      lockedClientId={clientId}
    />
  );
};

export const ClientFaqs: React.FC = () => (
  <FaqsPanel subtitle="Answers to the questions clients ask most often." />
);

export const ClientNotifications: React.FC = () => (
  <NotificationsPanel subtitle="Updates about your consultations, appointments and documents." />
);

export const ClientProfile: React.FC = () => (
  <SettingsPage subtitle="Your details, password and notification preferences." />
);

export default ClientDashboard;
