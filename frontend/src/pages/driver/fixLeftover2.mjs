import fs from 'fs';

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the leftover malformed code
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
  console.log('Pattern not found, searching for alternative...');
  // Try to find the exact leftover
  const idx = content.indexOf('})()} L');
  if (idx >= 0) {
    console.log('Found at:', idx);
    console.log(content.substring(idx-50, idx+100));
  } else {
    console.log('Could not find the exact pattern');
    // Search for the problematic sequence
    for (let i = 0; i < content.length - 10; i++) {
      if (content.substring(i, i+8) === '})()} L`') {
        console.log('Found at index:', i);
        console.log(content.substring(i-50, i+100));
        break;
      }
    }
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Done');