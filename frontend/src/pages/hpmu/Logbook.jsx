import { useEffect, useState } from 'react';
import { logbooksApi, fuelApi, hpmuApi } from '../../services/resources';
import StatusBadge from '../../components/StatusBadge';
import Loading from '../../components/Loading';
import Pagination from '../../components/Pagination';

function mergeRecords(logbooks, fuelIssues, fuelRequests) {
  const issueByTrip = new Map();
  (fuelIssues || []).forEach((i) => {
    if (i.tripId != null) issueByTrip.set(String(i.tripId), i);
  });
  const reqByTrip = new Map();
  (fuelRequests || []).forEach((r) => {
    if (r.tripId != null) reqByTrip.set(String(r.tripId), r);
  });

  const fromLogbooks = (logbooks || []).map((lb) => {
    const issue = lb.tripId != null ? issueByTrip.get(String(lb.tripId)) : null;
    const fuelReq = lb.tripId != null ? reqByTrip.get(String(lb.tripId)) : null;
    return {
      key: `lb-${lb.id}`,
      date: lb.entryDate || issue?.issuedAt || lb.createdAt,
      routeId: lb.tripName || lb.trip?.tripNumber || fuelReq?.trip?.tripNumber || '—',
      origin: lb.origin || lb.trip?.request?.originName || '—',
      destination: lb.destination || lb.trip?.request?.destinationName || '—',
      vehicle: lb.vehicle?.registrationNumber || lb.vehicleRegistration || issue?.vehicle?.registrationNumber || '—',
      vehicleModel: lb.vehicle?.model || issue?.vehicle?.model || lb.carType || '',
      driver: lb.driver?.user?.fullName || issue?.driver?.user?.fullName || '—',
      fuelIssued: lb.fuelIssuedLitres ?? issue?.litresIssued ?? fuelReq?.litresReleased ?? '—',
      fuelRemaining: lb.fuelRemaining ?? '—',
      voucherNumber: fuelReq?.voucherNumber || null,
      voucherStatus: fuelReq?.voucherStatus || null,
      status: lb.status || '—',
      source: 'logbook',
      raw: lb,
    };
  });

  const logbookTripIds = new Set(
    (logbooks || []).filter((lb) => lb.tripId != null).map((lb) => String(lb.tripId))
  );

  const fromIssuesOnly = (fuelIssues || [])
    .filter((i) => i.tripId == null || !logbookTripIds.has(String(i.tripId)))
    .map((i) => {
      const fuelReq = i.fuelRequestId
        ? (fuelRequests || []).find((r) => r.id === i.fuelRequestId)
        : null;
      return {
        key: `fi-${i.id}`,
        date: i.issuedAt,
        routeId: i.trip?.tripNumber || fuelReq?.trip?.tripNumber || '—',
        origin: fuelReq?.trip?.request?.originName || '—',
        destination: fuelReq?.trip?.request?.destinationName || '—',
        vehicle: i.vehicle?.registrationNumber || '—',
        vehicleModel: i.vehicle?.model || '',
        driver: i.driver?.user?.fullName || '—',
        fuelIssued: i.litresIssued ?? '—',
        fuelRemaining: '—',
        voucherNumber: fuelReq?.voucherNumber || null,
        voucherStatus: fuelReq?.voucherStatus || null,
        status: 'HPMU_RELEASED',
        source: 'issue',
        raw: i,
      };
    });

  return [...fromLogbooks, ...fromIssuesOnly].sort(
    (a, b) => new Date(b.date || 0) - new Date(a.date || 0)
  );
}

