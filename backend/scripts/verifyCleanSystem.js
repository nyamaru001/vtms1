require('dotenv').config();
const axios = require('axios');

const BASE = process.env.API_BASE || 'http://localhost:5000/api';
const PASSWORD = 'Password123!';

const USERS = [
  { username: 'officer1', role: 'OFFICER' },
  { username: 'fideli', role: 'OFFICER' },
  { username: 'driver1', role: 'DRIVER' },
  { username: 'driver2', role: 'DRIVER' },
  { username: 'transport1', role: 'TRANSPORT_OFFICER' },
  { username: 'hpmu1', role: 'HPMU' },
  { username: 'r3approver1', role: 'R3' },
  { username: 'admin', role: 'ADMIN' },
];

function lenOf(data) {
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.data)) return data.data.length;
  if (Array.isArray(data?.rows)) return data.rows.length;
  if (typeof data?.total === 'number') return data.total;
  if (Array.isArray(data?.notifications)) return data.notifications.length;
  if (Array.isArray(data?.items)) return data.items.length;
  return null;
}

(async () => {
  let fails = 0;
  const clients = {};

  for (const u of USERS) {
    try {
      const res = await axios.post(`${BASE}/auth/login`, { username: u.username, password: PASSWORD });
      const role = res.data?.user?.role;
      const token = res.data?.token;
      const ok = Boolean(token) && role === u.role;
      if (!ok) fails += 1;
      console.log(`LOGIN ${u.username} => ${ok ? 'PASS' : 'FAIL'} role=${role} expected=${u.role} token=${Boolean(token)}`);
      clients[u.username] = axios.create({
        baseURL: BASE,
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      });
    } catch (e) {
      fails += 1;
      console.log(`LOGIN ${u.username} => ERROR ${e.response?.status || ''} ${e.response?.data?.message || e.message}`);
    }
  }

  async function expectEmpty(label, p, expectedStatus = 200) {
    try {
      const res = await p;
      const n = lenOf(res.data);
      const total = res.data?.total;
      const count = n != null ? n : total;
      const statusOk = res.status === expectedStatus;
      const emptyOk = count === 0 || (res.data && typeof res.data === 'object' && !Array.isArray(res.data) && (res.data.cancelled === 0 || res.data.total === 0 || res.data.pending === 0));
      // For stats objects, check transactional fields are zero
      let statsOk = true;
      if (res.data && typeof res.data === 'object' && !Array.isArray(res.data) && 'total' in res.data && 'pending' in res.data) {
        statsOk =
          res.data.total === 0 &&
          res.data.pending === 0 &&
          res.data.cancelled === 0 &&
          (res.data.trips === 0 || res.data.trips === undefined) &&
          (res.data.activeTrips === 0 || res.data.activeTrips === undefined) &&
          (res.data.completedTrips === 0 || res.data.completedTrips === undefined);
        console.log(`${label} => HTTP ${res.status} stats=${JSON.stringify(res.data)} ${statusOk && statsOk ? 'CLEAN' : 'DIRTY'}`);
        if (!(statusOk && statsOk)) fails += 1;
        return;
      }
      const pass = statusOk && count === 0;
      if (!pass) fails += 1;
      console.log(`${label} => HTTP ${res.status} count=${count} ${pass ? 'CLEAN' : 'NOT EMPTY'}`);
    } catch (e) {
      fails += 1;
      console.log(`${label} => ERROR ${e.message}`);
    }
  }

  const o = clients.officer1;
  const t = clients.transport1;
  const d = clients.driver1;
  const h = clients.hpmu1;
  const r = clients.r3approver1;

  if (o) {
    await expectEmpty('officer stats', o.get('/stats'));
    await expectEmpty('officer requests', o.get('/requests', { params: { limit: 50 } }));
    await expectEmpty('officer trips', o.get('/trips', { params: { limit: 50 } }));
    await expectEmpty('officer notifications', o.get('/notifications', { params: { limit: 50 } }));
  }
  if (t) {
    await expectEmpty('transport requests', t.get('/requests', { params: { limit: 50 } }));
    await expectEmpty('transport vehicles', t.get('/vehicles', { params: { limit: 50 } }), 200); // vehicles may be 1 (master)
    await expectEmpty('transport notifications', t.get('/notifications', { params: { limit: 50 } }));
    try {
      const v = await t.get('/vehicles', { params: { limit: 50 } });
      const n = lenOf(v.data);
      console.log(`transport vehicles count=${n} (master data expected >=0)`);
      if (n !== 1) { console.log('NOTE vehicles count:', n); }
    } catch {}
  }
  if (d) {
    await expectEmpty('driver trips', d.get('/trips', { params: { limit: 50 } }));
    await expectEmpty('driver fuel', d.get('/fuel-requests', { params: { limit: 50 } }));
    await expectEmpty('driver logbooks', d.get('/logbooks', { params: { limit: 50 } }));
    await expectEmpty('driver notifications', d.get('/notifications', { params: { limit: 50 } }));
  }
  if (h) {
    await expectEmpty('hpmu fuel', h.get('/fuel-requests', { params: { limit: 50 } }));
    await expectEmpty('hpmu logbooks', h.get('/logbooks', { params: { limit: 50 } }));
    await expectEmpty('hpmu notifications', h.get('/notifications', { params: { limit: 50 } }));
  }
  if (r) {
    await expectEmpty('r3 queue/requests', r.get('/r3/queue', { params: { limit: 50 } }).catch(async () => r.get('/requests', { params: { status: 'R3_REVIEW', limit: 50 } })));
    await expectEmpty('r3 notifications', r.get('/notifications', { params: { limit: 50 } }));
  }

  // Protected routes still work (401 without token)
  try {
    const bare = axios.create({ baseURL: BASE, validateStatus: () => true });
    const res = await bare.get('/requests');
    console.log(`unauth GET /requests => ${res.status} ${res.status === 401 ? 'OK' : 'UNEXPECTED'}`);
    if (res.status !== 401) fails += 1;
  } catch (e) {
    fails += 1;
    console.log('unauth ERROR', e.message);
  }

  console.log('\n=== VERIFY SUMMARY ===');
  console.log(fails === 0 ? 'ALL CLEAN CHECKS PASSED' : `FAILURES: ${fails}`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e.response?.data || e.message);
  process.exit(1);
});
