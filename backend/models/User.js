const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  fullName: { type: DataTypes.STRING, allowNull: false, field: 'full_name' },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  email: { type: DataTypes.STRING, allowNull: true, validate: { isEmail: true } },
  phone: { type: DataTypes.STRING, allowNull: true },
  role: {
    type: DataTypes.ENUM('ADMIN', 'OFFICER', 'DRIVER', 'TRANSPORT_OFFICER', 'R3', 'HPMU'),
    allowNull: false,
  },
  passwordHash: { type: DataTypes.STRING, allowNull: false, field: 'password_hash' },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE'),
    defaultValue: 'ACTIVE',
  },
  profilePhoto: { type: DataTypes.STRING, allowNull: true, field: 'profile_photo' },
}, {
  tableName: 'users',
  underscored: true,
});

module.exports = User;
