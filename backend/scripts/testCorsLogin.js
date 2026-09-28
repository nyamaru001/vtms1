require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const API = process.env.API_BASE || 'http://localhost:5000/api';
const ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
];
const USERS = ['officer1', 'driver1', 'driver2', 'transport1', 'hpmu1', 'r3approver1', 'admin', 'fideli', 'r3user'];
const PASSWORD = 'Password123!';

(async () => {
  let pass = 0;
  let fail = 0;
  const ok = (cond, label, detail) => {
    if (cond) pass++; else fail++;
    console.log(`${cond ? 'PASS' : 'FAIL'} | ${label} | ${detail}`);
  };

  // CORS preflight for each allowed origin
  for (const origin of ORIGINS) {
    try {
      const res = await axios.options(`${API}/auth/login`, {
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type,Authorization',
        },
        validateStatus: () => true,
      });
      const allow = res.headers['access-control-allow-origin'];
      ok(
        res.status === 204 && (allow === origin || allow === '*'),
        `CORS preflight ${origin}`,
        `status=${res.status} allow=${allow}`
      );
    } catch (e) {
      ok(false, `CORS preflight ${origin}`, e.message);
    }
  }

  // Simulated browser login for each user with Origin header
  for (const username of USERS) {
    try {
      const res = await axios.post(
        `${API}/auth/login`,
        { username, password: PASSWORD },
        {
          headers: {
            Origin: 'http://localhost:5173',
            'Content-Type': 'application/json',
          },
          validateStatus: () => true,
        }
      );
      const allow = res.headers['access-control-allow-origin'];
      const hasToken = Boolean(res.data?.token);
      const role = res.data?.user?.role;
      ok(
        res.status === 200 && hasToken && Boolean(role) && (allow === 'http://localhost:5173' || allow === '*'),
        `browser-style login ${username}`,
        `status=${res.status} token=${hasToken} role=${role} allow=${allow} msg=${res.data?.message || ''}`
      );
    } catch (e) {
      ok(false, `browser-style login ${username}`, e.message);
    }
  }

  // Wrong password from browser origin
  try {
    const res = await axios.post(
      `${API}/auth/login`,
      { username: 'officer1', password: 'WrongPass!' },
      { headers: { Origin: 'http://localhost:5173' }, validateStatus: () => true }
    );
    ok(res.status === 401, 'browser-style wrong password', `status=${res.status}`);
  } catch (e) {
    ok(false, 'browser-style wrong password', e.message);
  }

  // nest1 (README stale) from browser origin
  try {
    const res = await axios.post(
      `${API}/auth/login`,
      { username: 'nest1', password: PASSWORD },
      { headers: { Origin: 'http://localhost:5173' }, validateStatus: () => true }
    );
    ok(res.status === 401, 'browser-style nest1 (stale README user)', `status=${res.status}`);
  } catch (e) {
    ok(false, 'browser-style nest1', e.message);
  }

  console.log(`\n=== CORS/BROWSER API SUMMARY === Total=${pass + fail} Passed=${pass} Failed=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
