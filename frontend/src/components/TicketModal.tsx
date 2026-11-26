import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ApiError } from '../api/client';
import { ticketsApi } from '../api/endpoints';
import { useToast } from '../context/ToastContext';
import { Ticket, TicketCategory, TicketPriority } from '../types';

interface TicketModalProps {
  open: boolean;
  ticket?: Ticket | null;
  onClose: () => void;
  onSaved: (ticket: Ticket) => void;
}

export function TicketModal({ open, ticket, onClose, onSaved }: TicketModalProps) {
  const isEdit = Boolean(ticket);
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<TicketCategory>('technical');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (ticket) {
      setTitle(ticket.title);
      setDescription(ticket.description);
      setCategory(ticket.category);
      setPriority(ticket.priority);
    } else {
      setTitle('');
      setDescription('');
      setCategory('technical');
      setPriority('medium');
    }
    setError('');
  }, [ticket, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = isEdit && ticket
        ? await ticketsApi.update(ticket.id, { title, description, category, priority })
        : await ticketsApi.create({ title, description, category, priority });

      showToast(isEdit ? 'Ticket updated' : 'Support ticket submitted');
      onSaved(res.ticket);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        const firstDetail = err.details?.[0]?.message;
        setError(firstDetail || err.message);
      } else {
        setError('Could not save ticket');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div>
            <h3 className="card-title">{isEdit ? 'Edit Support Ticket' : 'New Support Ticket'}</h3>
            <p className="card-subtitle">
              {isEdit
                ? 'Update ticket details so the support team has accurate context.'
                : 'Describe the issue clearly to route it to the right team.'}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form className="card-body" onSubmit={handleSubmit}>
          {error && <div className="alert-error">{error}</div>}

          <div className="form-group">
            <label className="form-label" htmlFor="ticket-title">
              Subject
            </label>
            <input
              id="ticket-title"
              className="input"
              placeholder="e.g. Webhook signatures failing in staging environment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              minLength={4}
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label className="form-label" htmlFor="ticket-category">
                Category
              </label>
              <select
                id="ticket-category"
                className="select"
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
              >
                <option value="technical">Technical</option>
                <option value="billing">Billing</option>
                <option value="account">Account &amp; Auth</option>
                <option value="feature_request">Feature Request</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="ticket-priority">
                Priority
              </label>
              <select
                id="ticket-priority"
                className="select"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="ticket-description">
              Description
            </label>
            <textarea
              id="ticket-description"
              className="textarea"
              rows={5}
              placeholder="Include steps to reproduce, expected behavior, and any error codes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={10}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
