const axios = require('axios');
const API = 'http://localhost:5000/api';

async function login(username, password) {
  const res = await axios.post(API + '/auth/login', { username, password });
  return { token: res.data.token, user: res.data.user };
}

async function testFullWorkflow() {
  try {
    console.log('=== TEST 1: OFFICER creates vehicle request ===');
    const officer = await login('officer1', 'Password123!');
    console.log('Officer logged in:', officer.user.username, officer.user.role);
    officer.token = officer.token;

    const requestRes = await axios.post(API + '/requests', {
      purpose: 'Test trip to Arusha',
      originName: 'Dar es Salaam',
      originLat: -6.7924,
      originLng: 39.2083,
      destinationName: 'Arusha',
      destinationLat: -3.3869,
      destinationLng: 36.6830,
      departureDate: '2026-09-20',
      departureTime: '08:00',
      returnDate: '2026-09-21',
      returnTime: '17:00',
      passengers: 3,
      additionalNotes: 'Test request',
    }, { headers: { Authorization: 'Bearer ' + officer.token } });
    console.log('Request created:', requestRes.data.requestNumber, requestRes.data.status);
    const requestId = requestRes.data.id;
    const requestNumber = requestRes.data.requestNumber;

    console.log('\n=== TEST 2: TRANSPORT_OFFICER assigns vehicle + driver ===');
    const transport = await login('transport1', 'Password123!');
    console.log('Transport Officer logged in:', transport.user.username, transport.user.role);

    // Get available vehicles and drivers
    const vehicles = await axios.get(API + '/vehicles/available', { headers: { Authorization: 'Bearer ' + transport.token } });
    const drivers = await axios.get(API + '/drivers/available', { headers: { Authorization: 'Bearer ' + transport.token } });
    console.log('Available vehicles:', vehicles.data.length);
    console.log('Available drivers:', drivers.data.length);

    if (vehicles.data.length === 0 || drivers.data.length === 0) {
      throw new Error('No available vehicles or drivers');
    }

    const vehicleId = vehicles.data[0].id;
    const driverId = drivers.data[0].id;
    console.log('Assigning vehicle:', vehicles.data[0].registrationNumber, 'driver:', drivers.data[0].user?.fullName);

    const assignRes = await axios.post(API + '/requests/' + requestId + '/assign', {
      vehicleId,
      driverId,
    }, { headers: { Authorization: 'Bearer ' + transport.token } });
    console.log('Assignment result:', assignRes.data.message);
    console.log('Request status:', assignRes.data.request.status);
    console.log('Trip created:', assignRes.data.trip.tripNumber, assignRes.data.trip.status);
    const tripId = assignRes.data.trip.id;
    const tripNumber = assignRes.data.trip.tripNumber;

    // Verify database state
    console.log('\n=== Database verification after assignment ===');
    const reqCheck = await axios.get(API + '/requests/' + requestId, { headers: { Authorization: 'Bearer ' + transport.token } });
    console.log('Request driverId:', reqCheck.data.driverId, 'vehicleId:', reqCheck.data.vehicleId);
    const tripCheck = await axios.get(API + '/trips/' + tripId, { headers: { Authorization: 'Bearer ' + transport.token } });
    console.log('Trip driverId:', tripCheck.data.driverId, 'vehicleId:', tripCheck.data.vehicleId, 'requestId:', tripCheck.data.requestId);

    console.log('\n=== TEST 3: DRIVER sees assigned trip, requests fuel ===');
    const driver = await login('driver1', 'Password123!');
    console.log('Driver logged in:', driver.user.username, driver.user.role);

    const trips = await axios.get(API + '/trips', { headers: { Authorization: 'Bearer ' + driver.token } });
    console.log('Driver trips:', trips.data.map(t => ({ id: t.id, tripNumber: t.tripNumber, status: t.status })));
    const driverTrip = trips.data.find(t => t.id === tripId);
    if (!driverTrip) throw new Error('Driver trip not found');
    console.log('Found assigned trip:', driverTrip.tripNumber);

    // Get fuel calculation
    const calc = await axios.get(API + '/fuel/calc/' + tripId, { headers: { Authorization: 'Bearer ' + driver.token } });
    console.log('Fuel calc:', calc.data);

    // Create fuel request
    const fuelRes = await axios.post(API + '/fuel', {
      tripId,
      currentKm: calc.data.completedKm || 0,
      litresRequested: Math.ceil(calc.data.estimatedRemainingFuelLitres || 50),
      reason: 'Fuel for trip to Arusha',
      notes: 'Test fuel request',
    }, { headers: { Authorization: 'Bearer ' + driver.token } });
    console.log('Fuel request created:', fuelRes.data.id, fuelRes.data.status);
    const fuelRequestId = fuelRes.data.id;

    console.log('\n=== TEST 4: TRANSPORT_OFFICER forwards fuel to R3 ===');
    const fuelForward = await axios.post(API + '/fuel/' + fuelRequestId + '/forward', {
      decision: 'FORWARD',
      comment: 'Forwarding to R3 for approval',
    }, { headers: { Authorization: 'Bearer ' + transport.token } });
    console.log('Fuel forwarded, new status:', fuelForward.data.status);

    console.log('\n=== TEST 5: R3 approves and sends to HPMU ===');
    const r3 = await login('r3approver1', 'Password123!');
    console.log('R3 logged in:', r3.user.username, r3.user.role);

    const r3Approve = await axios.post(API + '/fuel/' + fuelRequestId + '/r3-decide', {
      decision: 'APPROVE',
      comment: 'Approving and sending to HPMU',
    }, { headers: { Authorization: 'Bearer ' + r3.token } });
    console.log('R3 approved, new status:', r3Approve.data.status);

    console.log('\n=== TEST 6: HPMU approves ===');
    const hpmu = await login('HPMU1', 'Password123!');
    console.log('HPMU logged in:', hpmu.user.username, hpmu.user.role);

    const hpmuApprove = await axios.post(API + '/hpmu/' + fuelRequestId + '/decide', {
      decision: 'APPROVE',
      comment: 'Approved by HPMU',
    }, { headers: { Authorization: 'Bearer ' + hpmu.token } });
    console.log('HPMU approved, new status:', hpmuApprove.data.status);

    console.log('\n=== TEST 7: HPMU releases fuel ===');
    const hpmuRelease = await axios.post(API + '/hpmu/' + fuelRequestId + '/release', {
      litresRequested: 50,
      comment: 'Fuel released',
    }, { headers: { Authorization: 'Bearer ' + hpmu.token } });
    console.log('HPMU released, new status:', hpmuRelease.data.status);

    console.log('\n=== TEST 8: DRIVER verifies fuel approved, starts trip ===');
    const driverTrips = await axios.get(API + '/trips', { headers: { Authorization: 'Bearer ' + driver.token } });
    console.log('Driver trips after fuel:', driverTrips.data.map(t => ({ id: t.id, status: t.status })));

    const startRes = await axios.post(API + '/trips/' + tripId + '/start', {
      startKm: 50000,
      startLat: -6.7924,
      startLng: 39.2083,
    }, { headers: { Authorization: 'Bearer ' + driver.token } });
    console.log('Trip started, status:', startRes.data.status);

    const reqAfterStart = await axios.get(API + '/requests/' + requestId, { headers: { Authorization: 'Bearer ' + transport.token } });
    console.log('Request status after start:', reqAfterStart.data.status);

    console.log('\n=== TEST 9: Update trip location ===');
    const locationRes = await axios.post(API + '/trips/' + tripId + '/location', {
      latitude: -6.5,
      longitude: 38.5,
    }, { headers: { Authorization: 'Bearer ' + driver.token } });
    console.log('Location recorded:', locationRes.data.id);

    console.log('\n=== TEST 10: Complete trip ===');
    const completeRes = await axios.post(API + '/trips/' + tripId + '/complete', {
      endKm: 50500,
    }, { headers: { Authorization: 'Bearer ' + driver.token } });
    console.log('Trip completed, status:', completeRes.data.trip.status);
    console.log('Odometer KM:', completeRes.data.trip.totalOdometerKm);
    console.log('Comparison:', completeRes.data.comparison);

    // Verify vehicle and driver status
    const vehicleAfter = await axios.get(API + '/vehicles/' + vehicleId, { headers: { Authorization: 'Bearer ' + transport.token } });
    console.log('Vehicle status after trip:', vehicleAfter.data.status, 'odometer:', vehicleAfter.data.currentOdometer);
    const driverAfter = await axios.get(API + '/drivers/' + driverId, { headers: { Authorization: 'Bearer ' + transport.token } });
    console.log('Driver status after trip:', driverAfter.data.status);

    console.log('\n=== TEST 11: ADMIN dashboard ===');
    const admin = await login('admin', 'AdminSecurePass2026!');
    console.log('Admin logged in:', admin.user.username, admin.user.role);

    const stats = await axios.get(API + '/admin/stats', { headers: { Authorization: 'Bearer ' + admin.token } });
    console.log('Admin stats:', stats.data);

    // Create a test user via admin
    const newUser = await axios.post(API + '/users', {
      fullName: 'Test Officer',
      username: 'testofficer',
      email: 'test@vtms.local',
      role: 'OFFICER',
      password: 'TestPass123!',
    }, { headers: { Authorization: 'Bearer ' + admin.token } });
    console.log('Created test user:', newUser.data.username, newUser.data.role);

    // Verify new user can login
    const testLogin = await login('testofficer', 'TestPass123!');
    console.log('Test user login:', testLogin.user.username, testLogin.user.role);

    console.log('\n=== ALL TESTS PASSED ===');
  } catch (err) {
    console.error('\n=== TEST FAILED ===');
    console.error('Error:', err.response?.data || err.message);
    if (err.response?.data) {
      console.error('Response:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

testFullWorkflow();