export default function HPMULogbook() {
  const [records, setRecords] = useState([]);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, limit: 10, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [printItem, setPrintItem] = useState(null);
  const [printAll, setPrintAll] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { page: 1, limit: 200 };
      if (status) params.status = status;
      const [lbRes, issues, fuelList] = await Promise.all([
        logbooksApi.list(params).catch(() => ({ data: [] })),
        hpmuApi.fuelLogbook().catch(() => []),
        fuelApi.list({ limit: 200 }).catch(() => ({ data: [] })),
      ]);
      const logbooks = Array.isArray(lbRes) ? lbRes : lbRes?.data || [];
      const fuelRequests = Array.isArray(fuelList) ? fuelList : fuelList?.data || [];
      let merged = mergeRecords(logbooks, issues, fuelRequests);
      if (status) {
        merged = merged.filter((r) => String(r.status).toUpperCase() === status);
      }
      setRecords(merged);
      setMeta({ page: 1, limit: 10, total: merged.length });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load logbooks.');
      setRecords([]);
      setMeta({ page: 1, limit: 10, total: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const paged = records.slice((page - 1) * 10, page * 10);

  const handlePrint = (item) => {
    setPrintAll(false);
    setPrintItem(item);
    setTimeout(() => window.print(), 100);
  };

  const handlePrintAll = () => {
    setPrintItem(null);
    setPrintAll(true);
    setTimeout(() => window.print(), 100);
  };

  const fmtDate = (v) => (v ? String(v).slice(0, 10) : '—');

  if (loading && !records.length) return <Loading />;

  return (
    <div className="panel" data-testid="hpmu-logbook">
      <div className="panel-header">
        <div>
          <span className="eyebrow">HPMU LOGBOOK</span>
          <h3>Automatic Trip & Fuel Logbook</h3>
          <p className="field-hint">
            Built automatically from driver logbooks and HPMU fuel releases. Vehicle · Driver · Route ·
            Fuel · Voucher · Status.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className="input select-inline"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="VERIFIED">Verified</option>
            <option value="RETURNED">Returned</option>
            <option value="HPMU_RELEASED">Fuel Released</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={handlePrintAll} data-testid="print-all-logbook">
            Print All
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      {!records.length ? (
        <div className="empty-state">No automatic logbook records yet.</div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Route ID</th>
              <th>Route</th>
              <th>Vehicle</th>
              <th>Driver</th>
              <th>Fuel (L)</th>
              <th>Voucher</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((row) => (
              <tr key={row.key} data-testid="logbook-row">
                <td>{fmtDate(row.date)}</td>
                <td data-testid="route-id">{row.routeId}</td>
                <td>
                  {row.origin} → {row.destination}
                </td>
                <td>
                  {row.vehicle}
                  {row.vehicleModel ? ` (${row.vehicleModel})` : ''}
                </td>
                <td>{row.driver}</td>
                <td>{row.fuelIssued}</td>
                <td data-testid="voucher-cell">{row.voucherNumber || '—'}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => handlePrint(row)}>
                    Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Pagination
        page={meta.page}
        limit={meta.limit}
        total={meta.total}
        onChange={setPage}
      />

      {printItem && (
        <div id="logbook-print-root">
          <div className="print-sheet" data-testid="hpmu-print-sheet">
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, margin: 0 }}>HPMU Automatic Logbook</h2>
              <p style={{ fontSize: 11, margin: '4px 0' }}>
                Vehicle · Driver · Route · Fuel · Voucher · Status
              </p>
            </div>
            <table className="print-table" style={{ fontSize: 11 }}>
              <tbody>
                <tr>
                  <th style={{ width: 150 }}>Date</th>
                  <td>{fmtDate(printItem.date)}</td>
                </tr>
                <tr>
                  <th>Route ID</th>
                  <td>{printItem.routeId}</td>
                </tr>
                <tr>
                  <th>Route</th>
                  <td>
                    {printItem.origin} → {printItem.destination}
                  </td>
                </tr>
                <tr>
                  <th>Vehicle</th>
                  <td>
                    {printItem.vehicle}
                    {printItem.vehicleModel ? ` — ${printItem.vehicleModel}` : ''}
                  </td>
                </tr>
                <tr>
                  <th>Driver</th>
                  <td>{printItem.driver}</td>
                </tr>
                <tr>
                  <th>Fuel Issued (L)</th>
                  <td>{printItem.fuelIssued}</td>
                </tr>
                <tr>
                  <th>Fuel Remaining (L)</th>
                  <td>{printItem.fuelRemaining}</td>
                </tr>
                <tr>
                  <th>Fuel Voucher</th>
                  <td>{printItem.voucherNumber || '—'}</td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>{printItem.status}</td>
                </tr>
              </tbody>
            </table>
            <div className="print-signature" style={{ marginTop: 28 }}>
              <div>
                <div className="signature-line" />
                <span>HPMU Signature</span>
              </div>
              <div>
                <div className="signature-line" />
                <span>Date</span>
              </div>
            </div>
          </div>
          <div className="row-actions" style={{ margin: '12px 0' }}>
            <button className="btn btn-primary" onClick={() => window.print()}>
              Print Now
            </button>
            <button className="btn btn-ghost" onClick={() => setPrintItem(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {printAll && (
        <div id="logbook-print-root">
          <div className="print-sheet">
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <h2 style={{ fontSize: 15, margin: 0 }}>HPMU Automatic Logbook — All Records</h2>
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Route ID</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Fuel (L)</th>
                  <th>Voucher</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {records.map((row) => (
                  <tr key={row.key}>
                    <td>{fmtDate(row.date)}</td>
                    <td>{row.routeId}</td>
                    <td>{row.vehicle}</td>
                    <td>{row.driver}</td>
                    <td>{row.fuelIssued}</td>
                    <td>{row.voucherNumber || '—'}</td>
                    <td>{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row-actions" style={{ margin: '12px 0' }}>
            <button className="btn btn-primary" onClick={() => window.print()}>
              Print Now
            </button>
            <button className="btn btn-ghost" onClick={() => setPrintAll(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
