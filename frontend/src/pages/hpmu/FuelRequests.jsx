import { useCallback, useEffect, useMemo, useState } from 'react';
import { fuelApi, hpmuApi, statsApi } from '../../services/resources';
import Loading from '../../components/Loading';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import Modal from '../../components/Modal';

const STATUSES = [
  'ALL',
  'HPMU_REVIEW',
  'HPMU_APPROVED',
  'HPMU_REJECTED',
  'HPMU_RETURNED',
  'HPMU_RELEASED',
  'DRIVER_CONFIRMED',
  'COMPLETED',
];

const statusLabel = {
  HPMU_REVIEW: 'Under Review',
  HPMU_APPROVED: 'Approved',
  HPMU_REJECTED: 'Rejected',
  HPMU_RETURNED: 'Returned',
  HPMU_RELEASED: 'Released',
  DRIVER_CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
};

const emptyFilters = {
  search: '',
  status: 'ALL',
  date: '',
};

const MIN_VOUCHER_TOKEN_LENGTH = 10;
const MAX_VOUCHER_TOKEN_LENGTH = 20;
const VOUCHER_TOKEN_LENGTH_ERROR = 'Voucher token must contain between 10 and 20 characters.';
const VOUCHER_TOKEN_PATTERN = /^[A-Za-z0-9]+$/;

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-TZ', { dateStyle: 'medium', timeStyle: 'short' });
}

function getDriverName(item) {
  return (
    item?.driver?.user?.fullName ||
    item?.driver?.name ||
    item?.trip?.driver?.user?.fullName ||
    item?.trip?.driver?.name ||
    '—'
  );
}

function getVehicleNumber(item) {
  return item?.vehicle?.registrationNumber || item?.trip?.vehicle?.registrationNumber || '—';
}

function getTripNumber(item) {
  return (
    item?.trip?.tripNumber ||
    item?.trip?.request?.requestNumber ||
    item?.request?.requestNumber ||
    `FR-${item?.id ?? '—'}`
  );
}

