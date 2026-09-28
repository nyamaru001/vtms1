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

  const [triggers] = await conn.query(
    `SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE, ACTION_STATEMENT
     FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = DATABASE()`
  );
  console.log('TRIGGERS:', triggers.length);
  for (const t of triggers) {
    console.log(`- ${t.TRIGGER_NAME} on ${t.EVENT_OBJECT_TABLE}`);
    console.log(t.ACTION_STATEMENT.slice(0, 300));
  }

  const [tables] = await conn.query(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME`
  );
  console.log('\nCOUNTS:');
  for (const t of tables) {
    const [c] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t.name}\``);
    console.log(`${t.name}: ${c[0].n}`);
  }

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
