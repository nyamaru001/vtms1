const express = require('express');
const { Op } = require('sequelize');

const {
  FuelRequest,
  Trip,
  Vehicle,
  Driver,
  User,
  VehicleRequest,
  HPMURecommendation,
  ExtraFuelRequest,
  FuelIssueLog,
} = require('../models');

const { authenticate, authorize } = require('../middleware/auth');

const {
  calculateFuel,
  calculateRemainingFuel,
  calculateTripFuel,
  getTripDistanceForFuel,
  isRoundTrip,
} = require('../services/fuelService');

const { getTripProgress } = require('../services/progressService');
const { logAction } = require('../services/auditService');
const { notify } = require('../services/notificationService');

const router = express.Router();

router.use(authenticate);

/* =========================================================
   SOCKET.IO
========================================================= */

const emitSocketEvent = (io, event, payload) => {
  if (!io || !payload?.userId) {
    return;
  }

  io.to(`user:${payload.userId}`).emit(event, payload);
};

/* =========================================================
   COMMON INCLUDE
========================================================= */

const FUEL_INCLUDE = [
  {
    model: Trip,
    as: 'trip',
    include: [
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
            attributes: ['id', 'fullName'],
          },
        ],
      },
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
        attributes: ['id', 'fullName'],
      },
    ],
  },

  {
    // HPMU user who released the fuel (shown as "Issued By" on vouchers).
    model: User,
    as: 'releasedByUser',
    attributes: ['id', 'fullName', 'username'],
    required: false,
  },

  {
    model: HPMURecommendation,
    as: 'hpmuRecommendations',
    attributes: [
      'decision',
      'comment',
      'createdAt',
    ],
    required: false,
  },

  {
    model: FuelIssueLog,
    as: 'issueLog',
    attributes: [
      'id',
      'litresIssued',
      'issuedAt',
      'issueOdometerKm',
      'stationReference',
      'notes',
    ],
    required: false,
  },
];

/* =========================================================
   GET ALL FUEL REQUESTS

   DRIVER:
     sees own requests

   HPMU:
     sees all fuel requests

   OFFICER:
     sees fuel requests for own trips

   TRANSPORT OFFICER:
     sees fuel information

   R3:
     read-only visibility
========================================================= */

router.get('/', async (req, res, next) => {
  try {
    const { status, tripId, page, limit } = req.query;

    const where = {};

    if (tripId) {
      where.tripId = tripId;
    }

    const wantsPagination = page != null || limit != null;
    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageLimit = Math.min(Math.max(Number(limit) || 15, 1), 100);

    /* =====================================================
       DRIVER
    ===================================================== */

    if (req.user.role === 'DRIVER') {
      const driver = await Driver.findOne({
        where: {
          userId: req.user.id,
        },
      });

      if (!driver) {
        return res.json([]);
      }

      where.driverId = driver.id;

      if (status) {
        where.status = status;
      } else {
        where.status = {
          [Op.in]: [
            'PENDING',
            'HPMU_REVIEW',
            'HPMU_APPROVED',
            'HPMU_REJECTED',
            'HPMU_RETURNED',
            'HPMU_RELEASED',
            'DRIVER_CONFIRMED',
            'COMPLETED',
          ],
        };
      }
    }

    /* =====================================================
       OFFICER
    ===================================================== */

    else if (req.user.role === 'OFFICER') {
      const myTrips = await Trip.findAll({
        include: [
          {
            model: VehicleRequest,
            as: 'request',
            where: {
              officerId: req.user.id,
            },
            required: true,
          },
        ],
        attributes: ['id'],
      });

      const tripIds = myTrips.map((trip) => trip.id);

      if (tripIds.length === 0) {
        return res.json([]);
      }

      where.tripId = {
        [Op.in]: tripIds,
      };

      if (status) {
        where.status = status;
      } else {
        where.status = {
          [Op.in]: [
            'HPMU_REVIEW',
            'HPMU_APPROVED',
            'HPMU_REJECTED',
            'HPMU_RETURNED',
            'HPMU_RELEASED',
            'DRIVER_CONFIRMED',
            'COMPLETED',
          ],
        };
      }
    }

    /* =====================================================
       HPMU
    ===================================================== */

    else if (req.user.role === 'HPMU') {
      if (status) {
        where.status = status;
      }
    }

    /* =====================================================
       TRANSPORT OFFICER
    ===================================================== */

    else if (req.user.role === 'TRANSPORT_OFFICER') {
      if (status) {
        where.status = status;
      } else {
        where.status = {
          [Op.in]: [
            'HPMU_REVIEW',
            'HPMU_APPROVED',
            'HPMU_RELEASED',
            'DRIVER_CONFIRMED',
            'COMPLETED',
            'HPMU_REJECTED',
            'HPMU_RETURNED',
          ],
        };
      }
    }

    /* =====================================================
       R3
    ===================================================== */

    else if (req.user.role === 'R3') {
      if (status) {
        where.status = status;
      } else {
        where.status = {
          [Op.in]: [
            'HPMU_REVIEW',
            'HPMU_APPROVED',
            'HPMU_RELEASED',
            'DRIVER_CONFIRMED',
            'COMPLETED',
            'HPMU_REJECTED',
            'HPMU_RETURNED',
          ],
        };
      }
    }

    /* =====================================================
       OTHER
    ===================================================== */

    else if (status) {
      where.status = status;
    }

    if (wantsPagination) {
      const { rows, count } = await FuelRequest.findAndCountAll({
        where,
        include: FUEL_INCLUDE,
        distinct: true,
        limit: pageLimit,
        offset: (pageNumber - 1) * pageLimit,
        order: [['createdAt', 'DESC']],
      });

      return res.json({
        data: rows,
        total: count,
        page: pageNumber,
        limit: pageLimit,
        totalPages: Math.ceil(count / pageLimit),
      });
    }

    const requests = await FuelRequest.findAll({
      where,
      include: FUEL_INCLUDE,
      order: [['createdAt', 'DESC']],
    });

    return res.json(requests);
  } catch (err) {
    next(err);
  }
});

