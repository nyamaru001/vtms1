require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const BASE = process.env.API_BASE || 'http://localhost:5000/api';
const PASSWORD = process.env.SEED_PASSWORD || 'Password123!';

async function login(username) {
  const res = await axios.post(`${BASE}/auth/login`, { username, password: PASSWORD });
  return res.data.token;
}

(async () => {
  const token = await login('officer1');
  const res = await axios.get(`${BASE}/requests`, {
    params: { search: 'TRIP', startDate: '2020-01-01', endDate: '2030-01-01', vehicleId: 1 },
    headers: { Authorization: `Bearer ${token}` },
  });
  console.log(JSON.stringify({
    status: res.status,
    total: res.data.total,
    page: res.data.page,
    rows: res.data.data?.length,
  }));
})().catch((e) => {
  console.error(e.response?.data || e.message);
  process.exit(1);
});
