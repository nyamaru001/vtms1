const express = require('express');
const { Op } = require('sequelize');
const { Driver, User, Vehicle } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();
router.use(authenticate);

/**
 * Get the authenticated driver's profile.
 * Uses the authenticated user's ID to find the associated driver profile.
 */
router.get('/profile', async (req, res, next) => {
  try {
    if (req.user.role !== 'DRIVER') {
      return res.status(403).json({ message: 'Only drivers can access this endpoint.' });
    }

    const driver = await Driver.findOne({
      where: { userId: req.user.id },
      include: [
        { model: User, as: 'user', attributes: { exclude: ['passwordHash'] } },
        { model: Vehicle, as: 'assignedVehicle' },
      ],
    });

    if (!driver) {
      return res.status(404).json({
        message: 'Driver profile not found for this user.',
        userId: req.user.id,
      });
    }

    res.json(driver);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const { search = '', status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (status) where.status = status;

    const { rows, count } = await Driver.findAndCountAll({
      where,
      include: [
        { model: User, as: 'user', attributes: ['id', 'fullName', 'username', 'phone', 'status'] },
        { model: Vehicle, as: 'assignedVehicle', attributes: ['id', 'registrationNumber', 'model'] },
      ],
      limit: Number(limit), offset: (Number(page) - 1) * Number(limit),
      order: [['createdAt', 'DESC']],
    });

    let filtered = rows;
    if (search) {
      const s = search.toLowerCase();
      filtered = rows.filter((d) =>
        d.user && (d.user.fullName.toLowerCase().includes(s) || d.user.username.toLowerCase().includes(s))
      );
    }

    res.json({ data: filtered, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

router.get('/available', async (req, res, next) => {
  try {
    const drivers = await Driver.findAll({
      where: { status: 'AVAILABLE' },
      include: [{ model: User, as: 'user', attributes: ['id', 'fullName', 'username'] }],
    });
    res.json(drivers);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const driver = await Driver.findByPk(req.params.id, {
      include: [
        { model: User, as: 'user', attributes: { exclude: ['passwordHash'] } },
        { model: Vehicle, as: 'assignedVehicle' },
      ],
    });
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });
    res.json(driver);
  } catch (err) { next(err); }
});

router.put('/:id', authorize('TRANSPORT_OFFICER'), async (req, res, next) => {
  try {
    const driver = await Driver.findByPk(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });
    const { licenseNumber, licenseExpiry, status } = req.body;
    await driver.update({ licenseNumber, licenseExpiry, status });
    await logAction({
      userId: req.user.id, action: 'EDIT_DRIVER', entity: 'Driver', entityId: driver.id,
      description: 'Edited driver profile', ipAddress: req.ip,
    });
    res.json(driver);
  } catch (err) { next(err); }
});

router.patch('/:id/status', authorize('TRANSPORT_OFFICER'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const driver = await Driver.findByPk(req.params.id);
    if (!driver) return res.status(404).json({ message: 'Driver not found.' });
    await driver.update({ status });
    res.json(driver);
  } catch (err) { next(err); }
});

module.exports = router;
