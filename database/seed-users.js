/**
 * seed-users.js
 *
 * Finishes the database by inserting the 5 role-based demo users
 * (plus their driver records) with REAL bcrypt-hashed passwords.
 *
 * Why this is a separate script instead of plain INSERT statements
 * in the .sql file: bcrypt hashes are salted and generated at runtime —
 * there is no valid "static SQL" way to produce a working hash without
 * actually running bcrypt. This script runs bcrypt for you and writes
 * straight into vehicle_transport_management via mysql2.
 *
 * SETUP (run once):
 *   npm init -y
 *   npm install mysql2 bcrypt dotenv
 *
 * USAGE:
 *   1. Make sure vtms_database.sql has already been run against MySQL
 *      (so the users/drivers/vehicles tables exist).
 *   2. Set your DB credentials below or via a .env file (DB_HOST,
 *      DB_PORT, DB_USER, DB_PASSWORD, DB_NAME).
 *   3. node seed-users.js
 *
 * All seeded users share the password: Password123!
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'vehicle_transport_management',
};

const DEFAULT_PASSWORD = 'Password123!';

const USERS = [
  { fullName: 'Alice Officer', username: 'officer1', email: 'officer1@vtms.local', role: 'OFFICER' },
  { fullName: 'John Driver', username: 'driver1', email: 'driver1@vtms.local', role: 'DRIVER' },
  { fullName: 'Mary Driver', username: 'driver2', email: 'driver2@vtms.local', role: 'DRIVER' },
  { fullName: 'Peter Transport', username: 'transport1', email: 'transport1@vtms.local', role: 'TRANSPORT_OFFICER' },
  { fullName: 'Nancy HPMU', username: 'hpmu1', email: 'hpmu1@vtms.local', role: 'HPMU' },
  { fullName: 'Robert R3', username: 'r3approver1', email: 'r3approver1@vtms.local', role: 'R3' },
];

async function seed() {
  const conn = await mysql.createConnection(DB_CONFIG);
  console.log(`Connected to ${DB_CONFIG.database} at ${DB_CONFIG.host}:${DB_CONFIG.port}`);

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  for (const u of USERS) {
    const [existing] = await conn.execute('SELECT id FROM users WHERE username = ?', [u.username]);

    let userId;
    if (existing.length > 0) {
      userId = existing[0].id;
      console.log(`- ${u.username} already exists (id ${userId}), skipping insert.`);
    } else {
      const [result] = await conn.execute(
        `INSERT INTO users (full_name, username, email, role, password_hash, status)
         VALUES (?, ?, ?, ?, ?, 'ACTIVE')`,
        [u.fullName, u.username, u.email, u.role, passwordHash]
      );
      userId = result.insertId;
      console.log(`+ Created ${u.username} (${u.role}), id ${userId}`);
    }

    if (u.role === 'DRIVER') {
      const [existingDriver] = await conn.execute('SELECT id FROM drivers WHERE user_id = ?', [userId]);
      if (existingDriver.length === 0) {
        await conn.execute(
          `INSERT INTO drivers (user_id, license_number, license_expiry, status)
           VALUES (?, ?, ?, 'AVAILABLE')`,
          [userId, `DL-${1000 + userId}`, '2027-12-31']
        );
        console.log(`  + Created driver profile for ${u.username}`);
      }
    }
  }

  await conn.end();
  console.log('\nDone. All seeded users share the password: Password123!');
  console.log('Login usernames: officer1, driver1, driver2, transport1, hpmu1, r3approver1');
}

seed().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
