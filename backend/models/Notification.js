const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  link: { type: DataTypes.STRING, allowNull: true },
  type: { type: DataTypes.STRING, allowNull: true },
  referenceId: { type: DataTypes.INTEGER, allowNull: true, field: 'reference_id' },
  referenceType: { type: DataTypes.STRING, allowNull: true, field: 'reference_type' },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_read' },
}, {
  tableName: 'notifications',
  underscored: true,
});

module.exports = Notification;
