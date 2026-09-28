const { Sequelize } = require('sequelize');
require('dotenv').config();

// IMPORTANT: this must point at vehicle_transport_management, never at
// an unrelated database. Verify DB_NAME below matches your .env file.
const DB_NAME = process.env.DB_NAME || 'vehicle_transport_management';

const sequelize = new Sequelize(
  DB_NAME,
  process.env.DB_USER || 'root',
  process.env.DB_PASSWORD || '',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    dialect: 'mysql',
    logging: false,
    define: {
      underscored: true,
      timestamps: true,
    },
  }
);

module.exports = sequelize;
