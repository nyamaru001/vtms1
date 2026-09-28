require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Sequelize, QueryTypes } = require('sequelize');

const s = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'mysql',
    logging: false,
  }
);

async function count(table) {
  const rows = await s.query(`SELECT COUNT(*) AS c FROM \`${table}\``, { type: QueryTypes.SELECT });
  return Number(rows[0].c);
}

(async () => {
  await s.authenticate();
  console.log('Connected to', process.env.DB_NAME);

  const tables = await s.query('SHOW TABLES', { type: QueryTypes.SHOWTABLES });
  const before = {};
  for (const t of tables) before[t] = await count(t);

  console.log('--- BEFORE ---');
  Object.entries(before).forEach(([t, c]) => console.log(`${t}: ${c}`));

  // FK-safe delete order: children first
  const order = [
    'trip_events',
    'trip_locations',
    'audit_logs',
    'notifications',
    'hpmu_recommendations',
    'r3_approvals',
    'fuel_issue_logs',
    'logbooks',
    'extra_fuel_requests',
    'fuel_requests',
    'trips',
    'vehicle_requests',
    // KEEP: users, drivers, vehicles (master/credential data)
  ];

  for (const t of order) {
    if (!tables.includes(t)) {
      console.log(`skip ${t} (missing)`);
      continue;
    }
    try {
      const [r] = await s.query(`DELETE FROM \`${t}\``);
      console.log(`deleted from ${t}: ${r.affectedRows ?? 0}`);
    } catch (e) {
      console.error(`ERROR ${t}: ${e.message}`);
    }
  }

  console.log('--- AFTER ---');
  const after = {};
  for (const t of tables) after[t] = await count(t);
  Object.entries(after).forEach(([t, c]) => console.log(`${t}: ${c}`));

  const users = await s.query('SELECT id, username, role, status FROM users ORDER BY id', { type: QueryTypes.SELECT });
  console.log('--- USERS KEPT ---');
  users.forEach((u) => console.log(`${u.id} ${u.username} ${u.role} ${u.status}`));

  await s.close();
  console.log('Done.');
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
