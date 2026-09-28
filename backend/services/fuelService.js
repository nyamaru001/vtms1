/**
 * Fuel calculation service.
 *
 * Base Fuel (litres) = Trip Distance / Vehicle KM-per-Litre
 * Total Fuel Required = Base Fuel x (1 + bufferPercent)
 *
 * Trip distance depends on trip type:
 * - One-way: oneWayKm
 * - Round trip: roundTripKm (or oneWayKm * 2)
 *
 * Never hardcode these values — always derive from the current
 * route distance and the specific vehicle's consumption rating.
 */
function calculateFuel(tripDistanceKm, kmPerLitre, bufferPercent) {
  const buffer = bufferPercent ?? parseFloat(process.env.FUEL_BUFFER_PERCENT || '0.10');

  if (!tripDistanceKm || !kmPerLitre || kmPerLitre <= 0) {
    return { baseFuelLitres: 0, fuelBufferPercent: buffer, totalFuelLitres: 0 };
  }

  const baseFuelLitres = tripDistanceKm / kmPerLitre;
  const totalFuelLitres = baseFuelLitres * (1 + buffer);

  return {
    baseFuelLitres: round2(baseFuelLitres),
    fuelBufferPercent: buffer,
    totalFuelLitres: round2(totalFuelLitres),
  };
}

/**
 * Determine if a vehicle request is a round trip or one-way.
 * A round trip has a return date and time specified.
 */
function isRoundTrip(vehicleRequest) {
  return vehicleRequest.returnDate && vehicleRequest.returnTime;
}

/**
 * Get the correct trip distance for fuel calculation based on trip type.
 * - Round trip: uses roundTripKm (full distance including return)
 * - One-way: uses oneWayKm (only outbound distance)
 */
function getTripDistanceForFuel(vehicleRequest) {
  if (isRoundTrip(vehicleRequest)) {
    // roundTripKm is already calculated as oneWayKm * 2 during route calculation
    return vehicleRequest.roundTripKm ?? (vehicleRequest.oneWayKm ? vehicleRequest.oneWayKm * 2 : 0);
  }
  // One-way trip: use only the outbound distance
  return vehicleRequest.oneWayKm ?? 0;
}

/**
 * Calculate estimated fuel for a trip based on its type (one-way or round trip).
 * Returns the full fuel calculation including buffer.
 */
function calculateTripFuel(vehicleRequest, kmPerLitre, bufferPercent) {
  const tripDistanceKm = getTripDistanceForFuel(vehicleRequest);
  return calculateFuel(tripDistanceKm, kmPerLitre, bufferPercent);
}

/**
 * Estimated fuel still needed to finish the remaining distance of a trip
 * in progress — plain distance ÷ consumption, no buffer (the buffer was
 * already applied to the original planning figure).
 */
function calculateRemainingFuel(remainingKm, kmPerLitre) {
  if (!remainingKm || !kmPerLitre || kmPerLitre <= 0) return 0;
  return round2(remainingKm / kmPerLitre);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { calculateFuel, calculateRemainingFuel, calculateTripFuel, getTripDistanceForFuel, isRoundTrip };
