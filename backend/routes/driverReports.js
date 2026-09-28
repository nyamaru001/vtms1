const express = require('express');
const { Op } = require('sequelize');
const { Trip, VehicleRequest, FuelRequest, Logbook, Driver, Vehicle } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('DRIVER'));

// Driver-only aggregated reports — always scoped to the authenticated
// driver's own driverId, never another driver's data.
router.get('/', async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ where: { userId: req.user.id } });
    if (!driver) return res.status(404).json({ message: 'Driver profile not found.' });

    const { startDate, endDate, vehicleId, status } = req.query;
    const tripWhere = { driverId: driver.id };
    if (vehicleId) tripWhere.vehicleId = vehicleId;
    if (status) tripWhere.status = status;
    if (startDate && endDate) tripWhere.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };

    const trips = await Trip.findAll({
      where: tripWhere,
      include: [{ model: VehicleRequest, as: 'request' }, { model: Vehicle, as: 'vehicle' }],
      order: [['createdAt', 'DESC']],
    });

    const completedTrips = trips.filter((t) => ['TRIP_COMPLETED', 'CLOSED'].includes(t.status));
    const activeTrips = trips.filter((t) => ['IN_PROGRESS', 'TRIP_STARTED'].includes(t.status));
    const totalDistanceKm = completedTrips.reduce((sum, t) => sum + (t.totalOdometerKm || 0), 0);

    const fuelWhere = { driverId: driver.id };
    if (startDate && endDate) fuelWhere.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    const fuelRequests = await FuelRequest.findAll({ where: fuelWhere, order: [['createdAt', 'DESC']] });
    const totalFuelIssued = fuelRequests
      .filter((f) => ['HPMU_APPROVED', 'HPMU_RELEASED', 'DRIVER_CONFIRMED', 'COMPLETED'].includes(f.status))
      .reduce((sum, f) => sum + (f.litresReleased || f.litresRequested || 0), 0);

    const logbookWhere = { driverId: driver.id };
    if (startDate && endDate) logbookWhere.entryDate = { [Op.between]: [startDate, endDate] };
    const logbooks = await Logbook.findAll({ where: logbookWhere, order: [['entryDate', 'DESC']] });

    res.json({
      totals: {
        tripsCompleted: completedTrips.length,
        activeTrips: activeTrips.length,
        totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
        totalFuelIssuedLitres: Math.round(totalFuelIssued * 100) / 100,
        fuelRequestsCount: fuelRequests.length,
        logbooksCount: logbooks.length,
      },
      trips,
      fuelRequests,
      logbooks,
    });
  } catch (err) { next(err); }
});

module.exports = router;
