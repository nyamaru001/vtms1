/**
 * Printable logbook layout. Receives a single selected logbook record
 * (from the database) and renders only those exact saved values.
 * Signature areas are blank lines for physical signing — no digital signature.
 */
export default function LogbookPrint({ logbook, title = 'Vehicle Trip Logbook', preparedByLabel = 'Driver Signature' }) {
  if (!logbook) return null;

  const row = (label, value) => (
    <tr>
      <td className="label">{label}</td>
      <td>{value ?? '—'}</td>
    </tr>
  );

  const fmtTime = (v) => (v ? new Date(v).toLocaleString() : '—');
  const fmtDate = (v) => (v ? String(v).slice(0, 10) : '—');
  const vehicleLabel = logbook.vehicleRegistration
    || (logbook.vehicle ? `${logbook.vehicle.registrationNumber}${logbook.vehicle.model ? ` — ${logbook.vehicle.model}` : ''}` : '—');

  const sectionTitle = (text) => (
    <h4 style={{ margin: '16px 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {text}
    </h4>
  );

  const driverName = logbook.driver?.user?.fullName || logbook.driver?.fullName || '—';
  const officerName =
    logbook.verifiedByUser?.fullName || logbook.officer?.fullName || logbook.officerName || '—';

  const isEmergency = logbook.requestType === 'EMERGENCY';

  return (
    <div className="print-sheet" id="logbook-print-sheet">
      <div className="print-header">
        <h2>Vehicle & Transport Management System</h2>
        <h3>{title} {isEmergency ? '<span style="color:#dc2626; font-size:16px;">[EMERGENCY FUEL]</span>' : ''}</h3>
        <p className="print-sub">
          Logbook Reference: {logbook.id ? `#${logbook.id}` : '—'}
          {' · '}
          Date: {fmtDate(logbook.entryDate)}
          {' · '}
          Status: {logbook.status === 'NOT STARTED' ? 'DRAFT' : (logbook.status || '—')}
        </p>
      </div>

      {sectionTitle('Main Information')}
      <table className="print-table">
        <tbody>
          {row('Driver', driverName)}
          {row('Officer', officerName)}
          {row('Vehicle / Registration', vehicleLabel)}
          {row('Vehicle Type', logbook.carType || logbook.vehicle?.type)}
          {row('Route ID / Trip Reference', logbook.tripName || logbook.trip?.tripNumber)}
          {row('Request Number', logbook.trip?.request?.requestNumber)}
          {row('Route From', logbook.origin)}
          {row('Route To', logbook.destination)}
          {row('Purpose', logbook.purpose)}
        </tbody>
      </table>

      {sectionTitle('Trip Information')}
      <table className="print-table">
        <tbody>
          {row('Start Time', fmtTime(logbook.startTime))}
          {row('End Time', fmtTime(logbook.endTime))}
          {row('Starting Odometer (KM)', logbook.startKm)}
          {row('Ending Odometer (KM)', logbook.endKm)}
          {row('Distance / KM', logbook.totalKm)}
          {row('Route Distance (KM)', logbook.routeDistanceKm)}
        </tbody>
      </table>

      {sectionTitle('Fuel Information')}
      <table className="print-table">
        <tbody>
          {row('Fuel Type', logbook.fuelType || logbook.vehicle?.fuelType)}
          {row('Fuel Available (L)', logbook.fuelAvailableBeforeTrip)}
          {row('Fuel Requested (L)', logbook.fuelRequested)}
          {row('Fuel Issued (L)', logbook.fuelIssuedLitres)}
          {row('Fuel Consumed (L)', logbook.fuelUsedLitres)}
          {row('Fuel Received from HPMU (L)', logbook.fuelReceivedFromHPMU)}
          {row('Fuel Remaining (L)', logbook.fuelRemaining)}
          {row('Fuel Voucher', logbook.voucherNumber)}
          {isEmergency && row('Fuel Request Type', 'Emergency Fuel Request')}
          {isEmergency && logbook.emergencyReason && row('Emergency Reason', logbook.emergencyReason)}
        </tbody>
      </table>

      {sectionTitle('Approval')}
      <table className="print-table">
        <tbody>
          {row('Status', logbook.status === 'NOT STARTED' ? 'DRAFT' : logbook.status)}
          {row('Submitted At', fmtTime(logbook.submittedAt))}
          {row('Approved By', logbook.status === 'VERIFIED' ? officerName : '—')}
          {row('Approved At', fmtTime(logbook.verifiedAt))}
        </tbody>
      </table>

      <div className="print-signature">
        <div className="signature-block">
          <div className="signature-line" />
          <span>{preparedByLabel}</span>
        </div>
        <div className="signature-block">
          <div className="signature-line" />
          <span>Officer Signature & Date</span>
        </div>
        <div className="signature-block">
          <div className="signature-line" />
          <span>Transport Officer Signature & Date</span>
        </div>
      </div>
    </div>
  );
}
