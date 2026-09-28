const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FuelRequest = sequelize.define(
  'FuelRequest',
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    tripId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'trip_id',
    },

    vehicleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'vehicle_id',
    },

    driverId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'driver_id',
    },

    currentKm: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'current_km',
    },

    litresRequested: {
      type: DataTypes.FLOAT,
      allowNull: false,
      field: 'litres_requested',
    },

    litresCalculated: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'litres_calculated',
    },

    // Snapshot of trip progress at the time
    // the driver submitted the fuel request.
    routeDistanceKm: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'route_distance_km',
    },

    completedKm: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'completed_km',
    },

    remainingKm: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'remaining_km',
    },

    previousFuelIssued: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'previous_fuel_issued',
    },

    exceedsEstimate: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'exceeds_estimate',
    },

    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    /*
     * Fuel approval workflow (HPMU-based):
     *
     * PENDING
     *    ↓
     * HPMU_REVIEW
     *    ↓
     * HPMU_APPROVED / HPMU_REJECTED / HPMU_RETURNED
     *    ↓
     * HPMU_RELEASED
     *    ↓
     * DRIVER_CONFIRMED
     *    ↓
     * COMPLETED
     */
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

    // HPMU Review fields
    hpmuReviewComment: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'hpmu_review_comment',
    },
    hpmuReviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'hpmu_reviewed_by',
    },
    hpmuReviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'hpmu_reviewed_at',
    },

    // HPMU Release fields
    litresReleased: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'litres_released',
    },
    releaseComment: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'release_comment',
    },
    releasedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'released_by',
    },
    releasedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'released_at',
    },

    // Driver confirmation
    confirmedByDriver: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'confirmed_by_driver',
    },
    confirmedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'confirmed_at',
    },
    actualLitresReceived: {
      type: DataTypes.FLOAT,
      allowNull: true,
      field: 'actual_litres_received',
    },
    confirmationNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'confirmation_notes',
    },

    // Official HPMU fuel voucher token (10-20 letters/numbers).
    // Enforced in the API (routes/hpmu.js) and here so the database
    // layer rejects anything the API would not accept.
    voucherNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
      field: 'voucher_number',
      validate: {
        voucherTokenLength(value) {
          if (value == null || value === '') return;
          const token = String(value).trim();
          if (token.length < 10 || token.length > 20) {
            throw new Error('Voucher token must contain between 10 and 20 characters.');
          }
          if (!/^[A-Za-z0-9]+$/.test(token)) {
            throw new Error('Voucher token may only contain letters and numbers.');
          }
        },
      },
    },
    voucherStatus: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'USED', 'VOID'),
      allowNull: false,
      defaultValue: 'PENDING',
      field: 'voucher_status',
    },
    voucherIssuedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'voucher_issued_at',
    },

    // Request type: NORMAL (default) or EMERGENCY
    requestType: {
      type: DataTypes.ENUM('NORMAL', 'EMERGENCY'),
      allowNull: false,
      defaultValue: 'NORMAL',
      field: 'request_type',
    },

    // Emergency reason - required when requestType is EMERGENCY
    emergencyReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'emergency_reason',
    },
  },
  {
    tableName: 'fuel_requests',
    underscored: true,
  }
);

module.exports = FuelRequest;