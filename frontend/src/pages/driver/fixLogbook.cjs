const fs = require('fs');

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the target location
const target = 'logbook?.fuelRequested ?? request.totalFuelLitres ??';
const targetIdx = content.indexOf(target);

if (targetIdx === -1) {
  console.log('Target not found');
  process.exit(1);
}

console.log('Found target at:', targetIdx);

// Find the start of the IIFE block
let blockStart = content.lastIndexOf('{(() => {', targetIdx);
console.log('Block start:', blockStart);

// Find the end of the block by finding the matching closing
let depth = 0;
let inString = false;
let stringChar = '';
let endIdx = targetIdx;

for (let i = targetIdx; i < content.length; i++) {
  const c = content[i];
  const prev = content[i - 1];
  
  if (!inString) {
    if (c === '\'' || c === '\"' || c === '`') {
      inString = true;
      stringChar = c;
    } else if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        endIdx = i + 1;
        break;
      }
    }
  } else if (c === stringChar && prev !== '\\') {
    inString = false;
  }
}

console.log('Block end:', endIdx);

const oldBlock = content.substring(blockStart, endIdx);
console.log('Block length:', oldBlock.length);

// Verify we found the right block
if (!oldBlock.includes('logbook?.fuelRequested ?? request.totalFuelLitres')) {
  console.log('ERROR: Target not found in block');
  process.exit(1);
}

console.log('Block found successfully');

// Create new block
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

const oldBlock = content.substring(blockStart, endIdx);
const newContent = content.replace(oldBlock, newBlock);

if (newContent === content) {
  console.log('ERROR: Replacement did not change content');
  process.exit(1);
}

fs.writeFileSync('C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx', newContent, 'utf8');
console.log('Successfully patched Logbook.jsx');