const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Logbook = sequelize.define('Logbook', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tripId: { type: DataTypes.INTEGER, allowNull: true, field: 'trip_id' },
  entryDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'entry_date' },
  vehicleId: { type: DataTypes.INTEGER, allowNull: true, field: 'vehicle_id' },
  driverId: { type: DataTypes.INTEGER, allowNull: false, field: 'driver_id' },
  officerId: { type: DataTypes.INTEGER, allowNull: true, field: 'officer_id' },
  purpose: { type: DataTypes.TEXT, allowNull: true },
  tripName: { type: DataTypes.STRING, allowNull: true, field: 'trip_name' },
  carType: { type: DataTypes.STRING, allowNull: true, field: 'car_type' },
  vehicleRegistration: { type: DataTypes.STRING, allowNull: true, field: 'vehicle_registration' },
  fuelType: { type: DataTypes.STRING, allowNull: true, field: 'fuel_type' },
  fuelRequested: { type: DataTypes.FLOAT, allowNull: true, field: 'fuel_requested' },
  origin: { type: DataTypes.STRING, allowNull: true },
  destination: { type: DataTypes.STRING, allowNull: true },
  routeDistanceKm: { type: DataTypes.FLOAT, allowNull: true, field: 'route_distance_km' },
  startTime: { type: DataTypes.DATE, allowNull: true, field: 'start_time' },
  endTime: { type: DataTypes.DATE, allowNull: true, field: 'end_time' },
  startKm: { type: DataTypes.FLOAT, allowNull: true, field: 'start_km' },
  endKm: { type: DataTypes.FLOAT, allowNull: true, field: 'end_km' },
  totalKm: { type: DataTypes.FLOAT, allowNull: true, field: 'total_km' },
  fuelUsedLitres: { type: DataTypes.FLOAT, allowNull: true, field: 'fuel_used_litres' },
  fuelIssuedLitres: { type: DataTypes.FLOAT, allowNull: true, field: 'fuel_issued_litres' },
  fuelAvailableBeforeTrip: { type: DataTypes.FLOAT, allowNull: true, field: 'fuel_available_before_trip' },
  fuelReceivedFromHPMU: { type: DataTypes.FLOAT, allowNull: true, field: 'fuel_received_from_hpmu' },
  fuelRemaining: { type: DataTypes.FLOAT, allowNull: true, field: 'fuel_remaining' },
  remarks: { type: DataTypes.TEXT, allowNull: true },
  postTripNotes: { type: DataTypes.TEXT, allowNull: true, field: 'post_trip_notes' },
  status: {
    type: DataTypes.ENUM('DRAFT', 'SUBMITTED', 'VERIFIED', 'RETURNED', 'CLOSED'),
    allowNull: false,
    defaultValue: 'DRAFT',
  },
  submittedAt: { type: DataTypes.DATE, allowNull: true, field: 'submitted_at' },
  verifiedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'verified_by' },
  verifiedAt: { type: DataTypes.DATE, allowNull: true, field: 'verified_at' },
  reviewComment: { type: DataTypes.TEXT, allowNull: true, field: 'review_comment' },
  signature: { type: DataTypes.TEXT('LONG'), allowNull: true, field: 'signature' },
}, {
  tableName: 'logbooks',
  underscored: true,
});

module.exports = Logbook;
