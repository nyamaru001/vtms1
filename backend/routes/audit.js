const express = require('express');
const { Op } = require('sequelize');
const { AuditLog, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/', async (req, res, next) => {
  try {
    const { userId, action, startDate, endDate, page = 1, limit = 50 } = req.query;
    const where = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (startDate && endDate) where.createdAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };

    const { rows, count } = await AuditLog.findAndCountAll({
      where,
      include: [{ model: User, as: 'user', attributes: ['id', 'fullName', 'username', 'role'] }],
      limit: Number(limit), offset: (Number(page) - 1) * Number(limit),
      order: [['createdAt', 'DESC']],
    });
    res.json({ data: rows, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

module.exports = router;
