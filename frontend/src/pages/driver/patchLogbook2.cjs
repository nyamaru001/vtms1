const fs = require('fs');

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
const content = fs.readFileSync(filePath, 'utf8');

// Exact block to replace (from the file)
const oldBlock = `                  })()}
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

const newBlock = `                  })()}
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

// We need to inject the new variables BEFORE the block
const injectBefore = `                  })()}
                  <div>
                    <span className="field-label">Fuel Available Before Trip (L)</span>
                    <p>{logbook?.fuelAvailableBeforeTrip ?? '—'}</p>
                  </div>
                  <div>
                    <span className="field-label">Fuel Requested (L)</span>
                    <p>{logbook?.fuelRequested ?? request.totalFuelLitres ?? '—'}</p>
                  </div>`;

const injectAfter = `                  })()}
                  <div>
                    <span className="field-label">Fuel Available Before Trip (L)</span>
                    <p>{logbook?.fuelAvailableBeforeTrip ?? '—'}</p>
                  </div>
                  <div>
                    <span className="field-label">Fuel Requested (L)</span>
                    <p><strong>{displayFuelRequested}</strong>{displayFuelRequested !== '—' && ' L'}</p>
                  </div>`;

// Find where the variables should be injected - right after the linkedFuelRequest const
const varInjectPoint = `                    const linkedFuelRequest = [...fuelRequests].reverse().find(fr => fr.litresRequested > 0);
                    if (linkedFuelRequest) {`;

const varInjectNew = `                    const linkedFuelRequest = [...fuelRequests].reverse().find(fr => fr.litresRequested > 0);
                    const displayFuelRequested = linkedFuelRequest?.litresRequested ?? logbook?.fuelRequested ?? '—';
                    const displayFuelIssued = linkedFuelRequest?.litresReleased ?? logbook?.fuelReceivedFromHPMU ?? logbook?.fuelIssuedLitres ?? '—';
                    const displayFuelReceived = linkedFuelRequest?.litresReleased ?? logbook?.fuelReceivedFromHPMU ?? '—';
                    if (linkedFuelRequest) {`;

// First inject the variables
if (content.includes(varInjectPoint)) {
  content = content.replace(varInjectPoint, varInjectNew);
  console.log('Injected display variables');
} else {
  console.log('Could not find var inject point');
  process.exit(1);
}

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

if (content.includes(oldDisplayBlock)) {
  content = content.replace(oldDisplayBlock, newDisplayBlock);
  console.log('Replaced display block');
} else {
  console.log('Old display block not found - trying alternative...');
  // Try with different template literal escaping
  const altOldDisplayBlock = oldDisplayBlock.replace(/`/g, '\\`');
  if (content.includes(altOldDisplayBlock)) {
    content = content.replace(altOldDisplayBlock, newDisplayBlock);
    console.log('Replaced with alt');
  } else {
    console.log('Still not found');
  }
}

fs.writeFileSync('Logbook.jsx', content, 'utf8');
console.log('Done');