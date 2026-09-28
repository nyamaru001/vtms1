const {
  VehicleRequest,
  Trip,
  Vehicle,
  Driver,
  User,
  FuelRequest,
  ExtraFuelRequest,
} = require('../models');
const { logAction } = require('./auditService');
const { notify } = require('./notificationService');

// Request statuses that must remain terminal (cannot cancel).
const REQUEST_BLOCKED = new Set([
  'TRIP_COMPLETED',
  'CLOSED',
  'CANCELLED',
  'R3_REJECTED',
]);

// Trip statuses that must remain terminal for officer cancellation.
const TRIP_BLOCKED = new Set([
  'TRIP_COMPLETED',
  'CLOSED',
  'CANCELLED',
  'DRIVER_CANCELLED',
]);

// Fuel statuses still pre-issue → can be invalidated on cancel.
const FUEL_PRE_ISSUE = ['PENDING', 'HPMU_REVIEW', 'HPMU_APPROVED', 'HPMU_RETURNED'];

function cleanReason(reason) {
  return typeof reason === 'string' ? reason.trim() : '';
}

async function freeVehicleAndDriver({ vehicleId, driverId, includeVehicleOdometer = false, endKm = null }) {
  if (driverId) {
    const driver = await Driver.findByPk(driverId);
    if (driver && ['ASSIGNED', 'ON_TRIP', 'BUSY'].includes(driver.status)) {
      await driver.update({ status: 'AVAILABLE', assignedVehicleId: null });
    }
  }

  if (vehicleId) {
    const vehicle = await Vehicle.findByPk(vehicleId);
    if (vehicle && ['ASSIGNED', 'IN_TRIP'].includes(vehicle.status)) {
      const patch = { status: 'AVAILABLE' };
      if (includeVehicleOdometer && endKm != null) {
        patch.currentOdometer = Number(endKm);
      }
      await vehicle.update(patch);
    }
  }
}

async function invalidateFuelForTrip(tripId, reason) {
  if (!tripId) return { fuelInvalidated: 0 };

  const note = `Trip cancelled by officer. Reason: ${reason}`;
  let count = 0;

  const fuels = await FuelRequest.findAll({
    where: { tripId, status: FUEL_PRE_ISSUE },
  });
  for (const f of fuels) {
    const existing = f.notes ? `${f.notes}\n` : '';
    await f.update({
      status: 'HPMU_REJECTED',
      hpmuReviewComment: note,
      notes: `${existing}${note}`,
    });
    count += 1;
  }

  const extras = await ExtraFuelRequest.findAll({
    where: { tripId, status: FUEL_PRE_ISSUE },
  });
  for (const e of extras) {
    await e.update({
      status: 'HPMU_REJECTED',
      hpmuReviewComment: note,
      confirmationNotes: e.confirmationNotes
        ? `${e.confirmationNotes}\n${note}`
        : note,
    });
    count += 1;
  }

  return { fuelInvalidated: count, hadIssuedFuel: Boolean(
    (await FuelRequest.count({ where: { tripId, status: ['HPMU_RELEASED', 'DRIVER_CONFIRMED', 'COMPLETED'] } }))
    || (await ExtraFuelRequest.count({ where: { tripId, status: ['HPMU_RELEASED', 'DRIVER_CONFIRMED', 'COMPLETED'] } }))
  )};
}

async function cancelLinkedTrip(request, reason, { activeTrip = false } = {}) {
  if (!request) return { trip: null, cancelledTrip: false };

  const trip = await Trip.findOne({ where: { requestId: request.id } });
  if (!trip) return { trip: null, cancelledTrip: false };
  if (TRIP_BLOCKED.has(trip.status)) return { trip, cancelledTrip: false };

  const wasActive = ['TRIP_STARTED', 'IN_PROGRESS'].includes(trip.status);
  const patch = {
    status: 'CANCELLED',
    endTime: trip.endTime || new Date(),
  };

  if (wasActive || activeTrip) {
    patch.tripType = 'EMERGENCY';
    patch.emergencyReason = reason;
    patch.emergencyNotes = `Officer cancelled trip: ${reason}`;
  }

  await trip.update(patch);

  await freeVehicleAndDriver({
    vehicleId: trip.vehicleId || request.vehicleId,
    driverId: trip.driverId || request.driverId,
    endKm: trip.endKm,
  });

  return { trip, cancelledTrip: true, wasActive };
}

