const mysql = require('mysql2/promise');

async function setupTestTrip() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Nyamaru@1974',
    database: 'vehicle_transport_management'
  });
  
  // Create a new vehicle request that's ready for driver assignment
  const [requestResult] = await conn.execute(`
    INSERT INTO vehicle_requests 
    (request_number, officer_id, purpose, origin_name, origin_lat, origin_lng, 
     destination_name, destination_lat, destination_lng, departure_date, departure_time, 
     return_date, return_time, passengers, additional_notes, one_way_km, round_trip_km, 
     duration_minutes, route_geometry, base_fuel_litres, fuel_buffer_percent, total_fuel_litres, 
     vehicle_id, driver_id, status, created_at, updated_at)
    VALUES 
    ('REQ-TEST-001', 1, 'Test trip for fuel request', 'Shinyanga', -3.76222, 33.232, 
     'Mwanza', -2.51667, 32.9, '2026-09-25', '08:00', '2026-09-25', '18:00', 
     2, 'Test trip', 150, 300, 240, '{"type":"LineString","coordinates":[[-3.76222,33.232],[-2.51667,32.9]]}', 
     30, 0.1, 33, 8, 3, 'R3_APPROVED', NOW(), NOW())
  `);
  
  const requestId = requestResult.insertId;
  console.log('Created request:', requestId);
  
  // Create a trip from this request
  const [tripResult] = await conn.execute(`
    INSERT INTO trips 
    (trip_number, request_id, vehicle_id, driver_id, officer_id, trip_type, status, created_at, updated_at)
    VALUES 
    ('TRIP-TEST-001', ?, 8, 3, 1, 'NORMAL', 'DRIVER_ACCEPTED', NOW(), NOW())
  `, [requestId]);
  
  const tripId = tripResult.insertId;
  console.log('Created trip:', tripId);
  
  await conn.end();
}

setupTestTrip().catch(console.error);