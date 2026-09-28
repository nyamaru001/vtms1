const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const R3Approval = sequelize.define('R3Approval', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  requestId: { type: DataTypes.INTEGER, allowNull: false, field: 'request_id' },
  reviewedBy: { type: DataTypes.INTEGER, allowNull: false, field: 'reviewed_by' },
  decision: {
    type: DataTypes.ENUM('APPROVE', 'REJECT', 'RETURN'),
    allowNull: false,
  },
  comment: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'r3_approvals',
  underscored: true,
});

module.exports = R3Approval;
