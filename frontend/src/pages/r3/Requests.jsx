import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { requestsApi, r3Api } from '../../services/resources';
import DataTable from '../../components/DataTable';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';

const STATUS_BUTTONS = [
  { key: 'pending', label: 'Pending', status: 'R3_REVIEW' },
  { key: 'approved', label: 'Approved', status: 'TRANSPORT_REVIEW' },
  { key: 'rejected', label: 'Rejected', status: 'R3_REJECTED' },
  { key: 'returned', label: 'Returned', status: 'R3_RETURNED' },
  { key: 'all', label: 'All', status: '' },
];

const LIMIT = 15;

function normalizeRows(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.rows)) return res.rows;
  return [];
}

function extractTotal(res) {
  if (typeof res?.total === 'number') return res.total;
  if (typeof res?.count === 'number') return res.count;
  return normalizeRows(res).length;
}

export default function R3Requests() {
  const [activeStatus, setActiveStatus] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedRequest, setSelectedRequest] = useState(null);
  const [decision, setDecision] = useState('APPROVE');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError('');

      const params = { page, limit: LIMIT };
      const selectedBtn = STATUS_BUTTONS.find((b) => b.key === activeStatus);
      if (selectedBtn?.status) params.status = selectedBtn.status;
      if (search.trim()) params.search = search.trim();
      if (date) { params.startDate = date; params.endDate = date; }

      const response = await requestsApi.list(params);
      setRequests(normalizeRows(response));
      setTotal(extractTotal(response));
    } catch (err) {
      setRequests([]);
      setTotal(0);
      setError(err.response?.data?.message || 'Failed to load requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { setPage(1); }, [activeStatus, search, date]);
  useEffect(() => { loadRequests(); }, [activeStatus, page, search, date]);

  const openReview = (request) => {
    setSelectedRequest(request);
    setDecision('APPROVE');
    setComment('');
    setError('');
  };

  const closeModal = () => {
    if (saving) return;
    setSelectedRequest(null);
    setDecision('APPROVE');
    setComment('');
    setError('');
  };

  const handleDecision = async () => {
    if (!selectedRequest) return;
    if ((decision === 'REJECT' || decision === 'RETURN') && !comment.trim()) {
      setError('Comment is required for Reject or Return.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      await r3Api.decide(selectedRequest.id, decision, comment.trim());
      closeModal();
      await loadRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit decision.');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: 'requestNumber',
      header: 'Request #',
      render: (r) => <Link to={`/r3/requests/${r.id}`}>{r.requestNumber || `REQ-${r.id}`}</Link>,
    },
    {
      key: 'officer',
      header: 'Officer',
      render: (r) => r.officer?.fullName || r.officer?.name || '—',
    },
    {
      key: 'route',
      header: 'Route',
      render: (r) => `${r.originName || '—'} → ${r.destinationName || '—'}`,
    },
    {
      key: 'vehicle',
      header: 'Vehicle',
      render: (r) => r.vehicle?.registrationNumber || 'Not assigned',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: 'date',
      header: 'Date',
      render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—',
    },
    {
      key: 'r3Decision',
      header: 'Decision',
      render: (r) => r.r3Approvals?.[0]?.decision || '—',
    },
    {
      key: 'actions',
      header: '',
      render: (r) =>
        r.status === 'R3_REVIEW' ? (
          <button type="button" className="link-btn" onClick={() => openReview(r)}>
            Review
          </button>
        ) : '—',
    },
  ];

  return (
    <div>
      <div className="hero-strip">
        <div>
          <span className="eyebrow">R3 APPROVAL</span>
          <h2>Request Management</h2>
          <p>Review and approve vehicle requests from officers.</p>
        </div>
      </div>

      <div className="panel">
        <div className="status-buttons no-print">
          {STATUS_BUTTONS.map((btn) => (
            <button
              key={btn.key}
              type="button"
              className={`btn btn-sm ${activeStatus === btn.key ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveStatus(btn.key)}
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="filters-row no-print">
          <input
            className="input"
            type="text"
            placeholder="Search by officer or request #"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <input
            className="input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <button className="btn btn-ghost" onClick={() => { setSearch(''); setDate(''); }}>
            Clear
          </button>
        </div>

        {error && !selectedRequest && <div className="callout callout-error">{error}</div>}

        {loading ? (
          <Loading />
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={requests}
              emptyMessage="No requests found."
            />
            <Pagination page={page} limit={LIMIT} total={total} onChange={setPage} />
          </>
        )}
      </div>

      <Modal
        open={!!selectedRequest}
        title="R3 Final Approval"
        onClose={closeModal}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>Cancel</button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setDecision('REJECT');
                if (!comment.trim()) { setError('Comment is required for Reject.'); return; }
                handleDecision();
              }}
              disabled={saving}
            >
              Reject
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setDecision('RETURN');
                if (!comment.trim()) { setError('Comment is required for Return.'); return; }
                handleDecision();
              }}
              disabled={saving}
            >
              Return
            </button>
            <button type="button" className="btn btn-primary" onClick={handleDecision} disabled={saving}>
              {saving ? 'Submitting...' : 'Approve Request'}
            </button>
          </>
        }
      >
        {selectedRequest && (
          <div>
            <div className="detail-grid">
              <div>
                <span className="field-label">Request Number</span>
                <p>{selectedRequest.requestNumber || `REQ-${selectedRequest.id}`}</p>
              </div>
              <div>
                <span className="field-label">Officer</span>
                <p>{selectedRequest.officer?.fullName || selectedRequest.officer?.name || '—'}</p>
              </div>
              <div>
                <span className="field-label">Origin</span>
                <p>{selectedRequest.originName || '—'}</p>
              </div>
              <div>
                <span className="field-label">Destination</span>
                <p>{selectedRequest.destinationName || '—'}</p>
              </div>
              <div>
                <span className="field-label">Vehicle</span>
                <p>{selectedRequest.vehicle?.registrationNumber || 'Not assigned'}</p>
              </div>
              <div>
                <span className="field-label">Distance</span>
                <p>{selectedRequest.distanceKm ? `${selectedRequest.distanceKm} km` : '—'}</p>
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <label className="field-label">Decision</label>
              <select className="input" value={decision} onChange={(e) => { setDecision(e.target.value); setError(''); }} disabled={saving}>
                <option value="APPROVE">APPROVE</option>
                <option value="REJECT">REJECT</option>
                <option value="RETURN">RETURN</option>
              </select>
            </div>

            <div style={{ marginTop: '16px' }}>
              <label className="field-label">Comment{decision !== 'APPROVE' && ' *'}</label>
              <textarea
                className="input"
                rows="4"
                value={comment}
                onChange={(e) => { setComment(e.target.value); setError(''); }}
                placeholder={decision === 'APPROVE' ? 'Optional approval comment...' : 'Enter reason...'}
                disabled={saving}
              />
            </div>

            {error && <div className="form-error">{error}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
