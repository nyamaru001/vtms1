import fs from 'fs';

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
const content = fs.readFileSync(filePath, 'utf8');

// Check for unclosed template literals
let inTemplate = false;
let templateStart = -1;
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (c === '`') {
    if (content[i-1] !== '\\') {
      console.log('Template literal at index:', i, 'context:', content.substring(Math.max(0, i-20), i+50));
    }
  }
}

// Check for potential unclosed regex
let depth = 0;
let inString = false;
let stringChar = '';
let depthStack = [];
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  const prev = content[i-1];
  if (!inString) {
    if (c === '\'' || c === '"' || c === '`') {
      inString = true;
      stringChar = c;
    } else if (c === '/' && content[i+1] !== '/' && content[i+1] !== '*') {
      // Potential regex start
      const context = content.substring(Math.max(0, i-20), i+50);
      console.log('Potential regex at index', i, ':', content.substring(Math.max(0, i-20), i+50));
    }
  }
}