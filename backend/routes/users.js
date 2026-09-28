const express = require('express');
const bcrypt = require('bcrypt');
const { Op, UniqueConstraintError } = require('sequelize');
const { User, Driver } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const sequelize = require('../config/database');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

// LIST + SEARCH + FILTER + PAGINATION
router.get('/', async (req, res, next) => {
  try {
    const { search = '', role, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where[Op.or] = [
        { fullName: { [Op.like]: `%${search}%` } },
        { username: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const { rows, count } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['passwordHash'] },
      limit: Number(limit),
      offset: (Number(page) - 1) * Number(limit),
      order: [['createdAt', 'DESC']],
    });

    res.json({ data: rows, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id, { attributes: { exclude: ['passwordHash'] } });
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json(user);
  } catch (err) { next(err); }
});

// CREATE
router.post('/', async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { fullName, username, email, phone, role, password, licenseNumber, licenseExpiry } = req.body;
    if (!fullName || !username || !role || !password) {
      await transaction.rollback();
      return res.status(400).json({ message: 'Full name, username, role, and password are required.' });
    }

    const validRoles = ['ADMIN', 'OFFICER', 'DRIVER', 'TRANSPORT_OFFICER', 'R3', 'HPMU'];
    if (!validRoles.includes(role)) {
      await transaction.rollback();
      return res.status(400).json({ message: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ fullName, username, email, phone, role, passwordHash }, { transaction });

    if (role === 'DRIVER') {
      await Driver.create({
        userId: user.id,
        licenseNumber: licenseNumber || 'PENDING',
        licenseExpiry: licenseExpiry || null,
      }, { transaction });
    }

    await logAction({
      userId: req.user.id, action: 'CREATE_USER', entity: 'User', entityId: user.id,
      description: `Created user ${username} (${role})`, ipAddress: req.ip,
    }, transaction);

    await transaction.commit();

    const { passwordHash: _omit, ...safeUser } = user.toJSON();
    res.status(201).json(safeUser);
  } catch (err) {
    await transaction.rollback();
    if (err instanceof UniqueConstraintError) {
      const field = err.errors?.[0]?.path || 'field';
      const value = err.errors?.[0]?.value || '';
      return res.status(409).json({ message: `A user with the ${field} "${value}" already exists.` });
    }
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: err.errors.map(e => e.message).join(', ') });
    }
    next(err);
  }
});

// EDIT
router.put('/:id', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const { fullName, email, phone, role, profilePhoto } = req.body;
    await user.update({ fullName, email, phone, role, profilePhoto });

    await logAction({
      userId: req.user.id, action: 'EDIT_USER', entity: 'User', entityId: user.id,
      description: `Edited user ${user.username}`, ipAddress: req.ip,
    });

    const { passwordHash: _omit, ...safeUser } = user.toJSON();
    res.json(safeUser);
  } catch (err) { next(err); }
});

// ACTIVATE / DEACTIVATE
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ message: 'Status must be ACTIVE or INACTIVE.' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    await user.update({ status });
    await logAction({
      userId: req.user.id, action: status === 'ACTIVE' ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entity: 'User', entityId: user.id, description: `${status} user ${user.username}`, ipAddress: req.ip,
    });
    res.json({ message: `User ${status.toLowerCase()}.` });
  } catch (err) { next(err); }
});

// RESET PASSWORD
router.post('/:id/reset-password', async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    await logAction({
      userId: req.user.id, action: 'RESET_PASSWORD', entity: 'User', entityId: user.id,
      description: `Reset password for ${user.username}`, ipAddress: req.ip,
    });
    res.json({ message: 'Password reset successfully.' });
  } catch (err) { next(err); }
});

// DELETE
router.delete('/:id', async (req, res, next) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    await user.destroy();
    await logAction({
      userId: req.user.id, action: 'DELETE_USER', entity: 'User', entityId: req.params.id,
      description: `Deleted user ${user.username}`, ipAddress: req.ip,
    });
    res.json({ message: 'User deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
