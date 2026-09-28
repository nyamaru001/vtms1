const sequelize = require('../config/database');

const User = require('./User');
const Driver = require('./Driver');
const Vehicle = require('./Vehicle');
const VehicleRequest = require('./VehicleRequest');
const Trip = require('./Trip');
const TripLocation = require('./TripLocation');
const TripEvent = require('./TripEvent');
const FuelRequest = require('./FuelRequest');
const FuelIssueLog = require('./FuelIssueLog');
const Logbook = require('./Logbook');
const Notification = require('./Notification');
const AuditLog = require('./AuditLog');
const HPMURecommendation = require('./HPMURecommendation');
const R3Approval = require('./R3Approval');
const ExtraFuelRequest = require('./ExtraFuelRequest');
const TripCompletion = require('./TripCompletion');
const RequestActivity = require('./RequestActivity');
const AssignmentHistory = require('./AssignmentHistory');
const DriverFuelEntry = require('./DriverFuelEntry');

// =========================================================
// ASSOCIATIONS
// =========================================================

// =========================================================
// USER <-> DRIVER
// =========================================================

User.hasOne(Driver, {
  foreignKey: 'userId',
  as: 'driverProfile',
});

Driver.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// =========================================================
// DRIVER <-> VEHICLE
// =========================================================

Driver.belongsTo(Vehicle, {
  foreignKey: 'assignedVehicleId',
  as: 'assignedVehicle',
});

// =========================================================
// VEHICLE REQUEST
// Officer creates vehicle request
// R3 reviews
// Transport Officer assigns vehicle + driver
// =========================================================

VehicleRequest.belongsTo(User, {
  foreignKey: 'officerId',
  as: 'officer',
});

User.hasMany(VehicleRequest, {
  foreignKey: 'officerId',
  as: 'requests',
});

VehicleRequest.belongsTo(Vehicle, {
  foreignKey: 'vehicleId',
  as: 'vehicle',
});

VehicleRequest.belongsTo(Driver, {
  foreignKey: 'driverId',
  as: 'driver',
});

VehicleRequest.belongsTo(User, {
  foreignKey: 'cancelledBy',
  as: 'cancelledByUser',
});

// =========================================================
// VEHICLE REQUEST <-> TRIP
// =========================================================

VehicleRequest.hasOne(Trip, {
  foreignKey: 'requestId',
  as: 'trip',
});

Trip.belongsTo(VehicleRequest, {
  foreignKey: 'requestId',
  as: 'request',
});

// =========================================================
// TRIP
// =========================================================

Trip.belongsTo(Vehicle, {
  foreignKey: 'vehicleId',
  as: 'vehicle',
});

Trip.belongsTo(Driver, {
  foreignKey: 'driverId',
  as: 'driver',
});

Trip.belongsTo(User, {
  foreignKey: 'officerId',
  as: 'officer',
});

// =========================================================
// TRIP LOCATIONS
// =========================================================

Trip.hasMany(TripLocation, {
  foreignKey: 'tripId',
  as: 'locations',
});

TripLocation.belongsTo(Trip, {
  foreignKey: 'tripId',
  as: 'trip',
});

// =========================================================
// TRIP EVENTS / ROUTE DEVIATIONS
// Driver may report a justified change of route, stop, incident or breakdown.
// =========================================================

Trip.hasMany(TripEvent, {
  foreignKey: 'tripId',
  as: 'events',
});

TripEvent.belongsTo(Trip, {
  foreignKey: 'tripId',
  as: 'trip',
});

TripEvent.belongsTo(Driver, {
  foreignKey: 'driverId',
  as: 'driver',
});

// =========================================================
// TRIP <-> FUEL REQUEST
// Driver creates fuel request
// HPMU reviews/approves/releases
// =========================================================

Trip.hasMany(FuelRequest, {
  foreignKey: 'tripId',
  as: 'fuelRequests',
});

