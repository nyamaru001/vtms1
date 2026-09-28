const express = require('express');
const { Op } = require('sequelize');
const { Logbook, Vehicle, Driver, User, Trip, VehicleRequest, DriverFuelEntry } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const { notify } = require('../services/notificationService');
const { recordActivity } = require('../services/activityService');

const router = express.Router();
router.use(authenticate);

const LOGBOOK_INCLUDE = [
  {
    model: Vehicle,
    as: 'vehicle',
    attributes: ['id', 'registrationNumber', 'model', 'type', 'fuelType', 'currentOdometer'],
    required: false,
  },
  { model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['id', 'fullName'] }] },
  { model: User, as: 'officer', attributes: ['id', 'fullName'], required: false },
  { model: User, as: 'verifiedByUser', attributes: ['id', 'fullName'], required: false },
  {
    model: Trip,
    as: 'trip',
    attributes: ['id', 'tripNumber', 'status', 'startKm', 'endKm', 'vehicleId', 'officerId', 'startTime', 'endTime'],
    required: false,
    include: [
      {
        model: VehicleRequest,
        as: 'request',
        attributes: ['id', 'requestNumber', 'originName', 'destinationName', 'purpose', 'departureDate', 'departureTime', 'totalFuelLitres', 'passengers'],
        required: false,
      },
      { model: Vehicle, as: 'vehicle', attributes: ['id', 'registrationNumber', 'model', 'currentOdometer'], required: false },
      {
        model: require('../models').FuelRequest,
        as: 'fuelRequests',
        required: false,
        include: [
          { model: User, as: 'releasedByUser', attributes: ['id', 'fullName', 'username'], required: false },
        ],
      },
    ],
  },
  { model: DriverFuelEntry, as: 'fuelEntries', required: false },
];

// LIST
router.get('/', async (req, res, next) => {
  try {
    const { tripId, status, page = 1, limit = 20 } = req.query;
    const where = {};
    if (tripId) where.tripId = tripId;
    if (status) where.status = status;

    if (req.user.role === 'DRIVER') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      where.driverId = driver ? driver.id : -1;
    }

    // OFFICER sees logbooks for their own requests/trips (or assigned as officer)
    if (req.user.role === 'OFFICER') {
      where.officerId = req.user.id;
    }

    const { rows, count } = await Logbook.findAndCountAll({
      where, include: LOGBOOK_INCLUDE,
      limit: Number(limit), offset: (Number(page) - 1) * Number(limit),
      order: [['createdAt', 'DESC']],
    });

    res.json({ data: rows, total: count, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const logbook = await Logbook.findByPk(req.params.id, { include: LOGBOOK_INCLUDE });
    if (!logbook) return res.status(404).json({ message: 'Logbook entry not found.' });
    res.json(logbook);
  } catch (err) { next(err); }
});

const MANUAL_TEXT_FIELDS = [
  'purpose', 'tripName', 'carType', 'vehicleRegistration', 'fuelType',
  'origin', 'destination', 'remarks', 'postTripNotes', 'signature', 'reviewComment',
];
const MANUAL_NUM_FIELDS = [
  'routeDistanceKm', 'startKm', 'endKm', 'totalKm',
  'fuelUsedLitres', 'fuelIssuedLitres', 'fuelAvailableBeforeTrip',
  'fuelReceivedFromHPMU', 'fuelRemaining', 'fuelRequested',
];

function pickManualFields(body = {}) {
  const out = {};
  for (const key of MANUAL_TEXT_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key] === '' || body[key] == null ? null : String(body[key]);
  }
  for (const key of MANUAL_NUM_FIELDS) {
    if (body[key] !== undefined) {
      out[key] = body[key] === '' || body[key] == null || Number.isNaN(Number(body[key])) ? null : Number(body[key]);
    }
  }
  if (body.entryDate !== undefined) out.entryDate = body.entryDate || null;
  if (body.startTime !== undefined) out.startTime = body.startTime || null;
  if (body.endTime !== undefined) out.endTime = body.endTime || null;
  if (body.tripId !== undefined) out.tripId = body.tripId ? Number(body.tripId) : null;
  if (body.vehicleId !== undefined) out.vehicleId = body.vehicleId ? Number(body.vehicleId) : null;
  if (body.officerId !== undefined) out.officerId = body.officerId ? Number(body.officerId) : null;
  if (body.driverId !== undefined) out.driverId = body.driverId ? Number(body.driverId) : null;
  if (body.status !== undefined && ['DRAFT', 'SUBMITTED', 'VERIFIED', 'RETURNED', 'CLOSED'].includes(body.status)) {
    out.status = body.status;
  }
  return out;
}

