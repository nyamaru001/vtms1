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
// LEAFLET DEFAULT MARKER ICON FIX
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
// DEFAULT MAP CENTER
// =====================================================

const DEFAULT_CENTER = [-6.7924, 39.2083];

// =====================================================
// FIT MAP TO ALL LOCATIONS
// =====================================================

function FitMapToLocations({
  origin,
  destination,
  markers,
  routeCoordinates,
}) {
  const map = useMap();

  useEffect(() => {
    const points = [];

    // Origin
    if (
      origin &&
      Number.isFinite(Number(origin.lat)) &&
      Number.isFinite(Number(origin.lng))
    ) {
      points.push([
        Number(origin.lat),
        Number(origin.lng),
      ]);
    }

    // Destination
    if (
      destination &&
      Number.isFinite(Number(destination.lat)) &&
      Number.isFinite(Number(destination.lng))
    ) {
      points.push([
        Number(destination.lat),
        Number(destination.lng),
      ]);
    }

    // Additional markers
    if (Array.isArray(markers)) {
      markers.forEach((marker) => {
        if (
          Number.isFinite(Number(marker.lat)) &&
          Number.isFinite(Number(marker.lng))
        ) {
          points.push([
            Number(marker.lat),
            Number(marker.lng),
          ]);
        }
      });
    }

    // Route
    if (Array.isArray(routeCoordinates)) {
      routeCoordinates.forEach(([lat, lng]) => {
        if (
          Number.isFinite(Number(lat)) &&
          Number.isFinite(Number(lng))
        ) {
          points.push([
            Number(lat),
            Number(lng),
          ]);
        }
      });
    }

    if (points.length === 0) {
      return;
    }

    if (points.length === 1) {
      map.flyTo(points[0], 13, {
        animate: true,
        duration: 0.7,
      });

      return;
    }

    const bounds = L.latLngBounds(points);

    map.fitBounds(bounds, {
      padding: [45, 45],
      maxZoom: 13,
      animate: true,
    });
  }, [
    origin,
    destination,
    markers,
    routeCoordinates,
    map,
  ]);

  return null;
}

// =====================================================
// ROAD ROUTE
// =====================================================

