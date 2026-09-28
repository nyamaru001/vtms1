const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
}, {
  tableName: 'request_activities',
  timestamps: true,
  updatedAt: false,
  underscored: true,
});

module.exports = RequestActivity;
