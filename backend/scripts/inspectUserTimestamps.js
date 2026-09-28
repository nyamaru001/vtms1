require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [rows] = await conn.query(
    `SELECT id, username, role, status, created_at, updated_at,
            LEFT(password_hash, 7) AS hashPrefix,
            LENGTH(password_hash) AS hashLen
     FROM users ORDER BY id`
  );
  console.log(JSON.stringify(rows, null, 2));

  // Compare hash equality groups
  const [hashes] = await conn.query('SELECT id, username, password_hash FROM users ORDER BY id');
  const byHash = {};
  for (const h of hashes) {
    byHash[h.password_hash] = byHash[h.password_hash] || [];
    byHash[h.password_hash].push(h.username);
  }
  console.log('\nUnique hash count:', Object.keys(byHash).length);
  for (const [hash, users] of Object.entries(byHash)) {
    console.log(`  users=[${users.join(', ')}] prefix=${hash.slice(0, 7)} len=${hash.length}`);
  }

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
