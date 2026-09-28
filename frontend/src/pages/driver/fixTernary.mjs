import fs from 'fs';

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the ternary operator - change && to ?
const oldTernary = `{linkedFuelRequest && (`;
const newTernary = `{linkedFuelRequest ? (`;

if (content.includes(oldTernary)) {
  content = content.replace(oldTernary, newTernary);
  console.log('Fixed ternary operator');
} else {
  console.log('Ternary pattern not found');
  process.exit(1);
}

fs.writeFileSync('C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx', content, 'utf8');
console.log('Fixed ternary operator in Logbook.jsx');