async function notifyCancellation({ request, trip, reason, prevStatus, officerName, hadFuelIssue }) {
  const link = `/officer/requests/${request.id}`;
  const title = 'Vehicle Request Cancelled';
  const message = [
    `Request: ${request.requestNumber}`,
    `Officer: ${officerName}`,
    `Reason: ${reason}`,
    `Date: ${new Date().toLocaleString()}`,
  ].join(' | ');

  const userIds = new Set();

  // Transport: always relevant once approved or assigned (and useful for any cancel after R3 path).
  const prevIsPostApproval = [
    'TRANSPORT_REVIEW',
    'R3_APPROVED',
    'DRIVER_ASSIGNED',
    'DRIVER_ACCEPTED',
    'FUEL_REQUESTED',
    'HPMU_REVIEW',
    'HPMU_APPROVED',
    'HPMU_RETURNED',
    'HPMU_RELEASED',
    'DRIVER_CONFIRMED',
    'TRIP_STARTED',
    'DRIVER_CANCELLED',
  ].includes(prevStatus);

  if (prevIsPostApproval || trip) {
    const transportOfficers = await User.findAll({
      where: { role: 'TRANSPORT_OFFICER', status: 'ACTIVE' },
    });
    transportOfficers.forEach((u) => userIds.add(u.id));
  }

  // R3 if still in or past R3 stage.
  if ([
    'R3_REVIEW', 'R3_APPROVED', 'R3_RETURNED', 'TRANSPORT_REVIEW',
    'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'TRIP_STARTED',
  ].includes(prevStatus)) {
    const r3Users = await User.findAll({ where: { role: 'R3', status: 'ACTIVE' } });
    r3Users.forEach((u) => userIds.add(u.id));
  }

  // Driver if assigned.
  if (request.driverId || trip?.driverId) {
    const driver = await Driver.findByPk(request.driverId || trip.driverId, {
      include: [{ model: User, as: 'user' }],
    });
    if (driver?.userId) userIds.add(driver.userId);
  }

  // HPMU if fuel stage affected or issue exists.
  const prevFuelStage = [
    'FUEL_REQUESTED', 'HPMU_REVIEW', 'HPMU_APPROVED', 'HPMU_RETURNED',
    'HPMU_RELEASED', 'DRIVER_CONFIRMED',
  ].includes(prevStatus);

  if (prevFuelStage || hadFuelIssue || (trip && (await FuelRequest.count({ where: { tripId: trip.id } })) > 0)) {
    const hpmuUsers = await User.findAll({ where: { role: 'HPMU', status: 'ACTIVE' } });
    hpmuUsers.forEach((u) => userIds.add(u.id));
  }

  for (const userId of userIds) {
    await notify(userId, title, message, link);
  }

  if (trip) {
    const driver = trip.driverId
      ? await Driver.findByPk(trip.driverId, { include: [{ model: User, as: 'user' }] })
      : null;
    if (driver?.userId && userIds.has(driver.userId)) {
      // already notified above
    }
  }

  return [...userIds];
}

/**
 * Cancel a vehicle request (and linked trip/assignment/fuel) for the owning Officer.
 * Requires non-empty reason. Never deletes history.
 */
async function cancelVehicleRequest({ request, user, reason, ipAddress, io }) {
  const clean = cleanReason(reason);
  if (!clean) {
    const err = new Error('Please provide a cancellation reason.');
    err.status = 400;
    throw err;
  }

  if (request.officerId !== user.id) {
    const err = new Error('Not your request.');
    err.status = 403;
    throw err;
  }

  if (REQUEST_BLOCKED.has(request.status)) {
    const err = new Error(
      request.status === 'CANCELLED'
        ? 'Request is already cancelled.'
        : `Request cannot be cancelled once it is ${request.status}.`
    );
    err.status = 400;
    throw err;
  }

  const prevStatus = request.status;
  const officer = await User.findByPk(user.id);
  const officerName = officer?.fullName || user.username || 'Officer';

  const { trip, cancelledTrip, wasActive } = await cancelLinkedTrip(request, clean);

  // Free assignment even without trip row (assigned on request only).
  if (!cancelledTrip && (request.vehicleId || request.driverId)) {
    await freeVehicleAndDriver({
      vehicleId: request.vehicleId,
      driverId: request.driverId,
    });
  }

  const { fuelInvalidated, hadIssuedFuel } = await invalidateFuelForTrip(trip?.id, clean);

  await request.update({
    status: 'CANCELLED',
    cancellationReason: clean,
    cancelledAt: new Date(),
    cancelledBy: user.id,
  });

  await logAction({
    userId: user.id,
    action: 'CANCEL_REQUEST',
    entity: 'VehicleRequest',
    entityId: request.id,
    description: `Cancelled request ${request.requestNumber} from ${prevStatus}: ${clean}`,
    ipAddress,
  });

  if (cancelledTrip) {
    await logAction({
      userId: user.id,
      action: 'CANCEL_TRIP',
      entity: 'Trip',
      entityId: trip.id,
      description: `Cancelled trip ${trip.tripNumber} during request cancellation: ${clean}`,
      ipAddress,
    });
  }

  const notified = await notifyCancellation({
    request,
    trip,
    reason: clean,
    prevStatus,
    officerName,
    hadFuelIssue: hadIssuedFuel || fuelInvalidated > 0,
  });

  if (io) {
    try {
      io.emit('vehicle_request_cancelled', {
        requestId: request.id,
        requestNumber: request.requestNumber,
        officerId: user.id,
        reason: clean,
        previousStatus: prevStatus,
      });
    } catch { /* socket optional */ }
  }

  const updated = await VehicleRequest.findByPk(request.id);
  return {
    request: updated,
    previousStatus: prevStatus,
    tripCancelled: cancelledTrip,
    tripWasActive: Boolean(wasActive),
    fuelInvalidated,
    notifiedUserIds: notified,
  };
}