// DRIVER / HPMU: create a manual logbook entry (manual values are authoritative)
router.post('/', authorize('DRIVER', 'HPMU'), async (req, res, next) => {
  try {
    let driverId = null;
    if (req.user.role === 'DRIVER') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (!driver) return res.status(404).json({ message: 'Driver profile not found.' });
      driverId = driver.id;
    } else {
      if (!req.body.driverId) {
        return res.status(400).json({ message: 'Driver is required.' });
      }
      driverId = Number(req.body.driverId);
    }

    const manual = pickManualFields(req.body);

    let linkedTrip = null;
    if (manual.tripId) {
      linkedTrip = await Trip.findByPk(manual.tripId, {
        include: [
          { model: VehicleRequest, as: 'request' },
          { model: Vehicle, as: 'vehicle' },
        ],
      });
    }

    if (manual.startKm != null && manual.endKm != null && Number(manual.endKm) < Number(manual.startKm)) {
      return res.status(400).json({ message: 'Ending odometer cannot be less than starting odometer.' });
    }
    if (manual.startKm != null && linkedTrip?.vehicle?.currentOdometer != null) {
      const vehicleOdometer = Number(linkedTrip.vehicle.currentOdometer || 0);
      if (vehicleOdometer && Number(manual.startKm) < vehicleOdometer) {
        return res.status(400).json({ message: `Starting odometer cannot be less than vehicle odometer (${vehicleOdometer} KM).` });
      }
    }

    const logbook = await Logbook.create({
      tripId: manual.tripId ?? null,
      entryDate: manual.entryDate || new Date().toISOString().slice(0, 10),
      vehicleId: manual.vehicleId ?? linkedTrip?.vehicleId ?? null,
      driverId,
      officerId: manual.officerId ?? linkedTrip?.officerId ?? null,
      purpose: manual.purpose ?? linkedTrip?.request?.purpose ?? null,
      tripName: manual.tripName ?? linkedTrip?.tripNumber ?? null,
      carType: manual.carType ?? linkedTrip?.vehicle?.model ?? null,
      vehicleRegistration: manual.vehicleRegistration ?? linkedTrip?.vehicle?.registrationNumber ?? null,
      fuelType: manual.fuelType ?? linkedTrip?.vehicle?.fuelType ?? null,
      fuelRequested: manual.fuelRequested ?? null,
      origin: manual.origin ?? linkedTrip?.request?.originName ?? null,
      destination: manual.destination ?? linkedTrip?.request?.destinationName ?? null,
      routeDistanceKm: manual.routeDistanceKm ?? linkedTrip?.request?.oneWayKm ?? null,
      startTime: manual.startTime ?? linkedTrip?.startTime ?? null,
      endTime: manual.endTime ?? linkedTrip?.endTime ?? null,
      startKm: manual.startKm ?? linkedTrip?.startKm ?? null,
      endKm: manual.endKm ?? linkedTrip?.endKm ?? null,
      totalKm: manual.totalKm ?? null,
      fuelUsedLitres: manual.fuelUsedLitres ?? null,
      fuelIssuedLitres: manual.fuelIssuedLitres ?? linkedTrip?.request?.totalFuelLitres ?? null,
      fuelAvailableBeforeTrip: manual.fuelAvailableBeforeTrip ?? null,
      fuelReceivedFromHPMU: manual.fuelReceivedFromHPMU ?? null,
      fuelRemaining: manual.fuelRemaining ?? null,
      remarks: manual.remarks ?? null,
      postTripNotes: manual.postTripNotes ?? null,
      signature: manual.signature ?? null,
      status: 'DRAFT',
    });

    await logAction({
      userId: req.user.id, action: 'CREATE_LOGBOOK', entity: 'Logbook', entityId: logbook.id,
      description: req.user.role === 'HPMU'
        ? 'HPMU created manual logbook entry'
        : 'Driver created manual logbook entry',
      ipAddress: req.ip,
    });

    res.status(201).json(logbook);
  } catch (err) { next(err); }
});

