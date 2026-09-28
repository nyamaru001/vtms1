const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TripLocation = sequelize.define('TripLocation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tripId: { type: DataTypes.INTEGER, allowNull: false, field: 'trip_id' },
  driverId: { type: DataTypes.INTEGER, allowNull: false, field: 'driver_id' },
  vehicleId: { type: DataTypes.INTEGER, allowNull: false, field: 'vehicle_id' },
  latitude: { type: DataTypes.FLOAT, allowNull: false },
  longitude: { type: DataTypes.FLOAT, allowNull: false },
  recordedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'recorded_at' },
}, {
  tableName: 'trip_locations',
  timestamps: true,
  updatedAt: false,
  underscored: true,
});

module.exports = TripLocation;
