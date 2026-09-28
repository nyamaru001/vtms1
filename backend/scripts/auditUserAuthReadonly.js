require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [rows] = await conn.query(
    'SELECT id, username, role, status, LENGTH(password_hash) AS hashLen, password_hash FROM users ORDER BY id'
  );

  const candidates = ['Password123!', 'Admin@123', 'password', 'admin', '123456'];

  for (const u of rows) {
    const statusOk = u.status === 'ACTIVE' || u.status === 'active' || u.status == null;
    const matches = [];
    for (const p of candidates) {
      try {
        const ok = await bcrypt.compare(p, u.password_hash);
        if (ok) matches.push(p);
      } catch (e) {
        matches.push(`ERR:${e.message}`);
      }
    }
    // also detect non-bcrypt
    const looksBcrypt = /^\$2[aby]\$/.test(u.password_hash || '');
    console.log(
      JSON.stringify({
        id: u.id,
        username: u.username,
        role: u.role,
        status: u.status,
        hashLen: u.hashLen,
        looksBcrypt,
        matchesPasswordCandidates: matches,
      })
    );
  }

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