// DRIVER: create from trip (kept for backward compat)
router.post('/from-trip/:tripId', authorize('DRIVER'), async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ where: { userId: req.user.id } });
    const trip = await Trip.findByPk(req.params.tripId, { include: [{ model: VehicleRequest, as: 'request' }] });

    if (!trip) return res.status(404).json({ message: 'Trip not found.' });
    if (!driver || trip.driverId !== driver.id) return res.status(403).json({ message: 'This is not your trip.' });

    let logbook = await Logbook.findOne({ where: { tripId: trip.id } });
    if (!logbook) {
      // Find the most recent fuel request for this trip
      const fuelRequest = await require('../models').FuelRequest.findOne({
        where: { tripId: trip.id },
        order: [['createdAt', 'DESC']],
      });

      logbook = await Logbook.create({
        tripId: trip.id,
        entryDate: new Date(),
        vehicleId: trip.vehicleId,
        driverId: trip.driverId,
        officerId: trip.officerId,
        purpose: trip.request?.purpose,
        origin: trip.request?.originName,
        destination: trip.request?.destinationName,
        routeDistanceKm: trip.request?.oneWayKm,
        startKm: trip.startKm,
        endKm: trip.endKm,
        totalKm: trip.totalOdometerKm,
        fuelRequested: fuelRequest?.litresRequested ?? null,
        fuelIssuedLitres: fuelRequest?.litresReleased ?? null,
        fuelReceivedFromHPMU: fuelRequest?.litresReleased ?? null,
        status: 'DRAFT',
      });
    }

    res.status(201).json(logbook);
  } catch (err) { next(err); }
});

// DRIVER: edit their own logbook | HPMU: edit any manual logbook entry
router.put('/:id', authorize('DRIVER', 'HPMU'), async (req, res, next) => {
  try {
    const logbook = await Logbook.findByPk(req.params.id);
    if (!logbook) return res.status(404).json({ message: 'Logbook entry not found.' });

    if (req.user.role === 'DRIVER') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (!driver || logbook.driverId !== driver.id) return res.status(403).json({ message: 'Not your logbook entry.' });
      if (!['DRAFT', 'RETURNED'].includes(logbook.status)) {
        return res.status(400).json({ message: `This entry cannot be edited once it is ${logbook.status}.` });
      }
    } else if (logbook.status === 'CLOSED') {
      return res.status(400).json({ message: 'This entry cannot be edited once it is CLOSED.' });
    }

    const updateFields = pickManualFields(req.body);
    // HPMU edits preserve current status unless explicitly provided; never force DRAFT overwrite of manual data.
    if (req.user.role === 'DRIVER') updateFields.status = 'DRAFT';
    else if (updateFields.status === undefined) delete updateFields.status;
    // driverId is only changeable by HPMU when explicitly sent
    if (req.user.role === 'DRIVER' && updateFields.driverId !== undefined) delete updateFields.driverId;

    const nextStart = updateFields.startKm !== undefined ? updateFields.startKm : logbook.startKm;
    const nextEnd = updateFields.endKm !== undefined ? updateFields.endKm : logbook.endKm;
    if (nextStart != null && nextEnd != null && Number(nextEnd) < Number(nextStart)) {
      return res.status(400).json({ message: 'Ending odometer cannot be less than starting odometer.' });
    }
    if (nextStart != null) {
      const vehicleId = updateFields.vehicleId ?? logbook.vehicleId;
      if (vehicleId) {
        const vehicle = await Vehicle.findByPk(vehicleId);
        if (vehicle && Number(vehicle.currentOdometer || 0) && Number(nextStart) < Number(vehicle.currentOdometer)) {
          return res.status(400).json({ message: `Starting odometer cannot be less than vehicle odometer (${vehicle.currentOdometer} KM).` });
        }
      }
    }
    if (nextStart != null && nextEnd != null) {
      updateFields.totalKm = Number(nextEnd) - Number(nextStart);
    }

    await logbook.update(updateFields);

    await logAction({
      userId: req.user.id, action: 'EDIT_LOGBOOK', entity: 'Logbook', entityId: logbook.id,
      description: req.user.role === 'HPMU'
        ? 'HPMU edited logbook entry'
        : 'Driver edited logbook entry',
      ipAddress: req.ip,
    });
    res.json(logbook);
  } catch (err) { next(err); }
});

