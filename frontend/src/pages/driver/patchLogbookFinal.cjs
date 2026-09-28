const fs = require('fs');

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
const fileContent = fs.readFileSync(filePath, 'utf8');

// First inject the display variables after linkedFuelRequest
const varInjectPoint = `                    const linkedFuelRequest = [...fuelRequests].reverse().find(fr => fr.litresRequested > 0);
                    if (linkedFuelRequest) {`;

const varInjectNew = `                    const linkedFuelRequest = [...fuelRequests].reverse().find(fr => fr.litresRequested > 0);
                    const displayFuelRequested = linkedFuelRequest?.litresRequested ?? logbook?.fuelRequested ?? '—';
                    const displayFuelIssued = linkedFuelRequest?.litresReleased ?? logbook?.fuelReceivedFromHPMU ?? logbook?.fuelIssuedLitres ?? '—';
                    const displayFuelReceived = linkedFuelRequest?.litresReleased ?? logbook?.fuelReceivedFromHPMU ?? '—';
                    if (linkedFuelRequest) {`;

if (!fileContent.includes(varInjectPoint)) {
  console.log('ERROR: Could not find var injection point');
  process.exit(1);
}

fileContent = fileContent.replace(varInjectPoint, varInjectNew);
console.log('Injected display variables');

// Now replace the display block
const oldDisplayBlock = `                  })()}
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
                        ? \`\${latestVoucher?.voucherNumber || '—'}\${logbook?.fuelIssuedLitres ? \` · \${logbook.fuelIssuedLitres} L\` : ''}\`
                        : '—'}
                    </p>
                  </div>`;

const newDisplayBlock = `                  })()}
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
                  </div>`;

if (!fileContent.includes(oldDisplayBlock)) {
  console.log('ERROR: Could not find old display block');
  process.exit(1);
}

fileContent = fileContent.replace(oldDisplayBlock, newDisplayBlock);
console.log('Replaced display block');

fs.writeFileSync(filePath, fileContent, 'utf8');
console.log('Done - Logbook.jsx patched successfully');