require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const axios = require('axios');

const BASE = process.env.API_URL || 'http://localhost:5000/api';

const TEST = {
  entryDate: '2026-09-23',
  origin: 'Shinyanga',
  destination: 'Mwanza',
  startKm: 10000,
  endKm: 10250,
  totalKm: 250,
  fuelIssuedLitres: 35,
  fuelRemaining: 10,
  fuelAvailableBeforeTrip: 40,
  fuelUsedLitres: 30,
  purpose: 'Manual HPMU test purpose',
  remarks: 'Manual HPMU test entry',
  tripName: 'TEST-REF-001',
  carType: 'Test Vehicle Type',
  vehicleRegistration: 'TEST-001',
  fuelType: 'Diesel',
  routeDistanceKm: 250,
  postTripNotes: 'post notes exact',
};

async function login(username, password) {
  const r = await axios.post(`${BASE}/auth/login`, { username, password });
  return r.data.token;
}

function pick(lb) {
  return {
    origin: lb.origin,
    destination: lb.destination,
    startKm: lb.startKm,
    endKm: lb.endKm,
    totalKm: lb.totalKm,
    fuelIssuedLitres: lb.fuelIssuedLitres,
    fuelRemaining: lb.fuelRemaining,
    fuelAvailableBeforeTrip: lb.fuelAvailableBeforeTrip,
    fuelUsedLitres: lb.fuelUsedLitres,
    purpose: lb.purpose,
    remarks: lb.remarks,
    tripName: lb.tripName,
    carType: lb.carType,
    vehicleRegistration: lb.vehicleRegistration,
    routeDistanceKm: lb.routeDistanceKm,
    postTripNotes: lb.postTripNotes,
    driverId: lb.driverId,
    entryDate: lb.entryDate ? String(lb.entryDate).slice(0, 10) : null,
  };
}

function assertEq(label, actual, expected) {
  const a = actual === undefined || actual === null ? null : actual;
  const e = expected === undefined || expected === null ? null : expected;
  const ok = String(a) === String(e) || (a === e);
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${label} | actual=${JSON.stringify(a)} expected=${JSON.stringify(e)}`);
  return ok;
}

(async () => {
  let fail = 0;
  const token = await login('hpmu1', 'Password123!');
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  // get a driver id
  const drivers = await axios.get(`${BASE}/drivers?limit=10`, auth);
  const driverList = Array.isArray(drivers.data) ? drivers.data : drivers.data.data;
  const driverId = driverList[0].id;
  console.log('Using driverId', driverId, driverList[0].user?.fullName);

  // CREATE
  const createBody = { ...TEST, driverId, vehicleId: null };
  const created = await axios.post(`${BASE}/logbooks`, createBody, auth);
  const id = created.data.id;
  console.log(`CREATE => ${created.status} id=${id}`);

  // REFRESH (GET from DB)
  const got = await axios.get(`${BASE}/logbooks/${id}`, auth);
  console.log('GET after create:');
  for (const [k, v] of Object.entries(pick(TEST))) {
    if (!assertEq(`create.${k}`, pick(got.data)[k], v)) fail++;
  }

  // EDIT
  const editBody = {
    ...TEST,
    driverId,
    origin: 'Dodoma',
    destination: 'Arusha',
    startKm: 11000,
    endKm: 11300,
    totalKm: 300,
    fuelIssuedLitres: 45,
    fuelRemaining: 15,
    remarks: 'Edited manual remarks',
    vehicleRegistration: 'TEST-002',
  };
  const updated = await axios.put(`${BASE}/logbooks/${id}`, editBody, auth);
  console.log(`UPDATE => ${updated.status}`);

  const got2 = await axios.get(`${BASE}/logbooks/${id}`, auth);
  console.log('GET after edit:');
  const expected2 = {
    ...pick(editBody),
    origin: 'Dodoma',
    destination: 'Arusha',
    startKm: 11000,
    endKm: 11300,
    totalKm: 300,
    fuelIssuedLitres: 45,
    fuelRemaining: 15,
    remarks: 'Edited manual remarks',
    vehicleRegistration: 'TEST-002',
  };
  for (const [k, v] of Object.entries(expected2)) {
    if (!assertEq(`edit.${k}`, pick(got2.data)[k], v)) fail++;
  }

  // status preserved as DRAFT (not overwritten weirdly)
  if (!assertEq('status', got2.data.status, 'DRAFT')) fail++;

  // print payload equals saved record fields
  console.log('PRINT-CHECK (saved record used for print):');
  if (!assertEq('print.startKm', got2.data.startKm, 11000)) fail++;
  if (!assertEq('print.endKm', got2.data.endKm, 11300)) fail++;
  if (!assertEq('print.fuelIssuedLitres', got2.data.fuelIssuedLitres, 45)) fail++;
  if (!assertEq('print.fuelRemaining', got2.data.fuelRemaining, 15)) fail++;

  // DELETE test record
  const del = await axios.delete(`${BASE}/logbooks/${id}`, auth);
  console.log(`DELETE => ${del.status}`);
  try {
    await axios.get(`${BASE}/logbooks/${id}`, auth);
    console.log('FAIL | deleted record still fetchable');
    fail++;
  } catch (e) {
    console.log(`PASS | deleted record 404 (${e.response?.status})`);
  }

  console.log(`\nSUMMARY: ${fail === 0 ? 'ALL PASS' : fail + ' FAILED'}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('ERROR', e.response?.status, e.response?.data || e.message);
  process.exit(1);
});
