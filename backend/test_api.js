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

async function testAPIEndpoints() {
  console.log('=== VTMS API ENDPOINT TESTS ===\n');
  
  // Test 1: Health check
  console.log('--- Test 1: Health Check ---');
  const health = await makeRequest('/api/health', 'GET');
  console.log(`GET /api/health: ${health.status} - ${health.body}`);
  
  // Test 2: Auth login (all roles)
  console.log('\n--- Test 2: Auth Login ---');
  const roles = [
    { username: 'officer1', role: 'OFFICER' },
    { username: 'driver1', role: 'DRIVER' },
    { username: 'transport1', role: 'TRANSPORT_OFFICER' },
    { username: 'HPMU1', role: 'HPMU' },
    { username: 'r3approver1', role: 'R3' }
  ];
  
  for (const user of roles) {
    const login = await makeRequest('/api/auth/login', 'POST', {
      username: user.username,
      password: 'Password123!'
    });
    const loginData = JSON.parse(login.body);
    console.log(`${user.role}: ${login.status === 200 ? 'OK' : 'FAIL'} (status ${login.status})`);
  }
  
  // Test 3: Vehicle requests list
  console.log('\n--- Test 3: Vehicle Requests List ---');
  const requests = await makeRequest('/api/requests', 'GET', {}, { 'Authorization': 'Bearer dummy' });
  console.log(`GET /api/requests: ${requests.status} - ${requests.body.substring(0, 100)}`);
  
  // Test 4: Fuel requests list
  console.log('\n--- Test 4: Fuel Requests List ---');
  const fuel = await makeRequest('/api/fuel', 'GET', {}, { 'Authorization': 'Bearer dummy' });
  console.log(`GET /api/fuel: ${fuel.status} - fuel requests: ${JSON.parse(fuel.body)?.length || 0}`);
  
  // Test 5: Trips list
  console.log('\n--- Test 5: Trips List ---');
  const trips = await makeRequest('/api/trips', 'GET', {}, { 'Authorization': 'Bearer dummy' });
  console.log(`GET /api/trips: ${trips.status} - ${trips.body.substring(0, 100)}`);
  
  // Test 6: Logbooks list
  console.log('\n--- Test 6: Logbooks List ---');
  const logbooks = await makeRequest('/api/logbooks', 'GET', {}, { 'Authorization': 'Bearer dummy' });
  console.log(`GET /api/logbooks: ${logbooks.status} - ${logbooks.body.substring(0, 100)}`);
  
  console.log('\n=== API TESTS COMPLETE ===');
}

testAPIEndpoints();