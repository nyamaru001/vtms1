import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestsApi, hpmuApi } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Loading from '../../components/Loading';

export default function HPMURequests() {
  const [requests, setRequests] = useState(null);
  const [status, setStatus] = useState('DRIVER_ASSIGNED');
  const [openModal, setOpenModal] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [decision, setDecision] = useState('APPROVE');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  const load = async () => {
    try {
      const response = await requestsApi.list({
        status: status || undefined,
        limit: 50,
      });

      const rows = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : [];

      setRequests(rows);
    } catch (e) {
      console.error('Failed to load HPMU requests:', e);
      setRequests([]);
      setError(
        e.response?.data?.message ||
          'Failed to load requests.'
      );
    }
  };

  useEffect(() => {
    load();
  }, [status]);

  const openActionModal = (request) => {
    setRequestId(request.id);
    setDecision('APPROVE');
    setComment('');
    setError('');
    setOpenModal(true);
  };

  const closeActionModal = () => {
    setOpenModal(false);
    setRequestId(null);
    setDecision('APPROVE');
    setComment('');
    setError('');
  };

  const handleAction = async () => {
    if (!requestId || !decision) return;

    if (
      decision !== 'APPROVE' &&
      !comment.trim()
    ) {
      setError('Comment is required for Reject or Return.');
      return;
    }

    try {
      setLoadingAction(true);
      setError('');

      await hpmuApi.decide(
        requestId,
        decision,
        comment
      );

      closeActionModal();
      await load();
    } catch (e) {
      console.error('HPMU action failed:', e);
      setError(
        e.response?.data?.message ||
          'HPMU action failed.'
      );
    } finally {
      setLoadingAction(false);
    }
  };

  if (!requests) return <Loading />;

  return (
    <div className="panel">
      <div className="panel-header">
        <h3>Vehicle Request Fuel Reviews</h3>

        <select
          className="input select-inline"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="DRIVER_ASSIGNED">
            Pending fuel review
          </option>
          <option value="HPMU_APPROVED">
            Approved
          </option>
          <option value="HPMU_REJECTED">
            Rejected
          </option>
          <option value="HPMU_RETURNED">
            Returned
          </option>
          <option value="">
            All
          </option>
        </select>
      </div>

      {error && !openModal && (
        <div className="form-error">{error}</div>
      )}

      <DataTable
        columns={[
          {
            key: 'requestNumber',
            header: 'Request #',
            render: (r) => (
              <Link to={`/hpmu/requests/${r.id}`}>
                {r.requestNumber}
              </Link>
            ),
          },
          {
            key: 'officer',
            header: 'Officer',
            render: (r) => r.officer?.fullName || '—',
          },
          {
            key: 'route',
            header: 'Route',
            render: (r) =>
              `${r.originName || '—'} → ${r.destinationName || '—'}`,
          },
          {
            key: 'vehicle',
            header: 'Vehicle',
            render: (r) => r.vehicle?.registrationNumber || '—',
          },
          {
            key: 'driver',
            header: 'Driver',
            render: (r) => r.driver?.user?.fullName || '—',
          },
          {
            key: 'fuel',
            header: 'Fuel (L)',
            render: (r) => r.totalFuelLitres ? `${r.totalFuelLitres} L` : '—',
          },
          {
            key: 'status',
            header: 'Status',
            render: (r) => <StatusBadge status={r.status} />,
          },
          {
            key: 'actions',
            header: '',
            render: (r) =>
              r.status === 'DRIVER_ASSIGNED' ? (
                <button
                  className="link-btn"
                  onClick={() => openActionModal(r)}
                >
                  Review
                </button>
              ) : null,
          },
        ]}
        rows={requests}
        emptyMessage="No vehicle requests found."
      />

      <Modal
        open={openModal}
        title="HPMU Fuel Decision"
        onClose={closeActionModal}
        footer={
          <>
            <button
              className="btn btn-ghost"
              onClick={closeActionModal}
              disabled={loadingAction}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAction}
              disabled={loadingAction}
            >
              {loadingAction ? 'Submitting...' : 'Submit Decision'}
            </button>
          </>
        }
      >
        {openModal && requestId && (
          <>
            <p style={{ marginBottom: 12 }}>
              Review fuel requirements for request #{requestId}
            </p>

            <div style={{ marginBottom: 12 }}>
              <label className="field-label">Decision *</label>
              <select
                className="input"
                value={decision}
                onChange={(e) => setDecision(e.target.value)}
              >
                <option value="APPROVE">APPROVE</option>
                <option value="REJECT">REJECT</option>
                <option value="RETURN">RETURN</option>
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="field-label">
                Comment {decision !== 'APPROVE' && '(required)'}
              </label>
              <textarea
                className="input"
                rows="3"
                placeholder="Enter comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            {error && (
              <div className="form-error">{error}</div>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
