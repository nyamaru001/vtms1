require('dotenv').config();
const axios = require('axios');

const BASE = process.env.API_URL || 'http://localhost:5000/api';
const results = [];

const push = (ok, label, detail = '') => {
  results.push({ ok, label, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${label} | ${detail}`);
};

async function login(username, password) {
  const res = await axios.post(`${BASE}/auth/login`, { username, password });
  return {
    token: res.data.token || res.data.accessToken || res.data.data?.token,
    user: res.data.user || res.data.data?.user,
    headers: {},
  };
}

function client(token) {
  return axios.create({
    baseURL: BASE,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
  });
}

async function createRequest(api, overrides = {}) {
  const body = {
    purpose: 'Cancel workflow test purpose',
    originName: 'Dar es Salaam',
    originLat: -6.7924,
    originLng: 39.2083,
    destinationName: 'Dodoma',
    destinationLat: -6.163,
    destinationLng: 35.7516,
    departureDate: '2026-10-01',
    departureTime: '09:00',
    passengers: 1,
    ...overrides,
  };
  const res = await api.post('/requests', body);
  return res;
}

async function main() {
  // --- logins ---
  let officer;
  try {
    const o = await login('officer1', 'Password123!');
    officer = client(o.token);
    push(Boolean(o.token), 'officer1 login', o.token ? 'ok' : 'no token');
  } catch (e) {
    push(false, 'officer1 login', e.message);
    return finish();
  }

  let officer2;
  try {
    const o = await login('fideli', 'Password123!');
    officer2 = client(o.token);
    push(Boolean(o.token), 'fideli (2nd officer) login', o.token ? 'ok' : 'no token');
  } catch (e) {
    push(false, 'fideli login', e.message);
    officer2 = null;
  }

  let r3;
  try {
    const o = await login('r3approver1', 'Password123!');
    r3 = client(o.token);
    push(Boolean(o.token), 'r3approver1 login', o.token ? 'ok' : 'no token');
  } catch (e) {
    push(false, 'r3 login', e.message);
  }

  let transport;
  try {
    const o = await login('transport1', 'Password123!');
    transport = client(o.token);
    push(Boolean(o.token), 'transport1 login', o.token ? 'ok' : 'no token');
  } catch (e) {
    push(false, 'transport login', e.message);
  }

  // ========== TEST 1: Pending cancel ==========
  try {
    const created = await createRequest(officer);
    push(created.status === 201 || created.status === 200, 'T1 create pending request', `HTTP ${created.status}`);
    const reqId = created.data.id;
    const status1 = created.data.status;

    const empty = await officer.patch(`/requests/${reqId}/cancel`, { reason: '   ' });
    push(empty.status === 400, 'T1 empty reason rejected', `HTTP ${empty.status} ${empty.data.message}`);

    const ok = await officer.patch(`/requests/${reqId}/cancel`, { reason: 'Illness — cannot travel today.' });
    push(ok.status === 200 && ok.data.status === 'CANCELLED', 'T1 pending cancel', `HTTP ${ok.status} status=${ok.data.status} from=${status1}`);
    push(ok.data.cancellationReason === 'Illness — cannot travel today.', 'T1 reason saved', String(ok.data.cancellationReason));
    push(Boolean(ok.data.cancelledAt), 'T1 cancelledAt set', String(ok.data.cancelledAt));

    // History still has it
    const hist = await officer.get(`/requests/${reqId}`);
    push(hist.status === 200 && hist.data.status === 'CANCELLED', 'T1 history retains cancelled', `HTTP ${hist.status}`);
    push(hist.data.cancellationReason === 'Illness — cannot travel today.', 'T1 history reason exact', String(hist.data.cancellationReason));
  } catch (e) {
    push(false, 'T1 pending cancel', e.message);
  }

  // ========== TEST 2: Approved (R3) cancel ==========
  let approvedId = null;
  try {
    const created = await createRequest(officer, { purpose: 'Approved cancel test' });
    const reqId = created.data.id;
    approvedId = reqId;

    const decide = await r3.post(`/r3/${reqId}/decide`, { decision: 'APPROVE', comment: 'ok' });
    push(decide.status === 200, 'T2 r3 approve', `HTTP ${decide.status} status=${decide.data.status}`);

    const afterApprove = await officer.get(`/reqquests/${reqId}`.replace('reqquests', 'requests'));
    push(
      ['R3_APPROVED', 'TRANSPORT_REVIEW'].includes(afterApprove.data.status),
      'T2 request is approved path',
      `status=${afterApprove.data.status}`
    );

    const cancel = await officer.patch(`/requests/${reqId}/cancel`, {
      reason: 'I am sick and cannot travel.',
    });
    push(cancel.status === 200 && cancel.data.status === 'CANCELLED', 'T2 approved cancel allowed', `HTTP ${cancel.status} status=${cancel.data.status}`);
    push(cancel.data.cancellationReason === 'I am sick and cannot travel.', 'T2 approved reason saved', String(cancel.data.cancellationReason));
  } catch (e) {
    push(false, 'T2 approved cancel', e.message);
  }

  // ========== TEST 3: Assigned cancel (vehicle + driver) ==========
  let assignedId = null;
  try {
    const created = await createRequest(officer, { purpose: 'Assigned cancel test' });
    const reqId = created.data.id;
    assignedId = reqId;

    // Approve via R3 → TRANSPORT_REVIEW
    await r3.post(`/r3/${reqId}/decide`, { decision: 'APPROVE', comment: 'ok' });

    // Ensure an AVAILABLE vehicle (create temp if fleet busy)
    let vehicles = await transport.get('/vehicles/available');
    let vehicleList = Array.isArray(vehicles.data) ? vehicles.data : vehicles.data?.data || [];
    let vehicle = vehicleList[0];
    let tempVehicleId = null;
    if (!vehicle) {
      const createdV = await transport.post('/vehicles', {
        registrationNumber: `T-CANCEL-${Date.now()}`,
        model: 'Test Cancel SUV',
        type: 'SUV',
        fuelType: 'Diesel',
        status: 'AVAILABLE',
      });
      vehicle = createdV.data;
      tempVehicleId = vehicle.id;
      push(createdV.status === 201 || createdV.status === 200, 'T3 temp vehicle created', `id=${vehicle.id}`);
    }

    const driversAv = await transport.get('/drivers/available');
    const driverList = Array.isArray(driversAv.data) ? driversAv.data : driversAv.data?.data || [];
    const driver = driverList[0];

    if (!vehicle || !driver) {
      push(false, 'T3 assign prerequisites', `vehicle=${!!vehicle} driver=${!!driver}`);
    } else {
      const assign = await transport.post(`/requests/${reqId}/assign`, {
        vehicleId: vehicle.id,
        driverId: driver.id,
      });
      push(assign.status === 200 || assign.status === 201, 'T3 assign', `HTTP ${assign.status} status=${assign.data.request?.status || assign.data.message}`);
      push(assign.data.request?.status === 'DRIVER_ASSIGNED', 'T3 status DRIVER_ASSIGNED', String(assign.data.request?.status));

      const vMid = await transport.get(`/vehicles/${vehicle.id}`);
      const dMid = await transport.get(`/drivers/${driver.id}`);
      push(vMid.data.status === 'ASSIGNED', 'T3 vehicle ASSIGNED before cancel', vMid.data.status);
      push(['ASSIGNED', 'BUSY'].includes(dMid.data.status), 'T3 driver assigned before cancel', dMid.data.status);

      const cancel = await officer.patch(`/requests/${reqId}/cancel`, {
        reason: 'Emergency — vehicle no longer required.',
      });
      push(cancel.status === 200 && cancel.data.status === 'CANCELLED', 'T3 assigned cancel', `HTTP ${cancel.status} status=${cancel.data.status}`);
      push(cancel.data.cancellationReason === 'Emergency — vehicle no longer required.', 'T3 assigned reason saved', String(cancel.data.cancellationReason));

      const vAfter = await transport.get(`/vehicles/${vehicle.id}`);
      const dAfter = await transport.get(`/drivers/${driver.id}`);
      push(vAfter.data.status === 'AVAILABLE', 'T3 vehicle freed', vAfter.data.status);
      push(dAfter.data.status === 'AVAILABLE', 'T3 driver freed', dAfter.data.status);
      push(dAfter.data.assignedVehicleId == null, 'T3 driver assignment cleared', String(dAfter.data.assignedVehicleId));

      // Trip should be cancelled if exists
      const trips = await officer.get('/trips');
      const list = Array.isArray(trips.data) ? trips.data : trips.data?.data || [];
      const related = list.find((t) => t.requestId === reqId || t.request?.id === reqId);
      if (related) {
        push(related.status === 'CANCELLED', 'T3 linked trip CANCELLED', related.status);
      } else {
        push(false, 'T3 linked trip', 'trip row missing after assign');
      }

      if (tempVehicleId) {
        await transport.delete(`/vehicles/${tempVehicleId}`);
      }
    }
  } catch (e) {
    push(false, 'T3 assigned cancel', e.message);
  }

  // ========== TEST 6: Trip cancel endpoint ==========
  try {
    const tripsRes = await officer.get('/trips');
    const list = Array.isArray(tripsRes.data) ? tripsRes.data : tripsRes.data?.data || [];
    let trip = list.find((t) =>
      ['NOT_STARTED', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'TRIP_STARTED', 'IN_PROGRESS'].includes(t.status)
    );

    if (!trip) {
      // Build one: approve + assign
      const created = await createRequest(officer, { purpose: 'Trip endpoint cancel test' });
      const reqId = created.data.id;
      await r3.post(`/r3/${reqId}/decide`, { decision: 'APPROVE', comment: 'ok' });
      let vehicles = await transport.get('/vehicles/available');
      let vehicleList = Array.isArray(vehicles.data) ? vehicles.data : vehicles.data?.data || [];
      let vehicle = vehicleList[0];
      let tempVehicleId = null;
      if (!vehicle) {
        const createdV = await transport.post('/vehicles', {
          registrationNumber: `T-TRIP-${Date.now()}`,
          model: 'Trip Cancel Test',
          type: 'SEDAN',
          fuelType: 'Petrol',
          status: 'AVAILABLE',
        });
        vehicle = createdV.data;
        tempVehicleId = vehicle.id;
      }
      const driversAv = await transport.get('/drivers/available');
      const driverList = Array.isArray(driversAv.data) ? driversAv.data : driversAv.data?.data || [];
      const driver = driverList[0];
      if (vehicle && driver) {
        await transport.post(`/requests/${reqId}/assign`, { vehicleId: vehicle.id, driverId: driver.id });
        const tripsRes2 = await officer.get('/trips');
        const list2 = Array.isArray(tripsRes2.data) ? tripsRes2.data : tripsRes2.data?.data || [];
        trip = list2.find((t) => (t.requestId || t.request?.id) === reqId && t.status === 'DRIVER_ASSIGNED');
      }
      if (tempVehicleId) await transport.delete(`/vehicles/${tempVehicleId}`).catch(() => {});
      if (!trip) {
        push(false, 'T6 trip created', 'no cancellable trip found');
        trip = null;
      }
    }

    if (trip) {
      const empty = await officer.post(`/trips/${trip.id}/cancel`, { reason: '  ' });
      push(empty.status === 400, 'T6 trip empty reason rejected', `HTTP ${empty.status} ${empty.data.message}`);
      const ok = await officer.post(`/trips/${trip.id}/cancel`, { reason: 'Emergency termination test' });
      push(ok.status === 200, 'T6 trip cancel', `HTTP ${ok.status} trip=${ok.data?.trip?.status}`);
      push(ok.data?.trip?.status === 'CANCELLED', 'T6 trip status CANCELLED', String(ok.data?.trip?.status));
      const reqId = trip.requestId || trip.request?.id;
      if (reqId) {
        const reqAfter = await officer.get(`/requests/${reqId}`);
        push(reqAfter.data.status === 'CANCELLED', 'T6 request also CANCELLED', reqAfter.data.status);
        push(reqAfter.data.cancellationReason === 'Emergency termination test', 'T6 request reason', String(reqAfter.data.cancellationReason));
        const vId = ok.data?.trip?.vehicleId || trip.vehicleId;
        const dId = ok.data?.trip?.driverId || trip.driverId;
        if (vId) {
          const vAfter = await transport.get(`/vehicles/${vId}`);
          push(vAfter.data.status === 'AVAILABLE', 'T6 vehicle freed via trip cancel', vAfter.data.status);
        }
        if (dId) {
          const dAfter = await transport.get(`/drivers/${dId}`);
          push(dAfter.data.status === 'AVAILABLE', 'T6 driver freed via trip cancel', dAfter.data.status);
        }
      }
    }
  } catch (e) {
    push(false, 'T6 trip cancel', e.message);
  }

  // ========== TEST 5: Unauthorized (other officer) ==========
  if (officer2 && approvedId) {
    // Create a fresh request owned by officer1 that officer2 tries to cancel
    try {
      const created = await createRequest(officer, { purpose: 'Authz cancel test' });
      const reqId = created.data.id;
      const res = await officer2.patch(`/requests/${reqId}/cancel`, { reason: 'Not mine' });
      push(res.status === 403, 'T5 other officer blocked', `HTTP ${res.status} ${res.data.message}`);

      // Also verify empty reason on valid own request
      const empty = await officer.patch(`/requests/${reqId}/cancel`, { reason: '' });
      push(empty.status === 400, 'T4 empty reason blocked', `HTTP ${empty.status} ${empty.data.message}`);

      // cleanup this one
      await officer.patch(`/requests/${reqId}/cancel`, { reason: 'Authz test cleanup' });
    } catch (e) {
      push(false, 'T5 unauthorized', e.message);
    }
  } else {
    push(false, 'T5 unauthorized', 'officer2 missing');
  }

  // ========== Notifications check ==========
  try {
    const notifs = await transport.get('/notifications');
    const list = Array.isArray(notifs.data) ? notifs.data : notifs.data?.data || notifs.data?.rows || [];
    const cancelled = list.filter((n) => /cancel/i.test(n.title || '') || /cancel/i.test(n.message || ''));
    push(cancelled.length > 0, 'notifications for transport', `count=${cancelled.length} sample=${cancelled[0]?.title || 'none'}`);
    if (cancelled[0]) {
      push(/Reason:/.test(cancelled[0].message || ''), 'notification includes reason', (cancelled[0].message || '').slice(0, 160));
      push(/REQ-/.test(cancelled[0].message || ''), 'notification includes request #', (cancelled[0].message || '').slice(0, 160));
    }
  } catch (e) {
    push(false, 'notifications', e.message);
  }

  // ========== Stats cancelled count ==========
  try {
    const stats = await officer.get('/stats');
    push(typeof stats.data.cancelled === 'number' && stats.data.cancelled >= 1, 'stats.cancelled', JSON.stringify(stats.data));
    push(typeof stats.data.rejected === 'number', 'stats.rejected present', String(stats.data.rejected));
    push(typeof stats.data.completedTrips === 'number', 'stats.completedTrips present', String(stats.data.completedTrips));
  } catch (e) {
    push(false, 'stats', e.message);
  }

  // ========== History list includes cancelled with reason ==========
  try {
    const list = await officer.get('/requests', { params: { status: 'CANCELLED', limit: 50 } });
    const rows = Array.isArray(list.data?.data) ? list.data.data : Array.isArray(list.data) ? list.data : [];
    push(rows.length >= 1, 'history list has cancelled', `count=${rows.length}`);
    const withReason = rows.filter((r) => r.cancellationReason);
    push(withReason.length >= 1, 'history rows include reason', `withReason=${withReason.length}`);
  } catch (e) {
    push(false, 'history list', e.message);
  }

  // ========== Unauthenticated ==========
  try {
    const bare = axios.create({ baseURL: BASE, validateStatus: () => true });
    const res = await bare.patch('/requests/1/cancel', { reason: 'x' });
    push(res.status === 401, 'unauthenticated blocked', `HTTP ${res.status}`);
  } catch (e) {
    push(false, 'unauthenticated', e.message);
  }

  finish();
}

function finish() {
  const pass = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log('\n=== SUMMARY ===');
  console.log(`Total: ${pass + fail}, Passed: ${pass}, Failed: ${fail}`);
  results.filter((r) => !r.ok).forEach((f) => console.log(`  - ${f.label}: ${f.detail}`));
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e.response?.data || e.message);
  process.exit(1);
});
