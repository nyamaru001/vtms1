const express = require('express');
const {
  FuelRequest,
  VehicleRequest,
  HPMURecommendation,
  User,
  ExtraFuelRequest,
  Driver,
  Trip,
  Vehicle,
  FuelIssueLog,
} = require('../models');

const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const { notify } = require('../services/notificationService');

const router = express.Router();

router.use(authenticate, authorize('HPMU'));

/*
|--------------------------------------------------------------------------
| HPMU RECOMMENDATION / DECISION
|--------------------------------------------------------------------------
| Supports:
| 1. Fuel Requests (driver requests fuel after assignment, HPMU reviews/releases)
| 2. Extra Fuel Requests (officer requests emergency fuel during trip)
|
| POST /api/hpmu/:requestId/decide
|
| Body:
| {
|   "decision": "APPROVE" | "REJECT" | "RETURN",
|   "comment": "..."
| }
|--------------------------------------------------------------------------
|
| VEHICLE REQUEST WORKFLOW:
| OFFICER creates → R3_REVIEW → R3_APPROVED → TRANSPORT_REVIEW (Transport assigns)
| → DRIVER_ASSIGNED → Driver accepts → FUEL_REQUESTED → HPMU_REVIEW (fuel)
| → HPMU_APPROVED → HPMU_RELEASED → DRIVER_CONFIRMED → TRIP_STARTED
|
| HPMU only reviews FUEL REQUESTS, not vehicle requests directly.
*/