export default function HPMUFuelRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState(emptyFilters);
  const [applied, setApplied] = useState(emptyFilters);
  const [error, setError] = useState('');
  // Exactly three database-backed statistics: Pending, Fuel Released, Rejected.
  const [stats, setStats] = useState({ pending: 0, released: 0, rejected: 0 });

  const [reviewItem, setReviewItem] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewLoading, setReviewLoading] = useState(false);

  const [releaseItem, setReleaseItem] = useState(null);
  const [releaseLitres, setReleaseLitres] = useState('');
  const [releaseVoucherToken, setReleaseVoucherToken] = useState('');
  const [releaseComment, setReleaseComment] = useState('');
  const [releaseError, setReleaseError] = useState('');
  const [releaseLoading, setReleaseLoading] = useState(false);

  const [viewItem, setViewItem] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = { page, limit: 15 };
      if (applied.status && applied.status !== 'ALL') {
        params.status = applied.status;
      }

      const response = await fuelApi.list(params);

      let rows = [];
      if (Array.isArray(response)) {
        rows = response;
      } else if (Array.isArray(response?.data)) {
        rows = response.data;
      } else if (Array.isArray(response?.rows)) {
        rows = response.rows;
      }

      if (applied.date) {
        const filterDate = new Date(`${applied.date}T00:00:00`);
        const nextDay = new Date(filterDate);
        nextDay.setDate(nextDay.getDate() + 1);
        rows = rows.filter((item) => {
          if (!item?.createdAt) return false;
          const itemDate = new Date(item.createdAt);
          return itemDate >= filterDate && itemDate < nextDay;
        });
      }

      if (applied.search.trim()) {
        const query = applied.search.trim().toLowerCase();
        rows = rows.filter((item) => {
          const tripNumber = getTripNumber(item).toLowerCase();
          const driverName = getDriverName(item).toLowerCase();
          const vehicleNumber = getVehicleNumber(item).toLowerCase();
          return (
            tripNumber.includes(query) ||
            driverName.includes(query) ||
            vehicleNumber.includes(query)
          );
        });
      }

      setRequests(rows);

      const backendTotal = response?.total ?? response?.pagination?.total ?? rows.length;
      setTotal(backendTotal);

      // Statistics come straight from the database (GET /api/stats), never
      // from the rows currently visible on the page.
      try {
        const s = await statsApi.get();
        setStats({
          pending: s?.pending ?? 0,
          released: s?.releasedHistorical ?? s?.released ?? 0,
          rejected: s?.rejected ?? 0,
        });
      } catch {
        /* statistics are non-blocking */
      }
    } catch (err) {
      console.error('Failed to load HPMU fuel requests:', err);
      setError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Failed to load fuel requests.'
      );
      setRequests([]);
      setTotal(0);
      setStats({ pending: 0, released: 0, rejected: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, applied]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = (event) => {
    event?.preventDefault();
    setPage(1);
    setApplied({ ...filters });
  };

  const clearFilters = () => {
    setFilters(emptyFilters);
    setApplied(emptyFilters);
    setPage(1);
  };

  const openReview = (item) => {
    setReviewItem(item);
    setReviewComment('');
    setReviewError('');
  };

  const closeReview = () => {
    if (reviewLoading) return;
    setReviewItem(null);
    setReviewComment('');
    setReviewError('');
  };

  const submitDecision = async (decision) => {
    if (!reviewItem) return;

    if (decision !== 'APPROVE' && !reviewComment.trim()) {
      setReviewError('Comment is required for Reject or Return.');
      return;
    }

    try {
      setReviewLoading(true);
      setReviewError('');

      await hpmuApi.decide(reviewItem.id, decision, reviewComment.trim());

      setReviewItem(null);
      setReviewComment('');
      await load();
    } catch (err) {
      console.error('HPMU decision failed:', err);
      setReviewError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Action failed.'
      );
    } finally {
      setReviewLoading(false);
    }
  };

  const openRelease = (item) => {
    setReleaseItem(item);
    setReleaseLitres(item?.litresRequested ?? '');
    setReleaseVoucherToken('');
    setReleaseComment('');
    setReleaseError('');
  };

  const closeRelease = () => {
    if (releaseLoading) return;
    setReleaseItem(null);
    setReleaseLitres('');
    setReleaseVoucherToken('');
    setReleaseComment('');
    setReleaseError('');
  };

  const submitRelease = async () => {
    if (!releaseItem) return;

    const litres = Number(releaseLitres);
    if (!litres || litres <= 0) {
      setReleaseError('Enter a valid number of litres.');
      return;
    }

    const token = String(releaseVoucherToken || '').trim();
    if (!token) {
      setReleaseError('Enter the fuel voucher token.');
      return;
    }
    if (
      token.length < MIN_VOUCHER_TOKEN_LENGTH ||
      token.length > MAX_VOUCHER_TOKEN_LENGTH
    ) {
      setReleaseError(VOUCHER_TOKEN_LENGTH_ERROR);
      return;
    }
    if (!VOUCHER_TOKEN_PATTERN.test(token)) {
      setReleaseError('Voucher token may only contain letters and numbers.');
      return;
    }

    try {
      setReleaseLoading(true);
      setReleaseError('');

      await hpmuApi.release(releaseItem.id, litres, releaseComment.trim(), {
        voucherToken: token,
      });

      setReleaseItem(null);
      setReleaseLitres('');
      setReleaseVoucherToken('');
      setReleaseComment('');
      await load();
    } catch (err) {
      console.error('Fuel release failed:', err);
      setReleaseError(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          'Fuel release failed.'
      );
    } finally {
      setReleaseLoading(false);
    }
  };

  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  const pageInfo = useMemo(() => {
    if (!total) return '0 records';
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return `${start}–${end} of ${total}`;
  }, [page, total]);

  if (loading && requests.length === 0) {
    return <Loading />;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <span className="eyebrow">HPMU PORTAL</span>
          <h1>Fuel Requests</h1>
          <p>Review, approve, reject, return and release fuel requests.</p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={load}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 20 }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Summary — exactly three statistics, all from the database */}
      <div className="stat-grid">
        <div className="stat-card accent">
          <span className="stat-icon">⏳</span>
          <span className="stat-value">{stats.pending}</span>
          <span className="stat-label">Pending</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">⛽</span>
          <span className="stat-value">{stats.released}</span>
          <span className="stat-label">Fuel Released</span>
        </div>
        <div className="stat-card">
          <span className="stat-icon">✕</span>
          <span className="stat-value">{stats.rejected}</span>
          <span className="stat-label">Rejected</span>
        </div>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Search & Filters</h3>
            <p>Find fuel requests by trip, driver, vehicle, status or date.</p>
          </div>
        </div>

        <form onSubmit={applyFilters}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 14,
            }}
          >
            <div className="form-group">
              <label>Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Trip, driver or vehicle…"
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status === 'ALL' ? 'All Statuses' : statusLabel[status] || status}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="submit" className="btn btn-primary">
              🔎 Apply Filters
            </button>
            <button type="button" className="btn btn-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Fuel Request Records</h3>
            <p>Showing {pageInfo}</p>
          </div>
        </div>

        {requests.length === 0 ? (
          <div style={{ padding: '45px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: 42, marginBottom: 10 }}>⛽</div>
            <h3>No fuel requests found</h3>
            <p>Try changing the filters or refresh the page.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Trip</th>
                  <th>Driver</th>
                  <th>Vehicle</th>
                  <th>Type</th>
                  <th>Fuel Requested</th>
                  <th>Fuel Released</th>
                  <th>Voucher</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((item, index) => (
                  <tr key={item.id}>
                    <td>{(page - 1) * pageSize + index + 1}</td>
                    <td>
                      <strong>{getTripNumber(item)}</strong>
                    </td>
                    <td>{getDriverName(item)}</td>
                    <td>{getVehicleNumber(item)}</td>
                    <td>
                      {item.requestType === 'EMERGENCY' && (
                        <span className="status-badge status-emergency" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>
                          Emergency
                        </span>
                      )}
                      {item.requestType === 'NORMAL' && (
                        <span style={{ color: '#64748b', fontSize: 12 }}>Normal</span>
                      )}
                    </td>
                    <td>
                      <strong>{item.litresRequested ?? '—'} L</strong>
                    </td>
                    <td>
                      {item.litresReleased ? (
                        <strong style={{ color: '#059669' }}>{item.litresReleased} L</strong>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>—</span>
                      )}
                    </td>
                    <td>{item.voucherNumber || '—'}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>{formatDate(item.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {item.status === 'HPMU_REVIEW' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => openReview(item)}
                          >
                            Review
                          </button>
                        )}
                        {item.status === 'HPMU_APPROVED' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => openRelease(item)}
                          >
                            Release
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => setViewItem(item)}
                        >
                          View
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > pageSize && (
          <div style={{ marginTop: 16 }}>
            <Pagination page={page} limit={pageSize} total={total} onChange={setPage} />
          </div>
        )}
      </div>

      {/* Review modal */}
      {reviewItem && (
        <Modal
          open={!!reviewItem}
          title="Review Fuel Request"
          onClose={closeReview}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeReview}
                disabled={reviewLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => submitDecision('REJECT')}
                disabled={reviewLoading}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn btn-warning"
                onClick={() => submitDecision('RETURN')}
                disabled={reviewLoading}
              >
                Return
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => submitDecision('APPROVE')}
                disabled={reviewLoading}
              >
                {reviewLoading ? 'Saving…' : '✓ Approve'}
              </button>
            </>
          }
        >
          <div className="detail-grid">
            <div>
              <span>Trip</span>
              <strong>{getTripNumber(reviewItem)}</strong>
            </div>
            <div>
              <span>Driver</span>
              <strong>{getDriverName(reviewItem)}</strong>
            </div>
            <div>
              <span>Vehicle</span>
              <strong>{getVehicleNumber(reviewItem)}</strong>
            </div>
            <div>
              <span>Request Type</span>
              <strong>
                {reviewItem.requestType === 'EMERGENCY' ? (
                  <span className="status-badge status-emergency" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>
                    Emergency
                  </span>
                ) : (
                  'Normal'
                )}
              </strong>
            </div>
            <div>
              <span>Requested Litres</span>
              <strong>{reviewItem.litresRequested ?? '—'}</strong>
            </div>
            {reviewItem.requestType === 'EMERGENCY' && reviewItem.emergencyReason && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span>Emergency Reason</span>
                <p style={{ marginTop: 4, color: '#dc2626', fontWeight: 500 }}>{reviewItem.emergencyReason}</p>
              </div>
            )}
          </div>

          {reviewError && <div className="alert alert-danger">{reviewError}</div>}

          <div className="form-group">
            <label>
              Comment{' '}
              <span style={{ color: '#64748b' }}>(required for Reject/Return)</span>
            </label>
            <textarea
              rows={4}
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Enter your review comment…"
            />
          </div>
        </Modal>
      )}

      {/* Release modal */}
      {releaseItem && (
        <Modal
          open={!!releaseItem}
          title="Release Fuel"
          onClose={closeRelease}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeRelease}
                disabled={releaseLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={submitRelease}
                disabled={releaseLoading}
              >
                {releaseLoading ? 'Releasing…' : '⛽ Release Fuel'}
              </button>
            </>
          }
        >
          <div className="detail-grid">
            <div>
              <span>Trip</span>
              <strong>{getTripNumber(releaseItem)}</strong>
            </div>
            <div>
              <span>Driver</span>
              <strong>{getDriverName(releaseItem)}</strong>
            </div>
            <div>
              <span>Vehicle</span>
              <strong>{getVehicleNumber(releaseItem)}</strong>
            </div>
            <div>
              <span>Request Type</span>
              <strong>
                {releaseItem.requestType === 'EMERGENCY' ? (
                  <span className="status-badge status-emergency" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>
                    Emergency
                  </span>
                ) : (
                  'Normal'
                )}
              </strong>
            </div>
            <div>
              <span>Requested</span>
              <strong>{releaseItem.litresRequested ?? '—'} L</strong>
            </div>
            {releaseItem.requestType === 'EMERGENCY' && releaseItem.emergencyReason && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span>Emergency Reason</span>
                <p style={{ marginTop: 4, color: '#dc2626', fontWeight: 500 }}>{releaseItem.emergencyReason}</p>
              </div>
            )}
          </div>

          {releaseError && <div className="alert alert-danger">{releaseError}</div>}

          <div className="form-group">
            <label>Litres to Release</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={releaseLitres}
              onChange={(e) => setReleaseLitres(e.target.value)}
              placeholder="Enter litres"
            />
          </div>

          <div className="form-group">
            <label>Fuel Voucher Token *</label>
            <input
              type="text"
              value={releaseVoucherToken}
              onChange={(e) => setReleaseVoucherToken(e.target.value)}
              placeholder="10-20 characters, letters and numbers"
              data-testid="voucher-token-input"
            />
            <small style={{ display: 'block', marginTop: 6 }}>
              {MIN_VOUCHER_TOKEN_LENGTH}-{MAX_VOUCHER_TOKEN_LENGTH} characters, letters and
              numbers only. Example: HPMU20260001AB
            </small>
          </div>

          <div className="form-group">
            <label>Release Comment</label>
            <textarea
              rows={4}
              value={releaseComment}
              onChange={(e) => setReleaseComment(e.target.value)}
              placeholder="Optional release comment…"
            />
          </div>
        </Modal>
      )}

      {/* View modal */}
      {viewItem && (
        <Modal
          open={!!viewItem}
          title="Fuel Request Details"
          onClose={() => setViewItem(null)}
          footer={
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setViewItem(null)}
            >
              Close
            </button>
          }
        >
          <div className="detail-grid">
            <div>
              <span>Trip Number</span>
              <strong>{getTripNumber(viewItem)}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>
                <StatusBadge status={viewItem.status} />
              </strong>
            </div>
            <div>
              <span>Driver</span>
              <strong>{getDriverName(viewItem)}</strong>
            </div>
            <div>
              <span>Vehicle</span>
              <strong>{getVehicleNumber(viewItem)}</strong>
            </div>
            <div>
              <span>Request Type</span>
              <strong>
                {viewItem.requestType === 'EMERGENCY' ? (
                  <span className="status-badge status-emergency" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>
                    Emergency
                  </span>
                ) : (
                  'Normal'
                )}
              </strong>
            </div>
            <div>
              <span>Requested Litres</span>
              <strong>{viewItem.litresRequested ?? '—'} L</strong>
            </div>
            {viewItem.requestType === 'EMERGENCY' && viewItem.emergencyReason && (
              <div style={{ gridColumn: '1 / -1' }}>
                <span>Emergency Reason</span>
                <p style={{ marginTop: 4, color: '#dc2626', fontWeight: 500 }}>{viewItem.emergencyReason}</p>
              </div>
            )}
            <div>
              <span>Voucher Number</span>
              <strong data-testid="view-voucher-number">{viewItem.voucherNumber || '—'}</strong>
            </div>
            <div>
              <span>Created</span>
              <strong>{formatDate(viewItem.createdAt)}</strong>
            </div>
            <div>
              <span>Updated</span>
              <strong>{formatDate(viewItem.updatedAt)}</strong>
            </div>
          </div>

          {viewItem.hpmuReviewComment && (
            <div style={{ marginTop: 20 }}>
              <strong>HPMU Review Comment</strong>
              <p>{viewItem.hpmuReviewComment}</p>
            </div>
          )}

          {viewItem.releaseComment && (
            <div style={{ marginTop: 20 }}>
              <strong>Release Comment</strong>
              <p>{viewItem.releaseComment}</p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