async function fetchRoadRoute(origin, destination) {
  if (!origin || !destination) {
    return null;
  }

  const originLat = Number(origin.lat);
  const originLng = Number(origin.lng);

  const destinationLat = Number(destination.lat);
  const destinationLng = Number(destination.lng);

  if (
    !Number.isFinite(originLat) ||
    !Number.isFinite(originLng) ||
    !Number.isFinite(destinationLat) ||
    !Number.isFinite(destinationLng)
  ) {
    return null;
  }

  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${originLng},${originLat};` +
    `${destinationLng},${destinationLat}` +
    `?overview=full&geometries=geojson&steps=false`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      'Road routing service returned an error.'
    );
  }

  const data = await response.json();

  if (
    data.code !== 'Ok' ||
    !Array.isArray(data.routes) ||
    data.routes.length === 0
  ) {
    throw new Error(
      'No road route was found between the selected locations.'
    );
  }

  const route = data.routes[0];

  return {
    distanceKm: route.distance / 1000,

    durationMinutes: route.duration / 60,

    geometry: route.geometry,
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

  const roundedMinutes = Math.round(minutes);

  const hours = Math.floor(
    roundedMinutes / 60
  );

  const remainingMinutes =
    roundedMinutes % 60;

  if (hours === 0) {
    return `${remainingMinutes} min`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

// =====================================================
// MAIN MAP VIEW
// =====================================================

export default function MapView({
  center = DEFAULT_CENTER,

  zoom = 7,

  markers = [],

  origin = null,

  destination = null,

  height = 320,

  showRoute = true,

  showDistance = true,

  fitBounds = true,

  routeColor = '#2563eb',

  routeWeight = 6,

  routeOpacity = 0.85,

  className = '',

  onRouteCalculated,

  children,
}) {
  const [route, setRoute] = useState(null);

  const [loadingRoute, setLoadingRoute] =
    useState(false);

  const [routeError, setRouteError] =
    useState('');

  // ===================================================
  // CALCULATE ROAD ROUTE
  // ===================================================

  useEffect(() => {
    let cancelled = false;

    async function calculateRoute() {
      if (
        !showRoute ||
        !origin ||
        !destination
      ) {
        setRoute(null);
        setRouteError('');
        return;
      }

      setLoadingRoute(true);
      setRouteError('');

      try {
        const result =
          await fetchRoadRoute(
            origin,
            destination
          );

        if (cancelled) return;

        setRoute(result);

        if (onRouteCalculated) {
          onRouteCalculated(result);
        }
      } catch (error) {
        if (cancelled) return;

        console.error(
          'MapView route error:',
          error
        );

        setRoute(null);

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

    calculateRoute();

    return () => {
      cancelled = true;
    };
  }, [
    origin?.lat,
    origin?.lng,
    destination?.lat,
    destination?.lng,
    showRoute,
  ]);

  // ===================================================
  // ROUTE POSITIONS
  // ===================================================

  const routeCoordinates = useMemo(() => {
    if (
      !route?.geometry?.coordinates
    ) {
      return [];
    }

    return route.geometry.coordinates.map(
      ([lng, lat]) => [
        Number(lat),
        Number(lng),
      ]
    );
  }, [route]);

  // ===================================================
  // MAP CENTER
  // ===================================================

  const mapCenter = useMemo(() => {
    if (
      origin &&
      Number.isFinite(Number(origin.lat)) &&
      Number.isFinite(Number(origin.lng))
    ) {
      return [
        Number(origin.lat),
        Number(origin.lng),
      ];
    }

    if (
      destination &&
      Number.isFinite(Number(destination.lat)) &&
      Number.isFinite(Number(destination.lng))
    ) {
      return [
        Number(destination.lat),
        Number(destination.lng),
      ];
    }

    return center;
  }, [center, origin, destination]);

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <div
      className={`map-view ${className}`}
      style={{
        position: 'relative',
      }}
    >

      {/* =================================================
          MAP
      ================================================= */}

      <div
        style={{
          height,
          width: '100%',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <MapContainer
          center={mapCenter}
          zoom={zoom}
          scrollWheelZoom
          style={{
            height: '100%',
            width: '100%',
          }}
        >

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* =================================================
              FIT MAP
          ================================================= */}

          {fitBounds && (
            <FitMapToLocations
              origin={origin}
              destination={destination}
              markers={markers}
              routeCoordinates={
                routeCoordinates
              }
            />
          )}

          {/* =================================================
              ORIGIN
          ================================================= */}

          {origin &&
            Number.isFinite(
              Number(origin.lat)
            ) &&
            Number.isFinite(
              Number(origin.lng)
            ) && (
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
                </Popup>
              </Marker>
            )}

          {/* =================================================
              DESTINATION
          ================================================= */}

          {destination &&
            Number.isFinite(
              Number(destination.lat)
            ) &&
            Number.isFinite(
              Number(destination.lng)
            ) && (
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
                </Popup>
              </Marker>
            )}

          {/* =================================================
              OTHER MARKERS
          ================================================= */}

          {Array.isArray(markers) &&
            markers.map((marker, index) => {
              if (
                !Number.isFinite(
                  Number(marker.lat)
                ) ||
                !Number.isFinite(
                  Number(marker.lng)
                )
              ) {
                return null;
              }

              return (
                <Marker
                  key={
                    marker.id ??
                    marker.key ??
                    index
                  }
                  position={[
                    Number(marker.lat),
                    Number(marker.lng),
                  ]}
                >
                  {marker.label && (
                    <Popup>
                      {marker.label}
                    </Popup>
                  )}
                </Marker>
              );
            })}

          {/* =================================================
              ROAD ROUTE
          ================================================= */}

          {showRoute &&
            routeCoordinates.length > 0 && (
              <Polyline
                positions={
                  routeCoordinates
                }
                pathOptions={{
                  color: routeColor,
                  weight: routeWeight,
                  opacity: routeOpacity,
                }}
              />
            )}

          {/* =================================================
              CUSTOM CHILDREN
          ================================================= */}

          {children}

        </MapContainer>
      </div>

      {/* ===================================================
          LOADING
      =================================================== */}

      {loadingRoute && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform:
              'translateX(-50%)',
            zIndex: 1000,
            background: '#ffffff',
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

      {/* ===================================================
          DISTANCE PANEL
      =================================================== */}

      {showDistance &&
        route &&
        !loadingRoute && (
          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              zIndex: 1000,
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >

            <div
              style={{
                background: '#ffffff',
                padding:
                  '10px 14px',
                borderRadius: 9,
                boxShadow:
                  '0 2px 10px rgba(0,0,0,0.15)',
                minWidth: 130,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform:
                    'uppercase',
                }}
              >
                Road Distance
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {formatDistance(
                  route.distanceKm
                )}
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                padding:
                  '10px 14px',
                borderRadius: 9,
                boxShadow:
                  '0 2px 10px rgba(0,0,0,0.15)',
                minWidth: 130,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  fontWeight: 700,
                  textTransform:
                    'uppercase',
                }}
              >
                Road Time
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                {formatDuration(
                  route.durationMinutes
                )}
              </div>
            </div>

          </div>
        )}

      {/* ===================================================
          ERROR
      =================================================== */}

      {routeError && (
        <div
          style={{
            marginTop: 8,
            padding: 10,
            borderRadius: 8,
            background: '#fef2f2',
            border:
              '1px solid #fecaca',
            color: '#b91c1c',
            fontSize: 13,
          }}
        >
          {routeError}
        </div>
      )}
    </div>
  );
}