router.post('/:requestId/decide', async (req, res, next) => {
  try {
    const { decision, comment } = req.body;
    const requestId = Number(req.params.requestId);

    if (!Number.isInteger(requestId)) {
      return res.status(400).json({
        message: 'Invalid request ID.',
      });
    }

    if (!['APPROVE', 'REJECT', 'RETURN'].includes(decision)) {
      return res.status(400).json({
        message: 'Invalid decision. Must be APPROVE, REJECT, or RETURN.',
      });
    }

    if (
      decision !== 'APPROVE' &&
      (!comment || !String(comment).trim())
    ) {
      return res.status(400).json({
        message: 'A comment is required for REJECT or RETURN decisions.',
      });
    }

/*
|--------------------------------------------------------------------------
| 1. CHECK VEHICLE REQUEST FOR FUEL REVIEW (after driver assignment)
| Status flow: DRIVER_ASSIGNED -> FUEL_REQUESTED -> HPMU_REVIEW -> HPMU_APPROVED/REJECTED/RETURNED
|--------------------------------------------------------------------------
*/

    const vehicleRequest = await VehicleRequest.findByPk(requestId);

    // HPMU reviews fuel for vehicle requests that are at DRIVER_ASSIGNED or FUEL_REQUESTED stage
    if (vehicleRequest && ['DRIVER_ASSIGNED', 'FUEL_REQUESTED'].includes(vehicleRequest.status)) {
      let nextStatus = 'HPMU_APPROVED';

      if (decision === 'REJECT') {
        nextStatus = 'HPMU_REJECTED';
      }

      if (decision === 'RETURN') {
        nextStatus = 'HPMU_RETURNED';
      }

      await HPMURecommendation.create({
        requestId: vehicleRequest.id,
        reviewedBy: req.user.id,
        decision,
        comment: comment || null,
      });

      await vehicleRequest.update({
        status: nextStatus,
      });

      await logAction({
        userId: req.user.id,
        action: 'HPMU_DECISION',
        entity: 'VehicleRequest',
        entityId: vehicleRequest.id,
        description: `HPMU fuel decision: ${decision} for vehicle request ${vehicleRequest.requestNumber}`,
        ipAddress: req.ip,
      });

      // Notify Transport Officers
      const transportOfficers = await User.findAll({
        where: {
          role: 'TRANSPORT_OFFICER',
          status: 'ACTIVE',
        },
      });

      await Promise.all(
        transportOfficers.map((user) =>
          notify(
            user.id,
            'Fuel request update',
            `Fuel for vehicle request ${vehicleRequest.requestNumber} was ${decision.toLowerCase()} by HPMU.`,
            `/transport/requests/${vehicleRequest.id}`
          )
        )
      );

      // Notify officer
      if (nextStatus === 'HPMU_REJECTED' || nextStatus === 'HPMU_RETURNED') {
        await notify(
          vehicleRequest.officerId,
          'Fuel request update',
          `Fuel for vehicle request ${vehicleRequest.requestNumber} was ${nextStatus.replace('HPMU_', '').toLowerCase()} by HPMU.`,
          `/officer/requests/${vehicleRequest.id}`
        );
      }

      // If approved, notify driver to confirm fuel receipt
      if (nextStatus === 'HPMU_APPROVED') {
        if (vehicleRequest.driverId) {
          const driver = await Driver.findByPk(vehicleRequest.driverId, { include: [{ model: User, as: 'user' }] });
          if (driver?.userId) {
            await notify(
              driver.userId,
              'Fuel approved',
              `Fuel for request ${vehicleRequest.requestNumber} has been approved by HPMU. Ready for release.`,
              `/driver/fuel`
            );
          }
        }
      }

      return res.json({
        success: true,
        type: 'VEHICLE_REQUEST_FUEL',
        request: vehicleRequest,
        message: `Fuel for vehicle request ${decision.toLowerCase()} successfully.`,
      });
    }

/*
    |--------------------------------------------------------------------------
    | 2. CHECK FUEL REQUEST
    | Status flow: PENDING -> HPMU_REVIEW -> HPMU_APPROVED/HPMU_REJECTED/HPMU_RETURNED
    | Then: HPMU_APPROVED -> HPMU_RELEASED -> DRIVER_CONFIRMED -> COMPLETED
    |--------------------------------------------------------------------------
    */

    const fuelRequest = await FuelRequest.findByPk(requestId, {
      include: [
        {
          model: Driver,
          as: 'driver',
          include: [{ model: User, as: 'user', attributes: ['id', 'fullName'] }],
        },
      ],
    });

    if (fuelRequest && fuelRequest.status === 'HPMU_REVIEW') {
      let nextStatus = 'HPMU_APPROVED';

      if (decision === 'REJECT') {
        nextStatus = 'HPMU_REJECTED';
      }

      if (decision === 'RETURN') {
        nextStatus = 'HPMU_RETURNED';
      }

      await HPMURecommendation.create({
        requestId: fuelRequest.id,
        reviewedBy: req.user.id,
        decision,
        comment: comment || null,
      });

      await fuelRequest.update({
        status: nextStatus,
        hpmuReviewComment: comment || null,
        hpmuReviewedBy: req.user.id,
        hpmuReviewedAt: new Date(),
      });

      await logAction({
        userId: req.user.id,
        action: 'HPMU_DECISION',
        entity: 'FuelRequest',
        entityId: fuelRequest.id,
        description: `HPMU decision: ${decision} for fuel request ${fuelRequest.id}`,
        ipAddress: req.ip,
      });

      /*
      |--------------------------------------------------------------------------
      | NOTIFY DRIVER
      |--------------------------------------------------------------------------
      */

      if (fuelRequest.driver) {
        await notify(
          fuelRequest.driver.userId,
          'Fuel request update',
          `Your fuel request was ${decision.toLowerCase()} by HPMU.`,
          `/driver/fuel`
        );
      }

      /*
      |--------------------------------------------------------------------------
      | NOTIFY TRANSPORT OFFICER
      |--------------------------------------------------------------------------
      */

      const transportOfficers = await User.findAll({
        where: {
          role: 'TRANSPORT_OFFICER',
          status: 'ACTIVE',
        },
      });

      await Promise.all(
        transportOfficers.map((user) =>
          notify(
            user.id,
            'Fuel request update',
            `Fuel request ${fuelRequest.id} was ${decision.toLowerCase()} by HPMU.`,
            `/transport/fuel`
          )
        )
      );

      return res.json({
        success: true,
        type: 'FUEL_REQUEST',
        request: fuelRequest,
        message: `Fuel request ${decision.toLowerCase()} successfully.`,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 3. CHECK EXTRA FUEL REQUEST
    | Status flow: PENDING -> HPMU_REVIEW -> HPMU_APPROVED/HPMU_REJECTED/HPMU_RETURNED
    | Then: HPMU_APPROVED -> HPMU_RELEASED -> DRIVER_CONFIRMED -> COMPLETED
    |--------------------------------------------------------------------------
    */

    const extraFuelRequest = await ExtraFuelRequest.findByPk(requestId, {
      include: [
        {
          model: Driver,
          as: 'driver',
          include: [{ model: User, as: 'user', attributes: ['id', 'fullName'] }],
        },
      ],
    });

    if (extraFuelRequest && extraFuelRequest.status === 'HPMU_REVIEW') {
      let nextStatus = 'HPMU_APPROVED';

      if (decision === 'REJECT') {
        nextStatus = 'HPMU_REJECTED';
      }

      if (decision === 'RETURN') {
        nextStatus = 'HPMU_RETURNED';
      }

      await HPMURecommendation.create({
        requestId: extraFuelRequest.id,
        reviewedBy: req.user.id,
        decision,
        comment: comment || null,
      });

      await extraFuelRequest.update({
        status: nextStatus,
        hpmuReviewComment: comment || null,
        hpmuReviewedBy: req.user.id,
        hpmuReviewedAt: new Date(),
      });

      await logAction({
        userId: req.user.id,
        action: 'HPMU_DECISION',
        entity: 'ExtraFuelRequest',
        entityId: extraFuelRequest.id,
        description: `HPMU decision: ${decision} for extra fuel request ${extraFuelRequest.id}`,
        ipAddress: req.ip,
      });

// Notify driver
      if (extraFuelRequest.driver) {
        let title, message;
        if (decision === 'APPROVE') {
          title = 'Fuel Request Approved';
          message = `Your fuel request was approved by HPMU.`;
        } else if (decision === 'REJECT') {
          title = 'Fuel Request Rejected';
          message = `Your fuel request was rejected by HPMU.`;
        } else if (decision === 'RETURN') {
          title = 'Fuel Request Returned';
          message = `Your fuel request was returned by HPMU.`;
        } else {
          title = 'Fuel Request Update';
          message = `Your fuel request was ${decision.toLowerCase()} by HPMU.`;
        }
        await notify(
          extraFuelRequest.driver.userId,
          title,
          message,
          `/driver/fuel`
        );
      }

      // Notify officer
      if (extraFuelRequest.officerId) {
        await notify(
          extraFuelRequest.officerId,
          'Extra fuel request update',
          `Your extra fuel request for trip ${extraFuelRequest.tripId} was ${decision.toLowerCase()} by HPMU.`,
          `/officer/trips/${extraFuelRequest.tripId}`
        );
      }

      // Notify transport officer
      const transportOfficers = await User.findAll({
        where: {
          role: 'TRANSPORT_OFFICER',
          status: 'ACTIVE',
        },
      });

      await Promise.all(
        transportOfficers.map((user) =>
          notify(
            user.id,
            'Extra fuel request update',
            `Extra fuel request ${extraFuelRequest.id} was ${decision.toLowerCase()} by HPMU.`,
            `/transport/fuel`
          )
        )
      );

      return res.json({
        success: true,
        type: 'EXTRA_FUEL_REQUEST',
        request: extraFuelRequest,
        message: `Extra fuel request ${decision.toLowerCase()} successfully.`,
      });
    }

    /*
    |--------------------------------------------------------------------------
    | 4. HPMU RELEASE FUEL (separate endpoint for release action)
    |--------------------------------------------------------------------------
    */

    // This is handled by a separate /release endpoint below

    /*
    |--------------------------------------------------------------------------
    | REQUEST NOT FOUND / WRONG STATUS
    |--------------------------------------------------------------------------
    */

    if (vehicleRequest) {
      return res.status(400).json({
        message: `Vehicle request is not awaiting HPMU review. Current status: ${vehicleRequest.status}`,
      });
    }

    if (fuelRequest) {
      return res.status(400).json({
        message: `Fuel request is not awaiting HPMU review. Current status: ${fuelRequest.status}`,
      });
    }

    if (extraFuelRequest) {
      return res.status(400).json({
        message: `Extra fuel request is not awaiting HPMU review. Current status: ${extraFuelRequest.status}`,
      });
    }

    return res.status(404).json({
      message: 'Vehicle, fuel, or extra fuel request not found.',
    });
  } catch (err) {
    next(err);
  }
});

/*
|--------------------------------------------------------------------------
| HPMU RELEASE FUEL
| POST /api/hpmu/:requestId/release
| Body: { "litresReleased": 50, "voucherToken": "HPMU20260001AB", "comment": "..." }
| voucherToken: 10-20 characters, letters and numbers only.
|--------------------------------------------------------------------------
*/

// Official HPMU Fuel Voucher Token:
//   - trimmed (never silently truncated)
//   - 10 to 20 characters
//   - letters and numbers only
const MIN_VOUCHER_TOKEN_LENGTH = 10;
const MAX_VOUCHER_TOKEN_LENGTH = 20;
const VOUCHER_TOKEN_PATTERN = /^[A-Za-z0-9]+$/;
const VOUCHER_TOKEN_LENGTH_ERROR = 'Voucher token must contain between 10 and 20 characters.';

function validateVoucherToken(rawToken) {
  const token = rawToken == null ? '' : String(rawToken).trim();

  if (!token) return { error: 'Fuel voucher token is required.' };

  if (token.length < MIN_VOUCHER_TOKEN_LENGTH || token.length > MAX_VOUCHER_TOKEN_LENGTH) {
    return { error: VOUCHER_TOKEN_LENGTH_ERROR };
  }

  if (!VOUCHER_TOKEN_PATTERN.test(token)) {
    return { error: 'Voucher token may only contain letters and numbers.' };
  }

  return { token };
}

router.post('/:requestId/release', async (req, res, next) => {
  try {
    const { litresReleased, comment, issueOdometerKm, stationReference, notes } = req.body;
    const requestId = Number(req.params.requestId);

    if (!Number.isInteger(requestId)) {
      return res.status(400).json({ message: 'Invalid request ID.' });
    }

    if (litresReleased == null || Number(litresReleased) <= 0) {
      return res.status(400).json({ message: 'Valid litres released is required.' });
    }

    const voucherCheck = validateVoucherToken(
      req.body.voucherToken ?? req.body.voucherNumber
    );
    if (voucherCheck.error) {
      return res.status(400).json({ message: voucherCheck.error });
    }

    const fuelRequest = await FuelRequest.findByPk(requestId, {
      include: [
        {
          model: Driver,
          as: 'driver',
          include: [{ model: User, as: 'user', attributes: ['id', 'fullName'] }],
        },
      ],
    });

    if (!fuelRequest) {
      return res.status(404).json({ message: 'Fuel request not found.' });
    }

    if (fuelRequest.status !== 'HPMU_APPROVED') {
      return res.status(400).json({
        message: `Fuel request must be approved before release. Current status: ${fuelRequest.status}`,
      });
    }

    const voucherNumber = voucherCheck.token;

    try {
      await fuelRequest.update({
        status: 'HPMU_RELEASED',
        litresReleased: Number(litresReleased),
        releaseComment: comment || null,
        releasedBy: req.user.id,
        releasedAt: new Date(),
        voucherNumber,
        voucherStatus: 'APPROVED',
        voucherIssuedAt: new Date(),
      });
    } catch (err) {
      if (err && err.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
          message: 'That fuel voucher token is already in use. Enter a different token.',
        });
      }
      throw err;
    }

    const issueLog = await FuelIssueLog.create({
      fuelRequestId: fuelRequest.id,
      tripId: fuelRequest.tripId,
      vehicleId: fuelRequest.vehicleId,
      driverId: fuelRequest.driverId,
      hpmuUserId: req.user.id,
      litresIssued: Number(litresReleased),
      issueOdometerKm: issueOdometerKm != null && issueOdometerKm !== '' ? Number(issueOdometerKm) : null,
      stationReference: stationReference ? String(stationReference).trim() : null,
      notes: notes ? String(notes).trim() : (comment ? String(comment).trim() : null),
      issuedAt: new Date(),
    });

    await logAction({
      userId: req.user.id,
      action: 'HPMU_RELEASE_FUEL',
      entity: 'FuelRequest',
      entityId: fuelRequest.id,
      description: `HPMU released ${litresReleased}L for fuel request ${fuelRequest.id}`,
      ipAddress: req.ip,
    });

    // Notify driver
    if (fuelRequest.driver) {
      await notify(
        fuelRequest.driver.userId,
        'Fuel released',
        `${litresReleased}L has been released for your trip. Please confirm receipt.`,
        `/driver/fuel`
      );
    }

    return res.json({ fuelRequest, issueLog });
  } catch (err) {
    next(err);
  }
});

/*
|--------------------------------------------------------------------------
| HPMU RELEASE EXTRA FUEL
| POST /api/hpmu/extra/:requestId/release
| Body: { "litresReleased": 50, "comment": "..." }
|--------------------------------------------------------------------------
*/

router.post('/extra/:requestId/release', async (req, res, next) => {
  try {
    const { litresReleased, comment } = req.body;
    const requestId = Number(req.params.requestId);

    if (!Number.isInteger(requestId)) {
      return res.status(400).json({ message: 'Invalid request ID.' });
    }

    if (litresReleased == null || Number(litresReleased) <= 0) {
      return res.status(400).json({ message: 'Valid litres released is required.' });
    }

    const extraFuelRequest = await ExtraFuelRequest.findByPk(requestId, {
      include: [
        {
          model: Driver,
          as: 'driver',
          include: [{ model: User, as: 'user', attributes: ['id', 'fullName'] }],
        },
      ],
    });

    if (!extraFuelRequest) {
      return res.status(404).json({ message: 'Extra fuel request not found.' });
    }

    if (extraFuelRequest.status !== 'HPMU_APPROVED') {
      return res.status(400).json({
        message: `Extra fuel request must be approved before release. Current status: ${extraFuelRequest.status}`,
      });
    }

    await extraFuelRequest.update({
      status: 'HPMU_RELEASED',
      litresReleased: Number(litresReleased),
      releaseComment: comment || null,
      releasedBy: req.user.id,
      releasedAt: new Date(),
    });

    const issueLog = await FuelIssueLog.create({
      extraFuelRequestId: extraFuelRequest.id,
      tripId: extraFuelRequest.tripId,
      vehicleId: extraFuelRequest.vehicleId,
      driverId: extraFuelRequest.driverId,
      hpmuUserId: req.user.id,
      litresIssued: Number(litresReleased),
      issueOdometerKm: null,
      stationReference: null,
      notes: comment || null,
      issuedAt: new Date(),
    });

    await logAction({
      userId: req.user.id,
      action: 'HPMU_RELEASE_EXTRA_FUEL',
      entity: 'ExtraFuelRequest',
      entityId: extraFuelRequest.id,
      description: `HPMU released ${litresReleased}L for extra fuel request ${extraFuelRequest.id}`,
      ipAddress: req.ip,
    });

    // Notify driver
    if (extraFuelRequest.driver) {
      await notify(
        extraFuelRequest.driver.userId,
        'Extra fuel released',
        `${litresReleased}L has been released for your trip. Please confirm receipt.`,
        `/driver/fuel`
      );
    }

    // Notify officer
    if (extraFuelRequest.officerId) {
      await notify(
        extraFuelRequest.officerId,
        'Extra fuel released',
        `${litresReleased}L has been released for your trip. Please confirm receipt.`,
        `/officer/trips/${extraFuelRequest.tripId}`
      );
    }

    // Notify transport officer
    const transportOfficers = await User.findAll({
      where: { role: 'TRANSPORT_OFFICER', status: 'ACTIVE' },
    });

    await Promise.all(
      transportOfficers.map((user) =>
        notify(
          user.id,
          'Extra fuel released',
          `Extra fuel request ${extraFuelRequest.id} has been released by HPMU (${litresReleased}L).`,
          `/transport/fuel`
        )
      )
    );

    return res.json(extraFuelRequest);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   HPMU FUEL ISSUE LOGBOOK
========================================================= */
router.post('/fuel-logbook', async (req, res, next) => {
  try {
    const {
      fuelRequestId,
      tripId,
      vehicleId,
      driverId,
      litresIssued,
      issueOdometerKm,
      stationReference,
      notes,
      tripReference,
      fuelRequestRef,
      purposeRoute,
      dateOfIssue,
    } = req.body;

    if (!vehicleId || !driverId || litresIssued == null) {
      return res.status(400).json({ message: 'Vehicle, driver, and fuel quantity are required.' });
    }

    const resolvedTripId = tripId ? Number(tripId) : null;

    const issueLog = await FuelIssueLog.create({
      fuelRequestId: fuelRequestId ? Number(fuelRequestId) : null,
      tripId: resolvedTripId,
      vehicleId: Number(vehicleId),
      driverId: Number(driverId),
      hpmuUserId: req.user.id,
      litresIssued: Number(litresIssued),
      issueOdometerKm: issueOdometerKm != null ? Number(issueOdometerKm) : null,
      stationReference: stationReference || null,
      notes: [
        tripReference ? `Trip Ref: ${tripReference}` : null,
        fuelRequestRef ? `Fuel Ref: ${fuelRequestRef}` : null,
        purposeRoute ? `Purpose: ${purposeRoute}` : null,
        notes || null,
      ].filter(Boolean).join(' | ') || null,
      issuedAt: dateOfIssue ? new Date(dateOfIssue) : new Date(),
    });

    await logAction({
      userId: req.user.id,
      action: 'HPMU_CREATE_FUEL_LOGBOOK',
      entity: 'FuelIssueLog',
      entityId: issueLog.id,
      description: `HPMU manually created fuel issue log entry for ${litresIssued}L`,
      ipAddress: req.ip,
    });

    res.status(201).json(issueLog);
  } catch (err) { next(err); }
});

router.get('/fuel-logbook', async (req, res, next) => {
  try {
    const issueLogs = await FuelIssueLog.findAll({
      include: [
        {
          model: Trip,
          as: 'trip',
          attributes: ['id', 'tripNumber', 'startKm', 'endKm', 'totalOdometerKm', 'startTime', 'endTime', 'requestId'],
          required: false,
          include: [
            {
              model: VehicleRequest,
              as: 'request',
              attributes: ['id', 'requestNumber', 'originName', 'destinationName', 'purpose', 'departureDate', 'oneWayKm', 'roundTripKm'],
              required: false,
            },
          ],
        },
        { model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['id', 'fullName'] }] },
        { model: Vehicle, as: 'vehicle', attributes: ['id', 'registrationNumber', 'model', 'type', 'fuelType'] },
        { model: User, as: 'hpmuUser', attributes: ['id', 'fullName'] },
        {
          model: FuelRequest,
          as: 'fuelRequest',
          attributes: ['id', 'status', 'litresRequested', 'litresReleased', 'voucherNumber', 'voucherStatus', 'releasedAt', 'requestType', 'emergencyReason'],
        },
        {
          model: ExtraFuelRequest,
          as: 'extraFuelRequest',
          attributes: ['id', 'status', 'requestedLitres', 'reason'],
        },
      ],
      order: [['issuedAt', 'DESC']],
    });

    // Auto-populated HPMU fuel logbook rows: every value is derived from the
    // linked trip, vehicle, request and fuel request records — nothing manual.
    const rows = issueLogs.map((log) => {
      const trip = log.trip;
      const request = trip?.request || null;

      let distanceKm = null;
      if (trip?.totalOdometerKm != null) distanceKm = Number(trip.totalOdometerKm);
      else if (trip?.startKm != null && trip?.endKm != null) distanceKm = Number(trip.endKm) - Number(trip.startKm);
      else if (request?.roundTripKm != null) distanceKm = Number(request.roundTripKm);
      else if (request?.oneWayKm != null) distanceKm = Number(request.oneWayKm);

      const origin = request?.originName || null;
      const destination = request?.destinationName || null;

      return {
        id: log.id,
        date: log.issuedAt,
        voucherNumber: log.fuelRequest?.voucherNumber || null,
        voucherStatus: log.fuelRequest?.voucherStatus || null,
        vehicleRegistration: log.vehicle?.registrationNumber || null,
        vehicleModel: log.vehicle?.model || null,
        vehicleType: log.vehicle?.type || null,
        fuelType: log.vehicle?.fuelType || null,
        driverName: log.driver?.user?.fullName || null,
        tripNumber: trip?.tripNumber || null,
        requestNumber: request?.requestNumber || null,
        origin,
        destination,
        route: [origin, destination].filter(Boolean).join(' → ') || null,
        purpose: request?.purpose || null,
        departureDate: request?.departureDate || null,
        distanceKm,
        fuelIssued: log.litresIssued,
        status: log.fuelRequest?.status || log.extraFuelRequest?.status || 'RELEASED',
        releasedBy: log.hpmuUser?.fullName || null,
        notes: log.notes || null,
        requestType: log.fuelRequest?.requestType || null,
        emergencyReason: log.fuelRequest?.emergencyReason || null,
      };
    });

    res.json(rows);
  } catch (err) { next(err); }
});

module.exports = router;