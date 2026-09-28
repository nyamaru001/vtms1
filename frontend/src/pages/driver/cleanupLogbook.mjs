import fs from 'fs';

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
const content = fs.readFileSync(filePath, 'utf8');

// Find the leftover old code
const leftover = `{displayFuelIssued !== '—' ? ' · ' + displayFuelIssued + ' L' : ''}
                        : '—'}
                    </p>
                  </div>
                </div>
              </div>
       `;

const cleanEnding = `{displayFuelIssued !== '—' ? ' · ' + displayFuelIssued + ' L' : ''}
                          </p>
                        </div>
                      </>
                    );
                  })()} `;

if (content.includes(leftover)) {
  const newContent = content.replace(leftover, cleanEnding);
  fs.writeFileSync('C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx', newContent, 'utf8');
  console.log('Cleaned up leftover code');
} else {
  console.log('Leftover pattern not found');
}