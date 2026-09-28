const express = require('express');
const { Op, fn, col, literal } = require('sequelize');
const { Trip, VehicleRequest, Vehicle, Driver, User, FuelRequest } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('TRANSPORT_OFFICER'));

router.get('/summary', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};
    if (startDate && endDate) where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };

    const totalTrips = await Trip.count({ where });
    const completedTrips = await Trip.count({ where: { ...where, status: { [Op.in]: ['COMPLETED', 'CLOSED'] } } });
    const totalKm = await Trip.sum('totalOdometerKm', { where }) || 0;
    const totalFuel = await FuelRequest.sum('litresRequested', { where: { status: { [Op.in]: ['HPMU_APPROVED', 'HPMU_RELEASED', 'DRIVER_CONFIRMED', 'COMPLETED'] } } }) || 0;
    const totalRequests = await VehicleRequest.count({ where });
    const approvedRequests = await VehicleRequest.count({ where: { ...where, status: { [Op.in]: ['R3_APPROVED', 'TRANSPORT_REVIEW', 'DRIVER_ASSIGNED', 'TRIP_STARTED', 'TRIP_COMPLETED', 'CLOSED'] } } });

    res.json({ totalTrips, completedTrips, totalKm, totalFuel, totalRequests, approvedRequests });
  } catch (err) { next(err); }
});

router.get('/vehicle-usage', async (req, res, next) => {
  try {
    const data = await Trip.findAll({
      attributes: [
        'vehicleId',
        [fn('COUNT', col('Trip.id')), 'tripCount'],
        [fn('SUM', col('total_odometer_km')), 'totalKm'],
      ],
      include: [{ model: Vehicle, as: 'vehicle', attributes: ['registrationNumber', 'model'] }],
      group: ['vehicleId', 'vehicle.id'],
      order: [[literal('tripCount'), 'DESC']],
    });
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/driver-performance', async (req, res, next) => {
  try {
    const data = await Trip.findAll({
      attributes: [
        'driverId',
        [fn('COUNT', col('Trip.id')), 'tripCount'],
        [fn('SUM', col('total_odometer_km')), 'totalKm'],
      ],
      include: [{ model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['fullName'] }] }],
      group: ['driverId', 'driver.id', 'driver->user.id'],
      order: [[literal('tripCount'), 'DESC']],
    });
    res.json(data);
  } catch (err) { next(err); }
});

router.get('/fuel', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const where = { status: { [Op.in]: ['HPMU_APPROVED', 'HPMU_RELEASED', 'DRIVER_CONFIRMED', 'COMPLETED'] } };
    if (startDate && endDate) where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };

    const requests = await FuelRequest.findAll({
      where,
      include: [
        { model: Vehicle, as: 'vehicle', attributes: ['registrationNumber', 'model'] },
        { model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['fullName'] }] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(requests);
  } catch (err) { next(err); }
});

module.exports = router;
