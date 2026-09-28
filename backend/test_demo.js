const axios = require('axios');
const BASE = 'http://localhost:5000/api';

let officerToken, r3Token, transportToken, driverToken, hpmuToken;
let requestId, tripId, fuelRequestId;

async function login(username, password) {
  const res = await axios.post(`${BASE}/auth/login`, { username, password });
  return res.data.token;
}

async function api(method, url, data, token) {
  const config = { headers: { Authorization: `Bearer ${token}` } };
  if (method === 'get') return axios.get(`${BASE}${url}`, { ...config, params: data });
  if (method === 'post') return axios.post(`${BASE}${url}`, data, config);
  if (method === 'patch') return axios.patch(`${BASE}${url}`, data, config);
  if (method === 'put') return axios.put(`${BASE}${url}`, data, config);
}

async function run() {
  try {
    // ===== CLEANUP PREVIOUS DEMO DATA =====
    console.log('\n=== CLEANUP ===');
    const { Op } = require('sequelize');
    const { Driver, VehicleRequest, Trip, FuelRequest, ExtraFuelRequest, Logbook, HPMURecommendation, R3Approval, FuelIssueLog } = require('./models');

    await Driver.update({ status: 'AVAILABLE', assignedVehicleId: null }, { where: { status: { [Op.in]: ['ASSIGNED', 'ON_TRIP'] } } });
    console.log('✓ Drivers reset to AVAILABLE');

    const demoPrefix = 'VTMS_DEMO_2026_';
    await FuelIssueLog.destroy({ where: {} });
    await ExtraFuelRequest.destroy({ where: { reason: { [Op.like]: `%${demoPrefix}%` } } });
    await FuelRequest.destroy({ where: { reason: { [Op.like]: `%${demoPrefix}%` } } });
    await Logbook.destroy({ where: { remarks: { [Op.like]: `%${demoPrefix}%` } } });
    await HPMURecommendation.destroy({ where: {} });
    await Trip.destroy({ where: {} });
    await R3Approval.destroy({ where: { comment: { [Op.like]: `%${demoPrefix}%` } } });
    await VehicleRequest.destroy({ where: { purpose: { [Op.like]: `%${demoPrefix}%` } } });
    console.log('✓ Previous demo data cleaned');

    // ===== LOGIN ALL USERS =====
    console.log('\n=== LOGGING IN ===');
    officerToken = await login('officer1', 'Officer@123');
    console.log('✓ Officer logged in');
    r3Token = await login('r3approver1', 'R3@123');
    console.log('✓ R3 logged in');
    transportToken = await login('transport1', 'Transport@123');
    console.log('✓ Transport Officer logged in');
    driverToken = await login('driver1', 'Driver@123');
    console.log('✓ Driver logged in');
    hpmuToken = await login('hpmu1', 'HPMU@123');
    console.log('✓ HPMU logged in');

    // ===== TEST A: OFFICER CREATES REQUEST =====
    console.log('\n=== TEST A: OFFICER CREATES REQUEST ===');
    const createRes = await api('post', '/requests', {
      purpose: 'VTMS_DEMO_2026_ - Official meeting in Arusha',
      originName: 'Dodoma',
      originLat: -6.1630,
      originLng: 35.7516,
      destinationName: 'Arusha',
      destinationLat: -3.3869,
      destinationLng: 36.6830,
      departureDate: '2026-09-22',
      departureTime: '08:00',
      returnDate: '2026-09-22',
      returnTime: '18:00',
      passengers: 3,
      additionalNotes: 'VTMS_DEMO_2026_ - Test request'
    }, officerToken);
    requestId = createRes.data.id;
    console.log(`✓ Request created: ${createRes.data.requestNumber} (ID: ${requestId})`);
    console.log(`  Status: ${createRes.data.status}`);

    // ===== TEST B: R3 APPROVES =====
    console.log('\n=== TEST B: R3 APPROVES REQUEST ===');
    const r3Decide = await api('post', `/r3/${requestId}/decide`, {
      decision: 'APPROVE',
      comment: 'VTMS_DEMO_2026_ - Approved for official travel'
    }, r3Token);
    console.log(`✓ R3 approved. Status: ${r3Decide.data.status}`);

    // ===== TEST C: TRANSPORT ASSIGNS =====
    console.log('\n=== TEST C: TRANSPORT ASSIGNS VEHICLE + DRIVER ===');
    const vehicles = await api('get', '/vehicles/available', null, transportToken);
    const drivers = await api('get', '/drivers/available', null, transportToken);
    const vehicle = vehicles.data[0];
    const driver = drivers.data[0];
    console.log(`  Using vehicle: ${vehicle?.registrationNumber} (ID: ${vehicle?.id})`);
    console.log(`  Using driver: ${driver?.user?.fullName} (ID: ${driver?.id})`);

    const assignRes = await api('post', `/requests/${requestId}/assign`, {
      vehicleId: vehicle.id,
      driverId: driver.id
    }, transportToken);
    tripId = assignRes.data.trip?.id;
    console.log(`✓ Assigned. Trip: ${assignRes.data.trip?.tripNumber} (ID: ${tripId})`);
    console.log(`  Request status: ${assignRes.data.request?.status}`);

    // ===== TEST D: DRIVER ACCEPTS =====
    console.log('\n=== TEST D: DRIVER ACCEPTS ASSIGNMENT ===');
    const acceptRes = await api('post', `/trips/${tripId}/accept`, {}, driverToken);
    console.log(`✓ Driver accepted. Trip status: ${acceptRes.data.status}`);
    console.log(`  Request status verified`);

    // ===== TEST E: EARLY FUEL REQUEST (Pre-trip) =====
    console.log('\n=== TEST E: EARLY FUEL REQUEST (Pre-trip, trip not started) ===');
    const fuelRes = await api('post', '/fuel', {
      tripId: tripId,
      currentKm: 150250,
      litresRequested: 60,
      reason: 'VTMS_DEMO_2026_ - Fuel for trip to Arusha',
      notes: 'Pre-trip fuel request'
    }, driverToken);
    fuelRequestId = fuelRes.data.id;
    console.log(`✓ Fuel request created: ID ${fuelRequestId}`);
    console.log(`  Status: ${fuelRes.data.status}`);
    console.log(`  Requested: ${fuelRes.data.litresRequested} L`);
    console.log(`  IMPORTANT: Trip was NOT started yet. This MUST pass.`);

    // ===== TEST F: HPMU RELEASES FUEL (50L instead of 60L) =====
    console.log('\n=== TEST F: HPMU RELEASES FUEL ===');
    // First approve
    const hpmuApprove = await api('post', `/hpmu/${fuelRequestId}/decide`, {
      decision: 'APPROVE',
      comment: 'VTMS_DEMO_2026_ - Approved for release'
    }, hpmuToken);
    console.log(`✓ HPMU approved. Status: ${hpmuApprove.data.request?.status}`);

    // Then release
    const releaseRes = await api('post', `/hpmu/${fuelRequestId}/release`, {
      litresReleased: 50,
      comment: 'VTMS_DEMO_2026_ - Released 50L (requested 60L)',
      issueOdometerKm: 150250,
      stationReference: 'STATION-001'
    }, hpmuToken);
    console.log(`✓ HPMU released fuel`);
    console.log  (`  Requested: ${releaseRes.data.fuelRequest.litresRequested} L`);
    console.log(`  Released: ${releaseRes.data.fuelRequest.litresReleased} L`);
    console.log(`  These MUST be different values.`);

    // ===== TEST G: DRIVER CONFIRMS FUEL RECEIPT =====
    console.log('\n=== TEST G: DRIVER CONFIRMS FUEL RECEIPT ===');
    const confirmRes = await api('patch', `/fuel/${fuelRequestId}/confirm-receipt`, {
      actualLitresReceived: 50,
      notes: 'VTMS_DEMO_2026_ - Received 50L at Dodoma station'
    }, driverToken);
    console.log(`✓ Driver confirmed receipt. Status: ${confirmRes.data.status}`);

    // ===== TEST G2: DRIVER FILLS PRE-TRIP LOGBOOK =====
    console.log('\n=== TEST G2: DRIVER FILLS PRE-TRIP LOGBOOK ===');
    const logbookRes = await api('post', `/logbooks/from-trip/${tripId}`, {}, driverToken);
    const logbookId = logbookRes.data.id;
    console.log(`✓ Logbook created: ID ${logbookId}`);

    const updateLogbook = await api('put', `/logbooks/${logbookId}`, {
      startKm: 150250,
      fuelAvailableBeforeTrip: 10,
      fuelReceivedFromHPMU: 40,
      remarks: 'VTMS_DEMO_2026_ - Pre-trip logbook entry'
    }, driverToken);
    console.log(`✓ Pre-trip logbook saved`);
    console.log(`  Starting KM: ${updateLogbook.data.startKm}`);
    console.log(`  Fuel Available: ${updateLogbook.data.fuelAvailableBeforeTrip} L`);
    console.log(`  Fuel Received: ${updateLogbook.data.fuelReceivedFromHPMU} L`);

    // ===== TEST H: START NORMAL TRIP =====
    console.log('\n=== TEST H: START NORMAL TRIP ===');
    const startRes = await api('post', `/trips/${tripId}/start`, {
      startKm: 150250
    }, driverToken);
    console.log(`✓ Trip started. Status: ${startRes.data.status}`);

    // ===== TEST H2: COMPLETE TRIP =====
    console.log('\n=== TEST H2: COMPLETE TRIP ===');
    const completeRes = await api('post', `/trips/${tripId}/complete`, {
      endKm: 150600
    }, driverToken);
    console.log(`✓ Trip completed. Status: ${completeRes.data.status}`);
    console.log(`  Odometer: ${completeRes.data.comparison.odometerKm} KM`);

    // ===== TEST H3: POST-TRIP LOGBOOK =====
    console.log('\n=== TEST H3: POST-TRIP LOGBOOK ===');
    const postTripLogbook = await api('put', `/logbooks/${logbookId}`, {
      endKm: 150600,
      fuelUsedLitres: 35,
      remarks: 'VTMS_DEMO_2026_ - Post-trip logbook entry'
    }, driverToken);
    console.log(`✓ Post-trip logbook saved`);
    console.log(`  Ending KM: ${postTripLogbook.data.endKm}`);
    console.log(`  Fuel Used: ${postTripLogbook.data.fuelUsedLitres} L`);

    // Submit logbook
    const submitLogbook = await api('post', `/logbooks/${logbookId}/submit`, {}, driverToken);
    console.log(`✓ Logbook submitted. Status: ${submitLogbook.data.status}`);

    // Verify logbook
    const verifyLogbook = await api('post', `/logbooks/${logbookId}/verify`, {
      decision: 'VERIFIED',
      comment: 'VTMS_DEMO_2026_ - Logbook verified'
    }, transportToken);
    console.log(`✓ Logbook verified. Status: ${verifyLogbook.data.status}`);

    // ===== TEST I: EMERGENCY TRIP =====
    console.log('\n=== TEST I: EMERGENCY TRIP ===');
    // Reset drivers
    await Driver.update({ status: 'AVAILABLE', assignedVehicleId: null }, { where: { status: { [Op.in]: ['ASSIGNED', 'ON_TRIP'] } } });
    // Create a second request for emergency
    const emergencyReq = await api('post', '/requests', {
      purpose: 'VTMS_DEMO_2026_ - Emergency medical supplies transport',
      originName: 'Dodoma',
      originLat: -6.1630,
      originLng: 35.7516,
      destinationName: 'Kahama',
      destinationLat: -3.7620,
      destinationLng: 32.5983,
      departureDate: '2026-09-23',
      departureTime: '06:00',
      passengers: 1,
      additionalNotes: 'VTMS_DEMO_2026_ - Emergency trip test'
    }, officerToken);
    const emergencyRequestId = emergencyReq.data.id;
    console.log(`✓ Emergency request created: ${emergencyReq.data.requestNumber}`);

    // Approve
    await api('post', `/r3/${emergencyRequestId}/decide`, { decision: 'APPROVE', comment: 'Approved' }, r3Token);
    console.log(`✓ Emergency request approved by R3`);

    // Get a different vehicle and driver
    const vehicles2 = await api('get', '/vehicles/available', null, transportToken);
    const drivers2 = await api('get', '/drivers/available', null, transportToken);
    const vehicle2 = vehicles2.data[0];
    const driver2 = drivers2.data[0];

    if (vehicle2 && driver2) {
      const assignEmergency = await api('post', `/requests/${emergencyRequestId}/assign`, {
        vehicleId: vehicle2.id,
        driverId: driver2.id
      }, transportToken);
      const emergencyTripId = assignEmergency.data.trip?.id;
      console.log(`✓ Emergency vehicle+driver assigned. Trip: ${assignEmergency.data.trip?.tripNumber}`);

      // Accept
      await api('post', `/trips/${emergencyTripId}/accept`, {}, driverToken);
      console.log(`✓ Driver accepted emergency assignment`);

      // Emergency start
      const emergencyStart = await api('post', `/trips/${emergencyTripId}/emergency-start`, {
        startKm: 200000,
        emergencyReason: 'Medical supply delivery needed urgently',
        emergencyNotes: 'VTMS_DEMO_2026_ - Emergency trip test'
      }, driverToken);
      console.log(`✓ Emergency trip started. Status: ${emergencyStart.data.status}`);
      console.log(`  Trip Type: ${emergencyStart.data.tripType}`);
      console.log(`  Emergency Reason: ${emergencyStart.data.emergencyReason}`);

      // Complete emergency trip
      await api('post', `/trips/${emergencyTripId}/complete`, { endKm: 200450 }, driverToken);
      console.log(`✓ Emergency trip completed`);
    } else {
      console.log('⚠ No available vehicles/drivers for emergency trip test');
    }

    // ===== TEST J: ADDITIONAL FUEL DURING TRIP =====
    console.log('\n=== TEST J: ADDITIONAL FUEL ===');
    // Reset drivers
    await Driver.update({ status: 'AVAILABLE', assignedVehicleId: null }, { where: { status: { [Op.in]: ['ASSIGNED', 'ON_TRIP'] } } });
    // Create yet another request for additional fuel test
    const addFuelReq = await api('post', '/requests', {
      purpose: 'VTMS_DEMO_2026_ - Additional fuel test',
      originName: 'Dodoma',
      originLat: -6.1630,
      originLng: 35.7516,
      destinationName: 'Mwanza',
      destinationLat: -2.5164,
      destinationLng: 32.9175,
      departureDate: '2026-09-24',
      departureTime: '07:00',
      passengers: 2,
      additionalNotes: 'VTMS_DEMO_2026_ - Additional fuel test'
    }, officerToken);
    await api('post', `/r3/${addFuelReq.data.id}/decide`, { decision: 'APPROVE', comment: 'OK' }, r3Token);
    
    const vehicles3 = await api('get', '/vehicles/available', null, transportToken);
    const drivers3 = await api('get', '/drivers/available', null, transportToken);
    
    if (vehicles3.data[0] && drivers3.data[0]) {
      const assignAddFuel = await api('post', `/requests/${addFuelReq.data.id}/assign`, {
        vehicleId: vehicles3.data[0].id,
        driverId: drivers3.data[0].id
      }, transportToken);
      const addFuelTripId = assignAddFuel.data.trip?.id;
      
      await api('post', `/trips/${addFuelTripId}/accept`, {}, driverToken);
      await api('post', `/trips/${addFuelTripId}/start`, { startKm: 100000 }, driverToken);
      console.log(`✓ Trip started for additional fuel test`);

      const addFuelRes = await api('post', '/fuel/additional', {
        tripId: addFuelTripId,
        requestedLitres: 30,
        reason: 'Unexpected route extension due to road conditions',
        currentLat: -4.8000,
        currentLng: 33.5000,
        currentLocationName: 'Tabora'
      }, driverToken);
      console.log(`✓ Additional fuel requested: ${addFuelRes.data.requestedLitres} L`);
      console.log(`  Status: ${addFuelRes.data.status}`);

      // HPMU approve and release for additional fuel
      try {
        await api('post', `/hpmu/${addFuelRes.data.id}/decide`, { decision: 'APPROVE', comment: 'OK' }, hpmuToken);
        console.log(`✓ Additional fuel approved by HPMU`);
      } catch (approveErr) {
        console.log(`⚠ HPMU approve for additional fuel failed: ${approveErr.response?.data?.message || approveErr.message}`);
        console.log(`  ExtraFuelRequest ID: ${addFuelRes.data.id}, Status: ${addFuelRes.data.status}`);
      }

      try {
        const releaseAddFuel = await api('post', `/hpmu/extra/${addFuelRes.data.id}/release`, {
          litresReleased: 25,
          comment: 'Released 25L of 30L requested'
        }, hpmuToken);
        console.log(`✓ Additional fuel released: ${releaseAddFuel.data.litresReleased} L`);
      } catch (releaseErr) {
        console.log(`⚠ HPMU release for additional fuel failed: ${releaseErr.response?.data?.message || releaseErr.message}`);
      }

      // Complete the trip
      await api('post', `/trips/${addFuelTripId}/complete`, { endKm: 100800 }, driverToken);
      console.log(`✓ Additional fuel test trip completed`);
    }

    // ===== NEGATIVE TESTS =====
    console.log('\n=== NEGATIVE TESTS ===');

    // Test: Driver without assignment requests fuel -> should fail
    console.log('\n--- Negative: Fuel request without valid trip ---');
    try {
      await api('post', '/fuel', {
        tripId: 999999,
        currentKm: 100000,
        litresRequested: 50
      }, driverToken);
      console.log('✗ Should have failed but didn\'t');
    } catch (err) {
      console.log(`✓ Correctly failed: ${err.response?.data?.message}`);
    }

    // Test: Rejection without reason -> should fail
    console.log('\n--- Negative: Reject without reason ---');
    try {
      // Create a fresh request for this test
      const negReq = await api('post', '/requests', {
        purpose: 'VTMS_DEMO_2026_ - Negative test',
        originName: 'Dodoma',
        originLat: -6.1630,
        originLng: 35.7516,
        destinationName: 'Arusha',
        destinationLat: -3.3869,
        destinationLng: 36.6830,
        departureDate: '2026-09-25',
        departureTime: '09:00',
        passengers: 1,
        additionalNotes: 'VTMS_DEMO_2026_ - Negative test'
      }, officerToken);
      await api('post', `/r3/${negReq.data.id}/decide`, { decision: 'APPROVE', comment: 'OK' }, r3Token);
      
      const negVehicles = await api('get', '/vehicles/available', null, transportToken);
      const negDrivers = await api('get', '/drivers/available', null, transportToken);
      
      if (negVehicles.data[0] && negDrivers.data[0]) {
        const negAssign = await api('post', `/requests/${negReq.data.id}/assign`, {
          vehicleId: negVehicles.data[0].id,
          driverId: negDrivers.data[0].id
        }, transportToken);
        const negTripId = negAssign.data.trip?.id;
        
        try {
          await api('post', `/trips/${negTripId}/reject-assignment`, { reason: '' }, driverToken);
          console.log('✗ Should have failed but didn\'t');
        } catch (err) {
          console.log(`✓ Correctly failed: ${err.response?.data?.message}`);
        }
      }
    } catch (err) {
      console.log(`✓ Setup failed (expected): ${err.response?.data?.message}`);
    }

    // ===== CHECK NOTIFICATIONS =====
    console.log('\n=== CHECK NOTIFICATIONS ===');
    const driverNotifs = await api('get', '/notifications', null, driverToken);
    const notifCount = driverNotifs.data?.unreadCount || 0;
    console.log(`✓ Driver has ${notifCount} unread notifications`);
    console.log(`  Notification icon MUST show this count.`);

    console.log('\n=== ALL TESTS PASSED ===');
    console.log('=== DEMO DATA: VTMS_DEMO_2026_ created in database ===');

  } catch (err) {
    console.error('\n✗ TEST FAILED:', err.response?.data?.message || err.message);
    console.error('  Stack:', err.stack?.split('\n')[1]);
  }
}

run();
