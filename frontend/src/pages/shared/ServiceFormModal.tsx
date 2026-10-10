import React, { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, Select, TextArea } from '../../components/UI';
import { toast } from '../../stores';
import { createLegalService, updateLegalService } from '../../services';
import type { LegalService } from '../../types';

const activeOptions = [
  { value: 'active', label: 'Active — offer on the portal' },
  { value: 'inactive', label: 'Retired — keep for history' },
];

export interface ServiceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Editing an existing practice area; omit to add one. */
  service?: LegalService | null;
  /** Called after a successful write so the catalogue can refresh. */
  onSaved?: () => void;
}

/** Practice-area editor for the firm catalogue (admin). */
export const ServiceFormModal: React.FC<ServiceFormModalProps> = ({
  isOpen,
  onClose,
  service = null,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState('active');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(service?.name ?? '');
    setDescription(service?.description ?? '');
    setActive(service?.isActive === false ? 'inactive' : 'active');
  }, [isOpen, service]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !description.trim()) {
      toast.error('A name and a description are required.');
      return;
    }

    setSaving(true);
    try {
      const isActive = active === 'active';
      if (service) {
        await updateLegalService(service.id, { name: name.trim(), description: description.trim(), isActive });
        toast.success('Practice area updated.');
      } else {
        await createLegalService({ name: name.trim(), description: description.trim(), isActive });
        toast.success('Practice area added.');
      }
      onSaved?.();
      onClose();
    } catch {
      toast.error('The practice area could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={service ? `Edit ${service.name}` : 'New practice area'}
      subtitle="Shown on the landing page and used when clients request a consultation."
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="service-form" loading={saving}>
            {service ? 'Save changes' : 'Add practice area'}
          </Button>
        </>
      }
    >
      <form id="service-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" required>
          <Input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="Family Law Consultation"
          />
        </Field>
        <Field label="Description" required>
          <TextArea
            rows={4}
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="Divorce, custody and maintenance matters handled end to end."
          />
        </Field>
        <Field label="Availability">
          <Select value={active} onChange={event => setActive(event.target.value)} options={activeOptions} />
        </Field>
      </form>
    </Modal>
  );
};

export default ServiceFormModal;
