import React, { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, TextArea } from '../../components/UI';
import { toast } from '../../stores';
import { createFaq, updateFaq } from '../../services';
import type { FAQ } from '../../types';

export interface FaqFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Editing an existing entry; omit to add a new question. */
  faq?: FAQ | null;
  /** Called after a successful write so the list can refresh. */
  onSaved?: () => void;
}

/** Small editor for the client-facing FAQ list. */
export const FaqFormModal: React.FC<FaqFormModalProps> = ({ isOpen, onClose, faq = null, onSaved }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [category, setCategory] = useState('General');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setQuestion(faq?.question ?? '');
    setAnswer(faq?.answer ?? '');
    setCategory(faq?.category ?? 'General');
  }, [isOpen, faq]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim() || !answer.trim()) {
      toast.error('Both the question and the answer are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = { question: question.trim(), answer: answer.trim(), category: category.trim() || 'General' };
      if (faq) {
        await updateFaq(faq.id, payload);
        toast.success('FAQ updated.');
      } else {
        await createFaq(payload);
        toast.success('FAQ published.');
      }
      onSaved?.();
      onClose();
    } catch {
      toast.error('The FAQ could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={faq ? 'Edit FAQ' : 'New FAQ'}
      subtitle="Short, plain-language answers keep clients out of the queue."
      maxWidth="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="faq-form" loading={saving}>
            {faq ? 'Save changes' : 'Publish'}
          </Button>
        </>
      }
    >
      <form id="faq-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Question" required>
          <Input
            value={question}
            onChange={event => setQuestion(event.target.value)}
            placeholder="How much does an initial consultation cost?"
          />
        </Field>
        <Field label="Category" hint="Used for the filter chips on the client portal.">
          <Input value={category} onChange={event => setCategory(event.target.value)} placeholder="General" />
        </Field>
        <Field label="Answer" required>
          <TextArea
            rows={6}
            value={answer}
            onChange={event => setAnswer(event.target.value)}
            placeholder="The initial 30-minute consultation is free of charge…"
          />
        </Field>
      </form>
    </Modal>
  );
};

export default FaqFormModal;
