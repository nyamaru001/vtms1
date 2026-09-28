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

// Test with actual usernodes and correct password
const testUsers = [
  { username: 'officer1', role: 'OFFICER' },
  { username: 'driver1', role: 'DRIVER' },
  { username: 'driver2', role: 'DRIVER' },
  { username: 'transport1', role: 'TRANSPORT_OFFICER' },
  { username: 'HPMU1', role: 'HPMU' },
  { username: 'r3approver1', role: 'R3' }
];

function testNext(i) {
  if (i >= testUsers.length) {
    console.log('All authentication tests completed');
    process.exit(0);
    return;
  }
  
  const user = testUsers[i];
  makeRequest('/api/auth/login', 'POST', { username: user.username, password: 'Password123!' }, (status, data) => {
    const result = JSON.parse(data);
    if (status === 200) {
      console.log(`LOGIN ${user.username}(${user.role}): OK - token generated, redirect to /${user.role.toLowerCase()}`);
      // Test accessing protected route
      const token = result.token;
      makeRequest('/api/users/' + user.username, 'GET', {}, (status2, data2) => {
        const result2 = JSON.parse(data2);
        console.log(`  User data API: status ${status2}, fullName: ${result2.data?.fullName || 'N/A'}`);
      });
    } else {
      console.log(`LOGIN ${user.username}(${user.role}): FAILED - status ${status}, message: ${result.message || result.error}`);
    }
    testNext(i + 1);
  });
}

testNext(0);