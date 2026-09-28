import fs from 'fs';

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `const fuelSection = shouldShowFuelSection ? (
    <>
      <div className="logbook-card" data-testid="fuel-section">
        <div className="logbook-card-header">
          <h3>FUEL</h3>
          <span className="eyebrow">Fuel type loaded from vehicle</span>
        </div>
        <div className="logbook-card-body">
          <div className="detail-grid">
            <div>
              <span className="field-label">Fuel Type</span>
              <p>{vehicle.fuelType || logbook?.fuelType || '—'}</p>
            </div>
            <div>
              <span className="field-label">Linked Fuel Request</span>
              <p>
                <span className="font-bold">#{linkedFuelRequest.id}</span> — {linkedFuelRequest.litresRequested} L requested
                {linkedFuelRequest.requestType === 'EMERGENCY' && (
                  <span className="status-badge status-emergency" style={{ marginLeft: 8, fontSize: 11, textTransform: 'uppercase' }}>
                    Emergency
                  </span>
                )}
              </p>
            </div>
            <div>
              <span className="field-label">Fuel Available Before Trip (L)</span>
              <p>{logbook?.fuelAvailableBeforeTrip ?? '—'}</p>
            </div>
            <div>
              <span className="field-label">Fuel Requested (L)</span>
              <p>{(displayFuelRequested !== '—' ? ' L' : '')}</p>
            </div>
            <div>
              <span className="field-label">Fuel Received from HPMU (L)</span>
              <p data-testid="fuel-received">{displayFuelReceived !== '—' ? ' L' : ''}</p>
            </div>
            <div>
              <span className="field-label">Fuel Consumed (L)</span>
              <p>{logbook?.fuelUsedLitres ?? '—'}</p>
            </div>
            <div>
              <span className="field-label">Fuel Remaining (L)</span>
              <p>{logbook?.fuelRemaining ?? '—'}</p>
            </div>
            <div>
              <span className="field-label">Fuel Voucher</span>
              <p data-testid="fuel-voucher">
                {latestVoucher?.voucherNumber || '—'}
                {displayFuelIssued !== '—' ? ' · ' + displayFuelIssued + ' L' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    ) : null;

  const buildPayload = () => ({`;

const newCode = `const fuelSection = shouldShowFuelSection && (
    <>
      <div className="logbook-card" data-testid="fuel-section">
        <div className="logbook-card-header">
          <h3>FUEL</h3>
          <span className="eyebrow">Fuel type loaded from vehicle</span>
        </div>
        <div className="logbook-card-body">
          <div className="detail-grid">
            <div>
              <span className="field-label">Fuel Type</span>
              <p>{vehicle.fuelType || logbook?.fuelType || '—'}</p>
            </div>
            <div>
              <span className="field-label">Linked Fuel Request</span>
              <p>
                <span className="font-bold">#{linkedFuelRequest.id}</span> — {linkedFuelRequest.litresRequested} L requested
                {linkedFuelRequest.requestType === 'EMERGENCY' && (
                  <span className="status-badge status-emergency" style={{ marginLeft: 8, fontSize: 11, textTransform: 'uppercase' }}>
                    Emergency
                  </span>
                )}
              </p>
            </div>
            <div>
              <span className="field-label">Fuel Available Before Trip (L)</span>
              <p>{logbook?.fuelAvailableBeforeTrip ?? '—'}</p>
            </div>
            <div>
              <span className="field-label">Fuel Requested (L)</span>
              <p>{(displayFuelRequested !== '—' ? ' L' : '')}</p>
            </div>
            <div>
              <span className="field-label">Fuel Received from HPMU (L)</span>
              <p data-testid="fuel-received">{displayFuelReceived !== '—' ? ' L' : ''}</p>
            </div>
            <div>
              <span className="field-label">Fuel Consumed (L)</span>
              <p>{logbook?.fuelUsedLitres ?? '—'}</p>
            </div>
            <div>
              <span className="field-label">Fuel Remaining (L)</span>
              <p>{logbook?.fuelRemaining ?? '—'}</p>
            </div>
            <div>
              <span className="field-label">Fuel Voucher</span>
              <p data-testid="fuel-voucher">
                {latestVoucher?.voucherNumber || '—'}
                {displayFuelIssued !== '—' ? ' · ' + displayFuelIssued + ' L' : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const buildPayload = () => ({`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync('C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx', content, 'utf8');
  console.log('Replaced successfully');
} else {
  console.log('Old code not found');
  // Find the approximate location
  const idx = content.indexOf('const buildPayload = () => ({');
  if (idx >= 0) {
    console.log('Found buildPayload at index:', idx);
    console.log('Context:', content.substring(Math.max(0, idx-200), idx+200));
  }
}