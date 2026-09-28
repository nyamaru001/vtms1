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

// Test with actual usernodes from the database
const testUsers = [
  { username: 'officer1', password: 'test123' },
  { username: 'driver1', password: 'test123' },
  { username: 'driver2', password: 'test123' },
  { username: 'transport1', password: 'test123' },
  { username: 'HPMU1', password: 'test123' },
  { username: 'r3approver1', password: 'test123' }
];

function testNext(i) {
  if (i >= testUsers.length) {
    console.log('All auth tests completed');
    process.exit(0);
    return;
  }
  
  const user = testUsers[i];
  makeRequest('/api/auth/login', 'POST', { username: user.username, password: user.password }, (status, data) => {
    const result = JSON.parse(data);
    if (status === 200) {
      console.log(`LOGIN ${user.username}(${user.role}): OK - redirect to /${user.role.toLowerCase()}`);
    } else {
      console.log(`LOGIN ${user.username}(${user.role}): FAILED - status ${status}`);
    }
    testNext(i + 1);
  });
}

testNext(0);