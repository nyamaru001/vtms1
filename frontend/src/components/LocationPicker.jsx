import { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* =========================================================
   LEAFLET MARKER ICON
========================================================= */

delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/* =========================================================
   DEFAULT MAP CENTER
========================================================= */

const DEFAULT_CENTER = [-6.7924, 39.2083];

/* =========================================================
   MAP CONTROLLER
========================================================= */

function MapController({
  origin,
  destination,
}) {
  const map = useMap();

  useEffect(() => {
    const points = [];

    if (origin) {
      points.push([
        origin.lat,
        origin.lng,
      ]);
    }

    if (destination) {
      points.push([
        destination.lat,
        destination.lng,
      ]);
    }

    /* BOTH LOCATIONS */

    if (points.length === 2) {
      map.fitBounds(points, {
        padding: [35, 35],
        maxZoom: 10,
        animate: true,
      });

      return;
    }

    /* ONLY ORIGIN */

    if (origin) {
      map.setView(
        [origin.lat, origin.lng],
        9,
        {
          animate: true,
        }
      );

      return;
    }

    /* ONLY DESTINATION */

    if (destination) {
      map.setView(
        [destination.lat, destination.lng],
        9,
        {
          animate: true,
        }
      );
    }
  }, [
    map,
    origin,
    destination,
  ]);

  return null;
}

/* =========================================================
   MAP MOVEMENT CONTROLS
========================================================= */

function MapMoveControls() {
  const map = useMap();

  const moveMap = (
    direction
  ) => {
    const size =
      map.getSize();

    const moveX =
      size.x * 0.35;

    const moveY =
      size.y * 0.35;

    let x = 0;
    let y = 0;

    switch (direction) {
      case 'left':
        x = -moveX;
        break;

      case 'right':
        x = moveX;
        break;

      case 'up':
        y = -moveY;
        break;

      case 'down':
        y = moveY;
        break;

      default:
        return;
    }

    map.panBy(
      [x, y],
      {
        animate: true,
        duration: 0.35,
      }
    );
  };

  const zoomIn = () => {
    map.zoomIn();
  };

  const zoomOut = () => {
    map.zoomOut();
  };

  return (
    <div className="map-custom-controls">

      <button
        type="button"
        className="map-control-btn map-control-up"
        onClick={() => moveMap('up')}
        title="Move map up"
        aria-label="Move map up"
      >
        ↑
      </button>

      <button
        type="button"
        className="map-control-btn map-control-left"
        onClick={() => moveMap('left')}
        title="Move map left"
        aria-label="Move map left"
      >
        ←
      </button>

      <button
        type="button"
        className="map-control-btn map-control-right"
        onClick={() => moveMap('right')}
        title="Move map right"
        aria-label="Move map right"
      >
        →
      </button>

      <button
        type="button"
        className="map-control-btn map-control-down"
        onClick={() => moveMap('down')}
        title="Move map down"
        aria-label="Move map down"
      >
        ↓
      </button>

      <div className="map-zoom-controls">

        <button
          type="button"
          className="map-control-btn"
          onClick={zoomIn}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>

        <button
          type="button"
          className="map-control-btn"
          onClick={zoomOut}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>

      </div>

    </div>
  );
}

/* =========================================================
   SEARCH LOCATION USING OPENSTREETMAP
========================================================= */

async function searchLocation(query) {
  const cleanQuery =
    query?.trim();

  if (!cleanQuery) {
    return null;
  }

  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({
      q: cleanQuery,
      format: 'json',
      addressdetails: '1',
      limit: '1',
      countrycodes: 'tz',
    });

  const response =
    await fetch(url, {
      headers: {
        Accept:
          'application/json',
      },
    });

  if (!response.ok) {
    throw new Error(
      'Location search failed.'
    );
  }

  const data =
    await response.json();

  if (
    !data ||
    data.length === 0
  ) {
    throw new Error(
      `Location "${cleanQuery}" was not found.`
    );
  }

  return {
    lat: Number(
      data[0].lat
    ),
    lng: Number(
      data[0].lon
    ),
    name:
      data[0].display_name,
  };
}

/* =========================================================
   CALCULATE ROAD ROUTE
========================================================= */

async function getRoadRoute(
  origin,
  destination
) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${origin.lng},${origin.lat};` +
    `${destination.lng},${destination.lat}` +
    `?overview=full&geometries=geojson&steps=false`;

  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      'Road route could not be calculated.'
    );
  }

  const data =
    await response.json();

  if (
    data.code !== 'Ok' ||
    !data.routes ||
    data.routes.length === 0
  ) {
    throw new Error(
      'No driving route was found between these locations.'
    );
  }

  const route =
    data.routes[0];

  return {
    distanceKm:
      route.distance / 1000,

    durationMinutes:
      route.duration / 60,

    geometry:
      route.geometry,

    coordinates:
      route.geometry.coordinates.map(
        ([lng, lat]) => [
          lat,
          lng,
        ]
      ),
  };
}

/* =========================================================
   LOCATION PICKER
========================================================= */

export default function LocationPicker({
  originQuery,
  destinationQuery,
  origin,
  destination,
  onOriginChange,
  onDestinationChange,
  height = 360,
  showDistance = true,
}) {
  /* =======================================================
     LOCATIONS
  ======================================================= */

  const [
    foundOrigin,
    setFoundOrigin,
  ] = useState(
    origin || null
  );

  const [
    foundDestination,
    setFoundDestination,
  ] = useState(
    destination || null
  );

  /* =======================================================
     ROUTE
  ======================================================= */

  const [
    route,
    setRoute,
  ] = useState([]);

  const [
    routeInfo,
    setRouteInfo,
  ] = useState(null);

  /* =======================================================
     UI
  ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState('');

  /* =======================================================
     SEARCH CONTROL
  ======================================================= */

  const searchTimer =
    useRef(null);

  const requestNumber =
    useRef(0);

  /* =========================================================
     SYNC ORIGIN
  ========================================================= */

  useEffect(() => {
    setFoundOrigin(
      origin || null
    );
  }, [origin]);

  /* =========================================================
     SYNC DESTINATION
  ========================================================= */

  useEffect(() => {
    setFoundDestination(
      destination || null
    );
  }, [destination]);

  /* =========================================================
     AUTOMATIC SEARCH
  ========================================================= */

  useEffect(() => {
    const originText =
      originQuery?.trim() || '';

    const destinationText =
      destinationQuery?.trim() || '';

    if (searchTimer.current) {
      clearTimeout(
        searchTimer.current
      );
    }

    /* CLEAR ORIGIN */

    if (!originText) {
      setFoundOrigin(null);

      if (origin) {
        onOriginChange?.(
          null
        );
      }
    }

    /* CLEAR DESTINATION */

    if (!destinationText) {
      setFoundDestination(
        null
      );

      if (destination) {
        onDestinationChange?.(
          null
        );
      }
    }

    /* CLEAR ROUTE */

    if (
      !originText ||
      !destinationText
    ) {
      setRoute([]);
      setRouteInfo(null);
    }

    /* NOTHING TO SEARCH */

    if (
      originText.length < 3 &&
      destinationText.length < 3
    ) {
      setLoading(false);
      setError('');
      return;
    }

    /* DEBOUNCE SEARCH */

    searchTimer.current =
      setTimeout(
        async () => {
          const currentRequest =
            ++requestNumber.current;

          try {
            setLoading(true);
            setError('');

            let originResult =
              null;

            let destinationResult =
              null;

            /* SEARCH ORIGIN */

            if (
              originText.length >= 3
            ) {
              originResult =
                await searchLocation(
                  originText
                );
            }

            if (
              currentRequest !==
              requestNumber.current
            ) {
              return;
            }

            /* SEARCH DESTINATION */

            if (
              destinationText.length >= 3
            ) {
              destinationResult =
                await searchLocation(
                  destinationText
                );
            }

            if (
              currentRequest !==
              requestNumber.current
            ) {
              return;
            }

            /* SAVE ORIGIN */

            if (originResult) {
              setFoundOrigin(
                originResult
              );

              onOriginChange?.(
                originResult
              );
            }

            /* SAVE DESTINATION */

            if (
              destinationResult
            ) {
              setFoundDestination(
                destinationResult
              );

              onDestinationChange?.(
                destinationResult
              );
            }

            /* ROUTE */

            if (
              originResult &&
              destinationResult
            ) {
              const routeResult =
                await getRoadRoute(
                  originResult,
                  destinationResult
                );

              if (
                currentRequest !==
                requestNumber.current
              ) {
                return;
              }

              setRoute(
                routeResult.coordinates
              );

              setRouteInfo({
                distanceKm:
                  routeResult.distanceKm,

                durationMinutes:
                  routeResult.durationMinutes,

                geometry:
                  routeResult.geometry,
              });
            } else {
              setRoute([]);
              setRouteInfo(null);
            }
          } catch (err) {
            console.error(
              'LocationPicker error:',
              err
            );

            if (
              currentRequest !==
              requestNumber.current
            ) {
              return;
            }

            setError(
              err?.message ||
                'Unable to find the location.'
            );

            setRoute([]);
            setRouteInfo(null);
          } finally {
            if (
              currentRequest ===
              requestNumber.current
            ) {
              setLoading(false);
            }
          }
        },
        900
      );

    return () => {
      if (searchTimer.current) {
        clearTimeout(
          searchTimer.current
        );
      }
    };
  }, [
    originQuery,
    destinationQuery,
    onOriginChange,
    onDestinationChange,
  ]);

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="location-search-map">

      {/* MAP */}

      <div
        className="location-map"
        style={{
          height,
        }}
      >
        <MapContainer
          center={
            DEFAULT_CENTER
          }
          zoom={6}
          minZoom={5}
          maxZoom={17}
          scrollWheelZoom={true}
          dragging={true}
          doubleClickZoom={true}
          touchZoom={true}
          zoomControl={false}
          style={{
            height: '100%',
            width: '100%',
          }}
        >

          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController
            origin={foundOrigin}
            destination={
              foundDestination
            }
          />

          <MapMoveControls />

          {/* ORIGIN */}

          {foundOrigin && (
            <Marker
              position={[
                foundOrigin.lat,
                foundOrigin.lng,
              ]}
            >
              <Popup>
                <strong>
                  Origin
                </strong>

                <br />

                {foundOrigin.name}
              </Popup>
            </Marker>
          )}

          {/* DESTINATION */}

          {foundDestination && (
            <Marker
              position={[
                foundDestination.lat,
                foundDestination.lng,
              ]}
            >
              <Popup>
                <strong>
                  Destination
                </strong>

                <br />

                {
                  foundDestination.name
                }
              </Popup>
            </Marker>
          )}

          {/* ROUTE */}

          {route.length > 1 && (
            <Polyline
              positions={route}
              pathOptions={{
                color:
                  '#2563eb',
                weight: 4,
                opacity: 0.85,
              }}
            />
          )}

        </MapContainer>

        {/* LOADING */}

        {loading && (
          <div className="map-loading">
            Searching location and route...
          </div>
        )}

        {/* EMPTY */}

        {!loading &&
          !foundOrigin &&
          !foundDestination && (
            <div className="map-empty">
              Type a location above to
              display it on the map.
            </div>
          )}
      </div>

      {/* ROUTE SUMMARY */}

      {showDistance &&
        routeInfo && (
          <div className="route-summary">

            <div>
              <span>
                ROAD DISTANCE
              </span>

              <strong>
                {routeInfo.distanceKm.toFixed(
                  1
                )}{' '}
                KM
              </strong>
            </div>

            <div>
              <span>
                EST. DRIVE TIME
              </span>

              <strong>
                {Math.round(
                  routeInfo.durationMinutes
                )}{' '}
                min
              </strong>
            </div>

          </div>
        )}

      {/* ERROR */}

      {error && (
        <div className="location-search-error">
          {error}
        </div>
      )}

    </div>
  );
}