const jwt = require('jsonwebtoken');

function initSockets(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required.'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.id;
      socket.userRole = payload.role;
      next();
    } catch (err) {
      next(new Error('Invalid session.'));
    }
  });

  io.on('connection', (socket) => {
    // Every user gets a personal room for notifications
    socket.join(`user:${socket.userId}`);

    // Transport Officer joins a room to see all active trips
    if (socket.userRole === 'TRANSPORT_OFFICER') {
      socket.join('transport:dashboard');
    }

    // R3 joins a room to see fuel decisions
    if (socket.userRole === 'R3') {
      socket.join('r3:dashboard');
    }

    // HPMU joins a room to see fuel reviews
    if (socket.userRole === 'HPMU') {
      socket.join('hpmu:dashboard');
    }

    socket.on('trip:subscribe', (tripId) => {
      socket.join(`trip:${tripId}`);
    });

    socket.on('trip:unsubscribe', (tripId) => {
      socket.leave(`trip:${tripId}`);
    });

    // Driver pushes their live location; broadcast to trip room + transport dashboard
    socket.on('trip:location:update', (payload) => {
      const { tripId, latitude, longitude } = payload || {};
      if (!tripId || latitude == null || longitude == null) return;
      const data = { tripId, latitude, longitude, timestamp: new Date().toISOString(), driverId: socket.userId };
      io.to(`trip:${tripId}`).emit('trip:location', data);
      io.to('transport:dashboard').emit('trip:location', data);
    });

    // Vehicle assigned notification
    socket.on('vehicle:assigned', (payload) => {
      const { requestId, driverId, vehicleId } = payload || {};
      if (requestId && driverId && vehicleId) {
        io.to(`user:${driverId}`).emit('vehicle:assigned', { requestId, driverId, vehicleId });
        io.to('transport:dashboard').emit('vehicle:assigned', { requestId, driverId, vehicleId });
      }
    });

    // Driver assigned notification
    socket.on('driver:assigned', (payload) => {
      const { requestId, driverId } = payload || {};
      if (requestId && driverId) {
        io.to(`user:${driverId}`).emit('driver:assigned', { requestId, driverId });
        io.to('transport:dashboard').emit('driver:assigned', { requestId, driverId });
      }
    });

    // Fuel submitted notification
    socket.on('fuel:submitted', (payload) => {
      const { fuelRequestId, tripNumber } = payload || {};
      if (fuelRequestId) {
        io.to('transport:dashboard').emit('fuel:submitted', { fuelRequestId, tripNumber });
      }
    });

    // Fuel forwarded to R3 notification
    socket.on('fuel:forwarded', (payload) => {
      const { fuelRequestId, tripNumber } = payload || {};
      if (fuelRequestId) {
        io.to('r3:dashboard').emit('fuel:forwarded', { fuelRequestId, tripNumber });
        io.to(`user:${socket.userId}`).emit('fuel:forwarded', { fuelRequestId, tripNumber });
      }
    });

    // HPMU review notification
    socket.on('hpmu:review', (payload) => {
      const { fuelRequestId, tripNumber } = payload || {};
      if (fuelRequestId) {
        io.to('hpmu:dashboard').emit('hpmu:review', { fuelRequestId, tripNumber });
      }
    });

    // HPMU decision submitted notification
    socket.on('hpmu:decision:submitted', (payload) => {
      const { fuelRequestId, tripNumber, decision } = payload || {};
      if (fuelRequestId) {
        io.to('r3:dashboard').emit('hpmu:decision:submitted', { fuelRequestId, tripNumber, decision });
        io.to('transport:dashboard').emit('hpmu:decision:submitted', { fuelRequestId, tripNumber, decision });
        io.to(`user:${socket.userId}`).emit('hpmu:decision:submitted', { fuelRequestId, tripNumber, decision });
      }
    });

    // R3 decision notification
    socket.on('r3:decision', (payload) => {
      const { fuelRequestId, tripNumber, decision } = payload || {};
      if (fuelRequestId) {
        io.to('driver:dashboard').emit('r3:decision', { fuelRequestId, tripNumber, decision });
        io.to('transport:dashboard').emit('r3:decision', { fuelRequestId, tripNumber, decision });
        io.to(`user:${socket.userId}`).emit('r3:decision', { fuelRequestId, tripNumber, decision });
      }
    });

    // Trip started notification
    socket.on('trip:started', (payload) => {
      const { tripId, driverId } = payload || {};
      if (tripId) {
        io.to('transport:dashboard').emit('trip:started', { tripId });
        io.to(`user:${driverId}`).emit('trip:started', { tripId });
      }
    });

    // Trip completed notification
    socket.on('trip:completed', (payload) => {
      const { tripId } = payload || {};
      if (tripId) {
        io.to('transport:dashboard').emit('trip:completed', { tripId });
      }
    });

    // Logbook submitted notification
    socket.on('logbook:submitted', (payload) => {
      const { logbookId, tripId } = payload || {};
      if (logbookId) {
        io.to('transport:dashboard').emit('logbook:submitted', { logbookId, tripId });
      }
    });

    // Logbook verified notification
    socket.on('logbook:verified', (payload) => {
      const { logbookId } = payload || {};
      if (logbookId) {
        io.to('transport:dashboard').emit('logbook:verified', { logbookId });
      }
    });

    socket.on('disconnect', () => {
      // no-op; rooms are cleaned up automatically
    });
  });
}

module.exports = initSockets;