/**
 * Cancel an officer-owned trip (pre-start or in-progress emergency).
 * Mirrors request cancel for the linked VehicleRequest.
 */
async function cancelOfficerTrip({ trip, user, reason, ipAddress, io }) {
  const clean = cleanReason(reason);
  if (!clean) {
    const err = new Error('Please provide a cancellation reason.');
    err.status = 400;
    throw err;
  }

  if (trip.officerId !== user.id) {
    const err = new Error('Not your trip.');
    err.status = 403;
    throw err;
  }

  if (TRIP_BLOCKED.has(trip.status)) {
    const err = new Error(
      trip.status === 'CANCELLED'
        ? 'Trip is already cancelled.'
        : `Trip cannot be cancelled once it is ${trip.status}.`
    );
    err.status = 400;
    throw err;
  }

  const prevTripStatus = trip.status;
  const request = await VehicleRequest.findByPk(trip.requestId);

  if (request) {
    if (REQUEST_BLOCKED.has(request.status) && request.status !== 'TRIP_STARTED') {
      // Still allow trip cancel if request is already terminal? Block only if request fully done.
      if (['TRIP_COMPLETED', 'CLOSED', 'CANCELLED'].includes(request.status)) {
        const err = new Error(
          request.status === 'CANCELLED'
            ? 'Request is already cancelled.'
            : `Request cannot be cancelled once it is ${request.status}.`
        );
        err.status = 400;
        throw err;
      }
    }

    const result = await cancelVehicleRequest({
      request,
      user,
      reason: clean,
      ipAddress,
      io,
    });
    return {
      ...result,
      previousTripStatus: prevTripStatus,
    };
  }

  // No request row — cancel trip alone (should not happen; requestId required).
  const wasActive = ['TRIP_STARTED', 'IN_PROGRESS'].includes(trip.status);
  await trip.update({
    status: 'CANCELLED',
    endTime: trip.endTime || new Date(),
    ...(wasActive
      ? {
          tripType: 'EMERGENCY',
          emergencyReason: clean,
          emergencyNotes: `Officer cancelled trip: ${clean}`,
        }
      : {}),
  });

  await freeVehicleAndDriver({
    vehicleId: trip.vehicleId,
    driverId: trip.driverId,
    endKm: trip.endKm,
  });
  await invalidateFuelForTrip(trip.id, clean);

  await logAction({
    userId: user.id,
    action: 'CANCEL_TRIP',
    entity: 'Trip',
    entityId: trip.id,
    description: `Cancelled trip ${trip.tripNumber} from ${prevTripStatus}: ${clean}`,
    ipAddress,
  });

  const notified = [];
  if (trip.driverId) {
    const driver = await Driver.findByPk(trip.driverId, { include: [{ model: User, as: 'user' }] });
    if (driver?.userId) {
      await notify(
        driver.userId,
        'Trip Cancelled',
        `Trip ${trip.tripNumber} was cancelled by the officer. Reason: ${clean}`,
        `/driver/trips/${trip.id}`
      );
      notified.push(driver.userId);
    }
  }

  return {
    request: null,
    previousStatus: prevTripStatus,
    tripCancelled: true,
    tripWasActive: wasActive,
    fuelInvalidated: 0,
    notifiedUserIds: notified,
  };
}

module.exports = {
  cancelVehicleRequest,
  cancelOfficerTrip,
  cleanReason,
  REQUEST_BLOCKED,
  TRIP_BLOCKED,
};
