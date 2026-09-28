const { AuditLog } = require('../models');

async function logAction({ userId, action, entity, entityId, description, ipAddress }) {
  try {
    await AuditLog.create({ userId, action, entity, entityId, description, ipAddress });
  } catch (err) {
    // Auditing must never break the primary request flow.
    console.error('Audit log failed:', err.message);
  }
}

module.exports = { logAction };
