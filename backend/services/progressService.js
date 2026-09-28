const { TripLocation } = require('../models');
const { haversineKm } = require('./routeService');

/**
 * Computes real trip progress from the driver's last known GPS ping —
 * never a fake/hardcoded value. Completed distance is estimated as the
 * road-corrected straight-line distance from the origin to the driver's
 * current position (same 1.3x road-correction factor used for route
 * estimation), capped at the total one-way route distance. This is an
 * approximation (true map-matching against the route polyline is out of
 * scope here) but it is always derived from a real GPS reading, and is
 * documented as such rather than presented as exact.
 */
async function getTripProgress(trip, request) {
  const oneWayKm = request.oneWayKm || 0;

  if (['NOT_STARTED', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED'].includes(trip.status)) {
    return { completedKm: 0, remainingKm: oneWayKm, percent: 0, lastLocation: null, basis: 'NOT_STARTED' };
  }

  if (trip.status === 'COMPLETED' || trip.status === 'CLOSED') {
    return { completedKm: oneWayKm, remainingKm: 0, percent: 100, lastLocation: null, basis: 'TRIP_COMPLETED' };
  }

  const lastLocation = await TripLocation.findOne({
    where: { tripId: trip.id },
    order: [['recordedAt', 'DESC']],
  });

  if (!lastLocation || !oneWayKm) {
    return { completedKm: 0, remainingKm: oneWayKm, percent: 0, lastLocation: null, basis: 'NO_GPS_DATA_YET' };
  }

  const ROAD_FACTOR = 1.3;
  const straightLine = haversineKm(
    { lat: request.originLat, lng: request.originLng },
    { lat: lastLocation.latitude, lng: lastLocation.longitude }
  );

  let completedKm = Math.min(oneWayKm, straightLine * ROAD_FACTOR);
  completedKm = Math.round(completedKm * 100) / 100;
  const remainingKm = Math.round((oneWayKm - completedKm) * 100) / 100;
  const percent = oneWayKm > 0 ? Math.round((completedKm / oneWayKm) * 100) : 0;

  return {
    completedKm,
    remainingKm,
    percent,
    lastLocation: { lat: lastLocation.latitude, lng: lastLocation.longitude, recordedAt: lastLocation.recordedAt },
    basis: 'GPS_ESTIMATE',
  };
}

module.exports = { getTripProgress };
