import api from './api';

export const usersApi = {
  list: (params) => api.get('/users', { params }).then((r) => r.data),
  get: (id) => api.get(`/users/${id}`).then((r) => r.data),
  create: (data) => api.post('/users', data).then((r) => r.data),
  update: (id, data) => api.put(`/users/${id}`, data).then((r) => r.data),
  setStatus: (id, status) => api.patch(`/users/${id}/status`, { status }).then((r) => r.data),
  resetPassword: (id, newPassword) => api.post(`/users/${id}/reset-password`, { newPassword }).then((r) => r.data),
  remove: (id) => api.delete(`/users/${id}`).then((r) => r.data),
};

export const vehiclesApi = {
  list: (params) => api.get('/vehicles', { params }).then((r) => r.data),
  available: () => api.get('/vehicles/available').then((r) => r.data),
  get: (id) => api.get(`/vehicles/${id}`).then((r) => r.data),
  create: (data) => api.post('/vehicles', data).then((r) => r.data),
  update: (id, data) => api.put(`/vehicles/${id}`, data).then((r) => r.data),
  setStatus: (id, status) => api.patch(`/vehicles/${id}/status`, { status }).then((r) => r.data),
  remove: (id) => api.delete(`/vehicles/${id}`).then((r) => r.data),
};

export const driversApi = {
  list: (params) => api.get('/drivers', { params }).then((r) => r.data),
  available: () => api.get('/drivers/available').then((r) => r.data),
  get: (id) => api.get(`/drivers/${id}`).then((r) => r.data),
  profile: () => api.get('/drivers/profile').then((r) => r.data),
  update: (id, data) => api.put(`/drivers/${id}`, data).then((r) => r.data),
  setStatus: (id, status) => api.patch(`/drivers/${id}/status`, { status }).then((r) => r.data),
};

export const requestsApi = {
  list: (params) => api.get('/requests', { params }).then((r) => r.data),
  get: (id) => api.get(`/requests/${id}`).then((r) => r.data),
  create: (data) => api.post('/requests', data).then((r) => r.data),
  cancel: (id, reason) => api.patch(`/requests/${id}/cancel`, { reason }).then((r) => r.data),
  recalculate: (id) => api.post(`/requests/${id}/recalculate`).then((r) => r.data),
  assign: (id, data) => api.post(`/requests/${id}/assign`, data).then((r) => r.data),
  returnToOfficer: (id, comment) => api.patch(`/requests/${id}/return`, { comment }).then((r) => r.data),
  fuelPreview: (id, vehicleId) => api.get(`/requests/${id}/fuel-preview`, { params: { vehicleId } }).then((r) => r.data),
};

export const r3Api = {
  decide: (requestId, decision, comment) =>
    api.post(`/r3/${requestId}/decide`, { decision, comment }).then((r) => r.data),
};

export const timelineApi = {
  get: (requestId) => api.get(`/requests/${requestId}/timeline`).then((r) => r.data),
  activities: (requestId) => api.get(`/requests/${requestId}/activities`).then((r) => r.data),
};

