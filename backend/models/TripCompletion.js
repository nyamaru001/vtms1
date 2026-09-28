const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TripCompletion = sequelize.define('TripCompletion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tripId: { type: DataTypes.INTEGER, allowNull: false, field: 'trip_id' },
  role: { type: DataTypes.ENUM('DRIVER', 'OFFICER'), allowNull: false },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  endKm: { type: DataTypes.FLOAT, allowNull: true, field: 'end_km' },
  notes: { type: DataTypes.TEXT, allowNull: true },
  confirmedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'confirmed_at' },
}, {
  tableName: 'trip_completions',
  timestamps: true,
  underscored: true,
  indexes: [
    { unique: true, fields: ['trip_id', 'role'] },
  ],
});

module.exports = TripCompletion;
