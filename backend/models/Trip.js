const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Trip = sequelize.define(
  'Trip',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    tripNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      field: 'trip_number',
    },

    requestId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'request_id',
    },

    vehicleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'vehicle_id',
    },

    /*
     * IMPORTANT:
     * This must contain drivers.id
     * NOT users.id
     */
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'driver_id',
    },

    officerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'officer_id',
    },

    startKm: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'start_km',
    },

    endKm: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'end_km',
    },

    totalOdometerKm: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'total_odometer_km',
    },

    startTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'start_time',
    },

    endTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'end_time',
    },

    startLat: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'start_lat',
    },

    startLng: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'start_lng',
    },

    endLat: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'end_lat',
    },

    endLng: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'end_lng',
    },

    tripType: {
      type: DataTypes.ENUM('NORMAL', 'EMERGENCY'),
      allowNull: false,
      defaultValue: 'NORMAL',
      field: 'trip_type',
    },

    emergencyReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'emergency_reason',
    },

    emergencyNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'emergency_notes',
    },

    status: {
      type: DataTypes.ENUM(
        'NOT_STARTED',
        'DRIVER_ASSIGNED',
        'DRIVER_ACCEPTED',
        'DRIVER_CANCELLED',
        'TRIP_STARTED',
        'IN_PROGRESS',
        'DRIVER_COMPLETED',
        'OFFICER_COMPLETED',
        'TRIP_COMPLETED',
        'CLOSED',
        'CANCELLED'
      ),
      allowNull: false,
      defaultValue: 'NOT_STARTED',
    },
  },
  {
    tableName: 'trips',
    timestamps: true,
    underscored: true,
  }
);

module.exports = Trip;