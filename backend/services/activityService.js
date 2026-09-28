/**
 * Persist chronological activity rows for vehicle requests.
 */
const { RequestActivity } = require('../models');

async function recordActivity({
  requestId,
  tripId = null,
  actorId = null,
  actorRole = null,
  action,
  fromStatus = null,
  toStatus = null,
  comment = null,
  metadata = null,
}) {
  if (!requestId || !action) return null;
  try {
    return await RequestActivity.create({
      requestId,
      tripId,
      actorId,
      actorRole,
      action,
      fromStatus,
      toStatus,
      comment,
      metadata,
    });
  } catch (e) {
    console.error('recordActivity failed:', e.message);
    return null;
  }
}

module.exports = { recordActivity };
