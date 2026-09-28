const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Vehicle = sequelize.define('Vehicle', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  registrationNumber: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'registration_number' },
  model: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: true },
  fuelType: { type: DataTypes.STRING, allowNull: true, field: 'fuel_type' },
  fuelConsumptionKmPerLitre: {
    type: DataTypes.FLOAT, allowNull: false, defaultValue: 10, field: 'fuel_consumption_km_per_litre',
  },
  currentOdometer: { type: DataTypes.FLOAT, defaultValue: 0, field: 'current_odometer' },
  status: {
    type: DataTypes.ENUM('AVAILABLE', 'ASSIGNED', 'IN_TRIP', 'MAINTENANCE', 'INACTIVE'),
    defaultValue: 'AVAILABLE',
  },
  serviceDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'service_date' },
  insuranceExpiry: { type: DataTypes.DATEONLY, allowNull: true, field: 'insurance_expiry' },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'vehicles',
  underscored: true,
});

module.exports = Vehicle;
