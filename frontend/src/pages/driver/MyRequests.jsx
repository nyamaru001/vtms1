import { useCallback, useEffect, useState } from 'react';
import { tripsApi, fuelApi, statsApi } from '../../services/resources';
import Loading from '../../components/Loading';
import StatusBadge from '../../components/StatusBadge';
import Modal from '../../components/Modal';
import FuelVoucherPrint from '../../components/FuelVoucherPrint';

const fmtDateTime = (v) => (v ? new Date(v).toLocaleString() : '—');

export default function MyRequests() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [fuelRequests, setFuelRequests] = useState([]);
  const [tripsById, setTripsById] = useState({});
  const [stats, setStats] = useState({ total: 0, pending: 0, released: 0 });

  const [confirmItem, setConfirmItem] = useState(null);
  const [actualLitres, setActualLitres] = useState('');
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);

  const [voucherItem, setVoucherItem] = useState(null);
  const [voucherRecord, setVoucherRecord] = useState(null);

  const loadStats = useCallback(async () => {
    try {
      const response = await statsApi.get();
      setStats({
        total: response?.fuelTotal ?? 0,
        pending: response?.fuelPending ?? 0,
        released: response?.fuelReleased ?? 0,
      });
    } catch {
      setStats({ total: 0, pending: 0, released: 0 });
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const list = await fuelApi.list();
      setFuelRequests(Array.isArray(list) ? list : list?.data || []);
    } catch {
      setFuelRequests([]);
    }
  }, []);

  const loadTrips = useCallback(async () => {
    try {
      const response = await tripsApi.list();
      const all = Array.isArray(response)
        ? response
        : response?.data || response?.trips || [];
      setTripsById(
        all.reduce((acc, trip) => {
          acc[trip.id] = trip;
          return acc;
        }, {})
      );
    } catch {
      setTripsById({});
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      await Promise.all([loadRequests(), loadTrips(), loadStats()]);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load your fuel requests.');
    } finally {
      setLoading(false);
    }
  }, [loadRequests, loadTrips, loadStats]);

  useEffect(() => {
    load();
  }, [load]);

  const openConfirm = (item) => {
    setConfirmItem(item);
    setActualLitres(String(item?.litresReleased || item?.litresRequested || ''));
    setConfirmNotes('');
    setConfirmError('');
  };

  const closeConfirm = () => {
    if (confirmLoading) return;
    setConfirmItem(null);
    setActualLitres('');
    setConfirmNotes('');
    setConfirmError('');
  };

  const handleConfirm = async () => {
    setConfirmError('');
    if (!confirmItem?.id) {
      setConfirmError('Invalid fuel request.');
      return;
    }
    if (!actualLitres || Number(actualLitres) <= 0) {
      setConfirmError('Enter actual litres received.');
      return;
    }
    try {
      setConfirmLoading(true);
      await fuelApi.confirmReceipt(confirmItem.id, {
        actualLitresReceived: Number(actualLitres),
        notes: confirmNotes.trim(),
      });
      closeConfirm();
      await Promise.all([loadRequests(), loadStats()]);
      setSuccess('Fuel receipt confirmed.');
    } catch (err) {
      setConfirmError(err.response?.data?.message || 'Failed to confirm receipt.');
    } finally {
      setConfirmLoading(false);
    }
  };

  const buildVoucherRecord = (item) => {
    const itemTrip = item?.trip || tripsById[item?.tripId] || {};
    const itemRequest = itemTrip.request || {};
    const itemVehicle = itemTrip.vehicle || item?.vehicle || {};

    return {
      voucherNumber: item.voucherNumber,
      voucherStatus: item.voucherStatus,
      status: item.status,
      litresRequested: item.litresRequested,
      litresReleased: item.litresReleased,
      releasedAt: item.releasedAt || item.voucherIssuedAt,
      driverName: item?.driver?.user?.fullName || '—',
      officerName: itemTrip?.officer?.fullName || '—',
      issuedBy: item.releasedByUser?.fullName || '—',
      vehicleRegistration: itemVehicle.registrationNumber,
      vehicleModel: itemVehicle.model,
      vehicleType: itemVehicle.type,
      fuelType: itemVehicle.fuelType,
      tripNumber: itemTrip.tripNumber,
      requestNumber: itemRequest.requestNumber,
      origin: itemRequest.originName,
      destination: itemRequest.destinationName,
      purpose: itemRequest.purpose,
      routeId: itemTrip.tripNumber || itemRequest.requestNumber || '—',
      currentKm: item.currentKm,
      date: item.releasedAt || item.createdAt,
      requestType: item.requestType || 'NORMAL',
      emergencyReason: item.emergencyReason || null,
    };
  };

  const printVoucher = (item) => {
    setVoucherRecord(buildVoucherRecord(item));
    setVoucherItem(item);
    setTimeout(() => window.print(), 150);
  };

  const downloadVoucher = (item) => {
    const record = buildVoucherRecord(item);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(generateVoucherHTML(record));
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 200);
  };

  if (loading) return <Loading label="Loading My Requests..." />;

  const latestFuel = [...fuelRequests].reverse()[0] || null;

  const getStatusLabel = (status) => {
    const labels = {
      PENDING: 'Pending',
      HPMU_REVIEW: 'Under Review',
      HPMU_APPROVED: 'Approved',
      HPMU_REJECTED: 'Rejected',
      HPMU_RETURNED: 'Returned',
      HPMU_RELEASED: 'Released',
      DRIVER_CONFIRMED: 'Received',
      COMPLETED: 'Completed',
    };
    return labels[status] || status;
  };

  const getStatusClass = (status) => {
    if (status === 'HPMU_RELEASED' || status === 'DRIVER_CONFIRMED' || status === 'COMPLETED') return 'status-success';
    if (status === 'HPMU_REVIEW') return 'status-pending';
    if (status === 'HPMU_APPROVED') return 'status-approved';
    if (status === 'HPMU_REJECTED') return 'status-rejected';
    if (status === 'HPMU_RETURNED') return 'status-returned';
    if (status === 'PENDING') return 'status-pending';
    return 'status-default';
  };

  return (
    <>
      <div className="my-requests-page" data-testid="my-requests-page">
        <header className="page-header">
          <div className="header-content">
            <span className="eyebrow">DRIVER PORTAL</span>
            <h1>My Requests</h1>
            <p className="header-subtitle">View and manage your submitted fuel requests</p>
          </div>
          {latestFuel && (
            <span className={`status-badge ${getStatusClass(latestFuel.status)}`}>
              {getStatusLabel(latestFuel.status)}
              {latestFuel.requestType === 'EMERGENCY' && ' · Emergency'}
            </span>
          )}
        </header>

        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="stat-grid stats-3" data-testid="driver-request-stats">
          <div className="stat-card">
            <span className="stat-icon">📋</span>
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Requests</span>
          </div>
          <div className="stat-card accent">
            <span className="stat-icon">⏳</span>
            <span className="stat-value">{stats.pending}</span>
            <span className="stat-label">Pending</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">⛽</span>
            <span className="stat-value">{stats.released}</span>
            <span className="stat-label">Released</span>
          </div>
        </div>

        <section className="section-card" data-testid="fuel-history-section">
          <div className="section-header">
            <div className="section-header-left">
              <div>
                <h2>Fuel Request History</h2>
                <p className="section-subtitle">All fuel requests you have submitted</p>
              </div>
            </div>
          </div>

          {fuelRequests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">⛽</div>
              <h3>No fuel requests yet</h3>
              <p>Submit a fuel request from the Request Fuel page.</p>
            </div>
          ) : (
            <div className="requests-table-wrap">
              <table className="requests-table">
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Trip ID</th>
                    <th>Vehicle</th>
                    <th>Fuel Type</th>
                    <th>Requested</th>
                    <th>Approved</th>
                    <th>Voucher</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fuelRequests.map((fr) => {
                    const frTrip = fr.trip || tripsById[fr.tripId] || {};
                    const frVehicle = frTrip.vehicle || fr.vehicle || {};

                    return (
                      <tr key={fr.id}>
                        <td><code>#{fr.id}</code></td>
                        <td>{fmtDateTime(fr.createdAt)}</td>
                        <td>
                          <span className={`type-badge ${fr.requestType === 'EMERGENCY' ? 'emergency' : 'normal'}`}>
                            {fr.requestType === 'EMERGENCY' ? 'Emergency' : 'Normal'}
                          </span>
                        </td>
                        <td>{frTrip.tripNumber || fr.tripId || '—'}</td>
                        <td>{frVehicle.registrationNumber || '—'}</td>
                        <td>{frVehicle.fuelType || '—'}</td>
                        <td>{fr.litresRequested} L</td>
                        <td>{fr.litresReleased ?? '—'} L</td>
                        <td>
                          {fr.voucherNumber ? (
                            <code className="voucher-cell" data-testid={`voucher-${fr.id}`}>
                              {fr.voucherNumber}
                            </code>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <StatusBadge status={fr.status} />
                        </td>
                        <td>
                          <div className="action-buttons">
                            {fr.voucherNumber && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-ghost"
                                  onClick={() => printVoucher(fr)}
                                  data-testid={`print-voucher-${fr.id}`}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                    <path d="M6 18H4a2 2 0 0 1-2-2v-5"></path>
                                    <path d="M18 18h2a2 2 0 0 0 2-2v-5"></path>
                                    <line x1="12" y1="9" x2="12" y2="15"></line>
                                  </svg>
                                  Print
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => downloadVoucher(fr)}
                                  data-testid={`download-voucher-${fr.id}`}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                    <polyline points="7 10 12 15 17 10"></polyline>
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                  Download
                                </button>
                              </>
                            )}
                            {fr.status === 'HPMU_RELEASED' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => openConfirm(fr)}
                                data-testid={`confirm-receipt-${fr.id}`}
                              >
                                Confirm Receipt
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {voucherItem && voucherRecord && (
          <div id="fuel-voucher-print-root" className="print-only">
            <FuelVoucherPrint voucher={voucherRecord} />
          </div>
        )}
      </div>

      {confirmItem && (
        <Modal
          open={!!confirmItem}
          title="Confirm Fuel Receipt"
          onClose={closeConfirm}
          footer={
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeConfirm}
                disabled={confirmLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={confirmLoading}
              >
                {confirmLoading ? 'Confirming...' : 'Confirm Receipt'}
              </button>
            </div>
          }
        >
          <div className="modal-body">
            {confirmError && <div className="alert alert-error">{confirmError}</div>}
            <div className="confirm-field">
              <label className="form-label">Voucher Number</label>
              <div className="input input-readonly">{confirmItem.voucherNumber || '—'}</div>
            </div>
            <div className="confirm-field">
              <label className="form-label">Litres Released by HPMU</label>
              <div className="input input-readonly">{confirmItem.litresReleased ?? '—'} L</div>
            </div>
            <div className="confirm-field">
              <label className="form-label">Actual Litres Received <span className="required">*</span></label>
              <input
                className="input"
                type="number"
                min="0.1"
                step="0.1"
                value={actualLitres}
                onChange={(e) => setActualLitres(e.target.value)}
                disabled={confirmLoading}
              />
            </div>
            <div className="confirm-field">
              <label className="form-label">Notes (optional)</label>
              <textarea
                className="input"
                rows="3"
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                disabled={confirmLoading}
              />
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function generateVoucherHTML(voucher) {
  if (!voucher) return '';
  const isEmergency = voucher.requestType === 'EMERGENCY';
  const fmt = (v) => (v ? new Date(v).toLocaleString() : '—');
  const route = [voucher.origin, voucher.destination].filter(Boolean).join(' → ');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fuel Voucher - ${voucher.voucherNumber || 'Voucher'}</title>
  <style>
    @media print {
      @page { size: A4; margin: 15mm; }
      body { margin: 0; padding: 20mm; }
      .no-print { display: none !important; }
    }
    body { font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', monospace; max-width: 720px; margin: 0 auto; padding: 20px; color: #111; line-height: 1.5; font-size: 12px; }
    .voucher-header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #111; }
    .voucher-title-row { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 12px; flex-wrap: wrap; }
    .voucher-brand { display: flex; align-items: center; gap: 12px; }
    .brand-icon { width: 48px; height: 48px; border-radius: 10px; background: #111; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; letter-spacing: 0.05em; }
    .brand-text { text-align: left; }
    .brand-text strong { display: block; font-size: 14px; font-weight: 700; line-height: 1.2; }
    .brand-text span { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 0.08em; }
    .emergency-badge { padding: 6px 14px; background: #dc2626; color: white; font-size: 11px; font-weight: 700; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.06em; }
    .voucher-meta { display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 11px; color: #555; flex-wrap: wrap; }
    .status-badge { padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .status-badge.approved { background: #d1fae5; color: #065f46; }
    .status-badge.used { background: #e5e7eb; color: #374151; }
    .status-badge.pending { background: #fef3c7; color: #92400e; }
    .voucher-token-section { text-align: center; margin: 28px 0; padding: 20px; background: #f8fafc; border: 2px dashed #d1d5db; border-radius: 12px; }
    .token-label { display: block; font-size: 10px; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 10px; }
    .token-value { display: inline-block; font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', monospace; font-size: 24px; font-weight: 800; letter-spacing: 0.08em; color: #111; padding: 8px 16px; background: white; border: 2px solid #111; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .voucher-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
    .voucher-table td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .voucher-table td.label { width: 35%; font-weight: 600; color: #374151; padding-right: 16px; }
    .voucher-table td:last-child { font-weight: 500; color: #111; word-break: break-word; }
    .voucher-signatures { display: flex; gap: 40px; margin: 32px 0 24px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
    .signature-block { flex: 1; text-align: center; }
    .signature-line { border-top: 1px solid #111; margin-bottom: 8px; min-height: 40px; }
    .signature-block span { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.06em; }
    .voucher-footer { text-align: center; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 10px; }
    .voucher-footer p { margin: 4px 0; }
  </style>
</head>
<body>
  <div class="fuel-voucher-print">
    <div class="voucher-header">
      <div class="voucher-title-row">
        <div class="voucher-brand">
          <div class="brand-icon">VTMS</div>
          <div class="brand-text">
            <strong>Vehicle & Transport Management System</strong>
            <span>Official Fuel Voucher</span>
          </div>
        </div>
        ${isEmergency ? '<span class="emergency-badge">EMERGENCY FUEL</span>' : ''}
      </div>
      <div class="voucher-meta">
        <span>Issued by ${voucher.issuedBy && voucher.issuedBy !== '—' ? voucher.issuedBy : 'HPMU'}</span>
        <span>${fmt(voucher.date)}</span>
        <span class="status-badge ${voucher.voucherStatus?.toLowerCase()}">${voucher.voucherStatus || '—'}</span>
      </div>
    </div>

    <div class="voucher-token-section">
      <div class="token-label">FUEL VOUCHER TOKEN</div>
      <div class="token-value">${voucher.voucherNumber || '—'}</div>
    </div>

    <table class="voucher-table">
      <tbody>
        <tr><td class="label">Request Type</td><td>${isEmergency ? 'Emergency Fuel Request' : 'Normal Fuel Request'}</td></tr>
        ${isEmergency && voucher.emergencyReason ? `<tr><td class="label">Emergency Reason</td><td>${voucher.emergencyReason}</td></tr>` : ''}
        <tr><td class="label">Fuel Approved (L)</td><td>${voucher.litresReleased ?? voucher.litresRequested}</td></tr>
        <tr><td class="label">Fuel Type</td><td>${voucher.fuelType}</td></tr>
        <tr><td class="label">Date Issued</td><td>${fmt(voucher.date || voucher.releasedAt)}</td></tr>
        <tr><td class="label">Current Odometer (KM)</td><td>${voucher.currentKm}</td></tr>
      </tbody>
    </table>

    <table class="voucher-table">
      <tbody>
        <tr><td class="label">Driver</td><td>${voucher.driverName}</td></tr>
        <tr><td class="label">Officer</td><td>${voucher.officerName}</td></tr>
        <tr><td class="label">Vehicle / Registration</td><td>${voucher.vehicleRegistration || '—'}${voucher.vehicleModel ? ` — ${voucher.vehicleModel}` : ''}</td></tr>
        <tr><td class="label">Vehicle Type</td><td>${voucher.vehicleType}</td></tr>
        <tr><td class="label">Trip ID / Route</td><td>${voucher.routeId || voucher.tripNumber}</td></tr>
        <tr><td class="label">Request Number</td><td>${voucher.requestNumber}</td></tr>
        <tr><td class="label">Route</td><td>${route || '—'}</td></tr>
        <tr><td class="label">Purpose</td><td>${voucher.purpose}</td></tr>
      </tbody>
    </table>

    <div class="voucher-signatures">
      <div class="signature-block">
        <div class="signature-line"></div>
        <span>HPMU Signature & Date</span>
      </div>
      <div class="signature-block">
        <div class="signature-line"></div>
        <span>Driver Signature & Date</span>
      </div>
    </div>

    <div class="voucher-footer">
      <p>This voucher is valid for fuel collection at authorized stations only.</p>
      <p>Token: ${voucher.voucherNumber || '—'}</p>
    </div>
  </div>
</body>
</html>
  `;
}
