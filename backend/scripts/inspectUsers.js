require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Sequelize, QueryTypes } = require('sequelize');
const bcrypt = require('bcrypt');

const s = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  { host: process.env.DB_HOST, port: process.env.DB_PORT, dialect: 'mysql', logging: false }
);

const CANDIDATES = ['Password123!', 'Admin@123', 'admin', 'password', 'Password123', 'nest1'];

(async () => {
  const cols = await s.query('SHOW COLUMNS FROM users', { type: QueryTypes.SELECT });
  console.log('COLUMNS:', cols.map((c) => c.Field).join(', '));

  const users = await s.query(
    'SELECT id, username, role, status, password_hash, email, full_name FROM users ORDER BY id',
    { type: QueryTypes.SELECT }
  );

  console.log('--- USERS ---');
  for (const u of users) {
    const h = String(u.password_hash || '');
    const looksBcrypt = /^\$2[aby]\$\d{2}\$/.test(h);
    let match = 'n/a';
    if (looksBcrypt) {
      const hits = [];
      for (const c of CANDIDATES) {
        const ok = await bcrypt.compare(c, h);
        if (ok) hits.push(c);
      }
      match = hits.length ? hits.join('|') : 'NO_CANDIDATE_MATCH';
    }
    console.log(
      [
        'id=' + u.id,
        'username=' + u.username,
        'role=' + u.role,
        'status=' + u.status,
        'hashLen=' + h.length,
        'looksBcrypt=' + looksBcrypt,
        'knownPasswordMatch=' + match,
        'email=' + (u.email || ''),
        'fullName=' + (u.full_name || ''),
      ].join(' | ')
    );
  }
  await s.close();
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
