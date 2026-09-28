require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const BASE = process.env.API_BASE || 'http://localhost:5000/api';
const PASSWORD = process.env.SEED_PASSWORD || 'Password123!';

const USERS = [
  { username: 'officer1', role: 'OFFICER' },
  { username: 'driver1', role: 'DRIVER' },
  { username: 'transport1', role: 'TRANSPORT_OFFICER' },
  { username: 'hpmu1', role: 'HPMU' },
  { username: 'r3approver1', role: 'R3' },
  { username: 'admin', role: 'ADMIN' },
];

async function login(username) {
  const res = await axios.post(`${BASE}/auth/login`, {
    username,
    password: PASSWORD,
  });
  return res.data.token || res.data.accessToken || res.data?.user?.token;
}

async function get(path, token) {
  try {
    const res = await axios.get(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return { ok: true, status: res.status, data: res.data };
  } catch (err) {
    return {
      ok: false,
      status: err.response?.status,
      message: err.response?.data?.message || err.message,
    };
  }
}

function summarizeList(data) {
  if (Array.isArray(data)) return `array(${data.length})`;
  if (data && Array.isArray(data.data)) {
    return `page(total=${data.total ?? data.data.length}, page=${data.page ?? 1}, limit=${data.limit ?? '?'}, rows=${data.data.length})`;
  }
  if (data && typeof data === 'object') {
    const keys = Object.keys(data).slice(0, 12).join(',');
    return `object{${keys}}`;
  }
  return typeof data;
}

(async () => {
  const results = [];

  // Health
  try {
    const health = await axios.get(`${BASE}/health`);
    results.push(['GET /health', health.status, 'ok']);
  } catch (e) {
    results.push(['GET /health', e.response?.status || 'ERR', e.message]);
  }

  for (const u of USERS) {
    let token;
    try {
      token = await login(u.username);
      if (!token) {
        results.push([`LOGIN ${u.username}`, 'FAIL', 'no token in response']);
        continue;
      }
      results.push([`LOGIN ${u.username}`, 200, 'ok']);
    } catch (e) {
      results.push([`LOGIN ${u.username}`, e.response?.status || 'ERR', e.response?.data?.message || e.message]);
      continue;
    }

    const checks = [
      ['/stats', 'stats'],
      ['/notifications', 'notifications'],
    ];

    if (u.role === 'OFFICER') {
      checks.push(['/requests', 'my requests'], ['/fuel', 'my fuel'], ['/trips', 'my trips']);
    }
    if (u.role === 'DRIVER') {
      checks.push(['/fuel', 'fuel list'], ['/trips', 'trips'], ['/driver/reports', 'driver reports'], ['/logbooks', 'logbooks']);
    }
    if (u.role === 'TRANSPORT_OFFICER') {
      checks.push(['/requests', 'requests'], ['/vehicles', 'vehicles'], ['/drivers', 'drivers'], ['/fuel', 'fuel'], ['/trips', 'trips']);
    }
    if (u.role === 'HPMU') {
      checks.push(['/fuel', 'fuel list'], ['/fuel?page=1&limit=15', 'fuel paginated'], ['/hpmu/fuel-logbook', 'fuel logbook']);
    }
    if (u.role === 'R3') {
      checks.push(['/requests', 'requests'], ['/fuel', 'fuel']);
    }
    if (u.role === 'ADMIN') {
      checks.push(['/admin/stats', 'admin stats'], ['/users', 'users'], ['/vehicles', 'vehicles']);
    }

    for (const [path, label] of checks) {
      const r = await get(path, token);
      if (!r.ok) {
        results.push([`${u.role} GET ${path} (${label})`, r.status || 'ERR', r.message]);
      } else if (path.startsWith('/stats') || path.startsWith('/admin/stats')) {
        results.push([`${u.role} GET ${path} (${label})`, r.status, JSON.stringify(r.data)]);
      } else if (path.includes('/fuel') || path.includes('reports') || path.startsWith('/requests') || path.startsWith('/trips') || path.startsWith('/logbooks') || path.startsWith('/users') || path.startsWith('/vehicles') || path.startsWith('/drivers') || path.startsWith('/notifications') || path.startsWith('/hpmu')) {
        results.push([`${u.role} GET ${path} (${label})`, r.status, summarizeList(r.data)]);
      } else {
        results.push([`${u.role} GET ${path} (${label})`, r.status, 'ok']);
      }
    }
  }

  // Unauthenticated checks
  try {
    await axios.get(`${BASE}/stats`);
    results.push(['GET /stats unauthenticated', 200, 'UNEXPECTED SUCCESS']);
  } catch (e) {
    results.push(['GET /stats unauthenticated', e.response?.status, 'blocked as expected']);
  }

  console.log('=== API TEST RESULTS ===');
  for (const row of results) {
    console.log(`${row[0]}\t${row[1]}\t${row[2]}`);
  }
})().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
