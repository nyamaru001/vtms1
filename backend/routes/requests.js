const express = require('express');
const { Op } = require('sequelize');

const {
  VehicleRequest,
  User,
  Vehicle,
  Driver,
  Trip,
  HPMURecommendation,
  R3Approval,
  RequestActivity,
  AssignmentHistory,
  Logbook,
} = require('../models');

const { authenticate, authorize } = require('../middleware/auth');
const { calculateRoute } = require('../services/routeService');
const { calculateFuel } = require('../services/fuelService');
const {
  nextRequestNumber,
  nextTripNumber,
} = require('../services/numberService');
const { logAction } = require('../services/auditService');
const { notify } = require('../services/notificationService');
const { cancelVehicleRequest } = require('../services/cancellationService');
const { recordActivity } = require('../services/activityService');
const sequelize = require('../config/database');

const router = express.Router();

router.use(authenticate);

/* =========================================================
   SOCKET.IO HELPER
========================================================= */
const emitSocketEvent = (io, event, payload) => {
  if (!io) {
    console.warn(
      `Socket.IO unavailable. Event not emitted: ${event}`
    );
    return;
  }

  io.emit(event, payload);
};

/* =========================================================
   FULL REQUEST INCLUDE
========================================================= */
const FULL_INCLUDE = [
  {
    model: User,
    as: 'officer',
    attributes: [
      'id',
      'fullName',
      'username',
      'phone',
      'email',
    ],
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
        attributes: [
          'id',
          'fullName',
          'username',
          'phone',
        ],
      },
    ],
  },

  {
    model: HPMURecommendation,
    as: 'hpmuRecommendations',
    include: [
      {
        model: User,
        as: 'reviewer',
        attributes: [
          'id',
          'fullName',
        ],
      },
    ],
  },

  {
    model: R3Approval,
    as: 'r3Approvals',
    include: [
      {
        model: User,
        as: 'reviewer',
        attributes: [
          'id',
          'fullName',
        ],
      },
    ],
  },

  {
    model: User,
    as: 'cancelledByUser',
    attributes: ['id', 'fullName', 'username'],
  },

  {
    model: Trip,
    as: 'trip',
  },
];

