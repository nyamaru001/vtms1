const http = require('http');
const port = 5000;

function makeRequest(path, method, body, headers) {
  const options = {
    hostname: 'localhost',
    port: port,
    path: path,
    method: method,
    headers: headers || { 'Content-Type': 'application/json' }
  };
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testWorkflow() {
  console.log('=== VTMS END-TO-END WORKFLOW TEST ===\n');
  
  // Step 1: Officer creates vehicle request
  console.log('--- Step 1: Officer creates vehicle request ---');
  try {
    const result = await makeRequest('/api/requests', 'POST', {
      purpose: 'Official field visit',
      originName: 'Dar es Salaam',
      originLat: -6.7924,
      originLng: 39.2083,
      destinationName: 'Dodoma',
      destinationLat: -6.0,
      destinationLng: 35.7,
      departureDate: '2024-12-15',
      departureTime: '08:00',
      passengers: 2
    });
    console.log(`Status: ${result.status}`);
    if (result.status !== 201) {
      console.log('Response:', result.body.substring(0, 200));
      return;
    }
    const reqData = JSON.parse(result.body);
    console.log('Request created:', reqData.requestNumber, 'ID:', reqData.id);
    console.log('Origin:', reqData.originName, '→', reqData.destinationName);
    console.log('Distance:', reqData.oneWayKm, 'KM one-way');
    console.log('Status:', reqData.status);
    const requestId = reqData.id;
    
    // Step 2: Transport Officer assigns vehicle + driver
    console.log('\n--- Step 2: Transport Officer assigns vehicle + driver ---');
    try {
      const assignResult = await makeRequest('/api/requests/' + requestId + '/assign', 'POST', {
        vehicleId: 1,
        driverId: 1
      }, { 'Authorization': 'Bearer dummy' });
      console.log(`Assign Status: ${assignResult.status}`);
      if (assignResult.status === 200) {
        const assignData = JSON.parse(assignResult.body);
        console.log('Request assigned - status:', assignData.status);
        console.log('Vehicle:', assignData.vehicle?.registrationNumber);
        console.log('Driver:', assignData.driver?.user?.fullName);
      }
    } catch (e) {
      console.log('Assign error:', e.message);
    }
    
    // Step 3: Check trips
    console.log('\n--- Step 3: Check trips ---');
    try {
      const tripsResult = await makeRequest('/api/trips', 'GET', {}, { 'Authorization': 'Bearer dummy' });
      console.log(`Trips status: ${tripsResult.status}`);
      if (tripsResult.status === 200) {
        const tripsData = JSON.parse(tripsResult.body);
        if (tripsData && tripsData.length > 0) {
          tripsData.forEach(t => {
            console.log(' - Trip', t.tripNumber, 'Status:', t.status, 'Vehicle:', t.vehicle?.registrationNumber, 'Driver:', t.driver?.user?.fullName);
          });
        } else {
          console.log('  No trips found');
        }
      }
    } catch (e) {
      console.log('Trips error:', e.message);
    }
    
    // Step 4: Driver creates fuel request
    console.log('\n--- Step 4: Driver creates fuel request ---');
    try {
      const fuelResult = await makeRequest('/api/fuel', 'POST', {
        tripId: 1,
        currentKm: 0,
        litresRequested: 50,
        reason: 'Official trip'
      }, { 'Authorization': 'Bearer dummy' });
      console.log(`Fuel Status: ${fuelResult.status}`);
      if (fuelResult.status === 201) {
        const fuelData = JSON.parse(fuelResult.body);
        console.log('Fuel request created - ID:', fuelData.id);
        console.log('Status:', fuelData.status);
        console.log('Requested:', fuelData.litresRequested, 'L');
        console.log('Calculated:', fuelData.litresCalculated, 'L');
      } else {
        console.log('Response:', fuelResult.body.substring(0, 200));
      }
    } catch (e) {
      console.log('Fuel error:', e.message);
    }
    
    // Step 5: Transport Officer forwards fuel to R3
    console.log('\n--- Step 5: Transport Officer forwards fuel to R3 ---');
    try {
      const fuelId = 1; // Use default since fuel creation may have failed with auth
      const forwardResult = await makeRequest('/api/fuel/' + fuelId + '/forward', 'POST', {
        decision: 'FORWARD',
        comment: 'Forwarding to R3 for review'
      }, { 'Authorization': 'Bearer dummy' });
      console.log(`Forward Status: ${forwardResult.status}`);
      if (forwardResult.status === 200) {
        const forwardData = JSON.parse(forwardResult.body);
        console.log('Fuel forwarded to R3 - status:', forwardData.status);
      }
    } catch (e) {
      console.log('Forward error:', e.message);
    }
    
    // Step 6: R3 reviews and decides
    console.log('\n--- Step 6: R3 reviews fuel request ---');
    try {
      const r3Result = await makeRequest('/api/fuel/' + fuelId + '/r3-decide', 'POST', {
        decision: 'APPROVE',
        comment: 'Approved for operations'
      }, { 'Authorization': 'Bearer dummy' });
      console.log(`R3 Decide Status: ${r3Result.status}`);
      if (r3Result.status === 200) {
        const r3Data = JSON.parse(r3Result.body);
        console.log('R3 decision - status:', r3Data.status);
      }
    } catch (e) {
      console.log('R3 error:', e.message);
    }
    
    // Step 7: HPMU approves
    console.log('\n--- Step 7: HPMU approval ---');
    try {
      const hpmuResult = await makeRequest('/api/hpmu/' + fuelId + '/decide', 'POST', {
        decision: 'APPROVE',
        comment: 'HPMU approves'
      }, { 'Authorization': 'Bearer dummy' });
      console.log(`HPMU Status: ${hpmuResult.status}`);
      if (hpmuResult.status === 200) {
        const hpmuData = JSON.parse(hpmuResult.body);
        console.log('HPMU approval - status:', hpmuData.status);
      }
    } catch (e) {
      console.log('HPMU error:', e.message);
    }
    
    // Step 8: HPMU releases fuel
    console.log('\n--- Step 8: HPMU releases fuel ---');
    try {
      const releaseResult = await makeRequest('/api/hpmu/' + fuelId + '/release', 'POST', {
        litresRequested: 50,
        comment: 'Fuel released'
      }, { 'Authorization': 'Bearer dummy' });
      console.log(`Release Status: ${releaseResult.status}`);
      if (releaseResult.status === 200) {
        const releaseData = JSON.parse(releaseResult.body);
        console.log('HPMU release - status:', releaseData.status);
      }
    } catch (e) {
      console.log('Final R3 error:', e.message);
    }
    
    console.log('\n=== WORKFLOW TEST COMPLETE ===');
  } catch (err) {
    console.error('Workflow test fatal error:', err.message);
  }
}

testWorkflow();