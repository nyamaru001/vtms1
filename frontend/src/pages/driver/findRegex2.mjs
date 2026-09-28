import fs from 'fs';

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
const content = fs.readFileSync(filePath, 'utf8');

let inString = false;
let stringChar = '';
let potentialRegex = [];

for (let i = 0; i < content.length; i++) {
  const c = content[i];
  const prev = content[i-1];
  
  if (!inString) {
    if (c === '\'' || c === '\"' || c === '`') {
      inString = true;
      stringChar = c;
    } else if (c === '/') {
      const next = content[i+1];
      if (next !== '/' && next !== '*') {
        const context = content.substring(Math.max(0, i-20), i+50);
        potentialRegex.push({ index: i, context: context.replace(/\n/g, '\\n') });
      }
    }
  } else if (c === stringChar && prev !== '\\') {
    inString = false;
  }
}

console.log('Found', potentialRegex.length, 'potential regex starts');
for (const r of potentialRegex) {
  // Find line number
  const lines = content.substring(0, r.index).split('\n');
  console.log('Line:', lines.length, 'Context:', r.context);
}