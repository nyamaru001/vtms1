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

(async () => {
  const tables = await s.query('SHOW TABLES', { type: QueryTypes.SHOWTABLES });
  console.log('TABLES:', tables.join(', '));
  for (const t of tables) {
    const rows = await s.query('SELECT COUNT(*) AS c FROM `' + t + '`', { type: QueryTypes.SELECT });
    console.log(t + ': ' + rows[0].c);
  }
  const fks = await s.query(
    "SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME " +
    "FROM information_schema.KEY_COLUMN_USAGE " +
    "WHERE TABLE_SCHEMA = :db AND REFERENCED_TABLE_NAME IS NOT NULL",
    { type: QueryTypes.SELECT, replacements: { db: process.env.DB_NAME } }
  );
  console.log('--- FKs ---');
  fks.forEach((f) =>
    console.log(f.TABLE_NAME + '.' + f.COLUMN_NAME + ' -> ' + f.REFERENCED_TABLE_NAME + '.' + f.REFERENCED_COLUMN_NAME)
  );
  const users = await s.query('SELECT id, username, role, status FROM users ORDER BY id', { type: QueryTypes.SELECT });
  console.log('--- USERS ---');
  users.forEach((u) => console.log(u.id + ' ' + u.username + ' ' + u.role + ' ' + u.status));
  await s.close();
})().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
