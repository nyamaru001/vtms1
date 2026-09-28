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

  const [tables] = await conn.query(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`
  );

  for (const t of tables) {
    const [cols] = await conn.query(
      `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [t.name]
    );
    console.log(`\n## ${t.name}`);
    console.log(cols.map((c) => `${c.COLUMN_NAME}:${c.DATA_TYPE}`).join(', '));
  }

  console.log('\n=== VEHICLES ROWS ===');
  const [vs] = await conn.query('SELECT * FROM vehicles');
  for (const v of vs) {
    const { id, registration_number, registrationNumber, status, model, make } = v;
    const reg = registration_number || registrationNumber;
    const all = Object.fromEntries(Object.entries(v).filter(([k]) => !/pass|hash|secret|token/i.test(k)));
    console.log(JSON.stringify(all));
  }

  console.log('\n=== DRIVERS ROWS (no secrets) ===');
  const [ds] = await conn.query('SELECT * FROM drivers');
  for (const d of ds) {
    const all = Object.fromEntries(Object.entries(d).filter(([k]) => !/pass|hash|secret|token/i.test(k)));
    console.log(JSON.stringify(all));
  }

  console.log('\n=== HPMU_RECOMMENDATIONS sample ===');
  try {
    const [hr] = await conn.query('SELECT * FROM hpmu_recommendations LIMIT 5');
    console.log(JSON.stringify(hr, null, 2));
  } catch (e) { console.log(e.message); }

  console.log('\n=== VEHICLE_REQUESTS (id, purpose, status, officer) ===');
  const [vrs] = await conn.query('SELECT id, purpose, status, officer_id, vehicle_id, driver_id, created_at FROM vehicle_requests ORDER BY id');
  for (const r of vrs) console.log(JSON.stringify(r));

  console.log('\n=== TRIPS ===');
  try {
    const [tr] = await conn.query('SELECT * FROM trips ORDER BY id');
    for (const t of tr) console.log(JSON.stringify(t));
  } catch (e) { console.log(e.message); }

  console.log('\n=== FUEL / LOGBOOK / R3 / REC / LOC / ISSUE counts already known ===');
  try {
    const [fr] = await conn.query('SELECT * FROM fuel_requests');
    console.log('fuel_requests', JSON.stringify(fr));
  } catch (e) {}
  try {
    const [lb] = await conn.query('SELECT * FROM logbooks');
    console.log('logbooks', JSON.stringify(lb));
  } catch (e) {}
  try {
    const [fi] = await conn.query('SELECT * FROM fuel_issue_logs');
    console.log('fuel_issue_logs', JSON.stringify(fi));
  } catch (e) {}
  try {
    const [ra] = await conn.query('SELECT id, request_id, status FROM r3_approvals ORDER BY id');
    console.log('r3_approvals', JSON.stringify(ra));
  } catch (e) {}
  try {
    const [tl] = await conn.query('SELECT * FROM trip_locations');
    console.log('trip_locations', JSON.stringify(tl));
  } catch (e) {}

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
