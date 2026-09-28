require('dotenv').config();
const sequelize = require('../config/database');

async function addTripCancelledEnum() {
  try {
    await sequelize.query(`
      ALTER TABLE trips
      MODIFY COLUMN status ENUM(
        'NOT_STARTED',
        'DRIVER_ASSIGNED',
        'DRIVER_ACCEPTED',
        'DRIVER_CANCELLED',
        'TRIP_STARTED',
        'IN_PROGRESS',
        'TRIP_COMPLETED',
        'CLOSED',
        'CANCELLED'
      ) NOT NULL DEFAULT 'NOT_STARTED'
    `);
    console.log('trips.status ENUM updated: CANCELLED added');
    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Failed to update trips enum:', err.message);
    await sequelize.close();
    process.exit(1);
  }
}

addTripCancelledEnum();
