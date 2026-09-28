import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { hpmuApi } from '../../services/resources';
import Loading from '../../components/Loading';
import StatusBadge from '../../components/StatusBadge';
import Pagination from '../../components/Pagination';
import Modal from '../../components/Modal';

const PAGE_LIMIT = 15;

const fmtDate = (v) => (v ? new Date(v).toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
}) : '—');

const printRow = (label, value) => (
  <tr>
    <td className="label">{label}</td>
    <td>{value ?? '—'}</td>
  </tr>
);

/**
 * HPMU FUEL LOGBOOK
 * Every row is read automatically from released fuel requests — HPMU never
 * types logbook values by hand. No odometer, trip times, fuel consumed or
 * "fuel received from HPMU" columns: this is a fuel issue log only.
 */
export default function FuelIssueLogbook() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [viewRow, setViewRow] = useState(null);
  const [showPrint, setShowPrint] = useState(false);
  const printFired = useRef(false);

  const load = useCallback(async () => {
    try {
      setError('');
      const data = await hpmuApi.fuelLogbook();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load the fuel logbook.');
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const list = rows || [];
    const d = driverFilter.trim().toLowerCase();
    const v = vehicleFilter.trim().toLowerCase();
    return list.filter((r) => {
      if (d && !String(r.driverName || '').toLowerCase().includes(d)) return false;
      if (v && !String(r.vehicleRegistration || '').toLowerCase().includes(v)) return false;
      return true;
    });
  }, [rows, driverFilter, vehicleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_LIMIT));
  const paged = filtered.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);

  const handlePrint = () => {
    printFired.current = false;
    setShowPrint(true);
    setTimeout(() => {
      if (!printFired.current) {
        printFired.current = true;
        window.print();
      }
    }, 200);
  };

  if (!rows) return <Loading label="Loading fuel logbook..." />;

  return (
    <div className="page-stack">
      <section className="page-hero compact">
        <div>
          <span className="eyebrow">HPMU CONTROL</span>
          <h1>Fuel Logbook</h1>
          <p>
            Automatically populated from released fuel requests. Voucher numbers, vehicles,
            drivers, distances and fuel issued are read from the database.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }} className="no-print">
          <button type="button" className="btn btn-light-outline" onClick={load}>↻ Refresh</button>
          <button type="button" className="btn btn-primary" onClick={handlePrint} data-testid="print-fuel-logbook">
            Print Fuel Logbook
          </button>
        </div>
      </section>

      {error && <div className="alert alert-error no-print">{error}</div>}

      {showPrint && (
        <div id="fuel-logbook-print-root">
          <div className="print-sheet" id="fuel-logbook-print-sheet">
            <div className="print-header">
              <h2>Vehicle &amp; Transport Management System</h2>
              <h3>HPMU Fuel Logbook</h3>
              <p className="print-sub">
                {filtered.length} record{filtered.length === 1 ? '' : 's'} · Printed{' '}
                {new Date().toLocaleString()}
              </p>
            </div>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher No.</th>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Vehicle Type</th>
                  <th>Trip / Route</th>
                  <th>Distance</th>
                  <th>Fuel Type</th>
                  <th>Fuel Issued</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{fmtDate(r.date)}</td>
                    <td>{r.voucherNumber || '—'}</td>
                    <td>{r.vehicleRegistration || '—'}</td>
                    <td>{r.driverName || '—'}</td>
                    <td>{r.vehicleType || '—'}</td>
                    <td>{r.tripNumber || r.requestNumber || '—'}{r.route ? ` · ${r.route}` : ''}</td>
                    <td>{r.distanceKm != null ? `${r.distanceKm} KM` : '—'}</td>
                    <td>{r.fuelType || '—'}</td>
                    <td>{r.fuelIssued != null ? `${r.fuelIssued} L` : '—'}</td>
                    <td>{r.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="print-signature">
              <div className="signature-block">
                <div className="signature-line" />
                <span>HPMU Signature &amp; Date</span>
              </div>
              <div className="signature-block">
                <div className="signature-line" />
                <span>Transport Officer Signature &amp; Date</span>
              </div>
            </div>
          </div>
          <div className="row-actions no-print" style={{ margin: '12px 0' }}>
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print Now</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowPrint(false)}>Close</button>
          </div>
        </div>
      )}

      <section className="panel no-print">
        <div className="panel-header">
          <div>
            <span className="eyebrow">AUTO-POPULATED</span>
            <h3>{filtered.length} fuel logbook record{filtered.length === 1 ? '' : 's'}</h3>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '0 16px 12px' }}>
          <div>
            <label className="field-label">Driver</label>
            <input
              className="input"
              value={driverFilter}
              onChange={(e) => { setDriverFilter(e.target.value); setPage(1); }}
              placeholder="Search driver..."
            />
          </div>
          <div>
            <label className="field-label">Vehicle</label>
            <input
              className="input"
              value={vehicleFilter}
              onChange={(e) => { setVehicleFilter(e.target.value); setPage(1); }}
              placeholder="Search registration..."
            />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
