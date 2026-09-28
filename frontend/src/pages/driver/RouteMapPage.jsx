import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { tripsApi, fuelApi } from '../../services/resources';
import RouteMap from '../../components/RouteMap';
import Loading from '../../components/Loading';

export default function DriverRouteMap() {
  const [params] = useSearchParams();

  const [trips, setTrips] = useState(null);
  const [tripId, setTripId] = useState(params.get('tripId') || '');
  const [calc, setCalc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  /* =========================================================
     LOAD DRIVER TRIPS
  ========================================================= */

  useEffect(() => {
    let mounted = true;

    const loadTrips = async () => {
      try {
        const response = await tripsApi.list();

        const result = Array.isArray(response)
          ? response
          : response?.data || [];

        if (mounted) {
          setTrips(result);
        }
      } catch (err) {
        console.error('Failed to load trips:', err);

        if (mounted) {
          setTrips([]);
          setError(
            err?.response?.data?.message ||
              'Failed to load your trips.'
          );
        }
      }
    };

    loadTrips();

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================================================
     CALCULATE SELECTED TRIP
  ========================================================= */

  useEffect(() => {
    if (!tripId) {
      setCalc(null);
      setError('');
      return;
    }

    let mounted = true;

    const calculateRoute = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fuelApi.calc(tripId);
        const result = response?.data ?? response;

        if (mounted) {
          setCalc(result);
        }
      } catch (err) {
        console.error('Failed to calculate route:', err);

        if (mounted) {
          setCalc(null);
          setError(
            err?.response?.data?.message ||
              'Unable to calculate this trip route.'
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    calculateRoute();

    return () => {
      mounted = false;
    };
  }, [tripId]);

  /* =========================================================
     SELECTED TRIP
  ========================================================= */

  const selectedTrip = useMemo(() => {
    if (!tripId || !trips) return null;

    return trips.find(
      (trip) => String(trip.id) === String(tripId)
    );
  }, [trips, tripId]);

  /* =========================================================
     HELPERS
  ========================================================= */

  const formatNumber = (value, decimals = 1) => {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return '—';
    }

    return number.toFixed(decimals);
  };

  const formatDuration = (minutes) => {
    const value = Number(minutes);

    if (!Number.isFinite(value) || value <= 0) {
      return '—';
    }

    if (value < 60) {
      return `${Math.round(value)} min`;
    }

    const hours = Math.floor(value / 60);
    const mins = Math.round(value % 60);

    return mins > 0
      ? `${hours} hr ${mins} min`
      : `${hours} hr`;
  };

  if (!trips) {
    return <Loading />;
  }

  return (
    <div className="driver-route-page">

      {/* =====================================================
          PAGE HEADER
      ===================================================== */}

      <div className="driver-route-header">

        <div>
          <span className="driver-route-kicker">
            DRIVER PORTAL
          </span>

          <h1>Route Map</h1>

          <p>
            View the exact origin and destination selected by the
            officer, road distance, route and calculated fuel plan.
          </p>
        </div>

        {calc && (
          <div className="route-distance-badge">
            <span>ONE-WAY DISTANCE</span>
            <strong>
              {formatNumber(calc.routeDistanceKm)} KM
            </strong>
          </div>
        )}

      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="driver-route-error">
          <span>!</span>
          <div>
            <strong>Route information unavailable</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* =====================================================
          TRIP SELECTOR
      ===================================================== */}

      <div className="driver-route-control-card">

        <div className="driver-route-control-title">
          <div className="route-control-icon">
            🚗
          </div>

          <div>
            <span>TRIP SELECTION</span>
            <h2>Select Trip</h2>
          </div>
        </div>

        <div className="driver-route-select-area">

          <label htmlFor="driver-trip-select">
            Trip
          </label>

          <select
            id="driver-trip-select"
            className="driver-route-select"
            value={tripId}
            onChange={(event) => {
              setTripId(event.target.value);
            }}
          >
            <option value="">
              Select a trip to view its route
            </option>

            {trips.map((trip) => (
              <option
                key={trip.id}
                value={trip.id}
              >
                {trip.tripNumber || `TRIP-${trip.id}`}
                {' — '}
                {trip.request?.originName || 'Origin'}
                {' → '}
                {trip.request?.destinationName || 'Destination'}
              </option>
            ))}
          </select>

        </div>

        {selectedTrip && (
          <div className="selected-trip-info">

            <div>
              <span>TRIP</span>
              <strong>
                {selectedTrip.tripNumber ||
                  `TRIP-${selectedTrip.id}`}
              </strong>
            </div>

            <div>
              <span>VEHICLE</span>
              <strong>
                {selectedTrip.vehicle?.registrationNumber ||
                  selectedTrip.vehicle?.plateNumber ||
                  'Not assigned'}
              </strong>
            </div>

            <div>
              <span>STATUS</span>
              <strong>
                {selectedTrip.status || '—'}
              </strong>
            </div>

          </div>
        )}

      </div>

      {/* =====================================================
          ROUTE INFORMATION
      ===================================================== */}

      {loading && (
        <div className="driver-route-loading">
          <Loading label="Calculating route..." />
        </div>
      )}

      {calc && !loading && (
        <>
          <div className="driver-route-stats">

            <div className="driver-route-stat">
              <div className="route-stat-icon blue">
                ↔
              </div>

              <div>
                <span>ONE-WAY DISTANCE</span>
                <strong>
                  {formatNumber(calc.routeDistanceKm)} KM
                </strong>
              </div>
            </div>

            <div className="driver-route-stat">
              <div className="route-stat-icon purple">
                ⇄
              </div>

              <div>
                <span>ROUND TRIP</span>
                <strong>
                  {formatNumber(calc.roundTripKm)} KM
                </strong>
              </div>
            </div>

            <div className="driver-route-stat">
              <div className="route-stat-icon green">
                ◷
              </div>

              <div>
                <span>ESTIMATED TIME</span>
                <strong>
                  {formatDuration(calc.durationMinutes)}
                </strong>
              </div>
            </div>

            <div className="driver-route-stat">
              <div className="route-stat-icon orange">
                ⛽
              </div>

              <div>
                <span>MAX PLANNED FUEL</span>
                <strong>
                  {formatNumber(
                    calc.maxPlannedFuelLitres
                  )} L
                </strong>
              </div>
            </div>

          </div>

          {/* =================================================
              ORIGIN / DESTINATION
          ================================================= */}

          <div className="driver-location-card">

            <div className="driver-location-point">

              <div className="location-marker origin">
                A
              </div>

              <div>
                <span>ORIGIN</span>
                <strong>
                  {calc.origin?.name || 'Origin'}
                </strong>

                {calc.origin?.lat != null &&
                  calc.origin?.lng != null && (
                    <small>
                      {formatNumber(calc.origin.lat, 5)},
                      {' '}
                      {formatNumber(calc.origin.lng, 5)}
                    </small>
                  )}
              </div>

            </div>

            <div className="location-connector" />

            <div className="driver-location-point">

              <div className="location-marker destination">
                B
              </div>

              <div>
                <span>DESTINATION</span>
                <strong>
                  {calc.destination?.name ||
                    'Destination'}
                </strong>

                {calc.destination?.lat != null &&
                  calc.destination?.lng != null && (
                    <small>
                      {formatNumber(
                        calc.destination.lat,
                        5
                      )}
                      ,
                      {' '}
                      {formatNumber(
                        calc.destination.lng,
                        5
                      )}
                    </small>
                  )}
              </div>

            </div>

          </div>

          {/* =================================================
              FUEL CALCULATION
          ================================================= */}

          <div className="driver-fuel-plan">

            <div className="driver-fuel-plan-header">
              <div>
                <span>FUEL CALCULATION</span>
                <h2>Vehicle Fuel Plan</h2>
              </div>

              <div className="fuel-plan-badge">
                AUTOMATIC
              </div>
            </div>

            <div className="fuel-plan-grid">

              <div>
                <span>Vehicle Consumption</span>
                <strong>
                  {formatNumber(
                    calc.vehicleConsumptionKmPerLitre,
                    2
                  )}{' '}
                  KM/L
                </strong>
              </div>

              <div>
                <span>Expected Fuel</span>
                <strong>
                  {formatNumber(
                    calc.expectedFuelLitres
                  )}{' '}
                  L
                </strong>
              </div>

              <div className="fuel-plan-total">
                <span>Maximum Planned Fuel</span>
                <strong>
                  {formatNumber(
                    calc.maxPlannedFuelLitres
                  )}{' '}
                  L
                </strong>
              </div>

            </div>

          </div>

          {/* =================================================
              MAP
          ================================================= */}

          <div className="driver-route-map-card">

            <div className="driver-route-map-header">

              <div>
                <span>OFFICER SELECTED ROUTE</span>
                <h2>Journey Map</h2>

                <p>
                  The route below is based on the origin and
                  destination selected when the vehicle request
                  was created.
                </p>
              </div>

              <div className="map-route-distance">
                <span>ROAD DISTANCE</span>
                <strong>
                  {formatNumber(
                    calc.routeDistanceKm
                  )}{' '}
                  KM
                </strong>
              </div>

            </div>

            <div className="driver-route-map">

              <RouteMap
                origin={calc.origin}
                destination={calc.destination}
                geometry={calc.routeGeometry}
                vehiclePosition={calc.lastLocation}
                height={430}
              />

            </div>

            <div className="driver-map-footer">

              <div>
                <span className="map-dot origin-dot" />
                <span>Officer origin</span>
              </div>

              <div>
                <span className="map-dot destination-dot" />
                <span>Officer destination</span>
              </div>

              {calc.lastLocation && (
                <div>
                  <span className="map-dot vehicle-dot" />
                  <span>Vehicle location</span>
                </div>
              )}

              <strong>
                {formatNumber(calc.routeDistanceKm)} KM
              </strong>

            </div>

          </div>
        </>
      )}

      {/* =====================================================
          NO TRIP SELECTED
      ===================================================== */}

      {!tripId && !loading && (
        <div className="driver-route-empty">

          <div className="driver-route-empty-icon">
            🗺️
          </div>

          <h2>Select a trip</h2>

          <p>
            Choose one of your trips above to view the exact
            route selected by the officer, road distance,
            duration and fuel calculation.
          </p>

        </div>
      )}

    </div>
  );
}