export const driverFuelApi = {
  list: (params) => api.get('/driver-fuel', { params }).then((r) => r.data),
  create: (formData) =>
    api.post('/driver-fuel', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  remove: (id) => api.delete(`/driver-fuel/${id}`).then((r) => r.data),
};

export const hpmuApi = {
  decide: (requestId, decision, comment) =>
    api.post(`/hpmu/${requestId}/decide`, { decision, comment }).then((r) => r.data),
  release: (requestId, litresReleased, comment, extra = {}) =>
    api.post(`/hpmu/${requestId}/release`, { litresReleased, comment, ...extra }).then((r) => r.data),
  releaseExtra: (requestId, litresReleased, comment) =>
    api.post(`/hpmu/extra/${requestId}/release`, { litresReleased, comment }).then((r) => r.data),
  fuelLogbook: () => api.get('/hpmu/fuel-logbook').then((r) => r.data),
};

export const tripsApi = {
  list: () => api.get('/trips').then((r) => r.data),
  get: (id) => api.get(`/trips/${id}`).then((r) => r.data),
  createFromRequest: (requestId) => api.post(`/trips/from-request/${requestId}`).then((r) => r.data),
  start: (id, data) => api.post(`/trips/${id}/start`, data).then((r) => r.data),
  updateLocation: (id, data) => api.post(`/trips/${id}/location`, data).then((r) => r.data),
  complete: (id, data) => api.post(`/trips/${id}/complete`, data).then((r) => r.data),
  close: (id) => api.post(`/trips/${id}/close`).then((r) => r.data),
  route: (id) => api.get(`/trips/${id}/route`).then((r) => r.data),
  locations: (id) => api.get(`/trips/${id}/locations`).then((r) => r.data),
  progress: (id) => api.get(`/trips/${id}/progress`).then((r) => r.data),
  accept: (id) => api.post(`/trips/${id}/accept`).then((r) => r.data),
  rejectAssignment: (id, data) => api.post(`/trips/${id}/reject-assignment`, data).then((r) => r.data),
  cancelAssignment: (id, data) => api.post(`/trips/${id}/cancel-assignment`, data).then((r) => r.data),
  emergencyStart: (id, data) => api.post(`/trips/${id}/emergency-start`, data).then((r) => r.data),
  cancel: (id, data) => api.post(`/trips/${id}/cancel`, data).then((r) => r.data),
  endTrip: (id, data) => api.post(`/trips/${id}/end-trip`, data).then((r) => r.data),
  confirmCompletion: (id, data) => api.post(`/trips/${id}/confirm-completion`, data).then((r) => r.data),
  completions: (id) => api.get(`/trips/${id}/completions`).then((r) => r.data),
  events: (id) => api.get(`/trips/${id}/events`).then((r) => r.data),
  reportEvent: (id, data) => api.post(`/trips/${id}/events`, data).then((r) => r.data),
};

export const fuelApi = {
  list: (params) => api.get('/fuel', { params }).then((r) => r.data),
  get: (id) => api.get(`/fuel/${id}`).then((r) => r.data),
  calc: (tripId) => api.get(`/fuel/calc/${tripId}`).then((r) => r.data),
  create: (data) => api.post('/fuel', data).then((r) => r.data),
  complete: (id) => api.patch(`/fuel/${id}/complete`).then((r) => r.data),
  createExtra: (data) => api.post('/fuel/extra', data).then((r) => r.data),
  confirmReceipt: (id, data) => api.patch(`/fuel/${id}/confirm-receipt`, data).then((r) => r.data),
  createAdditional: (data) => api.post('/fuel/additional', data).then((r) => r.data),
};

export const logbooksApi = {
  list: (params) => api.get('/logbooks', { params }).then((r) => r.data),
  get: (id) => api.get(`/logbooks/${id}`).then((r) => r.data),
  create: (data) => api.post('/logbooks', data).then((r) => r.data),
  createFromTrip: (tripId) => api.post(`/logbooks/from-trip/${tripId}`).then((r) => r.data),
  update: (id, data) => api.put(`/logbooks/${id}`, data).then((r) => r.data),
  submit: (id) => api.post(`/logbooks/${id}/submit`).then((r) => r.data),
  remove: (id) => api.delete(`/logbooks/${id}`).then((r) => r.data),
  verify: (id, decision, comment) => api.post(`/logbooks/${id}/verify`, { decision, comment }).then((r) => r.data),
};

export const driverReportsApi = {
  get: (params) => api.get('/driver/reports', { params }).then((r) => r.data),
};

export const notificationsApi = {
  list: () => api.get('/notifications').then((r) => r.data),
  markRead: (id) => api.patch(`/notifications/${id}/read`).then((r) => r.data),
  markAllRead: () => api.patch('/notifications/read-all').then((r) => r.data),
  remove: (id) => api.delete(`/notifications/${id}`).then((r) => r.data),
};

export const reportsApi = {
  summary: (params) => api.get('/reports/summary', { params }).then((r) => r.data),
  vehicleUsage: () => api.get('/reports/vehicle-usage').then((r) => r.data),
  driverPerformance: () => api.get('/reports/driver-performance').then((r) => r.data),
  fuel: (params) => api.get('/reports/fuel', { params }).then((r) => r.data),
};

export const statsApi = {
  get: () => api.get('/stats').then((r) => r.data),
};

export const auditApi = {
  list: (params) => api.get('/audit', { params }).then((r) => r.data),
};

export const adminApi = {
  stats: () => api.get('/admin/stats').then((r) => r.data),
  monitoring: () => api.get('/admin/monitoring').then((r) => r.data),
  users: {
    list: (params) => api.get('/users', { params }).then((r) => r.data),
    get: (id) => api.get(`/users/${id}`).then((r) => r.data),
    create: (data) => api.post('/users', data).then((r) => r.data),
    update: (id, data) => api.put(`/users/${id}`, data).then((r) => r.data),
    setStatus: (id, status) => api.patch(`/users/${id}/status`, { status }).then((r) => r.data),
    resetPassword: (id, newPassword) => api.post(`/users/${id}/reset-password`, { newPassword }).then((r) => r.data),
    remove: (id) => api.delete(`/users/${id}`).then((r) => r.data),
  },
  drivers: {
    list: (params) => api.get('/drivers', { params }).then((r) => r.data),
    available: () => api.get('/drivers/available').then((r) => r.data),
    get: (id) => api.get(`/drivers/${id}`).then((r) => r.data),
    update: (id, data) => api.put(`/drivers/${id}`, data).then((r) => r.data),
    setStatus: (id, status) => api.patch(`/drivers/${id}/status`, { status }).then((r) => r.data),
  },
  vehicles: {
    list: (params) => api.get('/vehicles', { params }).then((r) => r.data),
    available: () => api.get('/vehicles/available').then((r) => r.data),
    get: (id) => api.get(`/vehicles/${id}`).then((r) => r.data),
    create: (data) => api.post('/vehicles', data).then((r) => r.data),
    update: (id, data) => api.put(`/vehicles/${id}`, data).then((r) => r.data),
    setStatus: (id, status) => api.patch(`/vehicles/${id}/status`, { status }).then((r) => r.data),
    remove: (id) => api.delete(`/vehicles/${id}`).then((r) => r.data),
  },
};
