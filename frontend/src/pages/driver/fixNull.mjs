import fs from 'fs';

const filePath = 'C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldCode = `    </> : null;

  const buildPayload = () => ({`;

const newCode = `    </>
      ) : null;

  const buildPayload = () => ({`;

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode);
  fs.writeFileSync('C:\\Users\\Zacharia\\Desktop\\shool 2\\vtms\\frontend\\src\\pages\\driver\\Logbook.jsx', content, 'utf8');
  console.log('Replaced successfully');
} else {
  console.log('Old code not found');
}