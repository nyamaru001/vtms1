const { Notification } = require('../models');

let ioInstance = null;
function setSocketIO(io) {
  ioInstance = io;
}

async function notify(userId, title, message, link = null) {
  const notification = await Notification.create({ userId, title, message, link });
  if (ioInstance) {
    ioInstance.to(`user:${userId}`).emit('notification:new', notification);
  }
  return notification;
}

module.exports = { notify, setSocketIO };
