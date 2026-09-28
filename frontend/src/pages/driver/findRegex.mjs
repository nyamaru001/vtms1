import fs from 'fs';

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
const content = fs.readFileSync(filePath, 'utf8');

// Find all regex patterns
const regexPattern = /\/([^\/\\\n]*)\/[gimsuy]*/g;
let match;
while ((match = regexPattern.exec(content)) !== null) {
  console.log('Found regex:', match[0], 'at index:', match.index);
}