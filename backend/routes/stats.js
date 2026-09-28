const express = require('express');
const { Op } = require('sequelize');

const {
  User,
  Vehicle,
  VehicleRequest,
  Trip,
  FuelRequest,
  Logbook,
  Driver,
} = require('../models');

const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

/*
 * Role-scoped dashboard statistics.
 * All numbers come from real database queries — never hardcoded.
 * GET /api/stats
 */
router.get('/', async (req, res, next) => {
  try {
    const role = req.user.role;
    const userId = req.user.id;

    /* =========================================================
       OFFICER
    ========================================================= */
    if (role === 'OFFICER') {
      const where = { officerId: userId };

      const [
        total,
        pending,
        pendingRequests,
        inProgress,
        completed,
        cancelled,
        rejected,
        trips,
        activeTrips,
        completedTrips,
      ] = await Promise.all([
        VehicleRequest.count({ where }),
        VehicleRequest.count({
          where: {
            ...where,
            status: { [Op.in]: ['R3_REVIEW', 'TRANSPORT_REVIEW'] },
          },
        }),
        VehicleRequest.count({
          where: {
            ...where,
            status: {
              [Op.notIn]: ['TRIP_COMPLETED', 'CLOSED', 'CANCELLED', 'R3_REJECTED', 'HPMU_REJECTED'],
            },
          },
        }),
        VehicleRequest.count({
          where: {
            ...where,
            status: {
              [Op.in]: [
                'R3_APPROVED',
                'DRIVER_ASSIGNED',
                'DRIVER_ACCEPTED',
                'FUEL_REQUESTED',
                'HPMU_REVIEW',
                'HPMU_APPROVED',
                'HPMU_RELEASED',
                'DRIVER_CONFIRMED',
                'TRIP_STARTED',
              ],
            },
          },
        }),
        VehicleRequest.count({
          where: {
            ...where,
            status: { [Op.in]: ['TRIP_COMPLETED', 'CLOSED'] },
          },
        }),
        VehicleRequest.count({ where: { ...where, status: 'CANCELLED' } }),
        VehicleRequest.count({
          where: {
            ...where,
            status: { [Op.in]: ['R3_REJECTED', 'HPMU_REJECTED'] },
          },
        }),
        Trip.count({ where: { officerId: userId } }),
        Trip.count({
          where: {
            officerId: userId,
            status: { [Op.in]: ['DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'IN_PROGRESS', 'TRIP_STARTED'] },
          },
        }),
        Trip.count({
          where: {
            officerId: userId,
            status: { [Op.in]: ['TRIP_COMPLETED', 'CLOSED'] },
          },
        }),
      ]);

      return res.json({
        total,
        pending,
        pendingRequests,
        inProgress,
        completed,
        cancelled,
        rejected,
        trips,
        activeTrips,
        completedTrips,
      });
    }

    /* =========================================================
       TRANSPORT OFFICER
    ========================================================= */
    if (role === 'TRANSPORT_OFFICER') {
      const [
        pendingReview,
        driverAssigned,
        activeTrips,
        completed,
        totalVehicles,
        availableVehicles,
        totalDrivers,
        availableDrivers,
      ] = await Promise.all([
        VehicleRequest.count({ where: { status: 'TRANSPORT_REVIEW' } }),
        VehicleRequest.count({ where: { status: 'DRIVER_ASSIGNED' } }),
        Trip.count({
          where: {
            status: { [Op.in]: ['DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'IN_PROGRESS', 'TRIP_STARTED'] },
          },
        }),
        Trip.count({
          where: { status: { [Op.in]: ['TRIP_COMPLETED', 'CLOSED'] } },
        }),
        Vehicle.count(),
        Vehicle.count({ where: { status: 'AVAILABLE' } }),
        Driver.count(),
        Driver.count({ where: { status: 'AVAILABLE' } }),
      ]);

      return res.json({
        pendingReview,
        driverAssigned,
        activeTrips,
        completed,
        totalVehicles,
        availableVehicles,
        totalDrivers,
        availableDrivers,
      });
    }

    /* =========================================================
       DRIVER
    ========================================================= */
    if (role === 'DRIVER') {
      const driver = await Driver.findOne({ where: { userId } });
      if (!driver) {
        return res.json({
          totalTrips: 0,
          completed: 0,
          active: 0,
          waiting: 0,
          fuelTotal: 0,
          fuelPending: 0,
          fuelApproved: 0,
          fuelReleased: 0,
          fuelReleasedCurrent: 0,
          fuelConfirmed: 0,
        });
      }

      const driverWhere = { driverId: driver.id };

      const [
        totalTrips,
        completed,
        active,
        waiting,
        fuelTotal,
        fuelPending,
        fuelApproved,
        fuelReleased,
        fuelReleasedCurrent,
        fuelConfirmed,
      ] = await Promise.all([
        Trip.count({ where: driverWhere }),
        Trip.count({
          where: { ...driverWhere, status: { [Op.in]: ['TRIP_COMPLETED', 'CLOSED'] } },
        }),
        Trip.count({
          where: {
            ...driverWhere,
            status: { [Op.in]: ['DRIVER_ACCEPTED', 'IN_PROGRESS', 'TRIP_STARTED'] },
          },
        }),
        Trip.count({ where: { ...driverWhere, status: 'DRIVER_ASSIGNED' } }),
        FuelRequest.count({ where: driverWhere }),
        FuelRequest.count({
          where: {
            ...driverWhere,
            status: { [Op.in]: ['PENDING', 'HPMU_REVIEW', 'HPMU_APPROVED'] },
          },
        }),
        FuelRequest.count({ where: { ...driverWhere, status: 'HPMU_APPROVED' } }),
        // Historical release count: once HPMU releases fuel the release is
        // part of history forever. Driver confirmation must never decrease it.
        FuelRequest.count({ where: { ...driverWhere, releasedAt: { [Op.ne]: null } } }),
        // Requests currently sitting in the released state (drops after confirm).
        FuelRequest.count({ where: { ...driverWhere, status: 'HPMU_RELEASED' } }),
        FuelRequest.count({ where: { ...driverWhere, status: 'DRIVER_CONFIRMED' } }),
      ]);

      return res.json({
        totalTrips,
        completed,
        active,
        waiting,
        fuelTotal,
        fuelPending,
        fuelApproved,
        fuelReleased,
        fuelReleasedCurrent,
        fuelConfirmed,
      });
    }

    /* =========================================================
       R3
    ========================================================= */
    if (role === 'R3') {
      const [
        pending,
        approved,
        rejected,
        returned,
        total,
      ] = await Promise.all([
        VehicleRequest.count({ where: { status: 'R3_REVIEW' } }),
        VehicleRequest.count({ where: { status: 'R3_APPROVED' } }),
        VehicleRequest.count({ where: { status: 'R3_REJECTED' } }),
        VehicleRequest.count({ where: { status: 'R3_RETURNED' } }),
        VehicleRequest.count({
          where: {
            status: { [Op.in]: ['R3_REVIEW', 'R3_APPROVED', 'R3_REJECTED', 'R3_RETURNED'] },
          },
        }),
      ]);

      return res.json({ pending, approved, rejected, returned, total });
    }

    /* =========================================================
       HPMU
    ========================================================= */
    if (role === 'HPMU') {
      const [
        pending,
        approved,
        releasedCurrent,
        releasedHistorical,
        driverConfirmed,
        completed,
        total,
        rejected,
        extraPending,
      ] = await Promise.all([
        FuelRequest.count({
          where: { status: { [Op.in]: ['PENDING', 'HPMU_REVIEW'] } },
        }),
        FuelRequest.count({ where: { status: 'HPMU_APPROVED' } }),
        // Requests currently in the released state (drops once the driver
        // confirms receipt) - informational only.
        FuelRequest.count({ where: { status: 'HPMU_RELEASED' } }),
        // Historical: any request HPMU has ever released, regardless of the
        // driver's current confirmation status. Never decreases over time.
        FuelRequest.count({
          where: { releasedAt: { [Op.ne]: null } },
        }),
        FuelRequest.count({ where: { status: 'DRIVER_CONFIRMED' } }),
        FuelRequest.count({ where: { status: 'COMPLETED' } }),
        FuelRequest.count(),
        FuelRequest.count({ where: { status: 'HPMU_REJECTED' } }),
        require('../models').ExtraFuelRequest.count({
          where: { status: { [Op.in]: ['PENDING', 'HPMU_REVIEW'] } },
        }),
      ]);

      const extraReleased = await require('../models').ExtraFuelRequest.count({
        where: { releasedAt: { [Op.ne]: null } },
      });

      return res.json({
        pending: pending + extraPending,
        approved,
        // "Fuel Released" is historical: releasing fuel is a permanent event.
        released: releasedHistorical + extraReleased,
        releasedCurrent,
        releasedHistorical: releasedHistorical + extraReleased,
        driverConfirmed,
        completed,
        total,
        rejected,
        extraPending,
      });
    }

/* =========================================================
       ADMIN (same shape as /api/admin/stats)
    ========================================================= */
    if (role === 'ADMIN') {
      const [
        totalUsers,
        activeUsers,
        totalVehicles,
        availableVehicles,
        totalTrips,
        activeTrips,
        totalRequests,
        pendingVehicleRequests,
        pendingFuelRequests,
      ] = await Promise.all([
        User.count(),
        User.count({ where: { status: 'ACTIVE' } }),
        Vehicle.count(),
        Vehicle.count({ where: { status: 'AVAILABLE' } }),
        Trip.count(),
        Trip.count({
          where: { status: { [Op.in]: ['IN_PROGRESS', 'TRIP_STARTED'] } },
        }),
        VehicleRequest.count(),
        VehicleRequest.count({
          where: {
            status: { [Op.in]: ['PENDING', 'TRANSPORT_REVIEW', 'HPMU_REVIEW', 'R3_REVIEW', 'R3_RETURNED'] },
          },
        }),
        FuelRequest.count({
          where: { status: { [Op.in]: ['PENDING', 'HPMU_REVIEW', 'HPMU_APPROVED'] } },
        }),
      ]);

      return res.json({
        totalUsers,
        activeUsers,
        totalVehicles,
        availableVehicles,
        totalTrips,
        activeTrips,
        totalRequests,
        pendingVehicleRequests,
        pendingFuelRequests,
        logbooks: await Logbook.count(),
      });
    }

    return res.json({});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
