const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Driver = sequelize.define('Driver', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'user_id' },
  licenseNumber: { type: DataTypes.STRING, allowNull: false, field: 'license_number' },
  licenseExpiry: { type: DataTypes.DATEONLY, allowNull: true, field: 'license_expiry' },
  status: {
    type: DataTypes.ENUM('AVAILABLE', 'ASSIGNED', 'ON_TRIP', 'BUSY', 'UNAVAILABLE', 'CANCELLED_ASSIGNMENT', 'INACTIVE'),
    defaultValue: 'AVAILABLE',
  },
  assignedVehicleId: { type: DataTypes.INTEGER, allowNull: true, field: 'assigned_vehicle_id' },
}, {
  tableName: 'drivers',
  underscored: true,
});

module.exports = Driver;
