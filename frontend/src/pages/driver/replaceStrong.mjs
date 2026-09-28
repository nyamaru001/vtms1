import fs from 'fs';

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace all <strong> and </strong> with a CSS class approach
// First, replace <strong> with <span className="font-bold">
content = content.replace(/<strong>/g, '<span className="font-bold">');
content = content.replace(/<\/strong>/g, '</span>');

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replaced all strong tags with span.font-bold');