// DRIVER: submit for review → notify requesting OFFICER (and transport for visibility)
router.post('/:id/submit', authorize('DRIVER'), async (req, res, next) => {
  try {
    const driver = await Driver.findOne({ where: { userId: req.user.id } });
    const logbook = await Logbook.findByPk(req.params.id, { include: [{ model: Trip, as: 'trip' }] });
    if (!logbook) return res.status(404).json({ message: 'Logbook entry not found.' });
    if (!driver || logbook.driverId !== driver.id) return res.status(403).json({ message: 'Not your logbook entry.' });
    if (!['DRAFT', 'RETURNED'].includes(logbook.status)) {
      return res.status(400).json({ message: `Cannot submit from status ${logbook.status}.` });
    }

    const totalKm = (logbook.endKm != null && logbook.startKm != null) ? logbook.endKm - logbook.startKm : null;
    await logbook.update({ status: 'SUBMITTED', submittedAt: new Date(), totalKm });

    // ensure officerId is set from trip when missing
    if (!logbook.officerId && logbook.trip?.officerId) {
      await logbook.update({ officerId: logbook.trip.officerId });
    }

    await logAction({
      userId: req.user.id, action: 'SUBMIT_LOGBOOK', entity: 'Logbook', entityId: logbook.id,
      description: 'Logbook submitted for officer approval', ipAddress: req.ip,
    });

    if (logbook.trip?.requestId) {
      await recordActivity({
        requestId: logbook.trip.requestId,
        tripId: logbook.tripId,
        actorId: req.user.id,
        actorRole: 'DRIVER',
        action: 'LOGBOOK_SUBMITTED',
        toStatus: 'SUBMITTED',
        comment: null,
        metadata: { logbookId: logbook.id },
      });
    }

    // Notify requesting officer for approval
    if (logbook.officerId) {
      await notify(logbook.officerId, 'Logbook submitted for approval', 'A driver logbook entry is awaiting your approval.', '/officer/logbook');
    }

    const transportOfficers = await User.findAll({ where: { role: 'TRANSPORT_OFFICER', status: 'ACTIVE' } });
    await Promise.all(transportOfficers.map((to) =>
      notify(to.id, 'Logbook submitted', 'A logbook entry is ready for verification.', '/transport/logbook')
    ));

    res.json(logbook);
  } catch (err) { next(err); }
});