/* =========================================================
   LIST REQUESTS
========================================================= */
router.get('/', async (req, res, next) => {
  try {
    const {
      status,
      page = 1,
      limit = 20,
      search,
      vehicleId,
      startDate,
      endDate,
    } = req.query;

    const where = {};

    if (status) {
      if (status.includes(',')) {
        where.status = { [Op.in]: status.split(',').map(s => s.trim()) };
      } else {
        where.status = status;
      }
    }

    if (vehicleId) {
      where.vehicleId = vehicleId;
    }

    if (startDate || endDate) {
      const range = {};
      if (startDate) range[Op.gte] = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        range[Op.lte] = end;
      }
      where.createdAt = range;
    }

    if (search && String(search).trim()) {
      const term = String(search).trim();
      where[Op.or] = [
        { requestNumber: { [Op.like]: `%${term}%` } },
        { originName: { [Op.like]: `%${term}%` } },
        { destinationName: { [Op.like]: `%${term}%` } },
        { purpose: { [Op.like]: `%${term}%` } },
      ];
    }

    /* OFFICER — own requests */
    if (req.user.role === 'OFFICER') {
      where.officerId = req.user.id;
    }

    /* DRIVER — own requests (requester auto-identified from token) */
    if (req.user.role === 'DRIVER') {
      where.officerId = req.user.id;
    }

    /* HPMU */
    if (req.user.role === 'HPMU') {
      where.status =
        status || {
          [Op.in]: [
            'HPMU_REVIEW',
            'HPMU_APPROVED',
            'HPMU_REJECTED',
            'HPMU_RETURNED',
            'HPMU_RELEASED',
            'DRIVER_CONFIRMED',
          ],
        };
    }

    /* R3 */
    if (req.user.role === 'R3') {
      where.status =
        status || {
          [Op.in]: [
            'R3_REVIEW',
            'R3_APPROVED',
            'R3_REJECTED',
            'R3_RETURNED',
            'TRANSPORT_REVIEW',
          ],
        };
    }

    /* TRANSPORT OFFICER */
    if (req.user.role === 'TRANSPORT_OFFICER') {
      where.status =
        status || {
          [Op.in]: [
            'TRANSPORT_REVIEW',
            'DRIVER_ASSIGNED',
            'DRIVER_ACCEPTED',
            'DRIVER_CANCELLED',
            'FUEL_REQUESTED',
            'HPMU_REVIEW',
            'HPMU_APPROVED',
            'HPMU_REJECTED',
            'HPMU_RETURNED',
            'HPMU_RELEASED',
            'DRIVER_CONFIRMED',
            'TRIP_STARTED',
            'TRIP_COMPLETED',
            'CLOSED',
          ],
        };
    }

    const pageNumber = Math.max(
      Number(page) || 1,
      1
    );

    const pageLimit = Math.min(
      Math.max(Number(limit) || 20, 1),
      100
    );

    const {
      rows,
      count,
    } = await VehicleRequest.findAndCountAll({
      where,
      include: FULL_INCLUDE,
      distinct: true,
      limit: pageLimit,
      offset:
        (pageNumber - 1) * pageLimit,
      order: [
        ['createdAt', 'DESC'],
      ],
    });

    res.json({
      data: rows,
      total: count,
      page: pageNumber,
      limit: pageLimit,
      totalPages: Math.ceil(
        count / pageLimit
      ),
    });
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   REQUEST TIMELINE
   Built from real database records (status + related tables).
   Skips steps that are not applicable to this request.
========================================================= */
router.get('/:id/timeline', async (req, res, next) => {
  try {
    const request = await VehicleRequest.findByPk(req.params.id, {
      include: [
        { model: User, as: 'officer', attributes: ['id', 'fullName', 'role'] },
        { model: R3Approval, as: 'r3Approvals', include: [{ model: User, as: 'reviewer', attributes: ['id', 'fullName', 'role'] }] },
        { model: HPMURecommendation, as: 'hpmuRecommendations', include: [{ model: User, as: 'reviewer', attributes: ['id', 'fullName', 'role'] }] },
        { model: Trip, as: 'trip' },
        { model: RequestActivity, as: 'activities', include: [{ model: User, as: 'actor', attributes: ['id', 'fullName', 'role'] }] },
        { model: AssignmentHistory, as: 'assignmentHistory', include: [{ model: User, as: 'actor', attributes: ['id', 'fullName', 'role'] }] },
      ],
      order: [
        [{ model: RequestActivity, as: 'activities' }, 'createdAt', 'ASC'],
        [{ model: AssignmentHistory, as: 'assignmentHistory' }, 'createdAt', 'ASC'],
      ],
    });

    if (!request) return res.status(404).json({ message: 'Request not found.' });

    const steps = [];
    const push = (s) => { if (s) steps.push(s); };

    /*
     * Prefer the real RequestActivity rows (real actor + role + timestamp).
     * Synthesized steps below are only fallbacks for legacy trips that were
     * created before the corresponding activity row existed.
     */
    const recordedActions = new Set((request.activities || []).map((a) => a.action));

    push({
      key: 'CREATED',
      label: 'Vehicle request submitted',
      status: 'R3_REVIEW',
      at: request.createdAt,
      actor: request.officer?.fullName || null,
      role: request.officer?.role || 'OFFICER',
      activity: recordedActions.has('CREATE_REQUEST'),
    });

    if (request.r3Approvals?.length) {
      request.r3Approvals.forEach((a) => {
        push({
          key: `R3_${a.decision}`,
          label: `R3 ${String(a.decision).toLowerCase()}`,
          status: a.decision === 'APPROVE' ? 'TRANSPORT_REVIEW' : (a.decision === 'REJECT' ? 'R3_REJECTED' : 'R3_RETURNED'),
          at: a.createdAt,
          actor: a.reviewer?.fullName || null,
          role: a.reviewer?.role || 'R3',
          comment: a.comment,
        });
      });
    } else if (['R3_REVIEW', 'R3_RETURNED'].includes(request.status)) {
      push({ key: 'R3_PENDING', label: 'R3 review', status: 'R3_REVIEW', at: null, role: 'R3', pending: true });
    }

    if (request.assignmentHistory?.length) {
      request.assignmentHistory.forEach((h) => {
        push({
          key: `ASSIGN_${h.action}`,
          label: h.action === 'REJECTED' ? 'Driver rejected assignment' : `Assignment ${h.action.toLowerCase()}`,
          status: h.action === 'REJECTED' ? 'TRANSPORT_REVIEW' : 'DRIVER_ASSIGNED',
          at: h.createdAt,
          actor: h.actor?.fullName || null,
          role: h.actor?.role || h.actorRole || 'TRANSPORT_OFFICER',
          comment: h.reason,
        });
      });
    }

    if (request.trip) {
      const t = request.trip;
      if (t.status !== 'DRIVER_CANCELLED' && !recordedActions.has('ASSIGN_VEHICLE_DRIVER')) {
        push({
          key: 'ASSIGNED',
          label: 'Vehicle & driver assigned',
          status: 'DRIVER_ASSIGNED',
          at: t.createdAt,
          role: 'TRANSPORT_OFFICER',
        });
      }
      if (
        !recordedActions.has('DRIVER_ACCEPTED_ASSIGNMENT') &&
        (['DRIVER_ACCEPTED', 'FUEL_REQUESTED', 'HPMU_REVIEW', 'HPMU_APPROVED', 'HPMU_RELEASED', 'DRIVER_CONFIRMED', 'TRIP_STARTED', 'DRIVER_COMPLETED', 'OFFICER_COMPLETED', 'TRIP_COMPLETED', 'CLOSED'].includes(t.status) || t.startTime)
      ) {
        push({
          key: 'DRIVER_ACCEPTED',
          label: 'Driver accepted assignment',
          status: 'DRIVER_ACCEPTED',
          at: t.createdAt,
          role: 'DRIVER',
        });
      }
      if (t.startTime && !recordedActions.has('TRIP_STARTED')) {
        push({ key: 'TRIP_STARTED', label: 'Trip started', status: 'TRIP_STARTED', at: t.startTime, role: 'DRIVER' });
      }
      if (t.status === 'DRIVER_COMPLETED') {
        push({ key: 'DRIVER_COMPLETED', label: 'Driver confirmed completion', status: 'DRIVER_COMPLETED', at: t.updatedAt, role: 'DRIVER', pending: true });
      }
      if (t.status === 'OFFICER_COMPLETED') {
        push({ key: 'OFFICER_COMPLETED', label: 'Officer confirmed completion', status: 'OFFICER_COMPLETED', at: t.updatedAt, role: 'OFFICER', pending: true });
      }
      if (['TRIP_COMPLETED', 'CLOSED'].includes(t.status) && t.endTime && !recordedActions.has('TRIP_COMPLETED')) {
        push({ key: 'TRIP_COMPLETED', label: 'Trip completed (driver + officer confirmed)', status: 'TRIP_COMPLETED', at: t.endTime, role: 'OFFICER' });
      }
      if (t.status === 'CLOSED') {
        push({ key: 'CLOSED', label: 'Trip closed', status: 'CLOSED', at: t.updatedAt, role: 'TRANSPORT_OFFICER' });
      }
    }

    if (request.hpmuRecommendations?.length) {
      request.hpmuRecommendations.forEach((n) => {
        push({
          key: `HPMU_${n.decision}`,
          label: `HPMU ${String(n.decision).toLowerCase()} (fuel review)`,
          status: n.decision === 'APPROVE' ? 'HPMU_APPROVED' : (n.decision === 'REJECT' ? 'HPMU_REJECTED' : 'HPMU_RETURNED'),
          at: n.createdAt,
          actor: n.reviewer?.fullName || null,
          role: n.reviewer?.role || 'HPMU',
          comment: n.comment,
        });
      });
    }

    if (request.activities?.length) {
      request.activities.forEach((a) => {
        push({
          key: `ACT_${a.id}_${a.action}`,
          action: a.action,
          label: a.action.replace(/_/g, ' ').toLowerCase(),
          status: a.toStatus,
          at: a.createdAt,
          actor: a.actor?.fullName || null,
          role: a.actor?.role || a.actorRole,
          comment: a.comment,
          activity: true,
        });
      });
    }

    // current status marker
    push({
      key: 'CURRENT',
      label: `Current status: ${request.status}`,
      status: request.status,
      at: request.updatedAt,
      current: true,
    });

    steps.sort((a, b) => {
      const ta = a.at ? new Date(a.at).getTime() : Number.MAX_SAFE_INTEGER;
      const tb = b.at ? new Date(b.at).getTime() : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });

    return res.json({ status: request.status, steps });
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   REQUEST ACTIVITY HISTORY (chronological, DB-backed)
========================================================= */
router.get('/:id/activities', async (req, res, next) => {
  try {
    const request = await VehicleRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    const [activities, assignments, r3, hpmu] = await Promise.all([
      RequestActivity.findAll({
        where: { requestId: request.id },
        include: [{ model: User, as: 'actor', attributes: ['id', 'fullName', 'role'] }],
        order: [['createdAt', 'ASC']],
      }),
      AssignmentHistory.findAll({
        where: { requestId: request.id },
        include: [
          { model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['fullName'] }] },
          { model: User, as: 'actor', attributes: ['id', 'fullName', 'role'] },
        ],
        order: [['createdAt', 'ASC']],
      }),
      R3Approval.findAll({
        where: { requestId: request.id },
        include: [{ model: User, as: 'reviewer', attributes: ['id', 'fullName', 'role'] }],
        order: [['createdAt', 'ASC']],
      }),
      HPMURecommendation.findAll({
        where: { requestId: request.id },
        include: [{ model: User, as: 'reviewer', attributes: ['id', 'fullName', 'role'] }],
        order: [['createdAt', 'ASC']],
      }),
    ]);

    /*
     * Role always comes from the authenticated actor stored in the database
     * (users.role). The historical actor_role column is only a fallback for
     * legacy rows that pre-date the user join.
     */
    const history = [
      ...activities.map((a) => ({
        id: `act-${a.id}`,
        type: 'ACTIVITY',
        action: a.action,
        fromStatus: a.fromStatus,
        toStatus: a.toStatus,
        comment: a.comment,
        actor: a.actor?.fullName || null,
        actorId: a.actor?.id || a.actorId || null,
        role: a.actor?.role || a.actorRole || null,
        at: a.createdAt,
      })),
      ...assignments.map((h) => ({
        id: `asg-${h.id}`,
        type: 'ASSIGNMENT',
        action: h.action,
        comment: h.reason,
        driver: h.driver?.user?.fullName || null,
        actor: h.actor?.fullName || null,
        actorId: h.actor?.id || h.actorId || null,
        role: h.actor?.role || h.actorRole || null,
        at: h.createdAt,
      })),
      ...r3.map((a) => ({
        id: `r3-${a.id}`,
        type: 'R3_DECISION',
        action: a.decision,
        comment: a.comment,
        actor: a.reviewer?.fullName || null,
        actorId: a.reviewer?.id || a.reviewedBy || null,
        role: a.reviewer?.role || 'R3',
        at: a.createdAt,
      })),
      ...hpmu.map((n) => ({
        id: `hp-${n.id}`,
        type: 'HPMU_DECISION',
        action: n.decision,
        comment: n.comment,
        actor: n.reviewer?.fullName || null,
        actorId: n.reviewer?.id || n.reviewedBy || null,
        role: n.reviewer?.role || 'HPMU',
        at: n.createdAt,
      })),
    ].sort((a, b) => new Date(a.at) - new Date(b.at));

    return res.json(history);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   GET SINGLE REQUEST
========================================================= */
router.get('/:id', async (req, res, next) => {
  try {
    const request =
      await VehicleRequest.findByPk(
        req.params.id,
        {
          include: FULL_INCLUDE,
        }
      );

    if (!request) {
      return res.status(404).json({
        message: 'Request not found.',
      });
    }

    res.json(request);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   CREATE VEHICLE REQUEST
   OFFICER ONLY
========================================================= */
router.post(
  '/',
  authorize('OFFICER', 'R3', 'HPMU', 'DRIVER', 'TRANSPORT_OFFICER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const {
        purpose,
        originName,
        originLat,
        originLng,
        destinationName,
        destinationLat,
        destinationLng,
        departureDate,
        departureTime,
        returnDate,
        returnTime,
        passengers,
        additionalNotes,
      } = req.body;

      if (
        !purpose ||
        !originName ||
        !destinationName ||
        originLat == null ||
        originLng == null ||
        destinationLat == null ||
        destinationLng == null
      ) {
        return res.status(400).json({
          message:
            'Purpose, origin, and destination with map coordinates are required.',
        });
      }

      const route =
        await calculateRoute(
          {
            lat: originLat,
            lng: originLng,
          },
          {
            lat: destinationLat,
            lng: destinationLng,
          }
        );

      const requestNumber =
        await nextRequestNumber();

      const request =
        await VehicleRequest.create({
          requestNumber,
          officerId: req.user.id,

          purpose,

          originName,
          originLat,
          originLng,

          destinationName,
          destinationLat,
          destinationLng,

          departureDate,
          departureTime,

          returnDate,
          returnTime,

          passengers,
          additionalNotes,

          oneWayKm:
            route.oneWayKm,

          roundTripKm:
            route.roundTripKm,

          durationMinutes:
            route.durationMinutes,

          routeGeometry:
            route.geometry,

          status:
            'R3_REVIEW',
        });

      await logAction({
        userId: req.user.id,
        action: 'CREATE_REQUEST',
        entity: 'VehicleRequest',
        entityId: request.id,
        description:
          `Created vehicle request ${requestNumber}`,
        ipAddress: req.ip,
      });

      await recordActivity({
        requestId: request.id,
        actorId: req.user.id,
        actorRole: req.user.role,
        action: 'CREATE_REQUEST',
        fromStatus: null,
        toStatus: 'R3_REVIEW',
        comment: null,
      });

      const r3Users =
        await User.findAll({
          where: {
            role: 'R3',
            status: 'ACTIVE',
          },
        });

      await Promise.all(
        r3Users.map(
          (r3User) =>
            notify(
              r3User.id,
              'New vehicle request',
              `${req.user.fullName} submitted request ${requestNumber} requiring R3 review.`,
              `/r3/requests/${request.id}`
            )
        )
      );

      const io =
        req.app.get('io');

      emitSocketEvent(
        io,
        'vehicle_request_created',
        {
          requestId: request.id,
          requestNumber:
            request.requestNumber,
          officerId: req.user.id,
        }
      );

      res.status(201).json(
        request
      );
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   CANCEL REQUEST
   OFFICER ONLY — reason required; allows approved/assigned
   and pre-completion statuses; frees assignment + fuel via
   cancellationService.
========================================================= */
router.patch(
  '/:id/cancel',
  authorize('OFFICER'),
  async (req, res, next) => {
    try {
      const request = await VehicleRequest.findByPk(req.params.id);
      if (!request) {
        return res.status(404).json({ message: 'Request not found.' });
      }

      try {
        const result = await cancelVehicleRequest({
          request,
          user: req.user,
          reason: req.body?.reason,
          ipAddress: req.ip,
          io: req.app.get('io'),
        });
        return res.json(result.request);
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
   RECALCULATE ROUTE + FUEL
   TRANSPORT OFFICER ONLY
========================================================= */
router.post(
  '/:id/recalculate',
  authorize('TRANSPORT_OFFICER'),
  async (req, res, next) => {
    try {
      const request =
        await VehicleRequest.findByPk(
          req.params.id,
          {
            include: [
              {
                model: Vehicle,
                as: 'vehicle',
              },
            ],
          }
        );

      if (!request) {
        return res.status(404).json({
          message: 'Request not found.',
        });
      }

      const route =
        await calculateRoute(
          {
            lat: request.originLat,
            lng: request.originLng,
          },
          {
            lat:
              request.destinationLat,
            lng:
              request.destinationLng,
          }
        );

      let fuelUpdate = {};

      if (request.vehicle) {
        const fuel =
          calculateFuel(
            route.roundTripKm,
            request.vehicle
              .fuelConsumptionKmPerLitre
          );

        fuelUpdate = fuel;
      }

      await request.update({
        oneWayKm:
          route.oneWayKm,

        roundTripKm:
          route.roundTripKm,

        durationMinutes:
          route.durationMinutes,

        routeGeometry:
          route.geometry,

        ...fuelUpdate,
      });

      const io =
        req.app.get('io');

      emitSocketEvent(
        io,
        'vehicle_request_recalculated',
        {
          requestId:
            request.id,
          oneWayKm:
            route.oneWayKm,
          roundTripKm:
            route.roundTripKm,
        }
      );

      res.json(request);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   ASSIGN VEHICLE + DRIVER
   TRANSPORT OFFICER ONLY

   IMPORTANT:
   driverId MUST be drivers.id
   NOT users.id.

   Workflow (NEW):

   R3_APPROVED
         ↓
   TRANSPORT_REVIEW (Transport Officer assigns)
         ↓
   DRIVER_ASSIGNED (Driver receives notification, must accept)
========================================================= */
router.post(
  '/:id/assign',
  authorize('TRANSPORT_OFFICER'),
  async (req, res, next) => {
    const transaction =
      await sequelize.transaction();

    try {
      const {
        vehicleId,
        driverId,
      } = req.body;

      /* -----------------------------------------------------
         Validate IDs
      ----------------------------------------------------- */
      if (
        !vehicleId ||
        !driverId
      ) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            'Vehicle and driver are required.',
        });
      }

      /* -----------------------------------------------------
         Find request
      ----------------------------------------------------- */
      const request =
        await VehicleRequest.findByPk(
          req.params.id,
          {
            transaction,
            lock: transaction.LOCK.UPDATE,
          }
        );

      if (!request) {
        await transaction.rollback();

        return res.status(404).json({
          message:
            'Request not found.',
        });
      }

      /* -----------------------------------------------------
         Only R3_APPROVED or TRANSPORT_REVIEW can be assigned
      ----------------------------------------------------- */
      if (
        !['R3_APPROVED', 'TRANSPORT_REVIEW'].includes(request.status)
      ) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            `Only R3-approved requests can be assigned. Current status: ${request.status}`,
        });
      }

      /* -----------------------------------------------------
         Find vehicle
      ----------------------------------------------------- */
      const vehicle =
        await Vehicle.findByPk(
          vehicleId,
          {
            transaction,
            lock: transaction.LOCK.UPDATE,
          }
        );

      if (!vehicle) {
        await transaction.rollback();

        return res.status(404).json({
          message:
            'Vehicle not found.',
        });
      }

      /* -----------------------------------------------------
         Find driver
         IMPORTANT:
         driverId refers to drivers.id
      ----------------------------------------------------- */
      const driver =
        await Driver.findByPk(
          driverId,
          {
            include: [
              {
                model: User,
                as: 'user',
              },
            ],
            transaction,
            lock: transaction.LOCK.UPDATE,
          }
        );

      if (!driver) {
        await transaction.rollback();

        return res.status(404).json({
          message:
            'Driver not found.',
        });
      }

      /* -----------------------------------------------------
         Check vehicle
      ----------------------------------------------------- */
      if (
        vehicle.status !==
        'AVAILABLE'
      ) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            `Vehicle is currently ${vehicle.status} and cannot be assigned.`,
        });
      }

      /* -----------------------------------------------------
         Check driver
      ----------------------------------------------------- */
      if (
        driver.status !==
        'AVAILABLE'
      ) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            `Driver is currently ${driver.status} and cannot be assigned.`,
        });
      }

      /* -----------------------------------------------------
         Check overlapping requests
      ----------------------------------------------------- */
      const overlap =
        await VehicleRequest.findOne({
          where: {
            id: {
              [Op.ne]:
                request.id,
            },

            [Op.or]: [
              {
                vehicleId:
                  vehicle.id,
              },
              {
                driverId:
                  driver.id,
              },
            ],

            status: {
              [Op.in]: [
                'DRIVER_ASSIGNED',
                'DRIVER_ACCEPTED',
                'TRIP_STARTED',
                'R3_APPROVED',
                'TRANSPORT_REVIEW',
              ],
            },

            departureDate:
              request.departureDate,
          },

          transaction,
        });

      if (overlap) {
        await transaction.rollback();

        return res.status(400).json({
          message:
            'Selected vehicle or driver already has a conflicting trip on that date.',
        });
      }

      /* -----------------------------------------------------
         Calculate fuel
      ----------------------------------------------------- */
      const fuel =
        calculateFuel(
          request.roundTripKm,
          vehicle.fuelConsumptionKmPerLitre
        );

      /* -----------------------------------------------------
         Update request
      ----------------------------------------------------- */
      const statusBeforeAssign = request.status;
      await request.update(
        {
          vehicleId:
            vehicle.id,

          driverId:
            driver.id,

          baseFuelLitres:
            fuel.baseFuelLitres,

          fuelBufferPercent:
            fuel.fuelBufferPercent,

          totalFuelLitres:
            fuel.totalFuelLitres,

          status:
            'DRIVER_ASSIGNED',
        },
        {
          transaction,
        }
      );

      /* -----------------------------------------------------
         Update vehicle
      ----------------------------------------------------- */
      await vehicle.update(
        {
          status:
            'ASSIGNED',
        },
        {
          transaction,
        }
      );

      /* -----------------------------------------------------
         Update driver
      ----------------------------------------------------- */
      await driver.update(
        {
          status:
            'ASSIGNED',

          assignedVehicleId:
            vehicle.id,
        },
        {
          transaction,
        }
      );

      /* =====================================================
         CREATE OR UPDATE TRIP

         THIS IS THE IMPORTANT FIX.

         request.driverId = drivers.id
         trip.driverId    = drivers.id
      ===================================================== */

      let trip =
        await Trip.findOne({
          where: {
            requestId:
              request.id,
          },
          transaction,
          lock:
            transaction.LOCK.UPDATE,
        });

      if (!trip) {
        const tripNumber =
          await nextTripNumber();

        trip =
          await Trip.create(
            {
              tripNumber,

              requestId:
                request.id,

              vehicleId:
                vehicle.id,

              driverId:
                driver.id,

              officerId:
                request.officerId,

              status:
                'DRIVER_ASSIGNED',
            },
            {
              transaction,
            }
          );
      } else {
        await trip.update(
          {
            vehicleId:
              vehicle.id,

            driverId:
              driver.id,

            officerId:
              request.officerId,

            status:
              'DRIVER_ASSIGNED',
          },
          {
            transaction,
          }
        );
      }

      /* -----------------------------------------------------
         Commit transaction
      ----------------------------------------------------- */
      await transaction.commit();

      /* -----------------------------------------------------
         Audit
      ----------------------------------------------------- */
      const priorStatus = statusBeforeAssign;
      await logAction({
        userId:
          req.user.id,

        action:
          'ASSIGN_VEHICLE_DRIVER',

        entity:
          'VehicleRequest',

        entityId:
          request.id,

        description:
          `Assigned vehicle ${vehicle.registrationNumber} and driver ${driver.user?.fullName || driver.id} to request ${request.requestNumber}. Trip ${trip.tripNumber}.`,

        ipAddress:
          req.ip,
      });

      const { AssignmentHistory } = require('../models');
      await AssignmentHistory.create({
        requestId: request.id,
        tripId: trip.id,
        driverId: driver.id,
        vehicleId: vehicle.id,
        action: ['DRIVER_ASSIGNED', 'DRIVER_CANCELLED', 'TRANSPORT_REVIEW'].includes(statusBeforeAssign) ? 'REASSIGNED' : 'ASSIGNED',
        reason: null,
        actorId: req.user.id,
        actorRole: 'TRANSPORT_OFFICER',
      });

      await recordActivity({
        requestId: request.id,
        tripId: trip.id,
        actorId: req.user.id,
        actorRole: 'TRANSPORT_OFFICER',
        action: 'ASSIGN_VEHICLE_DRIVER',
        fromStatus: statusBeforeAssign,
        toStatus: 'DRIVER_ASSIGNED',
        comment: null,
        metadata: { vehicleId: vehicle.id, driverId: driver.id, tripId: trip.id },
      });

      /* -----------------------------------------------------
         Socket.IO
      ----------------------------------------------------- */
      const io =
        req.app.get('io');

      emitSocketEvent(
        io,
        'vehicle_assigned',
        {
          requestId:
            request.id,

          requestNumber:
            request.requestNumber,

          vehicleId:
            vehicle.id,

          driverId:
            driver.id,

          registrationNumber:
            vehicle.registrationNumber,

          tripId:
            trip.id,

          tripNumber:
            trip.tripNumber,

          status:
            request.status,
        }
      );

      emitSocketEvent(
        io,
        'driver:assigned',
        {
          requestId:
            request.id,

          requestNumber:
            request.requestNumber,

          driverId:
            driver.id,

          userId:
            driver.userId,

          vehicleId:
            vehicle.id,

          tripId:
            trip.id,

          tripNumber:
            trip.tripNumber,
        }
      );

      /* -----------------------------------------------------
         Notify driver
      ----------------------------------------------------- */
      if (driver.userId) {
        await notify(
          driver.userId,

          'Vehicle assigned',

          `Vehicle ${vehicle.registrationNumber} has been assigned to request ${request.requestNumber}. Trip ${trip.tripNumber} is ready. Please accept the assignment.`,

          `/driver`
        );
      }

      /* -----------------------------------------------------
         Notify officer
      ----------------------------------------------------- */
      await notify(
        request.officerId,

        'Vehicle assigned',

        `Vehicle ${vehicle.registrationNumber} and a driver have been assigned to your request ${request.requestNumber}.`,

        `/officer`
      );

      /* -----------------------------------------------------
         Notify HPMU for fuel review
      ----------------------------------------------------- */
      const hpmuUsers =
        await User.findAll({
          where: {
            role: 'HPMU',
            status: 'ACTIVE',
          },
        });

      await Promise.all(
        hpmuUsers.map(
          (hpmuUser) =>
            notify(
              hpmuUser.id,
              'Request needs fuel review',
              `Request ${request.requestNumber} has been assigned a vehicle and driver and requires fuel review.`,
              `/hpmu/requests/${request.id}`
            )
        )
      );

      emitSocketEvent(
        io,
        'request:hpmue_review',
        {
          requestId:
            request.id,

          requestNumber:
            request.requestNumber,

          vehicleId:
            vehicle.id,

          driverId:
            driver.id,

          tripId:
            trip.id,

          tripNumber:
            trip.tripNumber,
        }
      );

      /* -----------------------------------------------------
         Reload complete request
      ----------------------------------------------------- */
      const updatedRequest =
        await VehicleRequest.findByPk(
          request.id,
          {
            include:
              FULL_INCLUDE,
          }
        );

      res.json({
        message:
          'Vehicle and driver assigned successfully. Trip created.',

        request:
          updatedRequest,

        trip,
      });
    } catch (err) {
      try {
        if (!transaction.finished) {
          await transaction.rollback();
        }
      } catch (rollbackError) {
        console.error(
          'Transaction rollback failed:',
          rollbackError
        );
      }

      next(err);
    }
  }
);

/* =========================================================
   RETURN REQUEST
   TRANSPORT OFFICER / HPMU / R3
========================================================= */
router.patch(
  '/:id/return',
  authorize(
    'TRANSPORT_OFFICER',
    'HPMU',
    'R3'
  ),
  async (req, res, next) => {
    try {
      const { comment } =
        req.body;

      const request =
        await VehicleRequest.findByPk(
          req.params.id,
          {
            include: [
              {
                model: User,
                as: 'officer',
              },
            ],
          }
        );

      if (!request) {
        return res.status(404).json({
          message:
            'Request not found.',
        });
      }

      // Determine return status based on role
      let returnStatus;
      if (req.user.role === 'R3') {
        returnStatus = 'R3_RETURNED';
      } else if (req.user.role === 'HPMU') {
        returnStatus = 'HPMU_RETURNED';
      } else {
        returnStatus = 'R3_RETURNED'; // Transport Officer returns to R3
      }

      await request.update({
        status:
          returnStatus,
      });

      await logAction({
        userId:
          req.user.id,

        action:
          'RETURN_REQUEST',

        entity:
          'VehicleRequest',

        entityId:
          request.id,

        description:
          comment ||
          `Returned by ${req.user.role}`,

        ipAddress:
          req.ip,
      });

      await notify(
        request.officerId,

        'Request returned',

        `Your request ${request.requestNumber} was returned by ${req.user.role}: ${
          comment ||
          'see comments'
        }.`,

        `/officer/requests/${request.id}`
      );

      // Notify relevant role
      if (returnStatus === 'R3_RETURNED') {
        const r3Users = await User.findAll({ where: { role: 'R3', status: 'ACTIVE' } });
        await Promise.all(
          r3Users.map((r3User) =>
            notify(
              r3User.id,
              'Request returned for review',
              `Request ${request.requestNumber} was returned and requires your review.`,
              `/r3/requests/${request.id}`
            )
          )
        );
      } else if (returnStatus === 'HPMU_RETURNED') {
        const hpmuUsers = await User.findAll({ where: { role: 'HPMU', status: 'ACTIVE' } });
        await Promise.all(
          hpmuUsers.map((hpmuUser) =>
            notify(
              hpmuUser.id,
              'Request returned for review',
              `Request ${request.requestNumber} was returned and requires your review.`,
              `/hpmu/requests/${request.id}`
            )
          )
        );
      }

      const io =
        req.app.get('io');

      emitSocketEvent(
        io,
        'vehicle_request_returned',
        {
          requestId:
            request.id,

          requestNumber:
            request.requestNumber,

          returnedBy:
            req.user.id,

          role:
            req.user.role,

          comment:
            comment || null,
        }
      );

      res.json(request);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   FUEL PREVIEW
   TRANSPORT OFFICER ONLY
========================================================= */
router.get(
  '/:id/fuel-preview',
  authorize('TRANSPORT_OFFICER'),
  async (req, res, next) => {
    try {
      const {
        vehicleId,
      } = req.query;

      const request =
        await VehicleRequest.findByPk(
          req.params.id
        );

      if (!request) {
        return res.status(404).json({
          message:
            'Request not found.',
        });
      }

      let vehicle = null;

      if (vehicleId) {
        vehicle =
          await Vehicle.findByPk(
            vehicleId
          );

        if (!vehicle) {
          return res.status(404).json({
            message:
              'Vehicle not found.',
          });
        }
      }

      const fuel = vehicle
        ? calculateFuel(
            request.roundTripKm,
            vehicle.fuelConsumptionKmPerLitre
          )
        : null;

      res.json({
        origin: {
          lat:
            request.originLat,
          lng:
            request.originLng,
          name:
            request.originName,
        },

        destination: {
          lat:
            request.destinationLat,
          lng:
            request.destinationLng,
          name:
            request.destinationName,
        },

        oneWayKm:
          request.oneWayKm,

        roundTripKm:
          request.roundTripKm,

        durationMinutes:
          request.durationMinutes,

        routeGeometry:
          request.routeGeometry,

        vehicle: vehicle
          ? {
              id:
                vehicle.id,

              registrationNumber:
                vehicle.registrationNumber,

              model:
                vehicle.model,

              fuelConsumptionKmPerLitre:
                vehicle.fuelConsumptionKmPerLitre,
            }
          : null,

        fuel,
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;