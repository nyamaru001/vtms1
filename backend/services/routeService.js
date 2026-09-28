const axios = null; // using global fetch is not guaranteed on all Node versions; use a tiny http helper instead
const https = require('https');

/**
 * Calculates road-distance route info between two coordinates.
 * Tries OSRM (real routing engine) first if OSRM_BASE_URL is configured.
 * Falls back to a haversine great-circle estimate with a road-distance
 * correction factor (1.3x) if OSRM is unavailable — this fallback is
 * clearly labeled so it is never silently confused with real road routing.
 */
async function calculateRoute(origin, destination) {
  const osrmBase = process.env.OSRM_BASE_URL;

  if (osrmBase) {
    try {
      const url = `${osrmBase}/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
      const data = await httpGetJson(url);
      if (data && data.routes && data.routes[0]) {
        const route = data.routes[0];
        const oneWayKm = route.distance / 1000;
        return {
          oneWayKm: round2(oneWayKm),
          roundTripKm: round2(oneWayKm * 2),
          durationMinutes: round2(route.duration / 60),
          geometry: route.geometry,
          source: 'OSRM',
        };
      }
    } catch (err) {
      // fall through to haversine fallback
      console.warn('OSRM routing failed, falling back to estimate:', err.message);
    }
  }

  const straightLineKm = haversineKm(origin, destination);
  const ROAD_FACTOR = 1.3; // approximate correction for non-straight roads
  const AVG_SPEED_KMH = 45;
  const oneWayKm = straightLineKm * ROAD_FACTOR;

  return {
    oneWayKm: round2(oneWayKm),
    roundTripKm: round2(oneWayKm * 2),
    durationMinutes: round2((oneWayKm / AVG_SPEED_KMH) * 60),
    geometry: {
      type: 'LineString',
      coordinates: [[origin.lng, origin.lat], [destination.lng, destination.lat]],
    },
    source: 'ESTIMATE',
  };
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

module.exports = { calculateRoute, haversineKm };
