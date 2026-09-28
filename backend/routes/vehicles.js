const express = require('express');
const { Op } = require('sequelize');
const { Vehicle } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { search = '', status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { registrationNumber: { [Op.like]: `%${search}%` } },
        { model: { [Op.like]: `%${search}%` } },
      ];
    }
    const { rows, count } = await Vehicle.findAndCountAll({
      where, limit: Number(limit), offset: (Number(page) - 1) * Number(limit),
      order: [['createdAt', 'DESC']],
    });
    res.json({ data: rows, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

router.get('/available', async (req, res, next) => {
  try {
    const vehicles = await Vehicle.findAll({ where: { status: 'AVAILABLE' } });
    res.json(vehicles);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    res.json(vehicle);
  } catch (err) { next(err); }
});

router.post('/', authorize('TRANSPORT_OFFICER', 'ADMIN'), async (req, res, next) => {
  try {
    const vehicle = await Vehicle.create(req.body);
    await logAction({
      userId: req.user.id, action: 'CREATE_VEHICLE', entity: 'Vehicle', entityId: vehicle.id,
      description: `Added vehicle ${vehicle.registrationNumber}`, ipAddress: req.ip,
    });
    res.status(201).json(vehicle);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('TRANSPORT_OFFICER', 'ADMIN'), async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    await vehicle.update(req.body);
    await logAction({
      userId: req.user.id, action: 'EDIT_VEHICLE', entity: 'Vehicle', entityId: vehicle.id,
      description: `Edited vehicle ${vehicle.registrationNumber}`, ipAddress: req.ip,
    });
    res.json(vehicle);
  } catch (err) { next(err); }
});

router.patch('/:id/status', authorize('TRANSPORT_OFFICER', 'ADMIN'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    await vehicle.update({ status });
    res.json(vehicle);
  } catch (err) { next(err); }
});

router.delete('/:id', authorize('TRANSPORT_OFFICER', 'ADMIN'), async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findByPk(req.params.id);
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found.' });
    await vehicle.destroy();
    await logAction({
      userId: req.user.id, action: 'DELETE_VEHICLE', entity: 'Vehicle', entityId: req.params.id,
      description: `Deleted vehicle ${vehicle.registrationNumber}`, ipAddress: req.ip,
    });
    res.json({ message: 'Vehicle deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
