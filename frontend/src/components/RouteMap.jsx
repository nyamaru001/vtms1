import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';

import L from 'leaflet';
import { useEffect, useMemo, useState } from 'react';

// =====================================================
// LEAFLET MARKER ICON FIX
// =====================================================

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',

  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',

  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// =====================================================
// DEFAULT CENTER
// =====================================================

const DEFAULT_CENTER = [-6.7924, 39.2083];

// =====================================================
// FIT MAP BOUNDS
// =====================================================

function FitBounds({
  points,
  geometryPoints = [],
  vehiclePosition,
}) {
  const map = useMap();

  useEffect(() => {
    const allPoints = [...points];

    // Add route geometry to bounds
    if (geometryPoints.length > 0) {
      allPoints.push(...geometryPoints);
    }

    // Add vehicle position
    if (
      vehiclePosition &&
      Number.isFinite(
        Number(vehiclePosition.lat)
      ) &&
      Number.isFinite(
        Number(vehiclePosition.lng)
      )
    ) {
      allPoints.push([
        Number(vehiclePosition.lat),
        Number(vehiclePosition.lng),
      ]);
    }

    if (allPoints.length >= 2) {
      const bounds = L.latLngBounds(
        allPoints
      );

      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 14,
        animate: true,
      });

      return;
    }

    if (allPoints.length === 1) {
      map.setView(allPoints[0], 13);
    }
  }, [
    points,
    geometryPoints,
    vehiclePosition,
    map,
  ]);

  return null;
}

// =====================================================
// FETCH ROAD ROUTE FROM OSRM
// =====================================================

