require('dotenv').config();
const sequelize = require('../config/database');
const {
  TripEvent,
  TripLocation,
  AuditLog,
  Notification,
  HPMURecommendation,
  R3Approval,
  FuelIssueLog,
  Logbook,
  ExtraFuelRequest,
  FuelRequest,
  Trip,
  VehicleRequest,
  Driver,
  Vehicle,
  User,
} = require('../models');

const deleted = [];
const kept = [];
const errors = [];

async function destroy(Model, label, where = {}) {
  try {
    const count = await Model.destroy({ where, force: true });
    console.log(`  Deleted ${count} records from ${label}`);
    if (count > 0) deleted.push(`${label}: ${count}`);
  } catch (err) {
    console.error(`  Error deleting from ${label}: ${err.message}`);
    errors.push(`${label}: ${err.message}`);
  }
}

async function cleanProduction() {
  console.log('=== VTMS Production Data Cleanup ===\n');

  // Verify connection
  try {
    await sequelize.authenticate();
    console.log('Database connected.\n');
  } catch (err) {
    console.error('Unable to connect to database:', err.message);
    process.exit(1);
  }

  // Delete in FK-safe order (children first, parents last)

  console.log('Cleaning TripEvent...');
  await destroy(TripEvent, 'TripEvent');

  console.log('Cleaning TripLocation...');
  await destroy(TripLocation, 'TripLocation');

  console.log('Cleaning AuditLog...');
  await destroy(AuditLog, 'AuditLog');

  console.log('Cleaning Notification...');
  await destroy(Notification, 'Notification');

  console.log('Cleaning HPMURecommendation...');
  await destroy(HPMURecommendation, 'HPMURecommendation');

  console.log('Cleaning R3Approval...');
  await destroy(R3Approval, 'R3Approval');

  console.log('Cleaning FuelIssueLog...');
  await destroy(FuelIssueLog, 'FuelIssueLog');

  console.log('Cleaning Logbook...');
  await destroy(Logbook, 'Logbook');

  console.log('Cleaning ExtraFuelRequest...');
  await destroy(ExtraFuelRequest, 'ExtraFuelRequest');

  console.log('Cleaning FuelRequest...');
  await destroy(FuelRequest, 'FuelRequest');

  console.log('Cleaning Trip...');
  await destroy(Trip, 'Trip');

  console.log('Cleaning VehicleRequest...');
  await destroy(VehicleRequest, 'VehicleRequest');

  // Driver: only delete if no active trips reference them
  console.log('Cleaning Driver (skipping those with active trips)...');
  try {
    const activeTrips = await Trip.findAll({
      attributes: ['driverId'],
      where: { status: { [require('sequelize').Op.notIn]: ['COMPLETED', 'CANCELLED'] } },
      group: ['driverId'],
    });
    const activeDriverIds = activeTrips.map((t) => t.driverId).filter(Boolean);

    const where = activeDriverIds.length > 0
      ? { id: { [require('sequelize').Op.notIn]: activeDriverIds } }
      : {};

    const count = await Driver.destroy({ where, force: true });
    console.log(`  Deleted ${count} drivers (${activeDriverIds.length} kept due to active trips)`);
    if (count > 0) deleted.push(`Driver: ${count}`);
    if (activeDriverIds.length > 0) kept.push(`Driver: ${activeDriverIds.length} (active trips)`);
  } catch (err) {
    console.error(`  Error deleting from Driver: ${err.message}`);
    errors.push(`Driver: ${err.message}`);
  }

  console.log('Cleaning Vehicle...');
  await destroy(Vehicle, 'Vehicle');

  // User: delete all except ADMIN users
  console.log('Cleaning User (keeping ADMIN users)...');
  try {
    const adminCount = await User.count({ where: { role: 'ADMIN' } });
    const deletedCount = await User.destroy({
      where: { role: { [require('sequelize').Op.ne]: 'ADMIN' } },
      force: true,
    });
    console.log(`  Deleted ${deletedCount} users (${adminCount} ADMIN users kept)`);
    if (deletedCount > 0) deleted.push(`User: ${deletedCount}`);
    if (adminCount > 0) kept.push(`User (ADMIN): ${adminCount}`);
  } catch (err) {
    console.error(`  Error deleting from User: ${err.message}`);
    errors.push(`User: ${err.message}`);
  }

  // Summary
  console.log('\n=== Summary ===');
  if (deleted.length > 0) {
    console.log('\nDeleted:');
    deleted.forEach((d) => console.log(`  - ${d}`));
  } else {
    console.log('\nNo records deleted.');
  }

  if (kept.length > 0) {
    console.log('\nKept:');
    kept.forEach((k) => console.log(`  - ${k}`));
  }

  if (errors.length > 0) {
    console.log('\nErrors:');
    errors.forEach((e) => console.log(`  - ${e}`));
  }

  console.log('\nDatabase structure (tables, columns, indexes) was NOT modified.');

  await sequelize.close();
  console.log('\nDone. Exiting.');

  process.exit(errors.length > 0 ? 1 : 0);
}

cleanProduction();
