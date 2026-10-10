import React, { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, TextArea } from '../../components/UI';
import { toast, useDirectoryStore } from '../../stores';
import { createClient, updateClient } from '../../services';
import type { Client } from '../../types';

export interface ClientFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Editing an existing client record; omit to add a new one. */
  client?: Client | null;
  /** Called with the saved record so the caller can refresh its own list. */
  onSaved?: (client: Client) => void;
}

/**
 * Client directory editor (admin / staff).
 *
 * Creating a client can also create the linked login in one step: when a
 * password is given the API returns the client with its `userId` attached.
 */
export const ClientFormModal: React.FC<ClientFormModalProps> = ({
  isOpen,
  onClose,
  client = null,
  onSaved,
}) => {
  const loadClients = useDirectoryStore(state => state.loadClients);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFullName(client?.fullName ?? '');
    setEmail(client?.email ?? '');
    setContact(client?.contact ?? '');
    setAddress(client?.address ?? '');
    setPassword('');
  }, [isOpen, client]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName.trim() || !contact.trim() || !address.trim()) {
      toast.error('Name, contact number and address are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        fullName: fullName.trim(),
        email: email.trim() || undefined,
        contact: contact.trim(),
        address: address.trim(),
      };

      const saved = client
        ? await updateClient(client.id, payload)
        : await createClient({ ...payload, password: password.trim() || undefined });

      toast.success(client ? 'Client record updated.' : 'Client added to the directory.');
      await loadClients(true);
      onSaved?.(saved);
      onClose();
    } catch {
      toast.error('The client could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={client ? `Edit ${client.fullName}` : 'Add a client'}
      subtitle="Directory details are shared with the intake team."
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="client-form" loading={saving}>
            {client ? 'Save changes' : 'Add client'}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Full name" required>
          <Input value={fullName} onChange={event => setFullName(event.target.value)} placeholder="Jane Doe" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail" hint="Optional — needed for portal invitations.">
            <Input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="jane@example.com"
            />
          </Field>
          <Field label="Contact number" required>
            <Input
              value={contact}
              onChange={event => setContact(event.target.value)}
              placeholder="+1 555 0100"
            />
          </Field>
        </div>

        <Field label="Address" required>
          <TextArea
            rows={2}
            value={address}
            onChange={event => setAddress(event.target.value)}
            placeholder="12 Kingsway, Suite 400"
          />
        </Field>

        {!client && (
          <Field
            label="Portal password"
            hint="Leave blank to add the client without a login. Minimum 8 characters."
          >
            <Input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="Temporary password"
            />
          </Field>
        )}
      </form>
    </Modal>
  );
};

export default ClientFormModal;

