import React, { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, Select, TextArea } from '../../components/UI';
import { toast, useDirectoryStore } from '../../stores';
import { createUser, updateUser } from '../../services';
import type { User, UserRole } from '../../types';
import { ROLE_LABELS } from '../../types';

const ROLES: UserRole[] = ['admin', 'lawyer', 'staff', 'client'];

const roleOptions = ROLES.map(role => ({ value: role, label: ROLE_LABELS[role] }));
const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Disabled' },
];

export interface UserFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Editing an existing account; omit to invite a new one. */
  user?: User | null;
  /** Called with the saved record so the team table can react. */
  onSaved?: (user: User) => void;
}

/**
 * Team-member editor (admin only).
 *
 * Lawyers additionally carry `specialization` and `barNumber` — the AI intake
 * uses them to recommend the right attorney for a consultation.
 */
export const UserFormModal: React.FC<UserFormModalProps> = ({
  isOpen,
  onClose,
  user = null,
  onSaved,
}) => {
  const loadUsers = useDirectoryStore(state => state.loadUsers);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('lawyer');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [barNumber, setBarNumber] = useState('');
  const [active, setActive] = useState('active');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(user?.name ?? '');
    setEmail(user?.email ?? '');
    setPassword('');
    setRole(user?.role ?? 'lawyer');
    setPhone(user?.phone ?? '');
    setAddress(user?.address ?? '');
    setSpecialization(user?.specialization ?? '');
    setBarNumber(user?.barNumber ?? '');
    setActive(user?.isActive === false ? 'inactive' : 'active');
  }, [isOpen, user]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim() || !email.trim()) {
      toast.error('A name and an e-mail address are required.');
      return;
    }
    if (!user && password.trim().length < 8) {
      toast.error('Set an initial password of at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim(),
        role,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        specialization: role === 'lawyer' ? specialization.trim() || undefined : undefined,
        barNumber: role === 'lawyer' ? barNumber.trim() || undefined : undefined,
        isActive: active === 'active',
        ...(password.trim() ? { password: password.trim() } : {}),
      };

      const saved = user ? await updateUser(user.id, payload) : await createUser(payload);
      toast.success(user ? 'Account updated.' : `${saved.name} joined the firm workspace.`);
      await loadUsers(true);
      onSaved?.(saved);
      onClose();
    } catch {
      toast.error('The account could not be saved. Check the e-mail address is not taken.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? `Edit ${user.name}` : 'Invite a team member'}
      subtitle="Roles decide what the workspace shows — pick the narrowest role that fits."
      maxWidth="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="user-form" loading={saving}>
            {user ? 'Save changes' : 'Send invitation'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <Input value={name} onChange={event => setName(event.target.value)} placeholder="Ada Mensah" />
          </Field>
          <Field label="Work e-mail" required>
            <Input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="ada@firm.com"
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={user ? 'Reset password' : 'Initial password'}
            required={!user}
            hint={user ? 'Leave blank to keep the current password.' : 'Minimum 8 characters.'}
          >
            <Input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder={user ? '••••••••' : 'Temporary password'}
            />
          </Field>
          <Field label="Role" required>
            <Select
              value={role}
              onChange={event => setRole(event.target.value as UserRole)}
              options={roleOptions}
            />
          </Field>
        </div>

        {role === 'lawyer' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Specialization" hint="Shown to the AI recommender.">
              <Input
                value={specialization}
                onChange={event => setSpecialization(event.target.value)}
                placeholder="Family Law"
              />
            </Field>
            <Field label="Bar number">
              <Input
                value={barNumber}
                onChange={event => setBarNumber(event.target.value)}
                placeholder="BAR-2019-0042"
              />
            </Field>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input value={phone} onChange={event => setPhone(event.target.value)} placeholder="+1 555 0142" />
          </Field>
          <Field label="Account status">
            <Select
              value={active}
              onChange={event => setActive(event.target.value)}
              options={statusOptions}
            />
          </Field>
        </div>

        <Field label="Address">
          <Input value={address} onChange={event => setAddress(event.target.value)} placeholder="Chambers address" />
        </Field>
      </form>
    </Modal>
  );
};

export default UserFormModal;

