/**
 * Printable fuel voucher issued by HPMU.
 * This component is designed to be printed ONLY - it uses print-specific CSS
 * to hide everything except the voucher when printing.
 */
export default function FuelVoucherPrint({ voucher }) {
  if (!voucher) return null;

  const row = (label, value) => (
    <tr>
      <td className="label">{label}</td>
      <td>{value ?? '—'}</td>
    </tr>
  );

  const fmt = (v) => (v ? new Date(v).toLocaleString() : '—');
  const route = [voucher.origin, voucher.destination].filter(Boolean).join(' → ');
  const isEmergency = voucher.requestType === 'EMERGENCY';

  return (
    <div className="fuel-voucher-print">
      <div className="voucher-header">
        <div className="voucher-title-row">
          <div className="voucher-brand">
            <div className="brand-icon">VTMS</div>
            <div className="brand-text">
              <strong>Vehicle & Transport Management System</strong>
              <span>Official Fuel Voucher</span>
            </div>
          </div>
          {isEmergency && <span className="emergency-badge">EMERGENCY FUEL</span>}
        </div>
        <div className="voucher-meta">
          <span>Issued by HPMU</span>
          <span>{fmt(voucher.date)}</span>
          <span className={`status-badge ${voucher.voucherStatus?.toLowerCase()}`}>
            {voucher.voucherStatus || '—'}
          </span>
        </div>
      </div>

      <div className="voucher-token-section">
        <div className="token-label">FUEL VOUCHER TOKEN</div>
        <div className="token-value" data-testid="printed-voucher-token">
          {voucher.voucherNumber || '—'}
        </div>
      </div>

      <table className="voucher-table">
        <tbody>
          {row('Request Type', isEmergency ? 'Emergency Fuel Request' : 'Normal Fuel Request')}
          {isEmergency && voucher.emergencyReason && row('Emergency Reason', voucher.emergencyReason)}
          {row('Fuel Requested (L)', voucher.litresRequested ?? '—')}
{row('Fuel Issued (L)', voucher.litresReleased ?? '—')}
          {row('Fuel Type', voucher.fuelType)}
          {row('Date Issued', fmt(voucher.date || voucher.releasedAt))}
          {row('Current Odometer (KM)', voucher.currentKm)}
        </tbody>
      </table>

      <table className="voucher-table">
        <tbody>
          {row('Driver', voucher.driverName)}
          {row('Officer', voucher.officerName)}
          {row('Vehicle / Registration', `${voucher.vehicleRegistration || '—'}${voucher.vehicleModel ? ` — ${voucher.vehicleModel}` : ''}`)}
          {row('Vehicle Type', voucher.vehicleType)}
          {row('Trip ID / Route', voucher.routeId || voucher.tripNumber)}
          {row('Request Number', voucher.requestNumber)}
          {row('Route', route || '—')}
          {row('Purpose', voucher.purpose)}
        </tbody>
      </table>

      <div className="voucher-signatures">
        <div className="signature-block">
          <div className="signature-line" />
          <span>HPMU Signature & Date</span>
        </div>
        <div className="signature-block">
          <div className="signature-line" />
          <span>Driver Signature & Date</span>
        </div>
      </div>

      <div className="voucher-footer">
        <p>This voucher is valid for fuel collection at authorized stations only.</p>
        <p>Token: {voucher.voucherNumber || '—'}</p>
      </div>
    </div>
  );
}