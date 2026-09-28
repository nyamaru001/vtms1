const fs = require('fs');

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
const content = fs.readFileSync(filePath, 'utf8');

// Find the exact section we need to replace
const searchStart = '{( () => {';
const searchEnd = '} )() }';
const startIdx = content.indexOf(searchStart);
if (startIdx === -1) {
  console.log('Could not find start pattern');
  process.exit(1);
}

// Find the end of this block by looking for the closing pattern
let endIdx = content.indexOf('})()}', startIdx);
if (endIdx === -1) {
  console.log('Could not find end pattern');
  process.exit(1);
}
endIdx += 5; // Include the })()}

const oldBlock = content.substring(startIdx, endIdx);
console.log('Found block length:', oldBlock.length);

const newBlock = `{(() => {
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
                            {displayFuelIssued !== '—' ? ' · ' + displayFuelIssued + ' L' : ''}
                          </p>
                        </div>
                      </>
                    );
                  })()}`;

if (content.includes(oldBlock)) {
  const newContent = content.replace(oldBlock, newBlock);
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Successfully patched Logbook.jsx');
} else {
  console.log('Old block not found');
  console.log('Looking for similar...');
  // Try to find a close match
  const searchStr = 'logbook?.fuelRequested ?? request.totalFuelLitres';
  if (content.includes(searchStr)) {
    console.log('Found the target line at index:', content.indexOf(searchStr));
  }
}