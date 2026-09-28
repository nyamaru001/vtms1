import { useEffect, useState } from 'react';
import { logbooksApi } from '../../services/resources';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';
import LogbookPrint from '../../components/LogbookPrint';

export default function TransportLogbook() {
  const [logbooks, setLogbooks] = useState([]);
  const [status, setStatus] = useState('VERIFIED');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printItem, setPrintItem] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { page, limit: 10 };
      if (status) params.status = status;
      const response = await logbooksApi.list(params);
      setLogbooks(response.data || []);
      setMeta({ page: response.page || 1, limit: response.limit || 10, total: response.total || 0 });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load logbooks.');
      setLogbooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, status]);

  if (loading && !logbooks.length) return <Loading />;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">TRANSPORT LOGBOOK</span>
          <h3>Approved Driver Logbooks</h3>
          <p className="field-hint">View-only logbooks after officer approval.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select className="input select-inline" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="VERIFIED">Verified (Approved)</option>
            <option value="">All statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="RETURNED">Returned</option>
            <option value="DRAFT">Draft</option>
          </select>
          <button className="btn btn-secondary" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!logbooks.length ? (
        <div className="empty-state">No logbooks found.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Driver</th>
              <th>Vehicle</th>
              <th>Distance</th>
              <th>Fuel</th>
              <th>Status</th>
              <th>Approved By</th>
              <th>Approved At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {logbooks.map((lb) => (
              <tr key={lb.id} data-testid="logbook-row">
                <td>{lb.tripName || lb.trip?.tripNumber || `#${lb.id}`}</td>
                <td>{lb.driver?.user?.fullName || '—'}</td>
                <td>{lb.vehicle?.registrationNumber || lb.vehicleRegistration || '—'}</td>
                <td>{lb.totalKm ?? '—'}</td>
                <td>{lb.fuelUsedLitres ?? lb.fuelIssuedLitres ?? '—'} L</td>
                <td><StatusBadge status={lb.status} /></td>
                <td>{lb.verifiedByUser?.fullName || lb.officer?.fullName || '—'}</td>
                <td>{lb.verifiedAt ? new Date(lb.verifiedAt).toLocaleString() : '—'}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn btn-secondary" onClick={() => setPrintItem(lb)}>Print</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pagination page={meta.page} limit={meta.limit} total={meta.total} onChange={setPage} />

      {printItem && (
        <div id="logbook-print-root">
          <LogbookPrint logbook={printItem} title="Transport Trip Logbook" preparedByLabel="Transport Signature" />
          <div className="row-actions" style={{ margin: '12px 0' }}>
            <button className="btn btn-primary" onClick={() => window.print()}>Print Now</button>
            <button className="btn btn-ghost" onClick={() => setPrintItem(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
