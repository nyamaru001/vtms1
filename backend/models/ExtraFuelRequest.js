const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExtraFuelRequest = sequelize.define('ExtraFuelRequest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tripId: { type: DataTypes.INTEGER, allowNull: false, field: 'trip_id' },
  vehicleId: { type: DataTypes.INTEGER, allowNull: false, field: 'vehicle_id' },
  driverId: { type: DataTypes.INTEGER, allowNull: false, field: 'driver_id' },
  officerId: { type: DataTypes.INTEGER, allowNull: false, field: 'officer_id' },
  requestedLitres: { type: DataTypes.FLOAT, allowNull: false, field: 'requested_litres' },
  reason: { type: DataTypes.TEXT, allowNull: false },
  currentLat: { type: DataTypes.FLOAT, allowNull: true, field: 'current_lat' },
  currentLng: { type: DataTypes.FLOAT, allowNull: true, field: 'current_lng' },
  currentLocationName: { type: DataTypes.STRING, allowNull: true, field: 'current_location_name' },
  status: {
    type: DataTypes.ENUM(
      'PENDING',
      'HPMU_REVIEW',
      'HPMU_APPROVED',
      'HPMU_REJECTED',
      'HPMU_RETURNED',
      'HPMU_RELEASED',
      'DRIVER_CONFIRMED',
      'COMPLETED'
    ),
    allowNull: false,
    defaultValue: 'PENDING',
  },
  hpmuReviewedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'hpmu_reviewed_by' },
  hpmuReviewedAt: { type: DataTypes.DATE, allowNull: true, field: 'hpmu_reviewed_at' },
  hpmuReviewComment: { type: DataTypes.TEXT, allowNull: true, field: 'hpmu_review_comment' },
  litresReleased: { type: DataTypes.FLOAT, allowNull: true, field: 'litres_released' },
  releaseComment: { type: DataTypes.TEXT, allowNull: true, field: 'release_comment' },
  releasedBy: { type: DataTypes.INTEGER, allowNull: true, field: 'released_by' },
  releasedAt: { type: DataTypes.DATE, allowNull: true, field: 'released_at' },
  confirmedByDriver: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'confirmed_by_driver' },
  confirmedAt: { type: DataTypes.DATE, allowNull: true, field: 'confirmed_at' },
  actualLitresReceived: { type: DataTypes.FLOAT, allowNull: true, field: 'actual_litres_received' },
  confirmationNotes: { type: DataTypes.TEXT, allowNull: true, field: 'confirmation_notes' },
}, {
  tableName: 'extra_fuel_requests',
  underscored: true,
});

module.exports = ExtraFuelRequest;