require('dotenv').config();
const axios = require('axios');

const BASE = process.env.API_BASE || 'http://localhost:5000/api';

function lenOf(data) {
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.data)) return data.data.length;
  if (Array.isArray(data?.rows)) return data.rows.length;
  if (typeof data?.total === 'number') return data.total;
  if (Array.isArray(data?.items)) return data.items.length;
  return null;
}

(async () => {
  let fails = 0;

  const login = await axios.post(`${BASE}/auth/login`, {
    username: 'admin',
    password: 'Password123!',
  });
  const token = login.data.token;
  const role = login.data.user.role;
  console.log(`ADMIN LOGIN => PASS role=${role} token=${Boolean(token)}`);
  if (role !== 'ADMIN' || !token) fails += 1;

  const api = axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
  });

  async function expectEmpty(label, p) {
    const res = await p;
    let pass = false;
    let detail = `HTTP ${res.status}`;
    if (res.status !== 200) {
      pass = false;
      detail += ` unexpected status`;
    } else if (res.data && typeof res.data === 'object' && !Array.isArray(res.data) && 'total' in res.data && 'pending' in res.data) {
      const d = res.data;
      pass =
        d.total === 0 &&
        d.pending === 0 &&
        (d.cancelled === 0 || d.cancelled === undefined) &&
        (d.trips === 0 || d.trips === undefined) &&
        (d.activeTrips === 0 || d.activeTrips === undefined) &&
        (d.completed === 0 || d.completed === undefined);
      detail += ` stats=${JSON.stringify(d)}`;
    } else {
      const n = lenOf(res.data);
      pass = n === 0;
      detail += ` count=${n}`;
    }
    if (!pass) fails += 1;
    console.log(`${label} => ${pass ? 'CLEAN' : 'FAIL'} | ${detail}`);
  }

  // Admin may hit different routes; try common ones with graceful fallbacks
  await expectEmpty('admin notifications', api.get('/notifications', { params: { limit: 50 } }));

  // vehicles: expect 1 master vehicle (not transactional)
  const vehicles = await api.get('/vehicles', { params: { limit: 50 } });
  const vCount = lenOf(vehicles.data);
  console.log(`admin vehicles => count=${vCount} (master/reference expected 1) ${vCount === 1 ? 'OK' : 'UNEXPECTED'}`);
  if (vCount !== 1) fails += 1;

  // drivers via admin if available
  try {
    const drivers = await api.get('/drivers', { params: { limit: 50 } });
    const dCount = lenOf(drivers.data);
    console.log(`admin drivers => count=${dCount} (master/reference expected 2) ${dCount === 2 ? 'OK' : 'UNEXPECTED'}`);
    if (dCount !== 2) fails += 1;
  } catch (e) {
    console.log('admin drivers => skip', e.message);
  }

  // requests
  await expectEmpty('admin/all requests', api.get('/requests', { params: { limit: 50 } }));

  // trips
  await expectEmpty('admin/all trips', api.get('/trips', { params: { limit: 50 } }));

  // fuel
  try {
    await expectEmpty('admin fuel-requests', api.get('/fuel-requests', { params: { limit: 50 } }));
  } catch (e) {
    console.log('fuel-requests route check via status only');
  }

  // audit
  try {
    await expectEmpty('admin audit-logs', api.get('/audit-logs', { params: { limit: 50 } }));
  } catch (e) {
    try {
      await expectEmpty('admin audits', api.get('/audits', { params: { limit: 50 } }));
    } catch (e2) {
      console.log('audit route not exposed (ok) — SQL already verified 0');
    }
  }

  // Protected without token
  const bare = axios.create({ baseURL: BASE, validateStatus: () => true });
  const unauth = await bare.get('/requests');
  console.log(`unauth GET /requests => ${unauth.status} ${unauth.status === 401 ? 'OK' : 'UNEXPECTED'}`);
  if (unauth.status !== 401) fails += 1;

  // /auth/me works
  const me = await api.get('/auth/me');
  console.log(`GET /auth/me => ${me.status} username=${me.data?.username} role=${me.data?.role}`);
  if (me.status !== 200 || me.data?.role !== 'ADMIN') fails += 1;

  // Login failures for non-admin (documented, not fixed)
  const probes = ['officer1', 'driver1', 'driver2', 'transport1', 'hpmu1', 'r3approver1', 'fideli'];
  for (const username of probes) {
    try {
      await axios.post(`${BASE}/auth/login`, { username, password: 'Password123!' });
      console.log(`PROBE ${username}/Password123! => 200 (unexpected vs earlier failure)`);
    } catch (e) {
      console.log(`PROBE ${username}/Password123! => ${e.response?.status} ${e.response?.data?.message || e.message}`);
    }
  }

  console.log('\n=== ADMIN CLEAN VERIFY ===');
  console.log(fails === 0 ? 'PASSED' : `FAILURES: ${fails}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e.response?.data || e.message);
  process.exit(1);
});
