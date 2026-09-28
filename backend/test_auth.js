const http = require('http');
const port = 5000;

function makeRequest(path, method, body, callback) {
  const options = {
    hostname: 'localhost',
    port: port,
    path: path,
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      callback(res.statusCode, data);
    });
  });

  if (body) {
    req.write(JSON.stringify(body));
  }
  req.end();
}

// Test login with existing users
const testUsers = [
  { username: 'officer', role: 'OFFICER', password: 'officer123' },
  { username: 'driver', role: 'DRIVER', password: 'driver123' },
  { username: 'transport', role: 'TRANSPORT_OFFICER', password: 'transport123' },
  { username: 'r3', role: 'R3', password: 'r3123' },
  { username: 'hpmu', role: 'HPMU', password: 'hpmu123' }
];

function testNext(i) {
  if (i >= testUsers.length) {
    console.log('All authentication tests completed');
    process.exit(0);
    return;
  }
  
  const user = testUsers[i];
  makeRequest('/api/auth/login', 'POST', { username: user.username, password: user.password }, (status, data) => {
    const result = JSON.parse(data);
    if (status === 200) {
      console.log(`LOGIN ${user.role}: OK - token generated, redirect to /${user.role.toLowerCase()}`);
    } else {
      console.log(`LOGIN ${user.role}: FAILED - status ${status}, message: ${result.message || result.error}`);
    }
    testNext(i + 1);
  });
}

testNext(0);