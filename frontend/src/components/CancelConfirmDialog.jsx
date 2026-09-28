import { useEffect, useState } from 'react';
import Modal from './Modal';

/**
 * Confirmation modal that requires a cancellation reason before confirming.
 * Does not cancel on open — only on Confirm after a non-empty reason.
 */
export default function CancelConfirmDialog({
  open,
  title = 'Cancel Request?',
  referenceLabel,
  referenceValue,
  actionLabel = 'Cancel Request',
  keepLabel = 'Keep Request',
  impactNote = 'This action will cancel the request and notify the relevant users.',
  onConfirm,
  onCancel,
  submitting = false,
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setError('');
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('Please provide a cancellation reason.');
      return;
    }
    setError('');
    onConfirm(trimmed);
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
            {keepLabel}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Cancelling…' : actionLabel}
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {referenceValue && (
          <p style={{ margin: 0 }}>
            {referenceLabel || 'Reference'}: <strong>{referenceValue}</strong>
          </p>
        )}
        <p style={{ margin: 0 }}>{impactNote}</p>

        <div>
          <label className="field-label" htmlFor="cancel-reason">
            Cancellation Reason *
          </label>
          <textarea
            id="cancel-reason"
            className="input"
            rows={4}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError('');
            }}
            placeholder="Illness, emergency, change of plans, meeting cancelled, vehicle no longer required, other…"
            disabled={submitting}
          />
          {error && <div className="form-error">{error}</div>}
        </div>

        {reason.trim() && (
          <div style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
            Reason: {reason.trim()}
          </div>
        )}
      </div>
    </Modal>
  );
}
