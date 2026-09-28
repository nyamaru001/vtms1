const fs = require('fs');

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
const content = fs.readFileSync(filePath, 'utf8');

const oldCode = `{(() => {
                    const linkedFuelRequest = [...fuelRequests].reverse().find(fr => fr.litresRequested > 0);
                    if (linkedFuelRequest) {
                      return (
                        <div>
                          <span className="field-label">Linked Fuel Request</span>
                          <p>
                            <strong>#{linkedFuelRequest.id}</strong> — {linkedFuelRequest.litresRequested} L requested
                            {linkedFuelRequest.requestType === 'EMERGENCY' && (
                              <span className="status-badge status-emergency" style={{ marginLeft: 8, fontSize: 11, textTransform: 'uppercase' }}>
                                Emergency
                              </span>
                            )}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div>
                    <span className="field-label">Fuel Available Before Trip (L)</span>
                    <p>{logbook?.fuelAvailableBeforeTrip ?? '—'}</p>
                  </div>
                  <div>
                    <span className="field-label">Fuel Requested (L)</span>
                    <p>{logbook?.fuelRequested ?? request.totalFuelLitres ?? '—'}</p>
                  </div>
                  <div>
                    <span className="field-label">Fuel Received from HPMU (L)</span>
                    <p data-testid="fuel-received">{logbook?.fuelReceivedFromHPMU ?? '—'}</p>
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
                      {latestVoucher?.voucherNumber || logbook?.fuelIssuedLitres
                        ? `\${latestVoucher?.voucherNumber || '—'}\${logbook?.fuelIssuedLitres ? \` · \${logbook.fuelIssuedLitres} L\` : ''}`}
                      : '—'}
                    </p>
                  </div>`;

const newCode = `{(() => {
                    const linkedFuelRequest = [...fuelRequests].reverse().find(fr => fr.litresRequested > 0);
                    const displayFuelRequested = linkedFuelRequest?.litresRequested ?? logbook?.fuelRequested ?? '—';
                    const displayFuelIssued = linkedFuelRequest?.litresReleased ?? logbook?.fuelReceivedFromHPMU ?? logbook?.fuelIssuedLitres ?? '—';
                    const displayFuelReceived = linkedFuelRequest?.litresReleased ?? logbook?.fuelReceivedFromHPMU ?? '—';
                    return (
                      <>
                        {linkedFuelRequest && (
                          <div>
                            <span className="field-label">Linked Fuel Request</span>
                            <p>
                              <strong>#{linkedFuelRequest.id}</strong> — {linkedFuelRequest.litresRequested} L requested
                              {linkedFuelRequest.requestType === 'EMERGENCY' && (
                                <span className="status-badge status-emergency" style={{ marginLeft: 8, fontSize: 11, textTransform: 'uppercase' }}>
                                  Emergency
                                </span>
                              )}
                            </p>
                          </div>
                        )
                        : null}
                        <div>
                          <span className="field-label">Fuel Available Before Trip (L)</span>
                          <p>{logbook?.fuelAvailableBeforeTrip ?? '—'}</p>
                        </div>
                        <div>
                          <span className="field-label">Fuel Requested (L)</span>
                          <p><strong>{displayFuelRequested}</strong>{displayFuelRequested !== '—' && ' L'}</p>
                        </div>
                        <div>
                          <span className="field-label">Fuel Received from HPMU (L)</span>
                          <p data-testid="fuel-received"><strong>{displayFuelReceived}</strong>{displayFuelReceived !== '—' && ' L'}</p>
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
                            {displayFuelIssued !== '—' ? `\` · \${displayFuelIssued} L\`` : ''}
                          </p>
                        </div>
                      </>
                    );
                  })()}`;

if (content.includes(oldCode)) {
  const newContent = content.replace(oldCode, newCode);
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Successfully patched Logbook.jsx');
} else {
  console.log('Old code not found - trying alternative search...');
  // Try to find a portion
  if (content.includes('logbook?.fuelRequested ?? request.totalFuelLitres')) {
    console.log('Found target code with different formatting');
  }
}