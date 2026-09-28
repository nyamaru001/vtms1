const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const VehicleRequest = sequelize.define('VehicleRequest', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  requestNumber: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'request_number' },
  officerId: { type: DataTypes.INTEGER, allowNull: false, field: 'officer_id' },

  purpose: { type: DataTypes.TEXT, allowNull: false },
  originName: { type: DataTypes.STRING, allowNull: false, field: 'origin_name' },
  originLat: { type: DataTypes.FLOAT, allowNull: false, field: 'origin_lat' },
  originLng: { type: DataTypes.FLOAT, allowNull: false, field: 'origin_lng' },
  destinationName: { type: DataTypes.STRING, allowNull: false, field: 'destination_name' },
  destinationLat: { type: DataTypes.FLOAT, allowNull: false, field: 'destination_lat' },
  destinationLng: { type: DataTypes.FLOAT, allowNull: false, field: 'destination_lng' },

  departureDate: { type: DataTypes.DATEONLY, allowNull: false, field: 'departure_date' },
  departureTime: { type: DataTypes.STRING, allowNull: false, field: 'departure_time' },
  returnDate: { type: DataTypes.DATEONLY, allowNull: true, field: 'return_date' },
  returnTime: { type: DataTypes.STRING, allowNull: true, field: 'return_time' },
  passengers: { type: DataTypes.INTEGER, defaultValue: 1 },
  additionalNotes: { type: DataTypes.TEXT, allowNull: true, field: 'additional_notes' },

  // Route calculation (auto-computed, never hand-entered as the primary value)
  oneWayKm: { type: DataTypes.FLOAT, allowNull: true, field: 'one_way_km' },
  roundTripKm: { type: DataTypes.FLOAT, allowNull: true, field: 'round_trip_km' },
  durationMinutes: { type: DataTypes.FLOAT, allowNull: true, field: 'duration_minutes' },
  routeGeometry: { type: DataTypes.JSON, allowNull: true, field: 'route_geometry' },

  // Fuel calculation
  baseFuelLitres: { type: DataTypes.FLOAT, allowNull: true, field: 'base_fuel_litres' },
  fuelBufferPercent: { type: DataTypes.FLOAT, allowNull: true, field: 'fuel_buffer_percent' },
  totalFuelLitres: { type: DataTypes.FLOAT, allowNull: true, field: 'total_fuel_litres' },

  vehicleId: { type: DataTypes.INTEGER, allowNull: true, field: 'vehicle_id' },
  driverId: { type: DataTypes.INTEGER, allowNull: true, field: 'driver_id' },

  // Cancellation fields
  cancellationReason: { type: DataTypes.TEXT, allowNull: true, field: 'cancellation_reason' },
  cancelledAt: { type: DataTypes.DATE, allowNull: true, field: 'cancelled_at' },
  cancelledBy: { type: DataTypes.INTEGER, allowNull: true, field: 'cancelled_by' },

  status: {
    type: DataTypes.ENUM(
      'PENDING',
      'R3_REVIEW',
      'R3_APPROVED',
      'R3_REJECTED',
      'R3_RETURNED',
      'TRANSPORT_REVIEW',
      'DRIVER_ASSIGNED',
      'DRIVER_ACCEPTED',
      'DRIVER_CANCELLED',
      'FUEL_REQUESTED',
      'HPMU_REVIEW',
      'HPMU_APPROVED',
      'HPMU_REJECTED',
      'HPMU_RETURNED',
      'HPMU_RELEASED',
      'DRIVER_CONFIRMED',
      'TRIP_STARTED',
      'DRIVER_COMPLETED',
      'OFFICER_COMPLETED',
      'TRIP_COMPLETED',
      'CLOSED',
      'CANCELLED'
    ),
    defaultValue: 'PENDING',
  },
}, {
  tableName: 'vehicle_requests',
  underscored: true,
});

module.exports = VehicleRequest;
