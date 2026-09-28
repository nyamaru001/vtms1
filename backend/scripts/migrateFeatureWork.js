/**
 * One-time safe migrations for feature work.
 * Adds new status enum values and creates new tables if missing.
 * Idempotent: safe to run multiple times.
 */
require('dotenv').config();
const { Sequelize, DataTypes, QueryTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: 'mysql',
    logging: false,
  }
);

async function columnHasEnumValue(table, column, value) {
  const rows = await sequelize.query(
    `SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`,
    { type: QueryTypes.SELECT }
  );
  if (!rows.length) return false;
  return String(rows[0].Type || '').includes(`'${value}'`);
}

async function alterTripStatus() {
  const needed = [];
  for (const v of ['DRIVER_COMPLETED', 'OFFICER_COMPLETED']) {
    if (!(await columnHasEnumValue('trips', 'status', v))) needed.push(v);
  }
  if (!needed.length) {
    console.log('trips.status already has completion enum values');
    return;
  }
  const base = "enum('NOT_STARTED','DRIVER_ASSIGNED','DRIVER_ACCEPTED','DRIVER_CANCELLED','TRIP_STARTED','IN_PROGRESS','TRIP_COMPLETED','CLOSED','CANCELLED'";
  // rebuild with new values inserted before TRIP_COMPLETED
  const full = `enum('NOT_STARTED','DRIVER_ASSIGNED','DRIVER_ACCEPTED','DRIVER_CANCELLED','TRIP_STARTED','IN_PROGRESS','${needed.join("','")}','TRIP_COMPLETED','CLOSED','CANCELLED')`;
  await sequelize.query(`ALTER TABLE trips MODIFY status ${full} NOT NULL DEFAULT 'NOT_STARTED'`);
  console.log('trips.status altered:', needed.join(', '));
  void base;
}

async function alterRequestStatus() {
  const needed = [];
  for (const v of ['DRIVER_COMPLETED', 'OFFICER_COMPLETED']) {
    if (!(await columnHasEnumValue('vehicle_requests', 'status', v))) needed.push(v);
  }
  if (!needed.length) {
    console.log('vehicle_requests.status already has completion enum values');
    return;
  }
  const full = `enum('PENDING','R3_REVIEW','R3_APPROVED','R3_REJECTED','R3_RETURNED','TRANSPORT_REVIEW','DRIVER_ASSIGNED','DRIVER_ACCEPTED','DRIVER_CANCELLED','FUEL_REQUESTED','HPMU_REVIEW','HPMU_APPROVED','HPMU_REJECTED','HPMU_RETURNED','HPMU_RELEASED','DRIVER_CONFIRMED','TRIP_STARTED','${needed.join("','")}','TRIP_COMPLETED','CLOSED','CANCELLED')`;
  await sequelize.query(`ALTER TABLE vehicle_requests MODIFY status ${full} DEFAULT 'PENDING'`);
  console.log('vehicle_requests.status altered:', needed.join(', '));
}

