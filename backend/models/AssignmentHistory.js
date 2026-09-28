const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
}, {
  tableName: 'assignment_histories',
  timestamps: true,
  updatedAt: false,
  underscored: true,
});

module.exports = AssignmentHistory;
