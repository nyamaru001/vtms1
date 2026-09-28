require('dotenv').config();
const sequelize = require('../config/database');

async function updateRoleEnum() {
  try {
    await sequelize.query(`
      ALTER TABLE users
      MODIFY COLUMN role ENUM('ADMIN', 'OFFICER', 'DRIVER', 'TRANSPORT_OFFICER', 'R3', 'HPMU') NOT NULL
    `);
    console.log('Role enum updated successfully');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Failed to update role enum:', err.message);
    await sequelize.close();
    process.exit(1);
  }
}

updateRoleEnum();