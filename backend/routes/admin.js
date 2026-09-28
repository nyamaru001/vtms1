const express = require('express');
const { Op } = require('sequelize');

const {
  User,
  Driver,
  Vehicle,
  VehicleRequest,
  Trip,
  FuelRequest,
  Logbook,
  Notification,
  AuditLog,
} = require('../models');

const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

/* =========================================================
   ADMIN DASHBOARD STATISTICS
   All from real database queries
========================================================= */
router.get('/stats', async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      officers,
      drivers,
      transportOfficers,
      r3Users,
      hpmuUsers,
      totalVehicles,
      availableVehicles,
      totalTrips,
      activeTrips,
      pendingVehicleRequests,
      pendingFuelRequests,
    ] = await Promise.all([
      User.count(),
      User.count({ where: { status: 'ACTIVE' } }),
      User.count({ where: { role: 'OFFICER' } }),
      User.count({ where: { role: 'DRIVER' } }),
      User.count({ where: { role: 'TRANSPORT_OFFICER' } }),
      User.count({ where: { role: 'R3' } }),
      User.count({ where: { role: 'HPMU' } }),
      Vehicle.count(),
      Vehicle.count({ where: { status: 'AVAILABLE' } }),
      Trip.count(),
      Trip.count({
        where: {
          status: { [Op.in]: ['IN_PROGRESS', 'TRIP_STARTED'] },
        },
      }),
      VehicleRequest.count({
        where: {
          status: { [Op.in]: ['PENDING', 'TRANSPORT_REVIEW', 'HPMU_REVIEW', 'R3_REVIEW', 'RETURNED'] },
        },
      }),
      FuelRequest.count({
        where: {
          status: { [Op.in]: ['PENDING', 'HPMU_REVIEW', 'HPMU_APPROVED'] },
        },
      }),
    ]);

    res.json({
      totalUsers,
      activeUsers,
      officers,
      drivers,
      transportOfficers,
      r3Users,
      hpmuUsers,
      totalVehicles,
      availableVehicles,
      totalTrips,
      activeTrips,
      pendingVehicleRequests,
      pendingFuelRequests,
    });
  } catch (err) {
    next(err);
  }
});

// System monitoring
router.get('/monitoring', async (req, res, next) => {
  try {
    const db = require('../config/database');

    const [
      userCount, vehicleCount, requestCount, tripCount,
      fuelRequestCount, logbookCount, notificationCount, auditLogCount,
      driverCount,
      recentErrors,
      recentAudits
    ] = await Promise.all([
      User.count(),
      Vehicle.count(),
      VehicleRequest.count(),
      Trip.count(),
      FuelRequest.count(),
      Logbook.count(),
      Notification.count(),
      AuditLog.count(),
      Driver.count(),
      AuditLog.findAll({
        where: { action: { [require('sequelize').Op.like]: '%ERROR%' } },
        limit: 10,
        order: [['createdAt', 'DESC']],
        include: [{ model: User, as: 'user', attributes: ['fullName', 'username'] }],
      }).catch(() => []),
      AuditLog.findAll({
        limit: 20,
        order: [['createdAt', 'DESC']],
        include: [{ model: User, as: 'user', attributes: ['fullName', 'username'] }],
      }).catch(() => []),
    ]);

    let dbStatus = 'OK';
    try {
      await db.authenticate();
    } catch {
      dbStatus = 'ERROR';
    }

    res.json({
      database: { status: dbStatus, dialect: 'mysql' },
      counts: { users: userCount, vehicles: vehicleCount, drivers: driverCount, requests: requestCount, trips: tripCount, fuelRequests: fuelRequestCount, logbooks: logbookCount, notifications: notificationCount, auditLogs: auditLogCount },
      recentErrors,
      recentAudits,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;