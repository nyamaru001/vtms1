const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { DriverFuelEntry, Driver, Trip, Logbook, Vehicle, User } = require('../models');
const { authenticate, authorize } = require('../middleware/auth');
const { logAction } = require('../services/auditService');
const { recordActivity } = require('../services/activityService');

const router = express.Router();
router.use(authenticate);

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'fuel');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /pdf|png|jpe?g|webp|csv|vnd.ms-excel|vnd.openxmlformats-officedocument.spreadsheetml.sheet/i.test(
      `${file.mimetype}|${file.originalname}`
    );
    if (!ok) return cb(new Error('Only PDF, image, or spreadsheet files are allowed.'));
    cb(null, true);
  },
});

async function resolveDriver(userId) {
  return Driver.findOne({ where: { userId } });
}

// LIST driver fuel entries (driver sees own; others see all)
router.get('/', async (req, res, next) => {
  try {
    const { tripId, logbookId } = req.query;
    const where = {};
    if (tripId) where.tripId = tripId;
    if (logbookId) where.logbookId = logbookId;

    if (req.user.role === 'DRIVER') {
      const driver = await resolveDriver(req.user.id);
      where.driverId = driver ? driver.id : -1;
    }

    const rows = await DriverFuelEntry.findAll({
      where,
      include: [
        { model: Trip, as: 'trip', attributes: ['id', 'tripNumber', 'status'], required: false },
        { model: Driver, as: 'driver', include: [{ model: User, as: 'user', attributes: ['fullName'] }] },
        { model: Vehicle, as: 'vehicle', attributes: ['id', 'registrationNumber', 'model'], required: false },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json(rows);
  } catch (err) { next(err); }
});

// CREATE (optional receipt upload)
router.post('/', authorize('DRIVER'), upload.single('receipt'), async (req, res, next) => {
  try {
    const driver = await resolveDriver(req.user.id);
    if (!driver) return res.status(404).json({ message: 'Driver profile not found.' });

    const { tripId, logbookId, entryDate, description, litres, amount, stationReference, notes } = req.body;

    let vehicleId = null;
    if (tripId) {
      const trip = await Trip.findByPk(tripId);
      if (trip && trip.driverId !== driver.id) {
        return res.status(403).json({ message: 'This trip is not assigned to you.' });
      }
      vehicleId = trip?.vehicleId || null;
    }

    const entry = await DriverFuelEntry.create({
      tripId: tripId ? Number(tripId) : null,
      logbookId: logbookId ? Number(logbookId) : null,
      driverId: driver.id,
      vehicleId,
      entryDate: entryDate || new Date().toISOString().slice(0, 10),
      description: description || null,
      litres: litres != null && litres !== '' ? Number(litres) : null,
      amount: amount != null && amount !== '' ? Number(amount) : null,
      stationReference: stationReference || null,
      receiptPath: req.file ? `/uploads/fuel/${req.file.filename}` : null,
      notes: notes || null,
    });

    await logAction({
      userId: req.user.id,
      action: 'ADD_FUEL_ENTRY',
      entity: 'DriverFuelEntry',
      entityId: entry.id,
      description: `Driver added fuel list entry (${litres ?? '—'} L)${req.file ? ' with receipt' : ''}`,
      ipAddress: req.ip,
    });

    if (tripId) {
      const trip = await Trip.findByPk(tripId);
      if (trip?.requestId) {
        await recordActivity({
          requestId: trip.requestId,
          tripId: trip.id,
          actorId: req.user.id,
          actorRole: 'DRIVER',
          action: 'FUEL_LIST_ENTRY_ADDED',
          comment: description || null,
          metadata: { entryId: entry.id, litres: entry.litres },
        });
      }
    }

    res.status(201).json(entry);
  } catch (err) { next(err); }
});

// DELETE own draft entry
router.delete('/:id', authorize('DRIVER'), async (req, res, next) => {
  try {
    const driver = await resolveDriver(req.user.id);
    const entry = await DriverFuelEntry.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Fuel entry not found.' });
    if (!driver || entry.driverId !== driver.id) return res.status(403).json({ message: 'Not your fuel entry.' });
    await entry.destroy();
    res.json({ message: 'Fuel entry deleted.' });
  } catch (err) { next(err); }
});

module.exports = router;