async function createNewTables() {
  const TripCompletion = sequelize.define('TripCompletion', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tripId: { type: DataTypes.INTEGER, allowNull: false, field: 'trip_id' },
    role: { type: DataTypes.ENUM('DRIVER', 'OFFICER'), allowNull: false },
    userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
    endKm: { type: DataTypes.FLOAT, allowNull: true, field: 'end_km' },
    notes: { type: DataTypes.TEXT, allowNull: true },
    confirmedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'confirmed_at' },
  }, { tableName: 'trip_completions', timestamps: true, underscored: true, indexes: [{ unique: true, fields: ['trip_id', 'role'] }] });

  const RequestActivity = sequelize.define('RequestActivity', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    requestId: { type: DataTypes.INTEGER, allowNull: false, field: 'request_id' },
    tripId: { type: DataTypes.INTEGER, allowNull: true, field: 'trip_id' },
    actorId: { type: DataTypes.INTEGER, allowNull: true, field: 'actor_id' },
    actorRole: { type: DataTypes.STRING, allowNull: true, field: 'actor_role' },
    action: { type: DataTypes.STRING, allowNull: false },
    fromStatus: { type: DataTypes.STRING, allowNull: true, field: 'from_status' },
    toStatus: { type: DataTypes.STRING, allowNull: true, field: 'to_status' },
    comment: { type: DataTypes.TEXT, allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
  }, { tableName: 'request_activities', timestamps: true, updatedAt: false, underscored: true });

  const AssignmentHistory = sequelize.define('AssignmentHistory', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    requestId: { type: DataTypes.INTEGER, allowNull: false, field: 'request_id' },
    tripId: { type: DataTypes.INTEGER, allowNull: true, field: 'trip_id' },
    driverId: { type: DataTypes.INTEGER, allowNull: true, field: 'driver_id' },
    vehicleId: { type: DataTypes.INTEGER, allowNull: true, field: 'vehicle_id' },
    action: { type: DataTypes.ENUM('ASSIGNED', 'REJECTED', 'REASSIGNED', 'CANCELLED'), allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: true },
    actorId: { type: DataTypes.INTEGER, allowNull: true, field: 'actor_id' },
    actorRole: { type: DataTypes.STRING, allowNull: true, field: 'actor_role' },
  }, { tableName: 'assignment_histories', timestamps: true, updatedAt: false, underscored: true });

  const DriverFuelEntry = sequelize.define('DriverFuelEntry', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tripId: { type: DataTypes.INTEGER, allowNull: true, field: 'trip_id' },
    logbookId: { type: DataTypes.INTEGER, allowNull: true, field: 'logbook_id' },
    driverId: { type: DataTypes.INTEGER, allowNull: false, field: 'driver_id' },
    vehicleId: { type: DataTypes.INTEGER, allowNull: true, field: 'vehicle_id' },
    entryDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'entry_date' },
    description: { type: DataTypes.STRING, allowNull: true },
    litres: { type: DataTypes.FLOAT, allowNull: true },
    amount: { type: DataTypes.FLOAT, allowNull: true },
    stationReference: { type: DataTypes.STRING, allowNull: true, field: 'station_reference' },
    receiptPath: { type: DataTypes.STRING, allowNull: true, field: 'receipt_path' },
    notes: { type: DataTypes.TEXT, allowNull: true },
  }, { tableName: 'driver_fuel_entries', timestamps: true, underscored: true });

  await sequelize.sync();
  console.log('New tables ensured: trip_completions, request_activities, assignment_histories, driver_fuel_entries');
}

async function addFuelVoucherColumns() {
  const tableExists = await sequelize.query(
    `SHOW TABLES LIKE 'fuel_requests'`,
    { type: QueryTypes.SELECT }
  );
  if (!tableExists.length) {
    console.log('fuel_requests table not found; skip voucher columns');
    return;
  }

  const cols = await sequelize.query(`SHOW COLUMNS FROM fuel_requests`, { type: QueryTypes.SELECT });
  const names = cols.map((c) => c.Field);
  if (!names.includes('voucher_number')) {
    await sequelize.query(
      `ALTER TABLE fuel_requests ADD COLUMN voucher_number VARCHAR(32) NULL UNIQUE`
    );
    console.log('Added voucher_number');
  } else {
    console.log('voucher_number already exists');
  }
  if (!names.includes('voucher_status')) {
    await sequelize.query(
      `ALTER TABLE fuel_requests ADD COLUMN voucher_status ENUM('PENDING','APPROVED','USED','VOID') NOT NULL DEFAULT 'PENDING'`
    );
    console.log('Added voucher_status');
  } else {
    console.log('voucher_status already exists');
  }
  if (!names.includes('voucher_issued_at')) {
    await sequelize.query(`ALTER TABLE fuel_requests ADD COLUMN voucher_issued_at DATETIME NULL`);
    console.log('Added voucher_issued_at');
  } else {
    console.log('voucher_issued_at already exists');
  }
}

async function main() {
  try {
    await sequelize.authenticate();
    await alterTripStatus();
    await alterRequestStatus();
    await createNewTables();
    await addFuelVoucherColumns();
    console.log('Migration complete.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
