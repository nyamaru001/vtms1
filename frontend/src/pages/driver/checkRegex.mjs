import fs from 'fs';

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
const content = fs.readFileSync(filePath, 'utf8');

// Check for unclosed regex patterns
let inString = false;
let stringChar = '';
let inRegex = false;
let regexStart = -1;

for (let i = 0; i < content.length; i++) {
  const c = content[i];
  const prev = content[i-1];
  
  if (!inString) {
    if (c === '\'' || c === '"' || c === '`') {
      if (content[i-1] !== '\\') {
        inString = true;
        stringChar = c;
      }
    } else if (c === '/') {
      const next = content[i+1];
      if (next !== '/' && next !== '*') {
        // Potential regex start
        let inRegex = true;
        let regexDepth = 0;
        let inCharClass = false;
        let regexEnd = -1;
        
        for (let j = i+1; j < content.length; j++) {
          const rc = content[j];
          const rprev = content[j-1];
          
          if (!inCharClass) {
            if (rc === '[') {
              inCharClass = true;
            } else if (rc === '/') {
              if (rprev !== '\\') {
                // Found end of regex
                break;
              }
            }
          } else if (rc === ']') {
            inCharClass = false;
          }
        }
        
        // Just log potential regex starts
        const context = content.substring(Math.max(0, i-30), i+60);
        console.log('Potential regex at index', i, 'context:', content.substring(Math.max(0, i-30), i+60).replace(/\n/g, '\\n'));
      }
    }
  }
}