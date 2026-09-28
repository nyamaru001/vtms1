import fs from 'fs';

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the leftover malformed code at line 585
const oldCode = `                  })()} L\` : ''}\`
                        : '—'}
                    </p>
                  </div>`;

const newCode = `                  })()}
                    </p>
                  </div>`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  console.log('Fixed leftover code at line 585');
} else {
  console.log('Pattern not found, searching...');
  // Try alternative
  const altOld = `})()} L\` : ''}\`;
  const altNew = `})?}`;
  if (content.includes(altOld)) {
    content = content.replace(altOld, altNew);
    console.log('Fixed with alt pattern');
  } else {
    console.log('Alt pattern not found either');
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed leftover code');