FuelRequest.belongsTo(Trip, {
  foreignKey: 'tripId',
  as: 'trip',
});

FuelRequest.belongsTo(Vehicle, {
  foreignKey: 'vehicleId',
  as: 'vehicle',
});

FuelRequest.belongsTo(Driver, {
  foreignKey: 'driverId',
  as: 'driver',
});

FuelRequest.belongsTo(User, {
  foreignKey: 'hpmuReviewedBy',
  as: 'hpmuReviewer',
});

FuelRequest.belongsTo(User, {
  foreignKey: 'releasedBy',
  as: 'releasedByUser',
});

FuelRequest.hasOne(FuelIssueLog, {
  foreignKey: 'fuelRequestId',
  as: 'issueLog',
});
FuelIssueLog.belongsTo(FuelRequest, {
  foreignKey: 'fuelRequestId',
  as: 'fuelRequest',
});
FuelIssueLog.belongsTo(ExtraFuelRequest, {
  foreignKey: 'extraFuelRequestId',
  as: 'extraFuelRequest',
});
FuelIssueLog.belongsTo(Trip, {
  foreignKey: 'tripId',
  as: 'trip',
});
FuelIssueLog.belongsTo(Vehicle, {
  foreignKey: 'vehicleId',
  as: 'vehicle',
});
FuelIssueLog.belongsTo(Driver, {
  foreignKey: 'driverId',
  as: 'driver',
});
FuelIssueLog.belongsTo(User, {
  foreignKey: 'hpmuUserId',
  as: 'hpmuUser',
});

// =========================================================
// TRIP <-> LOGBOOK
// =========================================================

Trip.hasOne(Logbook, {
  foreignKey: 'tripId',
  as: 'logbook',
});

Logbook.belongsTo(Trip, {
  foreignKey: 'tripId',
  as: 'trip',
});

Logbook.belongsTo(Vehicle, {
  foreignKey: 'vehicleId',
  as: 'vehicle',
});

Logbook.belongsTo(Driver, {
  foreignKey: 'driverId',
  as: 'driver',
});

Logbook.belongsTo(User, {
  foreignKey: 'officerId',
  as: 'officer',
});

Logbook.belongsTo(User, {
  foreignKey: 'verifiedBy',
  as: 'verifiedByUser',
});

// =========================================================
// TRIP <-> EXTRA FUEL REQUEST
// =========================================================

Trip.hasMany(ExtraFuelRequest, {
  foreignKey: 'tripId',
  as: 'extraFuelRequests',
});

ExtraFuelRequest.belongsTo(Trip, {
  foreignKey: 'tripId',
  as: 'trip',
});

ExtraFuelRequest.belongsTo(Vehicle, {
  foreignKey: 'vehicleId',
  as: 'vehicle',
});

ExtraFuelRequest.belongsTo(Driver, {
  foreignKey: 'driverId',
  as: 'driver',
});

ExtraFuelRequest.belongsTo(User, {
  foreignKey: 'officerId',
  as: 'officer',
});

ExtraFuelRequest.belongsTo(User, {
  foreignKey: 'hpmuReviewedBy',
  as: 'hpmuReviewer',
});

ExtraFuelRequest.belongsTo(User, {
  foreignKey: 'releasedBy',
  as: 'releasedByUser',
});


// =========================================================
// HPMU RECOMMENDATIONS
// =========================================================

// Vehicle Request -> HPMU recommendations
VehicleRequest.hasMany(HPMURecommendation, {
  foreignKey: 'requestId',
  as: 'hpmuRecommendations',
  constraints: false,
});

HPMURecommendation.belongsTo(VehicleRequest, {
  foreignKey: 'requestId',
  as: 'request',
  constraints: false,
});

// Fuel Request -> HPMU recommendations
FuelRequest.hasMany(HPMURecommendation, {
  foreignKey: 'requestId',
  as: 'hpmuRecommendations',
  constraints: false,
});

