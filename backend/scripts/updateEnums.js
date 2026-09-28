require('dotenv').config();
const sequelize = require('../config/database');

async function updateEnums() {
  try {
    // Update trips status enum
    await sequelize.query(`
      ALTER TABLE trips
      MODIFY COLUMN status ENUM('NOT_STARTED', 'DRIVER_ASSIGNED', 'TRIP_STARTED', 'IN_PROGRESS', 'TRIP_COMPLETED', 'CLOSED') NOT NULL DEFAULT 'NOT_STARTED'
    `);
    console.log('Trip status enum updated');

    // Update fuel_requests status enum
    await sequelize.query(`
      ALTER TABLE fuel_requests
      MODIFY COLUMN status ENUM('PENDING', 'HPMU_REVIEW', 'HPMU_APPROVED', 'HPMU_REJECTED', 'HPMU_RETURNED', 'HPMU_RELEASED', 'DRIVER_CONFIRMED', 'COMPLETED') NOT NULL DEFAULT 'PENDING'
    `);
    console.log('Fuel request status enum updated');

    // Update vehicle_requests status enum
    await sequelize.query(`
      ALTER TABLE vehicle_requests
      MODIFY COLUMN status ENUM('PENDING', 'TRANSPORT_REVIEW', 'HPMU_REVIEW', 'HPMU_APPROVED', 'HPMU_REJECTED', 'HPMU_RETURNED', 'R3_REVIEW', 'R3_APPROVED', 'DRIVER_ASSIGNED', 'FUEL_REQUESTED', 'APPROVED', 'REJECTED', 'RETURNED', 'CANCELLED', 'TRIP_STARTED', 'TRIP_COMPLETED', 'CLOSED') NOT NULL DEFAULT 'PENDING'
    `);
    console.log('Vehicle request status enum updated');

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('Failed to update enums:', err.message);
    await sequelize.close();
    process.exit(1);
  }
}

updateEnums();