const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: true, field: 'user_id' },
  action: { type: DataTypes.STRING, allowNull: false },
  entity: { type: DataTypes.STRING, allowNull: true },
  entityId: { type: DataTypes.INTEGER, allowNull: true, field: 'entity_id' },
  description: { type: DataTypes.TEXT, allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
  ipAddress: { type: DataTypes.STRING, allowNull: true, field: 'ip_address' },
}, {
  tableName: 'audit_logs',
  timestamps: true,
  updatedAt: false,
  underscored: true,
});

module.exports = AuditLog;
