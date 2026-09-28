require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  const [dbName] = await conn.query('SELECT DATABASE() AS db');
  console.log('DATABASE:', dbName[0].db);

  const [tables] = await conn.query(
    `SELECT TABLE_NAME AS name, TABLE_ROWS AS estRows, TABLE_TYPE AS type
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
    [dbName[0].db]
  );

  console.log('\n=== TABLES + EXACT COUNTS ===');
  const counts = {};
  for (const t of tables) {
    const [c] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t.name}\``);
    counts[t.name] = Number(c[0].n);
    console.log(`${t.name}: ${counts[t.name]}`);
  }

  console.log('\n=== FOREIGN KEYS ===');
  const [fks] = await conn.query(
    `SELECT TABLE_NAME AS tbl, COLUMN_NAME AS col, CONSTRAINT_NAME AS cn,
            REFERENCED_TABLE_NAME AS refTbl, REFERENCED_COLUMN_NAME AS refCol
     FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL
     ORDER BY TABLE_NAME, CONSTRAINT_NAME`,
    [dbName[0].db]
  );
  for (const f of fks) {
    console.log(`${f.tbl}.${f.col} -> ${f.refTbl}.${f.refCol} (${f.cn})`);
  }

  console.log('\n=== USERS (count only + usernames/roles, NO password) ===');
  const [users] = await conn.query(
    `SELECT id, username, role FROM users ORDER BY id`
  );
  console.log('users count:', users.length);
  for (const u of users) console.log(`  id=${u.id} username=${u.username} role=${u.role}`);

  console.log('\n=== VEHICLES ===');
  try {
    const [vs] = await conn.query('SELECT id, registrationNumber, status FROM vehicles ORDER BY id');
    console.log('count:', vs.length);
    for (const v of vs) console.log(`  id=${v.id} reg=${v.registrationNumber} status=${v.status}`);
  } catch (e) { console.log('vehicles error', e.message); }

  console.log('\n=== DRIVERS ===');
  try {
    const [ds] = await conn.query('SELECT id, status, userId FROM drivers ORDER BY id');
    console.log('count:', ds.length);
    for (const d of ds) console.log(`  id=${d.id} userId=${d.userId} status=${d.status}`);
  } catch (e) { console.log('drivers error', e.message); }

  // Detect likely demo/test data by pattern in common text columns
  console.log('\n=== POSSIBLE TEST/DEMO PATTERNS ===');
  const patternTables = [
    { table: 'vehicle_requests', cols: ['purpose', 'destination', 'origin'] },
    { table: 'trips', cols: ['purpose', 'reason', 'emergencyNotes'] },
    { table: 'fuel_requests', cols: ['notes', 'purpose'] },
    { table: 'logbooks', cols: ['purpose', 'remarks', 'post_trip_notes'] },
    { table: 'notifications', cols: ['message', 'title'] },
    { table: 'audit_logs', cols: ['description', 'action'] },
  ];
  const testRe = /(test|demo|sample|cancel test|assigned cancel|approved cancel|authz|illness|emergency.*test|temp|cleanup|T-CANCEL|T-TRIP|Password123|localhost)/i;
  for (const p of patternTables) {
    if (!counts[p.table]) continue;
    const likeClauses = p.cols
      .filter((c) => true)
      .map((c) => `\`${c}\` REGEXP ?`)
      .join(' OR ');
    try {
      // verify columns exist
      const [cols] = await conn.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=?`,
        [dbName[0].db, p.table]
      );
      const have = new Set(cols.map((x) => x.COLUMN_NAME));
      const usable = p.cols.filter((c) => have.has(c));
      if (!usable.length) continue;
      const where = usable.map((c) => `\`${c}\` REGEXP ?`).join(' OR ');
      const params = usable.map(() => testRe.source);
      const [rows] = await conn.query(
        `SELECT COUNT(*) AS n FROM \`${p.table}\` WHERE ${where}`,
        params
      );
      console.log(`${p.table}: ~${rows[0].n} rows matching test/demo patterns in [${usable.join(', ')}]`);
    } catch (e) {
      console.log(`${p.table}: pattern check failed: ${e.message}`);
    }
  }

  await conn.end();
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
