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

async function test() {
  console.log('=== VTMS AUTHORIZED API TESTS ===\n');
  
  // Login as each role and capture token
  const tokens = {};
  const users = [
    { username: 'officer1', role: 'OFFICER' },
    { username: 'driver1', role: 'DRIVER' },
    { username: 'transport1', role: 'TRANSPORT_OFFICER' },
    { username: 'HPMU1', role: 'HPMU' },
    { username: 'r3approver1', role: 'R3' }
  ];
  
  for (const user of users) {
    const login = await makeRequest('/api/auth/login', 'POST', {
      username: user.username,
      password: 'Password123!'
    });
    const loginData = JSON.parse(login.body);
    if (login.status === 200 && loginData.token) {
      tokens[user.role] = loginData.token;
      console.log(`${user.role}: LOGIN OK, token received`);
    } else {
      console.log(`${user.role}: LOGIN FAILED status=${login.status}`);
    }
  }
  
  // Test endpoints with proper tokens
  console.log('\n--- Testing endpoints with auth tokens ---\n');
  
  // GET requests with tokens
  for (const [role, token] of Object.entries(tokens)) {
    console.log(`GET /api/requests (as ${role}):`);
    const r = await makeRequest('/api/requests', 'GET', {}, { 'Authorization': 'Bearer ' + token });
    console.log(`  Status: ${r.status}, Body: ${r.body.substring(0, 100)}`);
    
    console.log(`GET /api/fuel (as ${role}):`);
    const f = await makeRequest('/api/fuel', 'GET', {}, { 'Authorization': 'Bearer ' + token });
    console.log(`  Status: ${f.status}, Body: ${f.body.substring(0, 100)}`);
    
    console.log(`GET /api/trips (as ${role}):`);
    const t = await makeRequest('/api/trips', 'GET', {}, { 'Authorization': 'Bearer ' + token });
    console.log(`  Status: ${t.status}, Body: ${t.body.substring(0, 100)}`);
    
    console.log(`GET /api/logbooks (as ${role}):`);
    const l = await makeRequest('/api/logbooks', 'GET', {}, { 'Authorization': 'Bearer ' + token });
    console.log(`  Status: ${l.status}, Body: ${l.body.substring(0, 100)}`);
    console.log('');
  }
  
  // Test specific workflow operations
  console.log('--- Workflow operations ---');
  
  // Officer creates request
  if (tokens.OFFICER) {
    console.log('OFFICER: Create vehicle request:');
    const createReq = await makeRequest('/api/requests', 'POST', {
      purpose: 'Test workflow',
      originName: 'Dar es Salaam',
      originLat: -6.7924,
      originLng: 39.2083,
      destinationName: 'Dodoma',
      destinationLat: -6.0,
      destinationLng: 35.7,
      departureDate: '2024-12-15',
      departureTime: '08:00',
      passengers: 2
    }, { 'Authorization': 'Bearer ' + tokens.OFFICER });
    console.log(`  Status: ${createReq.status}`);
  }
  
  // Transport Officer assigns
  if (tokens.TRANSPORT_OFFICER) {
    console.log('TRANSPORT_OFFICER: Assign request:');
    const assign = await makeRequest('/api/requests/1/assign', 'POST', {
      vehicleId: 1,
      driverId: 1
    }, { 'Authorization': 'Bearer ' + tokens.TRANSPORT_OFFICER });
    console.log(`  Status: ${assign.status}`);
  }
  
  // Driver creates fuel request
  if (tokens.DRIVER) {
    console.log('DRIVER: Create fuel request:');
    const createFuel = await makeRequest('/api/fuel', 'POST', {
      tripId: 1,
      currentKm: 0,
      litresRequested: 50,
      reason: 'Official trip'
    }, { 'Authorization': 'Bearer ' + tokens.DRIVER });
    console.log(`  Status: ${createFuel.status}`);
    if (createFuel.status === 201) {
      const fuelData = JSON.parse(createFuel.body);
      const fuelId = fuelData.id;
      
      // Transport Officer forwards
      console.log('TRANSPORT_OFFICER: Forward fuel to R3:');
      const forward = await makeRequest('/api/fuel/' + fuelId + '/forward', 'POST', {
        decision: 'FORWARD',
        comment: 'Forwarding'
      }, { 'Authorization': 'Bearer ' + tokens.TRANSPORT_OFFICER });
      console.log(`  Status: ${forward.status}`);
      
      // R3 decides
      console.log('R3: Decide fuel:');
      const r3decide = await makeRequest('/api/fuel/' + fuelId + '/r3-decide', 'POST', {
        decision: 'APPROVE',
        comment: 'Approved'
      }, { 'Authorization': 'Bearer ' + tokens.R3 });
      console.log(`  Status: ${r3decide.status}`);
      
      // HPMU approves
      console.log('HPMU: Approve fuel:');
      const hpmu = await makeRequest('/api/hpmu/' + fuelId + '/decide', 'POST', {
        decision: 'APPROVE',
        comment: 'HPMU approves'
      }, { 'Authorization': 'Bearer ' + tokens.HPMU });
      console.log(`  Status: ${hpmu.status}`);
      
      // HPMU releases fuel
      console.log('HPMU: Release fuel:');
      const release = await makeRequest('/api/hpmu/' + fuelId + '/release', 'POST', {
        litresRequested: 50,
        comment: 'Fuel released'
      }, { 'Authorization': 'Bearer ' + tokens.HPMU });
      console.log(`  Status: ${release.status}`);
    }
  }
  
  console.log('\n=== TESTS COMPLETE ===');
}

test();