/**
 * Shared dual trip-completion logic.
 * DRIVER and OFFICER must both confirm before status becomes TRIP_COMPLETED.
 * First confirmation → DRIVER_COMPLETED or OFFICER_COMPLETED.
 * Second confirmation → TRIP_COMPLETED (+ free vehicle/driver, update request).
 */
const {
  Trip,
  VehicleRequest,
  Vehicle,
  Driver,
  TripCompletion,
  User,
  RequestActivity,
  Logbook,
} = require('../models');
const { logAction } = require('./auditService');
const { notify } = require('./notificationService');

const { Op } = require('sequelize');

async function recordCompletion({ trip, role, userId, endKm, notes, ipAddress, io }) {
  if (!['DRIVER', 'OFFICER'].includes(role)) {
    const err = new Error('Invalid completion role.');
    err.status = 400;
    throw err;
  }

  if (!['IN_PROGRESS', 'TRIP_STARTED', 'DRIVER_COMPLETED', 'OFFICER_COMPLETED'].includes(trip.status)) {
    const err = new Error(`Trip is not awaiting completion. Current status: ${trip.status}`);
    err.status = 400;
    throw err;
  }

  if (trip.startKm == null) {
    const err = new Error('Trip start KM has not been recorded.');
    err.status = 400;
    throw err;
  }

  if (endKm != null && Number(endKm) < Number(trip.startKm)) {
    const err = new Error('End KM cannot be less than start KM.');
    err.status = 400;
    throw err;
  }

  let completion = await TripCompletion.findOne({
    where: { tripId: trip.id, role },
  });

  if (completion) {
    // allow updating notes/endKm before both sides complete
    if (endKm != null) completion.endKm = Number(endKm);
    if (notes !== undefined) completion.notes = notes;
    await completion.save();
  } else {
    completion = await TripCompletion.create({
      tripId: trip.id,
      role,
      userId,
      endKm: endKm != null ? Number(endKm) : null,
      notes: notes || null,
    });
  }

  const all = await TripCompletion.findAll({ where: { tripId: trip.id } });
  const hasDriver = all.some((c) => c.role === 'DRIVER');
  const hasOfficer = all.some((c) => c.role === 'OFFICER');

  const driverRec = all.find((c) => c.role === 'DRIVER');
  const officerRec = all.find((c) => c.role === 'OFFICER');

  const finalEndKm = [driverRec?.endKm, officerRec?.endKm]
    .filter((v) => v != null)
    .sort((a, b) => b - a)[0] ?? null;

  let nextStatus;
  let fullyCompleted = false;

  if (hasDriver && hasOfficer) {
    nextStatus = 'TRIP_COMPLETED';
    fullyCompleted = true;
  } else if (hasDriver) {
    nextStatus = 'DRIVER_COMPLETED';
  } else {
    nextStatus = 'OFFICER_COMPLETED';
  }

  const totalOdometerKm = finalEndKm != null ? Number(finalEndKm) - Number(trip.startKm) : null;

  const prevStatus = trip.status;

  /*
   * ONE authoritative completion timestamp for the whole system.
   * It is stamped by the server the first time an End Trip / completion
   * confirmation succeeds (driver OR officer) and is never overwritten by the
   * other party, by later confirmations, by logbook edits or by page loads.
   */
  const authoritativeEndTime = trip.endTime || new Date();

  await trip.update({
    endKm: finalEndKm,
    totalOdometerKm,
    endTime: authoritativeEndTime,
    status: nextStatus,
  });

  const request = trip.requestId
    ? await VehicleRequest.findByPk(trip.requestId)
    : null;

  if (request) {
    await request.update({ status: nextStatus });
  }

  if (fullyCompleted) {
    if (trip.vehicleId) {
      const vehicle = await Vehicle.findByPk(trip.vehicleId);
      if (vehicle) {
        await vehicle.update({
          status: 'AVAILABLE',
          currentOdometer: finalEndKm != null ? Number(finalEndKm) : vehicle.currentOdometer,
        });
      }
    }
    if (trip.driverId) {
      const driver = await Driver.findByPk(trip.driverId);
      if (driver) {
        await driver.update({ status: 'AVAILABLE', assignedVehicleId: null });
      }
    }
  }

  /*
   * Mirror the authoritative trip timestamps onto the linked logbook so the
   * driver logbook, officer logbook and printed logbook all show the exact
   * same system trip completion time (never a page-load or browser time).
   */
  const linkedLogbook = await Logbook.findOne({ where: { tripId: trip.id } });
  if (linkedLogbook) {
    const logbookUpdate = {};
    if (linkedLogbook.startTime == null && trip.startTime) {
      logbookUpdate.startTime = trip.startTime;
    }
    if (linkedLogbook.endTime == null || authoritativeEndTime > linkedLogbook.endTime) {
      logbookUpdate.endTime = authoritativeEndTime;
    }
    if (finalEndKm != null) logbookUpdate.endKm = Number(finalEndKm);
    if (totalOdometerKm != null) logbookUpdate.totalKm = Number(totalOdometerKm);

    if (Object.keys(logbookUpdate).length) {
      await linkedLogbook.update(logbookUpdate);
    }
  }

  await logAction({
    userId,
    action: fullyCompleted ? 'TRIP_COMPLETE' : `${role}_COMPLETION_CONFIRM`,
    entity: 'Trip',
    entityId: trip.id,
    description: fullyCompleted
      ? `Trip ${trip.tripNumber} completed after ${role} confirmation. Odometer KM: ${totalOdometerKm ?? '—'}`
      : `Trip ${trip.tripNumber} ${role.toLowerCase()} completion confirmed. Awaiting other party.`,
    ipAddress,
  });

  if (request) {
    await RequestActivity.create({
      requestId: request.id,
      tripId: trip.id,
      actorId: userId,
      actorRole: role,
      action: fullyCompleted ? 'TRIP_COMPLETED' : 'COMPLETION_CONFIRMED',
      fromStatus: prevStatus,
      toStatus: nextStatus,
      comment: notes || null,
      metadata: { endKm: finalEndKm, totalOdometerKm },
    });
  }

  // notifications
  if (fullyCompleted) {
    if (request?.officerId) {
      await notify(
        request.officerId,
        'Trip completed',
        `Trip ${trip.tripNumber} has been fully confirmed and completed by driver and officer.`,
        `/officer/trips/${trip.id}`
      );
    }
    const driver = trip.driverId ? await Driver.findByPk(trip.driverId) : null;
    if (driver?.userId) {
      await notify(
        driver.userId,
        'Trip completed',
        `Trip ${trip.tripNumber} has been completed (confirmed by officer).`,
        `/driver/trips/${trip.id}`
      );
    }

    // Real-time Socket.IO emission for immediate UI updates
    if (io) {
      io.to(`trip:${trip.id}`).emit('trip:completed', {
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        status: 'TRIP_COMPLETED',
        endTime: authoritativeEndTime,
        endKm: finalEndKm,
        totalOdometerKm,
        completedBy: role,
      });
      io.to(`user:${request.officerId}`).emit('trip:completed', {
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        status: 'TRIP_COMPLETED',
        endTime: authoritativeEndTime,
      });
      if (driver?.userId) {
        io.to(`user:${driver.userId}`).emit('trip:completed', {
          tripId: trip.id,
          tripNumber: trip.tripNumber,
          status: 'TRIP_COMPLETED',
          endTime: authoritativeEndTime,
        });
      }
      io.to('transport:dashboard').emit('trip:completed', {
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        status: 'TRIP_COMPLETED',
        endTime: authoritativeEndTime,
      });
    }
  } else if (role === 'DRIVER' && request?.officerId) {
    await notify(
      request.officerId,
      'Driver confirmed trip completion',
      `Driver confirmed completion of trip ${trip.tripNumber}. Please confirm to complete the trip.`,
      `/officer/trips/${trip.id}`
    );

    if (io) {
      io.to(`trip:${trip.id}`).emit('trip:completion-confirmed', {
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        status: 'DRIVER_COMPLETED',
        confirmedBy: 'DRIVER',
        pendingRole: 'OFFICER',
      });
      io.to(`user:${request.officerId}`).emit('trip:completion-confirmed', {
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        status: 'DRIVER_COMPLETED',
        confirmedBy: 'DRIVER',
        pendingRole: 'OFFICER',
      });
    }
  } else if (role === 'OFFICER') {
    const driver = trip.driverId ? await Driver.findByPk(trip.driverId) : null;
    if (driver?.userId) {
      await notify(
        driver.userId,
        'Officer confirmed trip completion',
        `Officer confirmed completion of trip ${trip.tripNumber}. Please confirm to complete the trip.`,
        `/driver/trips/${trip.id}`
      );
    }

    if (io) {
      io.to(`trip:${trip.id}`).emit('trip:completion-confirmed', {
        tripId: trip.id,
        tripNumber: trip.tripNumber,
        status: 'OFFICER_COMPLETED',
        confirmedBy: 'OFFICER',
        pendingRole: 'DRIVER',
      });
      if (driver?.userId) {
        io.to(`user:${driver.userId}`).emit('trip:completion-confirmed', {
          tripId: trip.id,
          tripNumber: trip.tripNumber,
          status: 'OFFICER_COMPLETED',
          confirmedBy: 'OFFICER',
          pendingRole: 'DRIVER',
        });
      }
    }
  }

  const updated = await Trip.findByPk(trip.id, {
    include: [
      { model: VehicleRequest, as: 'request' },
      { model: Vehicle, as: 'vehicle' },
      {
        model: Driver,
        as: 'driver',
        include: [{ model: User, as: 'user', attributes: ['id', 'fullName', 'phone'] }],
      },
      { model: User, as: 'officer', attributes: ['id', 'fullName', 'phone'] },
      { model: TripCompletion, as: 'completions' },
    ],
  });

  return {
    trip: updated,
    fullyCompleted,
    pendingRole: fullyCompleted ? null : (hasDriver ? 'OFFICER' : 'DRIVER'),
    comparison: {
      routeKm: Number(request?.roundTripKm || 0),
      odometerKm: totalOdometerKm,
      differenceKm:
        totalOdometerKm != null && request?.roundTripKm
          ? Math.round((totalOdometerKm - Number(request.roundTripKm)) * 100) / 100
          : null,
    },
  };
}

async function listCompletions(tripId) {
  return TripCompletion.findAll({
    where: { tripId },
    order: [['confirmedAt', 'ASC']],
    include: [{ model: User, as: 'user', attributes: ['id', 'fullName', 'role'] }],
  });
}

module.exports = { recordCompletion, listCompletions, Op };
