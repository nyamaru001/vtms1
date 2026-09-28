const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const HPMURecommendation = sequelize.define('HPMURecommendation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  requestId: { type: DataTypes.INTEGER, allowNull: false, field: 'request_id' },
  reviewedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'reviewed_by' },
  decision: {
    type: DataTypes.ENUM('APPROVE', 'REJECT', 'RETURN'),
    allowNull: false,
  },
  comment: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'hpmu_recommendations',
  underscored: true,
});

module.exports = HPMURecommendation;