async function fetchRoadRoute(
  origin,
  destination
) {
  if (!origin || !destination) {
    return null;
  }

  const originLat = Number(origin.lat);
  const originLng = Number(origin.lng);

  const destinationLat =
    Number(destination.lat);

  const destinationLng =
    Number(destination.lng);

  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    !Number.isFinite(destinationLat) ||
    !Number.isFinite(destinationLng)
  ) {
    throw new Error(
      'Invalid origin or destination coordinates.'
    );
  }

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${originLng},${originLat};` +
    `${destinationLng},${destinationLat}` +
    `?overview=full&geometries=geojson&steps=false`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      'Road routing request failed.'
    );
  }

  const data = await response.json();

  if (
    data.code !== 'Ok' ||
    !data.routes ||
    data.routes.length === 0
  ) {
    throw new Error(
      'No road route found.'
    );
  }

  const route = data.routes[0];

  return {
    distanceKm:
      route.distance / 1000,

    durationMinutes:
      route.duration / 60,

    geometry:
      route.geometry,

    rawRoute: route,
  };
}

// =====================================================
// FORMAT DISTANCE
// =====================================================

function formatDistance(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return '--';
  }

  return `${distanceKm.toFixed(1)} km`;
}

// =====================================================
// FORMAT DURATION
// =====================================================

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) {
    return '--';
  }

  const totalMinutes =
    Math.round(minutes);

  const hours = Math.floor(
    totalMinutes / 60
  );

  const remainingMinutes =
    totalMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function RouteMap({
  origin = null,

  destination = null,

  geometry = null,

  distanceKm = null,

  durationMinutes = null,

  height = 360,

  vehiclePosition = null,

  showDistance = true,

  showDuration = true,

  calculateRoute = true,

  routeColor = '#2563eb',

  routeWeight = 5,

  routeOpacity = 0.85,

  fitVehicle = false,

  onRouteCalculated,
}) {
  // ===================================================
  // STATE
  // ===================================================

  const [calculatedRoute, setCalculatedRoute] =
    useState(null);

  const [loadingRoute, setLoadingRoute] =
    useState(false);

  const [routeError, setRouteError] =
    useState('');

  // ===================================================
  // CALCULATE ROAD ROUTE
  // ===================================================

  useEffect(() => {
    let cancelled = false;

    async function calculateRoadRoute() {
      // If route calculation disabled,
      // use provided geometry.
      if (
        !calculateRoute ||
        !origin ||
        !destination
      ) {
        setCalculatedRoute(null);
        setRouteError('');
        return;
      }

      setLoadingRoute(true);
      setRouteError('');

      try {
        const route =
          await fetchRoadRoute(
            origin,
            destination
          );

        if (cancelled) return;

        setCalculatedRoute(route);

        if (onRouteCalculated) {
          onRouteCalculated(route);
        }
      } catch (error) {
        if (cancelled) return;

        console.error(
          'RouteMap error:',
          error
        );

        setCalculatedRoute(null);

        setRouteError(
          'Unable to calculate road route.'
        );

        if (onRouteCalculated) {
          onRouteCalculated(null);
        }
      } finally {
        if (!cancelled) {
          setLoadingRoute(false);
        }
      }
    }

    calculateRoadRoute();

    return () => {
      cancelled = true;
    };
  }, [
    origin?.lat,
    origin?.lng,
    destination?.lat,
    destination?.lng,
    calculateRoute,
  ]);

  // ===================================================
  // SELECT BEST ROUTE DATA
  // ===================================================

  const activeRoute =
    calculatedRoute || null;

  const activeGeometry =
    activeRoute?.geometry ||
    geometry ||
    null;

  // ===================================================
  // DISTANCE
  // ===================================================

  const activeDistance =
    activeRoute?.distanceKm ??
    distanceKm ??
    null;

  // ===================================================
  // DURATION
  // ===================================================

  const activeDuration =
    activeRoute?.durationMinutes ??
    durationMinutes ??
    null;

  // ===================================================
  // ROUTE LINE COORDINATES
  // ===================================================

  const lineCoords = useMemo(() => {
    if (
      activeGeometry?.coordinates
    ) {
      return activeGeometry.coordinates.map(
        ([lng, lat]) => [
          Number(lat),
          Number(lng),
        ]
      );
    }

    // IMPORTANT:
    // Do NOT draw a fake straight-line route.
    // If no real geometry exists, return empty.
    return [];
  }, [activeGeometry]);

  // ===================================================
  // MAIN POINTS
  // ===================================================

  const points = useMemo(() => {
    const result = [];

    if (
      origin &&
      Number.isFinite(Number(origin.lat)) &&
      Number.isFinite(Number(origin.lng))
    ) {
      result.push([
        Number(origin.lat),
        Number(origin.lng),
      ]);
    }

    if (
      destination &&
      Number.isFinite(
        Number(destination.lat)
      ) &&
      Number.isFinite(
        Number(destination.lng)
      )
    ) {
      result.push([
        Number(destination.lat),
        Number(destination.lng),
      ]);
    }

    return result;
  }, [
    origin,
    destination,
  ]);

  // ===================================================
  // DEFAULT CENTER
  // ===================================================

  const center =
    points[0] ||
    DEFAULT_CENTER;

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div
      className="route-map"
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >

      {/* =================================================
          MAP
      ================================================= */}

      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom
        style={{
          height: '100%',
          width: '100%',
        }}
      >

        {/* =================================================
            OPENSTREETMAP
        ================================================= */}

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* =================================================
            FIT BOUNDS
        ================================================= */}

        <FitBounds
          points={points}
          geometryPoints={lineCoords}
          vehiclePosition={
            fitVehicle
              ? vehiclePosition
              : null
          }
        />

        {/* =================================================
            ORIGIN
        ================================================= */}

        {origin && (
          <Marker
            position={[
              Number(origin.lat),
              Number(origin.lng),
            ]}
          >
            <Popup>
              <strong>
                Origin
              </strong>

              <br />

              {origin.name ||
                'Starting point'}

              <br />

              <small>
                {Number(
                  origin.lat
                ).toFixed(6)}
                {', '}
                {Number(
                  origin.lng
                ).toFixed(6)}
              </small>
            </Popup>
          </Marker>
        )}

        {/* =================================================
            DESTINATION
        ================================================= */}

        {destination && (
          <Marker
            position={[
              Number(destination.lat),
              Number(destination.lng),
            ]}
          >
            <Popup>
              <strong>
                Destination
              </strong>

              <br />

              {destination.name ||
                'Destination'}

              <br />

              <small>
                {Number(
                  destination.lat
                ).toFixed(6)}
                {', '}
                {Number(
                  destination.lng
                ).toFixed(6)}
              </small>
            </Popup>
          </Marker>
        )}

        {/* =================================================
            VEHICLE POSITION
        ================================================= */}

        {vehiclePosition &&
          Number.isFinite(
            Number(vehiclePosition.lat)
          ) &&
          Number.isFinite(
            Number(vehiclePosition.lng)
          ) && (
            <Marker
              position={[
                Number(
                  vehiclePosition.lat
                ),
                Number(
                  vehiclePosition.lng
                ),
              ]}
            >
              <Popup>
                <strong>
                  Current Vehicle Location
                </strong>

                {vehiclePosition.name && (
                  <>
                    <br />
                    {vehiclePosition.name}
                  </>
                )}

                {vehiclePosition.registrationNumber && (
                  <>
                    <br />
                    Vehicle:{' '}
                    {
                      vehiclePosition.registrationNumber
                    }
                  </>
                )}
              </Popup>
            </Marker>
          )}

        {/* =================================================
            REAL ROAD ROUTE
        ================================================= */}

        {lineCoords.length > 1 && (
          <Polyline
            positions={lineCoords}
            pathOptions={{
              color: routeColor,
              weight: routeWeight,
              opacity: routeOpacity,
            }}
          />
        )}

      </MapContainer>

      {/* =================================================
          LOADING
      ================================================= */}

      {loadingRoute && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform:
              'translateX(-50%)',
            zIndex: 1000,
            background: '#fff',
            padding: '8px 14px',
            borderRadius: 8,
            boxShadow:
              '0 2px 10px rgba(0,0,0,0.15)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Calculating road route...
        </div>
      )}

      {/* =================================================
          ROUTE INFORMATION
      ================================================= */}

      {(showDistance ||
        showDuration) &&
        (activeDistance !== null ||
          activeDuration !== null) &&
        !loadingRoute && (
          <div
            style={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              zIndex: 1000,
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >

            {/* DISTANCE */}

            {showDistance &&
              activeDistance !== null && (
                <div
                  style={{
                    background: '#fff',
                    padding:
                      '10px 14px',
                    borderRadius: 9,
                    boxShadow:
                      '0 2px 10px rgba(0,0,0,.15)',
                    minWidth: 135,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      fontWeight: 700,
                    }}
                  >
                    ROAD DISTANCE
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#1d4ed8',
                    }}
                  >
                    {formatDistance(
                      activeDistance
                    )}
                  </div>
                </div>
              )}

            {/* DURATION */}

            {showDuration &&
              activeDuration !== null && (
                <div
                  style={{
                    background: '#fff',
                    padding:
                      '10px 14px',
                    borderRadius: 9,
                    boxShadow:
                      '0 2px 10px rgba(0,0,0,.15)',
                    minWidth: 135,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color: '#64748b',
                      fontWeight: 700,
                    }}
                  >
                    ROAD TIME
                  </div>

                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 18,
                      fontWeight: 800,
                      color: '#334155',
                    }}
                  >
                    {formatDuration(
                      activeDuration
                    )}
                  </div>
                </div>
              )}

          </div>
        )}

      {/* =================================================
          ERROR
      ================================================= */}

      {routeError && (
        <div
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            top: 12,
            zIndex: 1000,
            padding: 10,
            borderRadius: 8,
            background: '#fef2f2',
            border:
              '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {routeError}
        </div>
      )}
    </div>
  );
}