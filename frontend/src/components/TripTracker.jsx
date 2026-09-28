import { useEffect, useMemo, useState } from 'react';
import RouteMap from './RouteMap';
import { useSocket } from '../utils/useSocket';

export default function TripTracker({ trip }) {
  const socket = useSocket();

  // =====================================================
  // SAFETY CHECK
  // =====================================================

  const request = trip?.request || null;

  // =====================================================
  // GET LAST KNOWN LOCATION
  // =====================================================

  const initialPosition = useMemo(() => {
    const locations = Array.isArray(trip?.locations)
      ? trip.locations
      : [];

    if (locations.length === 0) {
      return null;
    }

    const lastLocation =
      locations[locations.length - 1];

    const lat = Number(
      lastLocation.latitude ??
        lastLocation.lat
    );

    const lng = Number(
      lastLocation.longitude ??
        lastLocation.lng
    );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }

    return {
      lat,
      lng,
      timestamp:
        lastLocation.timestamp ??
        lastLocation.createdAt ??
        null,
    };
  }, [trip?.locations]);

  // =====================================================
  // CURRENT VEHICLE POSITION
  // =====================================================

  const [position, setPosition] =
    useState(initialPosition);

  // =====================================================
  // SYNC INITIAL POSITION WHEN TRIP CHANGES
  // =====================================================

  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition]);

  // =====================================================
  // SOCKET.IO REALTIME LOCATION
  // =====================================================

  useEffect(() => {
    if (!socket || !trip?.id) {
      return;
    }

    const tripId = trip.id;

    // ---------------------------------------------------
    // Subscribe to this trip
    // ---------------------------------------------------

    socket.emit(
      'trip:subscribe',
      tripId
    );

    // ---------------------------------------------------
    // Receive vehicle location
    // ---------------------------------------------------

    const handleLocation = (data) => {
      if (!data) {
        return;
      }

      // Support both tripId and trip_id
      const incomingTripId =
        data.tripId ??
        data.trip_id;

      if (
        String(incomingTripId) !==
        String(tripId)
      ) {
        return;
      }

      const lat = Number(
        data.latitude ??
          data.lat
      );

      const lng = Number(
        data.longitude ??
          data.lng
      );

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        return;
      }

      setPosition({
        lat,
        lng,
        timestamp:
          data.timestamp ??
          data.createdAt ??
          new Date().toISOString(),
      });
    };

    socket.on(
      'trip:location',
      handleLocation
    );

    // ---------------------------------------------------
    // Cleanup
    // ---------------------------------------------------

    return () => {
      socket.emit(
        'trip:unsubscribe',
        tripId
      );

      socket.off(
        'trip:location',
        handleLocation
      );
    };
  }, [
    socket,
    trip?.id,
  ]);

  // =====================================================
  // BUILD ORIGIN
  // =====================================================

  const origin = useMemo(() => {
    if (!request) {
      return null;
    }

    const lat = Number(
      request.originLat
    );

    const lng = Number(
      request.originLng
    );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }

    return {
      lat,
      lng,
      name:
        request.originName ||
        'Origin',
    };
  }, [request]);

  // =====================================================
  // BUILD DESTINATION
  // =====================================================

  const destination = useMemo(() => {
    if (!request) {
      return null;
    }

    const lat = Number(
      request.destinationLat
    );

    const lng = Number(
      request.destinationLng
    );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return null;
    }

    return {
      lat,
      lng,
      name:
        request.destinationName ||
        'Destination',
    };
  }, [request]);

  // =====================================================
  // NO TRIP DATA
  // =====================================================

  if (!trip) {
    return (
      <div className="panel">
        <div className="form-error">
          Trip information is not available.
        </div>
      </div>
    );
  }

  // =====================================================
  // NO REQUEST ROUTE
  // =====================================================

  if (!origin && !destination) {
    return (
      <div className="panel">
        <div className="form-error">
          Origin and destination information
          are not available for this trip.
        </div>
      </div>
    );
  }

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="trip-tracker">

      {/* =================================================
          MAP
      ================================================= */}

      <RouteMap
        origin={origin}
        destination={destination}

        /*
         * Backend route geometry is optional.
         * RouteMap will calculate road route
         * when it is not available.
         */
        geometry={
          request?.routeGeometry ||
          trip?.routeGeometry ||
          null
        }

        /*
         * Existing backend distance can be used
         * immediately if available.
         */
        distanceKm={
          request?.distanceKm ??
          trip?.distanceKm ??
          null
        }

        durationMinutes={
          request?.durationMinutes ??
          trip?.durationMinutes ??
          null
        }

        vehiclePosition={position}

        height={380}

        showDistance={true}

        showDuration={true}

        calculateRoute={true}

        fitVehicle={false}
      />

      {/* =================================================
          LIVE STATUS
      ================================================= */}

      <div
        style={{
          marginTop: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          padding: '10px 12px',
          borderRadius: 9,
          border: '1px solid #e2e8f0',
          background: '#f8fafc',
        }}
      >

        {/* CONNECTION STATUS */}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background:
                position
                  ? '#16a34a'
                  : '#94a3b8',
            }}
          />

          {position
            ? 'Vehicle location available'
            : 'Waiting for vehicle location...'}
        </div>

        {/* LAST UPDATE */}

        {position?.timestamp && (
          <div
            style={{
              fontSize: 12,
              color: '#64748b',
            }}
          >
            Last update:{' '}
            {formatTimestamp(
              position.timestamp
            )}
          </div>
        )}

      </div>

      {/* =================================================
          CURRENT LOCATION
      ================================================= */}

      {position && (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: '#64748b',
          }}
        >
          Current vehicle coordinates:{' '}
          <strong>
            {position.lat.toFixed(6)}
            {', '}
            {position.lng.toFixed(6)}
          </strong>
        </div>
      )}

    </div>
  );
}

// =====================================================
// FORMAT TIMESTAMP
// =====================================================

function formatTimestamp(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(
    'en-GB',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    }
  );
}