import { useEffect, useState } from 'react';
import { logbooksApi } from '../../services/resources';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';
import LogbookPrint from '../../components/LogbookPrint';

const TABS = [
  { value: '', label: 'All' },
  { value: 'SUBMITTED', label: 'Awaiting Approval' },
  { value: 'VERIFIED', label: 'Verified' },
  { value: 'RETURNED', label: 'Returned' },
];

export default function OfficerLogbook() {
  const [logbooks, setLogbooks] = useState([]);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printItem, setPrintItem] = useState(null);
  const [decision, setDecision] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { page, limit: 10 };
      if (filter) params.status = filter;
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

  useEffect(() => { load(); }, [page, filter]);

  const submitDecision = async () => {
    if (!decision) return;
    if (decision.status === 'RETURNED' && !comment.trim()) {
      setError('A comment is required when returning a logbook.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await logbooksApi.verify(decision.id, decision.status, comment.trim());
      setDecision(null);
      setComment('');
      await load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit decision.');
    } finally {
      setBusy(false);
    }
  };

  if (loading && !logbooks.length) return <Loading />;

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <span className="eyebrow">OFFICER LOGBOOK</span>
          <h3>Trip Logbooks</h3>
          <p className="field-hint">Review and approve submitted logbooks for your trips.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => window.print()}>Print</button>
      </div>

      <div className="tab-bar" style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {TABS.map((t) => (
          <button
            key={t.value}
            className={`btn ${filter === t.value ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => { setFilter(t.value); setPage(1); }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="form-error">{error}</div>}

      {!logbooks.length ? (
        <div className="empty-state">No logbooks found.</div>
      ) : (
        logbooks.map((lb) => (
          <div key={lb.id} className="panel" style={{ marginBottom: 12 }} data-testid="logbook-row">
            <div className="panel-header">
              <div>
                <strong>{lb.tripName || lb.trip?.tripNumber || `Logbook #${lb.id}`}</strong>
                <div className="field-hint">
                  {lb.driver?.user?.fullName || '—'} · {lb.vehicle?.registrationNumber || '—'}
                  {lb.entryDate ? ` · ${String(lb.entryDate).slice(0, 10)}` : ''}
                </div>
              </div>
              <StatusBadge status={lb.status} />
            </div>
            <div className="detail-grid">
              <div><span className="field-label">Route</span><p>{lb.origin || '—'} → {lb.destination || '—'}</p></div>
              <div><span className="field-label">Start / End KM</span><p>{lb.startKm ?? '—'} / {lb.endKm ?? '—'}</p></div>
              <div><span className="field-label">Total KM</span><p>{lb.totalKm ?? '—'}</p></div>
              <div><span className="field-label">Fuel Used</span><p>{lb.fuelUsedLitres ?? '—'} L</p></div>
              <div><span className="field-label">Fuel Remaining</span><p>{lb.fuelRemaining ?? '—'} L</p></div>
              <div><span className="field-label">Trip Time</span><p>{lb.startTime ? new Date(lb.startTime).toLocaleString() : '—'} → {lb.endTime ? new Date(lb.endTime).toLocaleString() : '—'}</p></div>
            </div>
            {lb.status === 'SUBMITTED' && (
              <div className="row-actions">
                <button className="btn btn-primary" onClick={() => setDecision({ id: lb.id, status: 'VERIFIED' })} data-testid="approve-logbook">Approve Logbook</button>
                <button className="btn btn-ghost" onClick={() => setDecision({ id: lb.id, status: 'RETURNED' })}>Return</button>
              </div>
            )}
            {lb.verifiedAt && (
              <div className="field-hint" data-testid="logbook-approval-meta">
                {lb.status === 'VERIFIED' ? 'Officer Approved' : lb.status}
                {' · '}
                {lb.verifiedByUser?.fullName || lb.officer?.fullName || '—'}
                {' · '}
                {new Date(lb.verifiedAt).toLocaleString()}
                {lb.reviewComment ? ` · ${lb.reviewComment}` : ''}
              </div>
            )}
            <div className="row-actions" style={{ marginTop: 8 }}>
              <button className="btn btn-secondary" onClick={() => setPrintItem(lb)}>Print</button>
            </div>
          </div>
        ))
      )}

      <Pagination page={meta.page} limit={meta.limit} total={meta.total} onChange={setPage} />

      {printItem && (
        <div id="logbook-print-root">
          <LogbookPrint logbook={printItem} title="Officer Trip Logbook" preparedByLabel="Officer Signature" />
          <div className="row-actions" style={{ margin: '12px 0' }}>
            <button className="btn btn-primary" onClick={() => window.print()}>Print Now</button>
            <button className="btn btn-ghost" onClick={() => setPrintItem(null)}>Close</button>
          </div>
        </div>
      )}

      {decision && (
        <div className="modal open" role="dialog">
          <div className="modal-content">
            <h3>{decision.status === 'VERIFIED' ? 'Approve Logbook' : 'Return Logbook'}</h3>
            {decision.status === 'RETURNED' && (
              <>
                <label className="field-label">Comment *</label>
                <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
              </>
            )}
            <div className="row-actions" style={{ marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => { setDecision(null); setComment(''); }}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={submitDecision}>
                {busy ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
