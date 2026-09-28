const express = require('express');

const {
  Trip,
  VehicleRequest,
  Vehicle,
  Driver,
  User,
  TripLocation,
  TripEvent,
  Logbook,
  TripCompletion,
} = require('../models');

const { authenticate, authorize } = require('../middleware/auth');
const { nextTripNumber } = require('../services/numberService');
const { logAction } = require('../services/auditService');
const { notify } = require('../services/notificationService');
const { getTripProgress } = require('../services/progressService');
const { cancelOfficerTrip } = require('../services/cancellationService');
const { recordCompletion, listCompletions } = require('../services/completionService');
const { recordActivity } = require('../services/activityService');

const router = express.Router();

router.use(authenticate);

/* =========================================================
   COMMON TRIP INCLUDE
========================================================= */

const TRIP_INCLUDE = [
  {
    model: VehicleRequest,
    as: 'request',
  },
  {
    model: Vehicle,
    as: 'vehicle',
  },
  {
    model: Driver,
    as: 'driver',
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'fullName', 'phone'],
      },
    ],
  },
  {
    model: User,
    as: 'officer',
    attributes: ['id', 'username', 'fullName', 'phone'],
  },
];

/* =========================================================
   GET ALL TRIPS
   DRIVER -> ONLY HIS/HER TRIPS
   OFFICER -> ONLY HIS/HER REQUESTS
   OTHER AUTHORIZED ROLES -> ALL TRIPS
========================================================= */

