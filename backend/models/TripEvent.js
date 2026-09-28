const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TripEvent = sequelize.define('TripEvent', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tripId: { type: DataTypes.INTEGER, allowNull: false, field: 'trip_id' },
  driverId: { type: DataTypes.INTEGER, allowNull: false, field: 'driver_id' },
  type: {
    type: DataTypes.ENUM('ROUTE_CHANGE', 'UNPLANNED_STOP', 'BREAKDOWN', 'INCIDENT', 'OTHER'),
    allowNull: false,
    defaultValue: 'ROUTE_CHANGE',
  },
  locationName: { type: DataTypes.STRING, allowNull: true, field: 'location_name' },
  latitude: { type: DataTypes.FLOAT, allowNull: true },
  longitude: { type: DataTypes.FLOAT, allowNull: true },
  reason: { type: DataTypes.TEXT, allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'trip_events',
  timestamps: true,
  underscored: true,
});

module.exports = TripEvent;
