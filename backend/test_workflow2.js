const http = require('http');
const port = 5000;

let callbackResult = null;

function makeRequest(path, method, body, headers) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: method,
      headers: headers || { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.on('error', reject);
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
    const reqData = JSON.parse(result.body);
    if (result.status === 201) {
      console.log('Request created:', reqData.requestNumber, 'ID:', reqData.id);
      console.log('Origin:', reqData.originName);
      console.log('Destination:', reqData.destinationName);
      console.log('Distance:', reqData.oneWayKm, 'KM one-way');
      console.log('Status:', reqData.status);
      const requestId = reqData.id;
      
      // Step 2: Transport Officer assigns vehicle + driver
      console.log('\n--- Step 2: Transport Officer assigns vehicle + driver ---');
      const assignResult = await makeRequest('/api/requests/' + requestId + '/assign', 'POST', {
        vehicleId: 1,
        driverId: 1
      }, { 'Authorization': 'Bearer dummy' });
      console.log(`Assign Status: ${assignResult.status}`);
      const assignData = JSON.parse(assignResult.body);
      if (assignResult.status === 200) {
        console.log('Request assigned - status:', assignData.status);
        console.log('Vehicle:', assignData.vehicle?.registrationNumber);
        console.log('Driver:', assignData.driver?.user?.fullName);
      }
      
      // Step 3: Check trips
      console.log('\n--- Step 3: Check trips ---');
      const tripsResult = await makeRequest('/api/trips', 'GET', {}, { 'Authorization': 'Bearer dummy' });
      console.log(`Trips status: ${tripsResult.status}`);
      const tripsData = JSON.parse(tripsResult.body);
      if (tripsData && tripsData.length > 0) {
        tripsData.forEach(t => {
          console.log(' - Trip', t.tripNumber, 'Status:', t.status, 'Vehicle:', t.vehicle?.registrationNumber, 'Driver:', t.driver?.user?.fullName);
        });
      });
      
      // Step 4: Driver creates fuel request
      console.log('\n--- Step 4: Driver creates fuel request ---');
      const fuelResult = await makeRequest('/api/fuel', 'POST', {
        tripId: 1,
        currentKm: 0,
        litresRequested: 50,
        reason: 'Official trip'
      }, { 'Authorization': 'Bearer dummy' });
      console.log(`Fuel Status: ${fuelResult.status}`);
      const fuelData = JSON.parse(fuelResult.body);
      if (fuelResult.status === 201) {
        console.log('Fuel request created - ID:', fuelData.id);
        console.log('Status:', fuelData.status);
        console.log('Requested:', fuelData.litresRequested, 'L');
        console.log('Calculated:', fuelData.litresCalculated, 'L');
      }
      
      // Step 5: Transport Officer forwards fuel to R3
      console.log('\n--- Step 5: Transport Officer forwards fuel to R3 ---');
      const forwardResult = await makeRequest('/api/fuel/' + (fuelData?.id || 1) + '/forward', 'POST', {
        decision: 'FORWARD',
        comment: 'Forwarding to R3 for review'
      }, { 'Authorization': 'Bearer dummy' });
      console.log(`Forward Status: ${forwardResult.status}`);
      const forwardData = JSON.parse(forwardResult.body);
      if (forwardResult.status === 200) {
        console.log('Fuel forwarded to R3 - status:', forwardData.status);
      }
      
      // Step 6: R3 reviews and decides
      console.log('\n--- Step 6: R3 reviews fuel request ---');
      const r3DecideResult = await makeRequest('/api/fuel/' + (fuelData?.id || 1) + '/r3-decide', 'POST', {
        decision: 'APPROVE',
        comment: 'Approved for operations'
      }, { 'Authorization': 'Bearer dummy' });
      console.log(`R3 Decide Status: ${r3DecideResult.status}`);
      const r3DecideData = JSON.parse(r3DecideResult.body);
      if (r3DecideResult.status === 200) {
        console.log('R3 decision made - status:', r3DecideData.status);
      }
      
      // Step 7: HPMU approves
      console.log('\n--- Step 7: HPMU approval ---');
      const hpmuResult = await makeRequest('/api/hpmu/' + (fuelData?.id || 1) + '/decide', 'POST', {
        decision: 'APPROVE',
        comment: 'HPMU approves'
      }, { 'Authorization': 'Bearer dummy' });
      console.log(`HPMU Status: ${hpmuResult.status}`);
      const hpmuData = JSON.parse(hpmuResult.body);
      if (hpmuResult.status === 200) {
        console.log('HPMU approval - status:', hpmuData.status);
      }
      
      // Step 8: HPMU releases fuel
      console.log('\n--- Step 8: HPMU releases fuel ---');
      const releaseResult = await makeRequest('/api/hpmu/' + (fuelData?.id || 1) + '/release', 'POST', {
        litresRequested: 50,
        comment: 'Fuel released'
      }, { 'Authorization': 'Bearer dummy' });
      console.log(`Release Status: ${releaseResult.status}`);
      const releaseData = JSON.parse(releaseResult.body);
      if (releaseResult.status === 200) {
        console.log('HPMU release - status:', releaseData.status);
      }
      
      console.log('\n=== WORKFLOW TEST COMPLETE ===');
    } else {
      console.log('Request creation failed, aborting workflow');
      console.log('Response:', result.body);
    }
  } catch (err) {
    console.error('Workflow test error:', err.message);
  }
}

testWorkflow();