router.get('/', async (req, res, next) => {
  try {
    const where = {};

    /* -----------------------------------------------------
       DRIVER
       users.id
          ↓
       drivers.user_id
          ↓
       drivers.id
          ↓
       trips.driver_id
    ----------------------------------------------------- */

    if (req.user.role === 'DRIVER') {
      const driver = await Driver.findOne({
        where: {
          userId: req.user.id,
        },
        attributes: [
          'id',
          'userId',
          'licenseNumber',
          'licenseExpiry',
          'status',
          'assignedVehicleId',
        ],
      });

      if (!driver) {
        return res.status(404).json({
          message: 'Driver profile not found for this user.',
          userId: req.user.id,
        });
      }

      where.driverId = driver.id;
    }

    /* -----------------------------------------------------
       OFFICER
    ----------------------------------------------------- */

    if (req.user.role === 'OFFICER') {
      where.officerId = req.user.id;
    }

    const trips = await Trip.findAll({
      where,
      include: TRIP_INCLUDE,
      order: [['createdAt', 'DESC']],
    });

    return res.json(trips);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   GET SINGLE TRIP
========================================================= */

router.get('/:id', async (req, res, next) => {
  try {
    const trip = await Trip.findByPk(req.params.id, {
      include: [
        ...TRIP_INCLUDE,
        {
          model: TripLocation,
          as: 'locations',
        },
      ],
    });

    if (!trip) {
      return res.status(404).json({
        message: 'Trip not found.',
      });
    }

    /* -----------------------------------------------------
       SECURITY:
       DRIVER CAN ONLY OPEN HIS OWN TRIP
    ----------------------------------------------------- */

    if (req.user.role === 'DRIVER') {
      const driver = await Driver.findOne({
        where: {
          userId: req.user.id,
        },
      });

      if (!driver || trip.driverId !== driver.id) {
        return res.status(403).json({
          message: 'You are not allowed to view this trip.',
        });
      }
    }

    return res.json(trip);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   CREATE TRIP FROM VEHICLE REQUEST
========================================================= */

router.post(
  '/from-request/:requestId',
  authorize('TRANSPORT_OFFICER', 'DRIVER'),
  async (req, res, next) => {
    try {
      const request = await VehicleRequest.findByPk(req.params.requestId);

      if (!request) {
        return res.status(404).json({
          message: 'Vehicle request not found.',
        });
      }

      if (!request.vehicleId) {
        return res.status(400).json({
          message: 'A vehicle must be assigned before creating a trip.',
        });
      }

      if (!request.driverId) {
        return res.status(400).json({
          message: 'A driver must be assigned before creating a trip.',
        });
      }

      let trip = await Trip.findOne({
        where: {
          requestId: request.id,
        },
      });

      if (!trip) {
        const tripNumber = await nextTripNumber();

        trip = await Trip.create({
          tripNumber,
          requestId: request.id,
          vehicleId: request.vehicleId,
          driverId: request.driverId,
          officerId: request.officerId,
          status: 'DRIVER_ASSIGNED',
        });
      } else {
        /* Keep trip synchronized with assignment */
        await trip.update({
          vehicleId: request.vehicleId,
          driverId: request.driverId,
          officerId: request.officerId,
          status:
            trip.status === 'NOT_STARTED'
              ? 'DRIVER_ASSIGNED'
              : trip.status,
        });
      }

      const result = await Trip.findByPk(trip.id, {
        include: TRIP_INCLUDE,
      });

      return res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   DRIVER START TRIP
========================================================= */

router.post(
  '/:id/start',
  authorize('DRIVER'),
  async (req, res, next) => {
    try {
      const { startKm, startLat, startLng } = req.body;

      if (startKm == null || startKm === '') {
        return res.status(400).json({
          message: 'Start KM is required.',
        });
      }

      const driver = await Driver.findOne({
        where: {
          userId: req.user.id,
        },
      });

      if (!driver) {
        return res.status(404).json({
          message: 'Driver profile not found.',
        });
      }

      const trip = await Trip.findByPk(req.params.id, {
        include: [
          {
            model: Vehicle,
            as: 'vehicle',
          },
        ],
      });

      if (!trip) {
        return res.status(404).json({
          message: 'Trip not found.',
        });
      }

      if (trip.driverId !== driver.id) {
        return res.status(403).json({
          message: 'This trip is not assigned to you.',
        });
      }

      if (!['NOT_STARTED', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED'].includes(trip.status)) {
        return res.status(400).json({
          message: 'Trip already started or completed.',
        });
      }

      const vehicleOdometer = Number(trip.vehicle?.currentOdometer || 0);
      if (vehicleOdometer && Number(startKm) < vehicleOdometer) {
        return res.status(400).json({
          message: `Start KM cannot be less than the vehicle's latest odometer (${vehicleOdometer} KM).`,
        });
      }

      await trip.update({
        startKm: Number(startKm),
        startLat:
          startLat !== undefined && startLat !== ''
            ? Number(startLat)
            : null,
        startLng:
          startLng !== undefined && startLng !== ''
            ? Number(startLng)
            : null,
        startTime: new Date(),
        status: 'IN_PROGRESS',
      });

      const requestStatusBeforeStart = await VehicleRequest.findByPk(trip.requestId, {
        attributes: ['id', 'status'],
      });

      await VehicleRequest.update(
        {
          status: 'TRIP_STARTED',
        },
        {
          where: {
            id: trip.requestId,
          },
        }
      );

      if (trip.vehicle) {
        await trip.vehicle.update({
          status: 'IN_TRIP',
        });
      }

      await logAction({
        userId: req.user.id,
        action: 'TRIP_START',
        entity: 'Trip',
        entityId: trip.id,
        description: `Trip ${trip.tripNumber} started at KM ${startKm}`,
        ipAddress: req.ip,
      });

      await recordActivity({
        requestId: trip.requestId,
        tripId: trip.id,
        actorId: req.user.id,
        actorRole: 'DRIVER',
        action: 'TRIP_STARTED',
        fromStatus: requestStatusBeforeStart?.status || null,
        toStatus: 'TRIP_STARTED',
        comment: null,
        metadata: { startKm: Number(startKm) },
      });

      await notify(
        trip.officerId,
        'Trip started',
        `Your trip ${trip.tripNumber} has started.`,
        `/officer/trips/${trip.id}`
      );

      const updatedTrip = await Trip.findByPk(trip.id, {
        include: TRIP_INCLUDE,
      });

      return res.json(updatedTrip);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   DRIVER LIVE LOCATION
========================================================= */

router.post(
  '/:id/location',
  authorize('DRIVER'),
  async (req, res, next) => {
    try {
      const { latitude, longitude } = req.body;

      if (latitude == null || longitude == null) {
        return res.status(400).json({
          message: 'Latitude and longitude are required.',
        });
      }

      const driver = await Driver.findOne({
        where: {
          userId: req.user.id,
        },
      });

      if (!driver) {
        return res.status(404).json({
          message: 'Driver profile not found.',
        });
      }

      const trip = await Trip.findByPk(req.params.id);

      if (!trip) {
        return res.status(404).json({
          message: 'Trip not found.',
        });
      }

      if (trip.driverId !== driver.id) {
        return res.status(403).json({
          message: 'This trip is not assigned to you.',
        });
      }

      const location = await TripLocation.create({
        tripId: trip.id,
        driverId: trip.driverId,
        vehicleId: trip.vehicleId,
        latitude: Number(latitude),
        longitude: Number(longitude),
      });

      req.app
        .get('io')
        ?.to(`trip:${trip.id}`)
        .emit('trip:location', {
          tripId: trip.id,
          latitude: Number(latitude),
          longitude: Number(longitude),
          timestamp: location.recordedAt,
        });

      return res.status(201).json(location);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   DUAL TRIP COMPLETION CONFIRMATION
   DRIVER or OFFICER confirm; both must confirm before
   status becomes TRIP_COMPLETED.
========================================================= */

router.post(
  '/:id/confirm-completion',
  authorize('DRIVER', 'OFFICER', 'TRANSPORT_OFFICER'),
  async (req, res, next) => {
    try {
      const { endKm, notes } = req.body;

      const trip = await Trip.findByPk(req.params.id, {
        include: [
          { model: Vehicle, as: 'vehicle' },
          { model: VehicleRequest, as: 'request' },
        ],
      });

      if (!trip) {
        return res.status(404).json({ message: 'Trip not found.' });
      }

      if (req.user.role === 'DRIVER') {
        const driver = await Driver.findOne({ where: { userId: req.user.id } });
        if (!driver || trip.driverId !== driver.id) {
          return res.status(403).json({ message: 'This trip is not assigned to you.' });
        }
      }

      if (req.user.role === 'OFFICER' && trip.officerId !== req.user.id) {
        return res.status(403).json({ message: 'Not your trip.' });
      }

      /*
       * Driver and officer (or transport officer acting as the officer proxy)
       * share ONE completion workflow: recordCompletion() below is the same
       * service used by POST /:id/complete and POST /:id/end-trip.
       * The officer-side confirmation always occupies the OFFICER slot so a
       * single trip can never get two different completion records/times.
       */
      const completionRole = req.user.role === 'DRIVER' ? 'DRIVER' : 'OFFICER';

      const result = await recordCompletion({
        trip,
        role: completionRole,
        userId: req.user.id,
        endKm,
        notes,
        ipAddress: req.ip,
        io: req.app.get('io'),
      });

      return res.json({
        ...result,
        message: result.fullyCompleted
          ? 'Trip completed. Both driver and officer have confirmed.'
          : `Completion recorded. Waiting for ${result.pendingRole} confirmation.`,
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message });
      next(err);
    }
  }
);

router.get('/:id/completions', async (req, res, next) => {
  try {
    const trip = await Trip.findByPk(req.params.id);
    if (!trip) return res.status(404).json({ message: 'Trip not found.' });
    const completions = await listCompletions(trip.id);
    return res.json(completions);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   DRIVER COMPLETE TRIP (partial confirmation)
========================================================= */

router.post(
  '/:id/complete',
  authorize('DRIVER'),
  async (req, res, next) => {
    try {
      const { endKm, notes } = req.body;

      if (endKm == null || endKm === '') {
        return res.status(400).json({
          message: 'End KM is required.',
        });
      }

      const driver = await Driver.findOne({
        where: {
          userId: req.user.id,
        },
      });

      if (!driver) {
        return res.status(404).json({
          message: 'Driver profile not found.',
        });
      }

      const trip = await Trip.findByPk(req.params.id, {
        include: [
          {
            model: Vehicle,
            as: 'vehicle',
          },
          {
            model: VehicleRequest,
            as: 'request',
          },
        ],
      });

      if (!trip) {
        return res.status(404).json({
          message: 'Trip not found.',
        });
      }

      if (trip.driverId !== driver.id) {
        return res.status(403).json({
          message: 'This trip is not assigned to you.',
        });
      }

      if (!['IN_PROGRESS', 'TRIP_STARTED', 'DRIVER_COMPLETED', 'OFFICER_COMPLETED'].includes(trip.status)) {
        return res.status(400).json({
          message: 'Trip is not currently in progress.',
        });
      }

      const result = await recordCompletion({
        trip,
        role: 'DRIVER',
        userId: req.user.id,
        endKm,
        notes,
        ipAddress: req.ip,
        io: req.app.get('io'),
      });

      return res.json({
        ...result,
        message: result.fullyCompleted
          ? 'Trip completed. Both driver and officer have confirmed.'
          : 'Driver completion recorded. Waiting for officer confirmation.',
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message });
      next(err);
    }
  }
);


/* =========================================================
   DRIVER REPORT TRIP CHANGE / CHALLENGE
   A driver may continue a trip to a different place when
   an operational problem requires it, but a reason is mandatory.
========================================================= */
router.post(
  '/:id/events',
  authorize('DRIVER'),
  async (req, res, next) => {
    try {
      const { type = 'ROUTE_CHANGE', locationName, latitude, longitude, reason, notes } = req.body;
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ message: 'A reason is required for a trip change.' });
      }

      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      const trip = await Trip.findByPk(req.params.id);
      if (!driver || !trip || trip.driverId !== driver.id) {
        return res.status(403).json({ message: 'This trip is not assigned to you.' });
      }
      if (!['DRIVER_ACCEPTED', 'TRIP_STARTED', 'IN_PROGRESS'].includes(trip.status)) {
        return res.status(400).json({ message: 'Trip change can only be reported for an active assignment.' });
      }

      const event = await TripEvent.create({
        tripId: trip.id,
        driverId: driver.id,
        type,
        locationName: locationName ? String(locationName).trim() : null,
        latitude: latitude != null ? Number(latitude) : null,
        longitude: longitude != null ? Number(longitude) : null,
        reason: String(reason).trim(),
        notes: notes ? String(notes).trim() : null,
      });

      await logAction({
        userId: req.user.id,
        action: 'REPORT_TRIP_EVENT',
        entity: 'Trip',
        entityId: trip.id,
        description: `Driver reported ${type}: ${String(reason).trim()}`,
        ipAddress: req.ip,
      });

      await notify(
        trip.officerId,
        'Trip update reported',
        `Driver reported ${type.replace(/_/g, ' ').toLowerCase()} on trip ${trip.tripNumber}: ${String(reason).trim()}`,
        `/officer/trip-tracking/${trip.id}`
      );

      const transportOfficers = await User.findAll({
        where: { role: 'TRANSPORT_OFFICER', status: 'ACTIVE' },
      });
      await Promise.all(transportOfficers.map((u) =>
        notify(
          u.id,
          'Trip update reported',
          `Trip ${trip.tripNumber}: ${String(reason).trim()}`,
          `/transport/trips/${trip.id}`
        )
      ));

      req.app.get('io')?.emit('trip:event', {
        tripId: trip.id,
        event,
      });

      return res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/:id/events',
  async (req, res, next) => {
    try {
      const trip = await Trip.findByPk(req.params.id);
      if (!trip) return res.status(404).json({ message: 'Trip not found.' });
      const events = await TripEvent.findAll({
        where: { tripId: trip.id },
        order: [['createdAt', 'DESC']],
      });
      return res.json(events);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   TRANSPORT OFFICER CLOSE TRIP
========================================================= */

router.post(
  '/:id/close',
  authorize('TRANSPORT_OFFICER'),
  async (req, res, next) => {
    try {
      const trip = await Trip.findByPk(req.params.id, {
        include: TRIP_INCLUDE,
      });

      if (!trip) {
        return res.status(404).json({
          message: 'Trip not found.',
        });
      }

      if (trip.status !== 'TRIP_COMPLETED') {
        return res.status(400).json({
          message: 'Only fully completed trips (driver + officer confirmed) can be closed.',
        });
      }

      const logbook = await Logbook.findOne({
        where: {
          tripId: trip.id,
        },
      });

      if (!logbook || logbook.status !== 'VERIFIED') {
        return res.status(400).json({
          message:
            "This trip's logbook must be submitted by the driver and verified before the trip can be closed.",
        });
      }

      await trip.update({
        status: 'CLOSED',
      });

      await VehicleRequest.update(
        {
          status: 'CLOSED',
        },
        {
          where: {
            id: trip.requestId,
          },
        }
      );

      await logbook.update({
        status: 'CLOSED',
      });

      await logAction({
        userId: req.user.id,
        action: 'TRIP_CLOSE',
        entity: 'Trip',
        entityId: trip.id,
        description: `Trip ${trip.tripNumber} closed`,
        ipAddress: req.ip,
      });

      return res.json(trip);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   DRIVER ACCEPT ASSIGNMENT
========================================================= */

router.post(
  '/:id/accept',
  authorize('DRIVER'),
  async (req, res, next) => {
    try {
      const driver = await Driver.findOne({
        where: {
          userId: req.user.id,
        },
      });

      if (!driver) {
        return res.status(404).json({
          message: 'Driver profile not found.',
        });
      }

      const trip = await Trip.findByPk(req.params.id, {
        include: [
          {
            model: VehicleRequest,
            as: 'request',
          },
        ],
      });

      if (!trip) {
        return res.status(404).json({
          message: 'Trip not found.',
        });
      }

      if (trip.driverId !== driver.id) {
        return res.status(403).json({
          message: 'This trip is not assigned to you.',
        });
      }

      if (trip.status !== 'DRIVER_ASSIGNED') {
        return res.status(400).json({
          message: `Cannot accept assignment. Current status: ${trip.status}`,
        });
      }

      await trip.update({
        status: 'DRIVER_ACCEPTED',
      });

      await VehicleRequest.update(
        {
          status: 'DRIVER_ACCEPTED',
        },
        {
          where: {
            id: trip.requestId,
          },
        }
      );

      await logAction({
        userId: req.user.id,
        action: 'ACCEPT_ASSIGNMENT',
        entity: 'Trip',
        entityId: trip.id,
        description: `Driver accepted assignment for trip ${trip.tripNumber}`,
        ipAddress: req.ip,
      });

      await recordActivity({
        requestId: trip.requestId,
        tripId: trip.id,
        actorId: req.user.id,
        actorRole: 'DRIVER',
        action: 'DRIVER_ACCEPTED_ASSIGNMENT',
        fromStatus: 'DRIVER_ASSIGNED',
        toStatus: 'DRIVER_ACCEPTED',
        comment: null,
      });

      await notify(
        trip.officerId,
        'Assignment accepted',
        `Driver has accepted the assignment for trip ${trip.tripNumber}.`,
        `/officer/trips/${trip.id}`
      );

      const transportOfficers = await User.findAll({
        where: { role: 'TRANSPORT_OFFICER', status: 'ACTIVE' },
      });

      await Promise.all(
        transportOfficers.map((to) =>
          notify(
            to.id,
            'Assignment accepted',
            `Driver accepted assignment for trip ${trip.tripNumber}.`,
            `/transport/trips/${trip.id}`
          )
        )
      );

      const updatedTrip = await Trip.findByPk(trip.id, {
        include: TRIP_INCLUDE,
      });

      return res.json(updatedTrip);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   DRIVER CANCEL ASSIGNMENT
========================================================= */

router.post(
  '/:id/cancel-assignment',
  authorize('DRIVER'),
  async (req, res, next) => {
    try {
      const { reason, notes } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          message: 'Cancellation reason is required.',
        });
      }

      const driver = await Driver.findOne({
        where: {
          userId: req.user.id,
        },
      });

      if (!driver) {
        return res.status(404).json({
          message: 'Driver profile not found.',
        });
      }

      const trip = await Trip.findByPk(req.params.id, {
        include: [
          {
            model: VehicleRequest,
            as: 'request',
          },
        ],
      });

      if (!trip) {
        return res.status(404).json({
          message: 'Trip not found.',
        });
      }

      if (trip.driverId !== driver.id) {
        return res.status(403).json({
          message: 'This trip is not assigned to you.',
        });
      }

      if (!['DRIVER_ASSIGNED', 'DRIVER_ACCEPTED'].includes(trip.status)) {
        return res.status(400).json({
          message: `Cannot cancel assignment. Current status: ${trip.status}`,
        });
      }

      await trip.update({
        status: 'DRIVER_CANCELLED',
      });

      await VehicleRequest.update(
        {
          status: 'DRIVER_CANCELLED',
        },
        {
          where: {
            id: trip.requestId,
          },
        }
      );

      // Update driver and vehicle status
      await driver.update({
        status: 'AVAILABLE',
        assignedVehicleId: null,
      });

      if (trip.vehicle) {
        await trip.vehicle.update({
          status: 'AVAILABLE',
        });
      }

      await logAction({
        userId: req.user.id,
        action: 'CANCEL_ASSIGNMENT',
        entity: 'Trip',
        entityId: trip.id,
        description: `Driver cancelled assignment for trip ${trip.tripNumber}: ${reason}`,
        ipAddress: req.ip,
      });

      // Notify officer
      await notify(
        trip.officerId,
        'Assignment cancelled',
        `Driver cancelled assignment for trip ${trip.tripNumber}: ${reason}`,
        `/officer/trips/${trip.id}`
      );

      // Notify transport officer
      const transportOfficers = await User.findAll({
        where: { role: 'TRANSPORT_OFFICER', status: 'ACTIVE' },
      });

      await Promise.all(
        transportOfficers.map((to) =>
          notify(
            to.id,
            'Assignment cancelled',
            `Driver cancelled assignment for trip ${trip.tripNumber}: ${reason}. Please reassign.`,
            `/transport/trips/${trip.id}`
          )
        )
      );

      // If vehicle problem, notify specifically
      if (reason.toLowerCase().includes('vehicle') || reason.toLowerCase().includes('defect')) {
        await Promise.all(
          transportOfficers.map((to) =>
            notify(
              to.id,
              'Vehicle problem reported',
              `Driver reported vehicle issue for trip ${trip.tripNumber}: ${reason}. Vehicle may need maintenance.`,
              `/transport/vehicles/${trip.vehicleId}`
            )
          )
        );
      }

      const updatedTrip = await Trip.findByPk(trip.id, {
        include: TRIP_INCLUDE,
      });

      return res.json({
        trip: updatedTrip,
        message: 'Assignment cancelled successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   OFFICER CANCEL TRIP
   Reason required. Allows not-yet-complete trips including
   in-progress (emergency termination). Does not delete rows.
========================================================= */
router.post(
  '/:id/cancel',
  authorize('OFFICER'),
  async (req, res, next) => {
    try {
      const trip = await Trip.findByPk(req.params.id, {
        include: TRIP_INCLUDE,
      });
      if (!trip) {
        return res.status(404).json({ message: 'Trip not found.' });
      }

      try {
        const result = await cancelOfficerTrip({
          trip,
          user: req.user,
          reason: req.body?.reason,
          ipAddress: req.ip,
          io: req.app.get('io'),
        });

        const updatedTrip = await Trip.findByPk(trip.id, { include: TRIP_INCLUDE });
        return res.json({
          trip: updatedTrip,
          request: result.request,
          previousStatus: result.previousStatus,
          message: 'Trip cancelled.',
        });
      } catch (serviceErr) {
        return res
          .status(serviceErr.status || 400)
          .json({ message: serviceErr.message });
      }
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   OFFICER END TRIP (partial confirmation)
========================================================= */

router.post(
  '/:id/end-trip',
  authorize('OFFICER', 'TRANSPORT_OFFICER'),
  async (req, res, next) => {
    try {
      const { endKm, endLat, endLng, reason, notes } = req.body;

      const trip = await Trip.findByPk(req.params.id, {
        include: [
          {
            model: Vehicle,
            as: 'vehicle',
          },
          {
            model: VehicleRequest,
            as: 'request',
          },
        ],
      });

      if (!trip) {
        return res.status(404).json({
          message: 'Trip not found.',
        });
      }

      // Officer can only end their own trips
      if (req.user.role === 'OFFICER' && trip.officerId !== req.user.id) {
        return res.status(403).json({
          message: 'Not your trip.',
        });
      }

      if (!['TRIP_STARTED', 'IN_PROGRESS', 'DRIVER_COMPLETED', 'OFFICER_COMPLETED'].includes(trip.status)) {
        return res.status(400).json({
          message: `Trip is not in progress. Current status: ${trip.status}`,
        });
      }

      if (endLat != null) await trip.update({ endLat: Number(endLat) });
      if (endLng != null) await trip.update({ endLng: Number(endLng) });

      // Transport officer acts as officer proxy for completion confirmation
      const role = 'OFFICER';
      const result = await recordCompletion({
        trip,
        role,
        userId: req.user.id,
        endKm,
        notes: notes || reason || null,
        ipAddress: req.ip,
        io: req.app.get('io'),
      });

      await logAction({
        userId: req.user.id,
        action: 'END_TRIP_BY_OFFICER',
        entity: 'Trip',
        entityId: trip.id,
        description: `Officer ended trip ${trip.tripNumber}${reason ? ': ' + reason : ''}`,
        ipAddress: req.ip,
      });

      return res.json({
        ...result,
        message: result.fullyCompleted
          ? 'Trip completed. Both driver and officer have confirmed.'
          : 'Officer completion recorded. Waiting for driver confirmation.',
      });
    } catch (err) {
      if (err.status) return res.status(err.status).json({ message: err.message });
      next(err);
    }
  }
);

/* =========================================================
   ROUTE INFORMATION
========================================================= */

router.get('/:id/route', async (req, res, next) => {
  try {
    const trip = await Trip.findByPk(req.params.id, {
      include: [
        {
          model: VehicleRequest,
          as: 'request',
        },
      ],
    });

    if (!trip) {
      return res.status(404).json({
        message: 'Trip not found.',
      });
    }

    const r = trip.request;

    if (!r) {
      return res.status(404).json({
        message: 'Vehicle request for this trip was not found.',
      });
    }

    return res.json({
      origin: {
        lat: r.originLat,
        lng: r.originLng,
        name: r.originName,
      },

      destination: {
        lat: r.destinationLat,
        lng: r.destinationLng,
        name: r.destinationName,
      },

      oneWayKm: r.oneWayKm,
      roundTripKm: r.roundTripKm,
      durationMinutes: r.durationMinutes,
      geometry: r.routeGeometry,
    });
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   GPS LOCATIONS
========================================================= */

router.get('/:id/locations', async (req, res, next) => {
  try {
    const locations = await TripLocation.findAll({
      where: {
        tripId: req.params.id,
      },
      order: [['recordedAt', 'ASC']],
    });

    return res.json(locations);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   TRIP PROGRESS
========================================================= */

router.get('/:id/progress', async (req, res, next) => {
  try {
    const trip = await Trip.findByPk(req.params.id, {
      include: [
        {
          model: VehicleRequest,
          as: 'request',
        },
      ],
    });

    if (!trip) {
      return res.status(404).json({
        message: 'Trip not found.',
      });
    }

    if (!trip.request) {
      return res.status(404).json({
        message: 'Vehicle request for this trip was not found.',
      });
    }

    const progress = await getTripProgress(
      trip,
      trip.request
    );

    return res.json(progress);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   DRIVER EMERGENCY TRIP
   Allows driver to start a trip as emergency without
   waiting for the normal pre-trip flow.
========================================================= */

router.post(
  '/:id/emergency-start',
  authorize('DRIVER'),
  async (req, res, next) => {
    try {
      const { startKm, startLat, startLng, emergencyReason, emergencyNotes } = req.body;

      if (!startKm || startKm === '') {
        return res.status(400).json({ message: 'Start KM is required.' });
      }

      if (!emergencyReason || !String(emergencyReason).trim()) {
        return res.status(400).json({ message: 'Emergency reason is required.' });
      }

      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (!driver) {
        return res.status(404).json({ message: 'Driver profile not found.' });
      }

      const trip = await Trip.findByPk(req.params.id, {
        include: [
          { model: Vehicle, as: 'vehicle' },
          { model: VehicleRequest, as: 'request' },
        ],
      });

      if (!trip) {
        return res.status(404).json({ message: 'Trip not found.' });
      }

      if (trip.driverId !== driver.id) {
        return res.status(403).json({ message: 'This trip is not assigned to you.' });
      }

      if (!['NOT_STARTED', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED'].includes(trip.status)) {
        return res.status(400).json({ message: 'Trip already started or completed.' });
      }

      const emergencyVehicleOdometer = Number(trip.vehicle?.currentOdometer || 0);
      if (emergencyVehicleOdometer && Number(startKm) < emergencyVehicleOdometer) {
        return res.status(400).json({
          message: `Start KM cannot be less than the vehicle's latest odometer (${emergencyVehicleOdometer} KM).`,
        });
      }

      await trip.update({
        startKm: Number(startKm),
        startLat: startLat != null ? Number(startLat) : null,
        startLng: startLng != null ? Number(startLng) : null,
        startTime: new Date(),
        status: 'IN_PROGRESS',
        tripType: 'EMERGENCY',
        emergencyReason: String(emergencyReason).trim(),
        emergencyNotes: emergencyNotes ? String(emergencyNotes).trim() : null,
      });

      const requestStatusBeforeStart = await VehicleRequest.findByPk(trip.requestId, {
        attributes: ['id', 'status'],
      });

      await VehicleRequest.update(
        { status: 'TRIP_STARTED' },
        { where: { id: trip.requestId } }
      );

      if (trip.vehicle) {
        await trip.vehicle.update({ status: 'IN_TRIP' });
      }

      await driver.update({ status: 'ON_TRIP' });

      await logAction({
        userId: req.user.id,
        action: 'EMERGENCY_TRIP_START',
        entity: 'Trip',
        entityId: trip.id,
        description: `Emergency trip ${trip.tripNumber} started at KM ${startKm}. Reason: ${emergencyReason}`,
        ipAddress: req.ip,
      });

      await recordActivity({
        requestId: trip.requestId,
        tripId: trip.id,
        actorId: req.user.id,
        actorRole: 'DRIVER',
        action: 'TRIP_STARTED',
        fromStatus: requestStatusBeforeStart?.status || null,
        toStatus: 'TRIP_STARTED',
        comment: String(emergencyReason).trim(),
        metadata: { startKm: Number(startKm), tripType: 'EMERGENCY' },
      });

      await notify(
        trip.officerId,
        'Emergency trip started',
        `Emergency trip ${trip.tripNumber} has been started. Reason: ${emergencyReason}`,
        `/officer/trips/${trip.id}`
      );

      const transportOfficers = await User.findAll({
        where: { role: 'TRANSPORT_OFFICER', status: 'ACTIVE' },
      });

      await Promise.all(
        transportOfficers.map((to) =>
          notify(
            to.id,
            'Emergency trip started',
            `Emergency trip ${trip.tripNumber} has been started by driver. Reason: ${emergencyReason}`,
            `/transport/trips/${trip.id}`
          )
        )
      );

      const updatedTrip = await Trip.findByPk(trip.id, { include: TRIP_INCLUDE });
      return res.json(updatedTrip);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   DRIVER REJECT ASSIGNMENT
   Different from cancel: this is a formal rejection
   with a reason category.
========================================================= */

router.post(
  '/:id/reject-assignment',
  authorize('DRIVER'),
  async (req, res, next) => {
    try {
      const { reason, notes } = req.body;

      if (!reason || !reason.trim()) {
        return res.status(400).json({
          message: 'Rejection reason is required.',
        });
      }

      const driver = await Driver.findOne({
        where: { userId: req.user.id },
      });

      if (!driver) {
        return res.status(404).json({ message: 'Driver profile not found.' });
      }

      const trip = await Trip.findByPk(req.params.id, {
        include: [
          { model: VehicleRequest, as: 'request' },
          { model: Vehicle, as: 'vehicle' },
        ],
      });

      if (!trip) {
        return res.status(404).json({ message: 'Trip not found.' });
      }

      if (trip.driverId !== driver.id) {
        return res.status(403).json({ message: 'This trip is not assigned to you.' });
      }

      if (trip.status !== 'DRIVER_ASSIGNED') {
        return res.status(400).json({
          message: `Cannot reject assignment. Current status: ${trip.status}`,
        });
      }

      await trip.update({ status: 'DRIVER_CANCELLED' });

      // Request returns to TRANSPORT_REVIEW so the transport officer can reassign.
      await VehicleRequest.update(
        { status: 'TRANSPORT_REVIEW' },
        { where: { id: trip.requestId } }
      );

      await driver.update({
        status: 'AVAILABLE',
        assignedVehicleId: null,
      });

      if (trip.vehicleId) {
        const vehicle = await Vehicle.findByPk(trip.vehicleId);
        if (vehicle && vehicle.status !== 'AVAILABLE') {
          await vehicle.update({ status: 'AVAILABLE' });
        }
      }

      const { AssignmentHistory } = require('../models');
      await AssignmentHistory.create({
        requestId: trip.requestId,
        tripId: trip.id,
        driverId: driver.id,
        vehicleId: trip.vehicleId,
        action: 'REJECTED',
        reason,
        actorId: req.user.id,
        actorRole: 'DRIVER',
      });

      await recordActivity({
        requestId: trip.requestId,
        tripId: trip.id,
        actorId: req.user.id,
        actorRole: 'DRIVER',
        action: 'DRIVER_REJECTED_ASSIGNMENT',
        fromStatus: 'DRIVER_ASSIGNED',
        toStatus: 'TRANSPORT_REVIEW',
        comment: reason + (notes ? ` — ${notes}` : ''),
        metadata: { driverId: driver.id, previousDriverId: driver.id },
      });

      await logAction({
        userId: req.user.id,
        action: 'REJECT_ASSIGNMENT',
        entity: 'Trip',
        entityId: trip.id,
        description: `Driver rejected assignment for trip ${trip.tripNumber}: ${reason}`,
        ipAddress: req.ip,
      });

      await notify(
        trip.officerId,
        'Assignment rejected',
        `Driver rejected assignment for trip ${trip.tripNumber}: ${reason}`,
        `/officer/trips/${trip.id}`
      );

      const transportOfficers = await User.findAll({
        where: { role: 'TRANSPORT_OFFICER', status: 'ACTIVE' },
      });

      await Promise.all(
        transportOfficers.map((to) =>
          notify(
            to.id,
            'Assignment rejected — reassignment required',
            `Driver rejected assignment for trip ${trip.tripNumber}: ${reason}. Request returned to you for reassignment.`,
            `/transport/requests/${trip.requestId}`
          )
        )
      );

      const updatedTrip = await Trip.findByPk(trip.id, { include: TRIP_INCLUDE });
      const updatedRequest = await VehicleRequest.findByPk(trip.requestId);

      return res.json({
        trip: updatedTrip,
        request: updatedRequest,
        message: 'Assignment rejected. Request returned to Transport Officer for reassignment.',
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;