<thead>
               <tr>
                 <th>Date</th>
                 <th>Voucher No.</th>
                 <th>Vehicle</th>
                 <th>Driver</th>
                 <th>Vehicle Type</th>
                 <th>Trip / Route</th>
                 <th>Distance</th>
                 <th>Fuel Type</th>
                 <th>Fuel Issued</th>
                 <th>Type</th>
                 <th>Status</th>
                 <th>Actions</th>
               </tr>
             </thead>
             <tbody>
               {paged.map((r) => (
                 <tr key={r.id}>
                   <td>{fmtDate(r.date)}</td>
                   <td>{r.voucherNumber || '—'}</td>
                   <td>{r.vehicleRegistration || '—'}</td>
                   <td>{r.driverName || '—'}</td>
                   <td>{r.vehicleType || '—'}</td>
                   <td>
                     {r.tripNumber || r.requestNumber || '—'}
                     {r.route ? <div className="field-hint">{r.route}</div> : null}
                   </td>
                   <td>{r.distanceKm != null ? `${r.distanceKm} KM` : '—'}</td>
                   <td>{r.fuelType || '—'}</td>
                   <td>{r.fuelIssued != null ? `${r.fuelIssued} L` : '—'}</td>
                   <td>
                     {r.requestType === 'EMERGENCY' && (
                       <span className="status-badge status-emergency" style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>
                         Emergency
                       </span>
                     )}
                     {r.requestType === 'NORMAL' && (
                       <span style={{ color: '#64748b', fontSize: 12 }}>Normal</span>
                     )}
                   </td>
                   <td><StatusBadge status={r.status} /></td>
                   <td style={{ whiteSpace: 'nowrap' }}>
                     <button type="button" className="link-btn" onClick={() => setViewRow(r)}>View</button>
                     {' '}
                     <button type="button" className="link-btn" onClick={handlePrint}>Print</button>
                   </td>
                 </tr>
               ))}
               {paged.length === 0 && (
                 <tr>
                   <td colSpan={12} className="empty-cell">
                     No fuel releases recorded yet. Released fuel appears here automatically.
                   </td>
                 </tr>
               )}
             </tbody>
          </table>
        </div>

        <Pagination page={page} limit={PAGE_LIMIT} total={filtered.length} onChange={setPage} />
      </section>

      <Modal
        open={!!viewRow}
        title={viewRow ? `Fuel Logbook #${viewRow.id}` : 'Fuel Logbook'}
        onClose={() => setViewRow(null)}
        footer={(
          <button type="button" className="btn btn-ghost" onClick={() => setViewRow(null)}>Close</button>
        )}
      >
        {viewRow && (
          <table className="print-table" style={{ marginBottom: 0 }}>
            <tbody>
              {printRow('Date', fmtDate(viewRow.date))}
              {printRow('Voucher No.', viewRow.voucherNumber || '—')}
              {printRow('Voucher Status', viewRow.voucherStatus || '—')}
              {printRow('Vehicle', viewRow.vehicleRegistration || '—')}
              {printRow('Vehicle Model', viewRow.vehicleModel || '—')}
              {printRow('Vehicle Type', viewRow.vehicleType || '—')}
              {printRow('Driver', viewRow.driverName || '—')}
              {printRow('Trip / Route', [viewRow.tripNumber, viewRow.route].filter(Boolean).join(' · ') || '—')}
              {printRow('Purpose', viewRow.purpose || '—')}
              {printRow('Distance', viewRow.distanceKm != null ? `${viewRow.distanceKm} KM` : '—')}
              {printRow('Fuel Type', viewRow.fuelType || '—')}
              {printRow('Fuel Issued', viewRow.fuelIssued != null ? `${viewRow.fuelIssued} L` : '—')}
              {printRow('Request Type', viewRow.requestType === 'EMERGENCY' ? 'Emergency' : 'Normal')}
              {viewRow.requestType === 'EMERGENCY' && viewRow.emergencyReason && printRow('Emergency Reason', viewRow.emergencyReason)}
              {printRow('Status', viewRow.status || '—')}
              {printRow('Released By', viewRow.releasedBy || '—')}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  );
}
