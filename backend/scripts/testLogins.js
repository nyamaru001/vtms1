require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const BASE = process.env.API_BASE || 'http://localhost:5000/api';
const USERS = [
  { username: 'officer1', role: 'OFFICER' },
  { username: 'driver1', role: 'DRIVER' },
  { username: 'driver2', role: 'DRIVER' },
  { username: 'transport1', role: 'TRANSPORT_OFFICER' },
  { username: 'hpmu1', role: 'HPMU' },
  { username: 'r3approver1', role: 'R3' },
  { username: 'admin', role: 'ADMIN' },
  { username: 'fideli', role: 'OFFICER' },
  { username: 'r3user', role: 'R3' },
  { username: 'nest1', role: '?' },
  { username: 'HPMU1', role: '?' },
];
const PASSWORDS = ['Password123!', 'Admin@123'];

(async () => {
  for (const u of USERS) {
    for (const p of PASSWORDS) {
      try {
        const res = await axios.post(`${BASE}/auth/login`, { username: u.username, password: p });
        const gotRole = res.data?.user?.role;
        const hasToken = Boolean(res.data?.token);
        const roleOk = gotRole === u.role;
        console.log(
          `LOGIN ${u.username} / ${p} => 200 token=${hasToken} role=${gotRole} expected=${u.role} roleOk=${roleOk}`
        );
        if (hasToken && roleOk) break;
      } catch (e) {
        const st = e.response?.status;
        const msg = e.response?.data?.message || e.message;
        if (st === 401 && p === PASSWORDS[PASSWORDS.length - 1]) {
          console.log(`LOGIN ${u.username} / ${PASSWORDS.join(' OR ')} => ${st} ${msg}`);
        } else if (st !== 401) {
          console.log(`LOGIN ${u.username} / ${p} => ${st} ${msg}`);
        }
      }
    }
  }

  // Wrong password should still 401
  try {
    await axios.post(`${BASE}/auth/login`, { username: 'officer1', password: 'WrongPass!' });
    console.log('NEGATIVE officer1/WrongPass! => UNEXPECTED 200');
  } catch (e) {
    console.log(`NEGATIVE officer1/WrongPass! => ${e.response?.status} ${e.response?.data?.message || e.message}`);
  }

  // Missing fields
  try {
    await axios.post(`${BASE}/auth/login`, { username: 'officer1' });
    console.log('MISSING_PASSWORD => UNEXPECTED 200');
  } catch (e) {
    console.log(`MISSING_PASSWORD => ${e.response?.status} ${e.response?.data?.message || e.message}`);
  }
})().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
