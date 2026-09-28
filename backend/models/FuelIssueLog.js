const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FuelIssueLog = sequelize.define('FuelIssueLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fuelRequestId: { type: DataTypes.INTEGER, allowNull: true, field: 'fuel_request_id' },
  extraFuelRequestId: { type: DataTypes.INTEGER, allowNull: true, field: 'extra_fuel_request_id' },
  tripId: { type: DataTypes.INTEGER, allowNull: true, field: 'trip_id' },
  vehicleId: { type: DataTypes.INTEGER, allowNull: false, field: 'vehicle_id' },
  driverId: { type: DataTypes.INTEGER, allowNull: false, field: 'driver_id' },
  hpmuUserId: { type: DataTypes.INTEGER, allowNull: false, field: 'hpmu_user_id' },
  litresIssued: { type: DataTypes.FLOAT, allowNull: false, field: 'litres_issued' },
  issueOdometerKm: { type: DataTypes.FLOAT, allowNull: true, field: 'issue_odometer_km' },
  stationReference: { type: DataTypes.STRING, allowNull: true, field: 'station_reference' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  issuedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'issued_at' },
}, {
  tableName: 'fuel_issue_logs',
  timestamps: true,
  underscored: true,
});

module.exports = FuelIssueLog;