HPMURecommendation.belongsTo(FuelRequest, {
  foreignKey: 'requestId',
  as: 'fuelRequest',
  constraints: false,
});

// Extra Fuel Request -> HPMU recommendations
ExtraFuelRequest.hasMany(HPMURecommendation, {
  foreignKey: 'requestId',
  as: 'hpmuRecommendations',
  constraints: false,
});

HPMURecommendation.belongsTo(ExtraFuelRequest, {
  foreignKey: 'requestId',
  as: 'extraFuelRequest',
  constraints: false,
});

// HPMU recommendation reviewer
HPMURecommendation.belongsTo(User, {
  foreignKey: 'reviewedBy',
  as: 'reviewer',
});

// =========================================================
// R3 APPROVALS
// =========================================================

// Vehicle Request -> R3 approvals
VehicleRequest.hasMany(R3Approval, {
  foreignKey: 'requestId',
  as: 'r3Approvals',
});

R3Approval.belongsTo(VehicleRequest, {
  foreignKey: 'requestId',
  as: 'request',
});

// R3 reviewer
R3Approval.belongsTo(User, {
  foreignKey: 'reviewedBy',
  as: 'reviewer',
});

// =========================================================
// NOTIFICATIONS
// =========================================================

User.hasMany(Notification, {
  foreignKey: 'userId',
  as: 'notifications',
});

Notification.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// =========================================================
// AUDIT LOGS
// =========================================================

AuditLog.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// =========================================================
// TRIP COMPLETION CONFIRMATIONS (DRIVER + OFFICER dual confirm)
// =========================================================

Trip.hasMany(TripCompletion, { foreignKey: 'tripId', as: 'completions' });
TripCompletion.belongsTo(Trip, { foreignKey: 'tripId', as: 'trip' });
TripCompletion.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// =========================================================
// REQUEST ACTIVITY HISTORY
// =========================================================

VehicleRequest.hasMany(RequestActivity, { foreignKey: 'requestId', as: 'activities' });
RequestActivity.belongsTo(VehicleRequest, { foreignKey: 'requestId', as: 'request' });
RequestActivity.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

// =========================================================
// ASSIGNMENT HISTORY (assign / reject / reassign)
// =========================================================

VehicleRequest.hasMany(AssignmentHistory, { foreignKey: 'requestId', as: 'assignmentHistory' });
AssignmentHistory.belongsTo(VehicleRequest, { foreignKey: 'requestId', as: 'request' });
AssignmentHistory.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
AssignmentHistory.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });
AssignmentHistory.belongsTo(User, { foreignKey: 'actorId', as: 'actor' });

// =========================================================
// DRIVER FUEL ENTRIES (fuel list upload)
// =========================================================

Trip.hasMany(DriverFuelEntry, { foreignKey: 'tripId', as: 'fuelEntries' });
DriverFuelEntry.belongsTo(Trip, { foreignKey: 'tripId', as: 'trip' });
Logbook.hasMany(DriverFuelEntry, { foreignKey: 'logbookId', as: 'fuelEntries' });
DriverFuelEntry.belongsTo(Logbook, { foreignKey: 'logbookId', as: 'logbook' });
DriverFuelEntry.belongsTo(Driver, { foreignKey: 'driverId', as: 'driver' });
DriverFuelEntry.belongsTo(Vehicle, { foreignKey: 'vehicleId', as: 'vehicle' });

// =========================================================
// EXPORTS
// =========================================================

module.exports = {
  sequelize,
  User,
  Driver,
  Vehicle,
  VehicleRequest,
  Trip,
  TripLocation,
  TripEvent,
  FuelRequest,
  FuelIssueLog,
  Logbook,
  Notification,
  AuditLog,
  HPMURecommendation,
  R3Approval,
  ExtraFuelRequest,
  TripCompletion,
  RequestActivity,
  AssignmentHistory,
  DriverFuelEntry,
};