const mysql = require('mysql2/promise');

async function checkUsers() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Nyamaru@1974',
    database: 'vehicle_transport_management'
  });
  
  const [rows] = await conn.execute('SELECT id, username, role, password_hash FROM users');
  console.table(rows);
  
  await conn.end();
}

checkUsers().catch(console.error);