/* =========================================================
   FUEL CALCULATION
========================================================= */

router.get(
  '/calc/:tripId',
  authorize(
    'DRIVER',
    'TRANSPORT_OFFICER',
    'OFFICER'
  ),
  async (req, res, next) => {
    try {
      const trip = await Trip.findByPk(
        req.params.tripId,
        {
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
        }
      );

      if (!trip) {
        return res.status(404).json({
          message: 'Trip not found.',
        });
      }

      if (!trip.vehicle) {
        return res.status(400).json({
          message:
            'Vehicle information is missing for this trip.',
        });
      }

      if (!trip.request) {
        return res.status(400).json({
          message:
            'Vehicle request information is missing for this trip.',
        });
      }

      const progress = await getTripProgress(
        trip,
        trip.request
      );

      // Use trip type-aware fuel calculation
      const tripDistanceKm = getTripDistanceForFuel(trip.request);
      const plan = calculateFuel(
        tripDistanceKm,
        trip.vehicle.fuelConsumptionKmPerLitre
      );

      const estimatedRemainingFuel =
        calculateRemainingFuel(
          progress.remainingKm,
          trip.vehicle.fuelConsumptionKmPerLitre
        );

      const previouslyIssued =
        (await FuelRequest.sum(
          'litresRequested',
          {
            where: {
              tripId: trip.id,
              status: {
                [Op.in]: [
                  'HPMU_APPROVED',
                  'HPMU_RELEASED',
                  'DRIVER_CONFIRMED',
                  'COMPLETED',
                ],
              },
            },
          }
        )) || 0;

      return res.json({
        routeDistanceKm:
          trip.request.oneWayKm,

        roundTripKm:
          trip.request.roundTripKm,

        tripDistanceKm,

        isRoundTrip: isRoundTrip(trip.request),

        durationMinutes:
          trip.request.durationMinutes,

        vehicleConsumptionKmPerLitre:
          trip.vehicle.fuelConsumptionKmPerLitre,

        expectedFuelLitres:
          plan.baseFuelLitres,

        fuelBufferPercent:
          plan.fuelBufferPercent,

        maxPlannedFuelLitres:
          plan.totalFuelLitres,

        completedKm:
          progress.completedKm,

        remainingKm:
          progress.remainingKm,

        progressPercent:
          progress.percent,

        lastLocation:
          progress.lastLocation,

        estimatedRemainingFuelLitres:
          estimatedRemainingFuel,

        fuelAlreadyIssuedLitres:
          Math.round(
            previouslyIssued * 100
          ) / 100,

        origin: {
          lat: trip.request.originLat,
          lng: trip.request.originLng,
          name: trip.request.originName,
        },

        destination: {
          lat: trip.request.destinationLat,
          lng: trip.request.destinationLng,
          name: trip.request.destinationName,
        },

        routeGeometry:
          trip.request.routeGeometry,
      });
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   GET SINGLE FUEL REQUEST
========================================================= */

router.get(
  '/:id',
  async (req, res, next) => {
    try {
      const fuelRequest =
        await FuelRequest.findByPk(
          req.params.id,
          {
            include: FUEL_INCLUDE,
          }
        );

      if (!fuelRequest) {
        return res.status(404).json({
          message:
            'Fuel request not found.',
        });
      }

      return res.json(fuelRequest);
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   DRIVER
   CREATE INITIAL FUEL REQUEST

   Driver can request when:
   DRIVER_ASSIGNED
   DRIVER_ACCEPTED
   TRIP_STARTED
   IN_PROGRESS
========================================================= */

router.post(
  '/',
  authorize('DRIVER', 'HPMU'),
  async (req, res, next) => {
    try {
      const {
        tripId,
        currentKm,
        litresRequested,
        reason,
        notes,
        requestType,
        emergencyReason,
      } = req.body;

      const isEmergency = requestType === 'EMERGENCY';

      if (
        !tripId ||
        currentKm == null ||
        litresRequested == null ||
        Number(litresRequested) <= 0
      ) {
        return res.status(400).json({
          message:
            'Trip, current KM, and a valid fuel quantity are required.',
        });
      }

      if (isEmergency && !emergencyReason?.trim()) {
        return res.status(400).json({
          message:
            'Emergency reason is required for emergency fuel requests.',
        });
      }

      const driver = await Driver.findOne({
        where: {
          userId: req.user.id,
        },
      });

      if (!driver) {
        return res.status(403).json({
          message:
            'Driver profile not found.',
        });
      }

      const trip =
        await Trip.findByPk(
          tripId,
          {
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
          }
        );

      if (!trip) {
        return res.status(404).json({
          message: 'Trip not found.',
        });
      }

      if (trip.driverId !== driver.id) {
        return res.status(403).json({
          message:
            'This trip is not assigned to you.',
        });
      }

      if (!trip.vehicle) {
        return res.status(400).json({
          message:
            'Vehicle information is missing for this trip.',
        });
      }

      if (!trip.request) {
        return res.status(400).json({
          message:
            'Vehicle request information is missing for this trip.',
        });
      }

      const validStatuses = [
        'DRIVER_ASSIGNED',
        'DRIVER_ACCEPTED',
        'TRIP_STARTED',
        'IN_PROGRESS',
      ];

      if (!validStatuses.includes(trip.status)) {
        return res.status(400).json({
          message:
            `Fuel cannot be requested while trip status is ${trip.status}.`,
        });
      }

      const progress =
        await getTripProgress(
          trip,
          trip.request
        );

      // Use trip type-aware fuel calculation for the full trip estimate
      const fullTripEstimatedFuel = calculateTripFuel(
        trip.request,
        trip.vehicle.fuelConsumptionKmPerLitre
      ).totalFuelLitres;

      const estimatedRemainingFuel =
        calculateRemainingFuel(
          progress.remainingKm,
          trip.vehicle
            .fuelConsumptionKmPerLitre
        );

      const previouslyIssued =
        (await FuelRequest.sum(
          'litresRequested',
          {
            where: {
              tripId: trip.id,
              status: {
                [Op.in]: [
                  'HPMU_APPROVED',
                  'HPMU_RELEASED',
                  'DRIVER_CONFIRMED',
                  'COMPLETED',
                ],
              },
            },
          }
        )) || 0;

      const requestedAmount =
        Number(litresRequested);

      // Use full trip estimated fuel for exceedsEstimate check (with 15% tolerance)
      // This is informational only - does not block the request
      const exceedsEstimate =
        requestedAmount >
        Number(fullTripEstimatedFuel || 0) *
          1.15;

      const fuelRequest =
        await FuelRequest.create({
          tripId: trip.id,

          vehicleId:
            trip.vehicleId,

          driverId:
            trip.driverId,

          currentKm:
            Number(currentKm),

          litresRequested:
            requestedAmount,

          litresCalculated:
            fullTripEstimatedFuel,

          routeDistanceKm:
            trip.request.oneWayKm,

          completedKm:
            progress.completedKm,

          remainingKm:
            progress.remainingKm,

          previousFuelIssued:
            previouslyIssued,

          exceedsEstimate,

          reason:
            reason?.trim() || null,

          notes:
            notes?.trim() || null,

          status:
            'HPMU_REVIEW',

          requestType: isEmergency ? 'EMERGENCY' : 'NORMAL',

          emergencyReason: isEmergency ? emergencyReason?.trim() : null,
        });

      const requestTypeLabel = isEmergency ? 'Emergency ' : '';

      await logAction({
        userId: req.user.id,
        action:
          'CREATE_FUEL_REQUEST',
        entity:
          'FuelRequest',
        entityId:
          fuelRequest.id,
        description:
          `Driver requested ${requestedAmount}L ${requestTypeLabel}fuel for trip ${trip.tripNumber}.`,
        ipAddress: req.ip,
      });

      /* Notify HPMU */

      const hpmuUsers =
        await User.findAll({
          where: {
            role: 'HPMU',
            status: 'ACTIVE',
          },
        });

      await Promise.all(
        hpmuUsers.map((user) =>
          notify(
            user.id,
            'New Fuel Request',
            `${trip.tripNumber}: Driver requested ${requestedAmount}L ${requestTypeLabel}fuel.`,
            `/hpmu/fuel/${fuelRequest.id}`
          )
        )
      );

      /* Notify driver */

      await notify(
        req.user.id,
        'Fuel Request Submitted',
        `${trip.tripNumber}: your ${requestTypeLabel}fuel request was sent to HPMU.`,
        `/driver/fuel`
      );

      const io =
        req.app.get('io');

      emitSocketEvent(
        io,
        'fuel:submitted',
        {
          fuelRequestId:
            fuelRequest.id,

          tripNumber:
            trip.tripNumber,

          userId:
            req.user.id,
        }
      );

      return res.status(201).json(
        fuelRequest
      );
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   DRIVER
   ADDITIONAL / EMERGENCY FUEL

   Allowed from assigned trip as requested by user.
========================================================= */

router.post(
  '/additional',
  authorize('DRIVER'),
  async (req, res, next) => {
    try {
      const {
        tripId,
        requestedLitres,
        reason,
        currentLat,
        currentLng,
        currentLocationName,
      } = req.body;

      if (
        !tripId ||
        !requestedLitres ||
        Number(requestedLitres) <= 0 ||
        !reason?.trim()
      ) {
        return res.status(400).json({
          message:
            'Trip, requested litres, and reason are required.',
        });
      }

      const driver =
        await Driver.findOne({
          where: {
            userId: req.user.id,
          },
        });

      if (!driver) {
        return res.status(403).json({
          message:
            'Driver profile not found.',
        });
      }

      const trip =
        await Trip.findByPk(
          tripId,
          {
            include: [
              {
                model: Vehicle,
                as: 'vehicle',
              },
            ],
          }
        );

      if (!trip) {
        return res.status(404).json({
          message: 'Trip not found.',
        });
      }

      if (trip.driverId !== driver.id) {
        return res.status(403).json({
          message:
            'This trip is not assigned to you.',
        });
      }

      const allowedStatuses = [
        'DRIVER_ASSIGNED',
        'DRIVER_ACCEPTED',
        'TRIP_STARTED',
        'IN_PROGRESS',
      ];

      if (
        !allowedStatuses.includes(
          trip.status
        )
      ) {
        return res.status(400).json({
          message:
            `Additional fuel cannot be requested while trip status is ${trip.status}.`,
        });
      }

      const additionalFuelRequest =
        await ExtraFuelRequest.create({
          tripId: trip.id,

          vehicleId:
            trip.vehicleId,

          driverId:
            trip.driverId,

          officerId:
            trip.officerId || null,

          requestedLitres:
            Number(requestedLitres),

          reason:
            reason.trim(),

          currentLat:
            currentLat != null
              ? Number(currentLat)
              : null,

          currentLng:
            currentLng != null
              ? Number(currentLng)
              : null,

          currentLocationName:
            currentLocationName?.trim() ||
            null,

          status:
            'HPMU_REVIEW',
        });

      await logAction({
        userId: req.user.id,
        action:
          'CREATE_ADDITIONAL_FUEL_REQUEST',
        entity:
          'ExtraFuelRequest',
        entityId:
          additionalFuelRequest.id,
        description:
          `Driver requested ${requestedLitres}L additional fuel for trip ${trip.tripNumber}. Reason: ${reason}`,
        ipAddress: req.ip,
      });

      /* HPMU */

      const hpmuUsers =
        await User.findAll({
          where: {
            role: 'HPMU',
            status: 'ACTIVE',
          },
        });

      await Promise.all(
        hpmuUsers.map((user) =>
          notify(
            user.id,
            'Additional Fuel Request',
            `Driver requested ${requestedLitres}L additional fuel for ${trip.tripNumber}. Reason: ${reason}`,
            `/hpmu/extra/${additionalFuelRequest.id}`
          )
        )
      );

      /* Officer */

      if (trip.officerId) {
        await notify(
          trip.officerId,
          'Additional Fuel Request',
          `Driver requested ${requestedLitres}L additional fuel for your trip ${trip.tripNumber}.`,
          `/officer/trips/${trip.id}`
        );
      }

      return res.status(201).json(
        additionalFuelRequest
      );
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   OFFICER
   EXTRA FUEL REQUEST
========================================================= */

router.post(
  '/extra',
  authorize('OFFICER'),
  async (req, res, next) => {
    try {
      const {
        tripId,
        requestedLitres,
        reason,
        currentLat,
        currentLng,
        currentLocationName,
      } = req.body;

      if (
        !tripId ||
        !requestedLitres ||
        Number(requestedLitres) <= 0 ||
        !reason?.trim()
      ) {
        return res.status(400).json({
          message:
            'Trip, requested litres, and reason are required.',
        });
      }

      const trip =
        await Trip.findByPk(
          tripId,
          {
            include: [
              {
                model: Vehicle,
                as: 'vehicle',
              },
            ],
          }
        );

      if (!trip) {
        return res.status(404).json({
          message: 'Trip not found.',
        });
      }

      if (
        trip.officerId &&
        trip.officerId !== req.user.id
      ) {
        return res.status(403).json({
          message:
            'This trip does not belong to you.',
        });
      }

      const activeStatuses = [
        'DRIVER_ASSIGNED',
        'DRIVER_ACCEPTED',
        'TRIP_STARTED',
        'IN_PROGRESS',
      ];

      if (
        !activeStatuses.includes(
          trip.status
        )
      ) {
        return res.status(400).json({
          message:
            `Extra fuel cannot be requested while trip status is ${trip.status}.`,
        });
      }

      const extraFuelRequest =
        await ExtraFuelRequest.create({
          tripId: trip.id,

          vehicleId:
            trip.vehicleId,

          driverId:
            trip.driverId,

          officerId:
            req.user.id,

          requestedLitres:
            Number(requestedLitres),

          reason:
            reason.trim(),

          currentLat:
            currentLat != null
              ? Number(currentLat)
              : null,

          currentLng:
            currentLng != null
              ? Number(currentLng)
              : null,

          currentLocationName:
            currentLocationName?.trim() ||
            null,

          status:
            'HPMU_REVIEW',
        });

      await logAction({
        userId: req.user.id,
        action:
          'CREATE_EXTRA_FUEL_REQUEST',
        entity:
          'ExtraFuelRequest',
        entityId:
          extraFuelRequest.id,
        description:
          `Officer requested ${requestedLitres}L extra fuel for trip ${trip.tripNumber}.`,
        ipAddress: req.ip,
      });

      const hpmuUsers =
        await User.findAll({
          where: {
            role: 'HPMU',
            status: 'ACTIVE',
          },
        });

      await Promise.all(
        hpmuUsers.map((user) =>
          notify(
            user.id,
            'Extra Fuel Request',
            `Officer requested ${requestedLitres}L extra fuel for ${trip.tripNumber}. Reason: ${reason}`,
            `/hpmu/extra/${extraFuelRequest.id}`
          )
        )
      );

      return res.status(201).json(
        extraFuelRequest
      );
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   HPMU
   REVIEW FUEL REQUEST
========================================================= */

router.post(
  '/:id/hpmu-review',
  authorize('HPMU'),
  async (req, res, next) => {
    try {
      const {
        decision,
        comment,
      } = req.body;

      if (
        ![
          'APPROVE',
          'REJECT',
          'RETURN',
        ].includes(decision)
      ) {
        return res.status(400).json({
          message:
            'Invalid HPMU decision.',
        });
      }

      if (
        decision !== 'APPROVE' &&
        !comment?.trim()
      ) {
        return res.status(400).json({
          message:
            'Comment is required when rejecting or returning a request.',
        });
      }

      const fuelRequest =
        await FuelRequest.findByPk(
          req.params.id,
          {
            include: [
              {
                model: Trip,
                as: 'trip',
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
                    ],
                  },
                ],
              },
            ],
          }
        );

      if (!fuelRequest) {
        return res.status(404).json({
          message:
            'Fuel request not found.',
        });
      }

      if (
        fuelRequest.status !==
        'HPMU_REVIEW'
      ) {
        return res.status(400).json({
          message:
            `Fuel request is not awaiting HPMU review. Current status: ${fuelRequest.status}`,
        });
      }

      let nextStatus;

      if (decision === 'APPROVE') {
        nextStatus =
          'HPMU_APPROVED';
      } else if (decision === 'REJECT') {
        nextStatus =
          'HPMU_REJECTED';
      } else {
        nextStatus =
          'HPMU_RETURNED';
      }

      await fuelRequest.update({
        status: nextStatus,

        hpmuReviewComment:
          comment?.trim() || null,

        hpmuReviewedBy:
          req.user.id,

        hpmuReviewedAt:
          new Date(),
      });

      await logAction({
        userId: req.user.id,
        action:
          'HPMU_FUEL_DECISION',
        entity:
          'FuelRequest',
        entityId:
          fuelRequest.id,
        description:
          `HPMU ${decision.toLowerCase()}d fuel request ${fuelRequest.id}.`,
        ipAddress: req.ip,
      });

      /* Driver notification */

      if (
        fuelRequest.driver?.userId
      ) {
        let message;

        if (decision === 'APPROVE') {
          message =
            'Your fuel request was approved by HPMU. Please wait for fuel release.';
        } else if (
          decision === 'REJECT'
        ) {
          message =
            `Your fuel request was rejected by HPMU. ${comment || ''}`;
        } else {
          message =
            `Your fuel request was returned by HPMU. ${comment || ''}`;
        }

        await notify(
          fuelRequest.driver.userId,
          'Fuel Request Update',
          message,
          `/driver/fuel`
        );
      }

      const io =
        req.app.get('io');

      emitSocketEvent(
        io,
        'fuel:hpmu-decision',
        {
          fuelRequestId:
            fuelRequest.id,

          decision,

          userId:
            req.user.id,
        }
      );

      return res.json(
        fuelRequest
      );
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   HPMU
   RELEASE / ISSUE FUEL

   This is the actual fuel issuing step.

   HPMU_APPROVED
        ↓
   HPMU_RELEASED
        ↓
   FuelIssueLog created
        ↓
   Driver confirms receipt
========================================================= */

router.post(
  '/:id/release',
  authorize('HPMU'),
  async (req, res, next) => {
    try {
      const {
        litresIssued,
        issueOdometerKm,
        stationReference,
        notes,
      } = req.body;

      if (
        litresIssued == null ||
        Number(litresIssued) <= 0
      ) {
        return res.status(400).json({
          message:
            'A valid amount of fuel issued is required.',
        });
      }

      const fuelRequest =
        await FuelRequest.findByPk(
          req.params.id,
          {
            include: [
              {
                model: Trip,
                as: 'trip',
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
                  },
                ],
              },
            ],
          }
        );

      if (!fuelRequest) {
        return res.status(404).json({
          message:
            'Fuel request not found.',
        });
      }

      if (
        fuelRequest.status !==
        'HPMU_APPROVED'
      ) {
        return res.status(400).json({
          message:
            `Only HPMU-approved fuel requests can be released. Current status: ${fuelRequest.status}`,
        });
      }

      const amount =
        Number(litresIssued);

      const transaction =
        await FuelRequest.sequelize.transaction();

      try {
        await fuelRequest.update(
          {
            status:
              'HPMU_RELEASED',

            litresReleased:
              amount,

            releasedBy:
              req.user.id,

            releasedAt:
              new Date(),

            issueOdometerKm:
              issueOdometerKm != null
                ? Number(issueOdometerKm)
                : null,

            stationReference:
              stationReference?.trim() ||
              null,

            releaseNotes:
              notes?.trim() ||
              null,
          },
          {
            transaction,
          }
        );

        await FuelIssueLog.create(
          {
            fuelRequestId:
              fuelRequest.id,

            tripId:
              fuelRequest.tripId,

            vehicleId:
              fuelRequest.vehicleId,

            driverId:
              fuelRequest.driverId,

            hpmuUserId:
              req.user.id,

            litresIssued:
              amount,

            issueOdometerKm:
              issueOdometerKm != null
                ? Number(issueOdometerKm)
                : null,

            stationReference:
              stationReference?.trim() ||
              null,

            notes:
              notes?.trim() ||
              null,

            issuedAt:
              new Date(),
          },
          {
            transaction,
          }
        );

        await transaction.commit();
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }

      await logAction({
        userId:
          req.user.id,

        action:
          'HPMU_RELEASE_FUEL',

        entity:
          'FuelRequest',

        entityId:
          fuelRequest.id,

        description:
          `HPMU issued ${amount}L fuel for request ${fuelRequest.id}.`,

        ipAddress:
          req.ip,
      });

      /* Notify driver */

      if (
        fuelRequest.driver?.userId
      ) {
        await notify(
          fuelRequest.driver.userId,
          'Fuel Released',
          `${amount}L fuel has been released by HPMU for trip ${fuelRequest.trip?.tripNumber || fuelRequest.tripId}. Please confirm receipt.`,
          `/driver/fuel`
        );
      }

      /* Notify officer */

      if (
        fuelRequest.trip?.officerId
      ) {
        await notify(
          fuelRequest.trip.officerId,
          'Fuel Released',
          `${amount}L fuel was issued by HPMU for trip ${fuelRequest.trip?.tripNumber || fuelRequest.tripId}.`,
          `/officer/trips/${fuelRequest.tripId}`
        );
      }

      const io =
        req.app.get('io');

      emitSocketEvent(
        io,
        'fuel:released',
        {
          fuelRequestId:
            fuelRequest.id,

          tripNumber:
            fuelRequest.trip?.tripNumber,

          litresIssued:
            amount,

          userId:
            req.user.id,
        }
      );

      const updatedRequest =
        await FuelRequest.findByPk(
          fuelRequest.id,
          {
            include:
              FUEL_INCLUDE,
          }
        );

      return res.json(
        updatedRequest
      );
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   DRIVER
   CONFIRM FUEL RECEIPT
========================================================= */

router.patch(
  '/:id/confirm-receipt',
  authorize('DRIVER'),
  async (req, res, next) => {
    try {
      const {
        actualLitresReceived,
        notes,
      } = req.body;

      const driver =
        await Driver.findOne({
          where: {
            userId: req.user.id,
          },
        });

      if (!driver) {
        return res.status(403).json({
          message:
            'Driver profile not found.',
        });
      }

      const fuelRequest =
        await FuelRequest.findByPk(
          req.params.id,
          {
            include: [
              {
                model: Trip,
                as: 'trip',
                include: [
                  {
                    model: VehicleRequest,
                    as: 'request',
                  },
                ],
              },
              {
                model: Driver,
                as: 'driver',
              },
            ],
          }
        );

      if (!fuelRequest) {
        return res.status(404).json({
          message:
            'Fuel request not found.',
        });
      }

      if (
        fuelRequest.driverId !==
        driver.id
      ) {
        return res.status(403).json({
          message:
            'This fuel request does not belong to you.',
        });
      }

      if (
        fuelRequest.status !==
        'HPMU_RELEASED'
      ) {
        return res.status(400).json({
          message:
            `Fuel must be released by HPMU before confirmation. Current status: ${fuelRequest.status}`,
        });
      }

      const received =
        actualLitresReceived != null
          ? Number(actualLitresReceived)
          : Number(
              fuelRequest.litresReleased ||
                fuelRequest.litresRequested
            );

      if (
        Number.isNaN(received) ||
        received <= 0
      ) {
        return res.status(400).json({
          message:
            'Actual litres received must be greater than zero.',
        });
      }

      await fuelRequest.update({
        status:
          'DRIVER_CONFIRMED',

        confirmedByDriver:
          true,

        confirmedAt:
          new Date(),

        actualLitresReceived:
          received,

        confirmationNotes:
          notes?.trim() || null,

        voucherStatus:
          fuelRequest.voucherNumber ? 'USED' : fuelRequest.voucherStatus,
      });

      await logAction({
        userId:
          req.user.id,

        action:
          'CONFIRM_FUEL_RECEIPT',

        entity:
          'FuelRequest',

        entityId:
          fuelRequest.id,

        description:
          `Driver confirmed receipt of ${received}L fuel.`,

        ipAddress:
          req.ip,
      });

      /* Notify HPMU */

      const hpmuUsers =
        await User.findAll({
          where: {
            role: 'HPMU',
            status: 'ACTIVE',
          },
        });

      await Promise.all(
        hpmuUsers.map((user) =>
          notify(
            user.id,
            'Fuel Receipt Confirmed',
            `Driver confirmed receipt of ${received}L for fuel request ${fuelRequest.id}.`,
            `/hpmu/fuel/${fuelRequest.id}`
          )
        )
      );

      /* Notify Officer */

      if (
        fuelRequest.trip?.request
          ?.officerId
      ) {
        await notify(
          fuelRequest.trip.request
            .officerId,
          'Fuel Receipt Confirmed',
          `Driver confirmed fuel receipt for ${fuelRequest.trip.request.requestNumber}.`,
          `/officer/requests/${fuelRequest.trip.requestId}`
        );
      }

      const io =
        req.app.get('io');

      emitSocketEvent(
        io,
        'fuel:receipt-confirmed',
        {
          fuelRequestId:
            fuelRequest.id,

          tripNumber:
            fuelRequest.trip
              ?.tripNumber,

          userId:
            req.user.id,
        }
      );

      return res.json(
        fuelRequest
      );
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   DRIVER
   COMPLETE FUEL REQUEST
========================================================= */

router.patch(
  '/:id/complete',
  authorize('DRIVER'),
  async (req, res, next) => {
    try {
      const driver =
        await Driver.findOne({
          where: {
            userId: req.user.id,
          },
        });

      if (!driver) {
        return res.status(403).json({
          message:
            'Driver profile not found.',
        });
      }

      const fuelRequest =
        await FuelRequest.findByPk(
          req.params.id,
          {
            include: [
              {
                model: Trip,
                as: 'trip',
                include: [
                  {
                    model: VehicleRequest,
                    as: 'request',
                  },
                ],
              },
              {
                model: Driver,
                as: 'driver',
              },
            ],
          }
        );

      if (!fuelRequest) {
        return res.status(404).json({
          message:
            'Fuel request not found.',
        });
      }

      if (
        fuelRequest.driverId !==
        driver.id
      ) {
        return res.status(403).json({
          message:
            'This fuel request does not belong to you.',
        });
      }

      if (
        fuelRequest.status !==
        'DRIVER_CONFIRMED'
      ) {
        return res.status(400).json({
          message:
            `Fuel must be confirmed before completion. Current status: ${fuelRequest.status}`,
        });
      }

      await fuelRequest.update({
        status:
          'COMPLETED',

        completedAt:
          new Date(),
      });

      await logAction({
        userId:
          req.user.id,

        action:
          'MARK_FUEL_COMPLETED',

        entity:
          'FuelRequest',

        entityId:
          fuelRequest.id,

        description:
          `Fuel request ${fuelRequest.id} completed.`,

        ipAddress:
          req.ip,
      });

      /* Notify HPMU */

      const hpmuUsers =
        await User.findAll({
          where: {
            role: 'HPMU',
            status: 'ACTIVE',
          },
        });

      await Promise.all(
        hpmuUsers.map((user) =>
          notify(
            user.id,
            'Fuel Request Completed',
            `Fuel request ${fuelRequest.id} has been completed by the driver.`,
            `/hpmu/fuel/${fuelRequest.id}`
          )
        )
      );

      const io =
        req.app.get('io');

      emitSocketEvent(
        io,
        'fuel:completed',
        {
          fuelRequestId:
            fuelRequest.id,

          tripNumber:
            fuelRequest.trip
              ?.tripNumber,

          userId:
            req.user.id,
        }
      );

      return res.json(
        fuelRequest
      );
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   EXTRA FUEL
   HPMU REVIEW
========================================================= */

router.post(
  '/extra/:id/hpmu-review',
  authorize('HPMU'),
  async (req, res, next) => {
    try {
      const {
        decision,
        comment,
      } = req.body;

      if (
        ![
          'APPROVE',
          'REJECT',
          'RETURN',
        ].includes(decision)
      ) {
        return res.status(400).json({
          message:
            'Invalid HPMU decision.',
        });
      }

      if (
        decision !== 'APPROVE' &&
        !comment?.trim()
      ) {
        return res.status(400).json({
          message:
            'Comment is required for rejection or return.',
        });
      }

      const extraFuelRequest =
        await ExtraFuelRequest.findByPk(
          req.params.id
        );

      if (!extraFuelRequest) {
        return res.status(404).json({
          message:
            'Extra fuel request not found.',
        });
      }

      if (
        ![
          'PENDING',
          'HPMU_REVIEW',
        ].includes(
          extraFuelRequest.status
        )
      ) {
        return res.status(400).json({
          message:
            `Extra fuel request cannot be reviewed from status ${extraFuelRequest.status}.`,
        });
      }

      let nextStatus;

      if (decision === 'APPROVE') {
        nextStatus =
          'HPMU_APPROVED';
      } else if (
        decision === 'REJECT'
      ) {
        nextStatus =
          'HPMU_REJECTED';
      } else {
        nextStatus =
          'HPMU_RETURNED';
      }

      await extraFuelRequest.update({
        status:
          nextStatus,

        hpmuReviewComment:
          comment?.trim() || null,

        hpmuReviewedBy:
          req.user.id,

        hpmuReviewedAt:
          new Date(),
      });

      await logAction({
        userId:
          req.user.id,

        action:
          'HPMU_EXTRA_FUEL_DECISION',

        entity:
          'ExtraFuelRequest',

        entityId:
          extraFuelRequest.id,

        description:
          `HPMU ${decision.toLowerCase()}d extra fuel request ${extraFuelRequest.id}.`,

        ipAddress:
          req.ip,
      });

      if (
        extraFuelRequest.driverId
      ) {
        const driver =
          await Driver.findByPk(
            extraFuelRequest.driverId
          );

        if (driver?.userId) {
          await notify(
            driver.userId,
            'Extra Fuel Request Update',
            `Your extra fuel request was ${decision.toLowerCase()} by HPMU.`,
            `/driver/fuel`
          );
        }
      }

      return res.json(
        extraFuelRequest
      );
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   EXTRA FUEL
   HPMU RELEASE
========================================================= */

router.post(
  '/extra/:id/release',
  authorize('HPMU'),
  async (req, res, next) => {
    try {
      const {
        litresIssued,
        issueOdometerKm,
        stationReference,
        notes,
      } = req.body;

      if (
        litresIssued == null ||
        Number(litresIssued) <= 0
      ) {
        return res.status(400).json({
          message:
            'A valid amount of fuel issued is required.',
        });
      }

      const extraFuelRequest =
        await ExtraFuelRequest.findByPk(
          req.params.id
        );

      if (!extraFuelRequest) {
        return res.status(404).json({
          message:
            'Extra fuel request not found.',
        });
      }

      if (
        extraFuelRequest.status !==
        'HPMU_APPROVED'
      ) {
        return res.status(400).json({
          message:
            `Only approved extra fuel requests can be released. Current status: ${extraFuelRequest.status}`,
        });
      }

      const amount =
        Number(litresIssued);

      const transaction =
        await ExtraFuelRequest.sequelize.transaction();

      try {
        await extraFuelRequest.update(
          {
            status:
              'HPMU_RELEASED',

            litresReleased:
              amount,

            releasedBy:
              req.user.id,

            releasedAt:
              new Date(),

            issueOdometerKm:
              issueOdometerKm != null
                ? Number(issueOdometerKm)
                : null,

            stationReference:
              stationReference?.trim() ||
              null,

            releaseNotes:
              notes?.trim() ||
              null,
          },
          {
            transaction,
          }
        );

        await FuelIssueLog.create(
          {
            extraFuelRequestId:
              extraFuelRequest.id,

            tripId:
              extraFuelRequest.tripId,

            vehicleId:
              extraFuelRequest.vehicleId,

            driverId:
              extraFuelRequest.driverId,

            hpmuUserId:
              req.user.id,

            litresIssued:
              amount,

            issueOdometerKm:
              issueOdometerKm != null
                ? Number(issueOdometerKm)
                : null,

            stationReference:
              stationReference?.trim() ||
              null,

            notes:
              notes?.trim() ||
              null,

            issuedAt:
              new Date(),
          },
          {
            transaction,
          }
        );

        await transaction.commit();
      } catch (transactionError) {
        await transaction.rollback();
        throw transactionError;
      }

      await logAction({
        userId:
          req.user.id,

        action:
          'HPMU_RELEASE_EXTRA_FUEL',

        entity:
          'ExtraFuelRequest',

        entityId:
          extraFuelRequest.id,

        description:
          `HPMU issued ${amount}L extra fuel.`,

        ipAddress:
          req.ip,
      });

      const driver =
        await Driver.findByPk(
          extraFuelRequest.driverId
        );

      if (driver?.userId) {
        await notify(
          driver.userId,
          'Extra Fuel Released',
          `${amount}L extra fuel has been released by HPMU. Please confirm receipt.`,
          `/driver/fuel`
        );
      }

      return res.json(
        extraFuelRequest
      );
    } catch (err) {
      next(err);
    }
  }
);

/* =========================================================
   DRIVER
   CONFIRM EXTRA FUEL RECEIPT
========================================================= */

router.patch(
  '/extra/:id/confirm-receipt',
  authorize('DRIVER'),
  async (req, res, next) => {
    try {
      const {
        actualLitresReceived,
        notes,
      } = req.body;

      const driver =
        await Driver.findOne({
          where: {
            userId: req.user.id,
          },
        });

      if (!driver) {
        return res.status(403).json({
          message:
            'Driver profile not found.',
        });
      }

      const extraFuelRequest =
        await ExtraFuelRequest.findByPk(
          req.params.id
        );

      if (!extraFuelRequest) {
        return res.status(404).json({
          message:
            'Extra fuel request not found.',
        });
      }

      if (
        extraFuelRequest.driverId !==
        driver.id
      ) {
        return res.status(403).json({
          message:
            'This extra fuel request does not belong to you.',
        });
      }

      if (
        extraFuelRequest.status !==
        'HPMU_RELEASED'
      ) {
        return res.status(400).json({
          message:
            `Extra fuel must be released by HPMU first. Current status: ${extraFuelRequest.status}`,
        });
      }

      const received =
        actualLitresReceived != null
          ? Number(actualLitresReceived)
          : Number(
              extraFuelRequest.litresReleased ||
                extraFuelRequest.requestedLitres
            );

      await extraFuelRequest.update({
        status:
          'DRIVER_CONFIRMED',

        confirmedByDriver:
          true,

        confirmedAt:
          new Date(),

        actualLitresReceived:
          received,

        confirmationNotes:
          notes?.trim() || null,
      });

      await logAction({
        userId:
          req.user.id,

        action:
          'CONFIRM_EXTRA_FUEL_RECEIPT',

        entity:
          'ExtraFuelRequest',

        entityId:
          extraFuelRequest.id,

        description:
          `Driver confirmed receipt of ${received}L extra fuel.`,

        ipAddress:
          req.ip,
      });

      if (
        extraFuelRequest.officerId
      ) {
        await notify(
          extraFuelRequest.officerId,
          'Extra Fuel Receipt Confirmed',
          `Driver confirmed receipt of ${received}L extra fuel.`,
          `/officer/trips/${extraFuelRequest.tripId}`
        );
      }

      const hpmuUsers =
        await User.findAll({
          where: {
            role: 'HPMU',
            status: 'ACTIVE',
          },
        });

      await Promise.all(
        hpmuUsers.map((user) =>
          notify(
            user.id,
            'Extra Fuel Receipt Confirmed',
            `Driver confirmed receipt of ${received}L extra fuel.`,
            `/hpmu/extra/${extraFuelRequest.id}`
          )
        )
      );

      return res.json(
        extraFuelRequest
      );
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;