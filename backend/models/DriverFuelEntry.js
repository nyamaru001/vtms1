const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
}, {
  tableName: 'driver_fuel_entries',
  timestamps: true,
  underscored: true,
});

module.exports = DriverFuelEntry;
