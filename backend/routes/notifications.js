const express = require('express');
const { Notification } = require('../models');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.user.id }, order: [['createdAt', 'DESC']], limit: 100,
    });
    const unreadCount = await Notification.count({ where: { userId: req.user.id, isRead: false } });
    res.json({ data: notifications, unreadCount });
  } catch (err) { next(err); }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    await notification.update({ isRead: true });
    res.json(notification);
  } catch (err) { next(err); }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    await Notification.update({ isRead: true }, { where: { userId: req.user.id, isRead: false } });
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const notification = await Notification.findOne({ where: { id: req.params.id, userId: req.user.id } });
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    await notification.destroy();
    res.json({ message: 'Notification deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
