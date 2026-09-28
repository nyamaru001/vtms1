require('dotenv').config();
const mysql = require('mysql2/promise');

const PROTECTED_TABLES = new Set(['users']);

async function counts(conn) {
  const [tables] = await conn.query(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`
  );
  const out = {};
  for (const t of tables) {
    const [c] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t.name}\``);
    out[t.name] = Number(c[0].n);
  }
  return out;
}

async function delAll(conn, table) {
  if (PROTECTED_TABLES.has(table)) throw new Error(`Refusing to delete protected table: ${table}`);
  const [r] = await conn.query(`DELETE FROM \`${table}\``);
  return r.affectedRows || 0;
}

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('DATABASE:', (await conn.query('SELECT DATABASE() db'))[0][0].db);
  const before = await counts(conn);
  console.log('\n=== BEFORE ===');
  for (const [k, v] of Object.entries(before)) console.log(`${k}: ${v}`);

  const usersBefore = await conn.query(
    'SELECT id, username, role, password_hash FROM users ORDER BY id'
  );

  // Snapshot vehicles/drivers before any change
  const vehiclesBefore = await conn.query('SELECT * FROM vehicles ORDER BY id');
  const driversBefore = await conn.query('SELECT * FROM drivers ORDER BY id');

  await conn.beginTransaction();
  try {
    // FK-safe order: dependents first
    const order = [
      'fuel_issue_logs',
      'fuel_requests',
      'extra_fuel_requests',
      'logbooks',
      'trip_events',
      'trip_locations',
      'hpmu_recommendations',
      'r3_approvals',
      'trips',
      'vehicle_requests',
      'notifications',
      'audit_logs',
    ];

    const deleted = {};
    for (const t of order) {
      deleted[t] = await delAll(conn, t);
      console.log(`DELETE ${t}: ${deleted[t]}`);
    }

    // Clearly test vehicle from cancel suite
    const [testV] = await conn.query(
      `DELETE FROM vehicles WHERE registration_number LIKE 'T-CANCEL-%' OR model LIKE 'Test Cancel%'`
    );
    deleted['vehicles (test only)'] = testV.affectedRows || 0;
    console.log(`DELETE vehicles (test only): ${deleted['vehicles (test only)']}`);

    // Free stale assignment state on preserved master data (no inserts, no schema change)
    const [fu] = await conn.query(
      `UPDATE drivers SET status = 'AVAILABLE', assigned_vehicle_id = NULL
       WHERE status <> 'AVAILABLE' OR assigned_vehicle_id IS NOT NULL`
    );
    const [fv] = await conn.query(
      `UPDATE vehicles SET status = 'AVAILABLE'
       WHERE status <> 'AVAILABLE'`
    );
    console.log(`UPDATE drivers freed: ${fu.affectedRows}`);
    console.log(`UPDATE vehicles freed: ${fv.affectedRows}`);

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    console.error('ROLLBACK', e);
    process.exit(1);
  }

  const after = await counts(conn);
  console.log('\n=== AFTER ===');
  for (const [k, v] of Object.entries(after)) console.log(`${k}: ${v}`);

  const deletedReport = {};
  for (const k of Object.keys(before)) {
    deletedReport[k] = before[k] - (after[k] ?? 0);
  }
  console.log('\n=== DELETED (before - after) ===');
  for (const [k, v] of Object.entries(deletedReport)) console.log(`${k}: ${v}`);

  // Verify users untouched
  const usersAfter = await conn.query(
    'SELECT id, username, role, password_hash FROM users ORDER BY id'
  );
  const usersMatch =
    JSON.stringify(usersBefore[0]) === JSON.stringify(usersAfter[0]);
  console.log('\nUSERS UNCHANGED (incl. password_hash):', usersMatch);
  if (!usersMatch) {
    console.error('USER DRIFT DETECTED');
    process.exit(1);
  }

  const vehiclesAfter = await conn.query('SELECT * FROM vehicles ORDER BY id');
  const driversAfter = await conn.query('SELECT * FROM drivers ORDER BY id');
  console.log('\n=== VEHICLES AFTER ===');
  for (const v of vehiclesAfter[0]) {
    console.log(`id=${v.id} reg=${v.registration_number} status=${v.status}`);
  }
  console.log('=== DRIVERS AFTER ===');
  for (const d of driversAfter[0]) {
    console.log(`id=${d.id} user_id=${d.user_id} status=${d.status} vehicle=${d.assigned_vehicle_id}`);
  }

  // Ensure no schema drift: table list identical
  const [tablesAfter] = await conn.query(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE='BASE TABLE'
     ORDER BY TABLE_NAME`
  );
  const beforeTables = Object.keys(before).sort();
  const afterTables = tablesAfter.map((t) => t.name).sort();
  console.log('\nSCHEMA TABLE LIST UNCHANGED:', JSON.stringify(beforeTables) === JSON.stringify(afterTables));

  await conn.end();

  console.log('\nCLEANUP COMPLETE');
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