// DRIVER: delete a draft entry only | HPMU: delete non-closed entries (cleanup)
router.delete('/:id', authorize('DRIVER', 'HPMU'), async (req, res, next) => {
  try {
    const logbook = await Logbook.findByPk(req.params.id);
    if (!logbook) return res.status(404).json({ message: 'Logbook entry not found.' });

    if (req.user.role === 'DRIVER') {
      const driver = await Driver.findOne({ where: { userId: req.user.id } });
      if (!driver || logbook.driverId !== driver.id) return res.status(403).json({ message: 'Not your logbook entry.' });
      if (logbook.status !== 'DRAFT') return res.status(400).json({ message: 'Only draft entries can be deleted.' });
    } else if (logbook.status === 'CLOSED') {
      return res.status(400).json({ message: 'CLOSED entries cannot be deleted.' });
    }

    await logbook.destroy();
    res.json({ message: 'Logbook entry deleted.' });
  } catch (err) { next(err); }
});

// OFFICER (primary) or TRANSPORT_OFFICER (secondary): verify/approve or return
// OFFICER cannot verify logbooks not linked to them; TRANSPORT cannot re-approve VERIFIED entries (status gate already enforces).
router.post('/:id/verify', authorize('OFFICER', 'TRANSPORT_OFFICER'), async (req, res, next) => {
  try {
    const { decision, comment } = req.body;
    if (!['VERIFIED', 'RETURNED'].includes(decision)) {
      return res.status(400).json({ message: 'Invalid decision.' });
    }
    if (decision === 'RETURNED' && !comment) {
      return res.status(400).json({ message: 'A comment is required when returning a logbook entry.' });
    }

    const logbook = await Logbook.findByPk(req.params.id, {
      include: [
        { model: Driver, as: 'driver' },
        { model: Trip, as: 'trip' },
      ],
    });
    if (!logbook) return res.status(404).json({ message: 'Logbook entry not found.' });
    if (logbook.endKm != null && logbook.startKm != null && Number(logbook.endKm) < Number(logbook.startKm)) {
      return res.status(400).json({ message: 'Ending odometer cannot be less than starting odometer.' });
    }
    if (logbook.status !== 'SUBMITTED') {
      return res.status(400).json({ message: 'Only submitted logbook entries can be verified or returned.' });
    }

    // OFFICER: only their own trips' logbooks (unless no officer linked yet)
    if (req.user.role === 'OFFICER') {
      const linkedOfficer = logbook.officerId || logbook.trip?.officerId;
      if (linkedOfficer && linkedOfficer !== req.user.id) {
        return res.status(403).json({ message: 'This logbook belongs to another officer\'s trip.' });
      }
    }

    await logbook.update({ status: decision, verifiedBy: req.user.id, verifiedAt: new Date(), reviewComment: comment });

    if (decision === 'VERIFIED' && logbook.endKm != null) {
      const vehicleId = logbook.vehicleId || logbook.trip?.vehicleId;
      if (vehicleId) {
        const { Vehicle } = require('../models');
        const vehicle = await Vehicle.findByPk(vehicleId);
        if (vehicle && Number(logbook.endKm) >= Number(vehicle.currentOdometer || 0)) {
          await vehicle.update({ currentOdometer: Number(logbook.endKm) });
        }
      }
    }

    await logAction({
      userId: req.user.id, action: decision === 'VERIFIED' ? 'APPROVE_LOGBOOK' : 'RETURN_LOGBOOK', entity: 'Logbook', entityId: logbook.id,
      description: `Logbook ${decision.toLowerCase()} by ${req.user.role}`, ipAddress: req.ip,
    });

    if (logbook.trip?.requestId) {
      await recordActivity({
        requestId: logbook.trip.requestId,
        tripId: logbook.tripId,
        actorId: req.user.id,
        actorRole: req.user.role,
        action: decision === 'VERIFIED' ? 'LOGBOOK_APPROVED' : 'LOGBOOK_RETURNED',
        toStatus: decision,
        comment: comment || null,
        metadata: { logbookId: logbook.id },
      });
    }

    if (logbook.driver) {
      await notify(logbook.driver.userId, 'Logbook update', `Your logbook was ${decision === 'VERIFIED' ? 'approved' : 'returned for correction'}.`, '/driver/logbook');
    }

    res.json(logbook);
  } catch (err) { next(err); }
});

module.exports = router;
