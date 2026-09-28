const sequelize = require('./config/database');
const { Op } = require('sequelize');
const { User, Vehicle, Driver, VehicleRequest, Trip, FuelRequest, Logbook, FuelIssueLog, TripLocation, TripEvent } = require('./models');

async function cleanup() {
  try {
    console.log('=== Starting Cleanup ===');
    
    // First, find all test trips and their IDs
    const testTrips = await Trip.findAll({ where: { tripNumber: { [Op.like]: 'TRIP-TEST-%' } } });
    const testTripIds = testTrips.map(t => t.id);
    console.log('Found test trips:', testTripIds);
    
    // Also find test vehicle requests
    const testVReqs = await VehicleRequest.findAll({ 
      where: { 
        [Op.or]: [
          { requestNumber: { [Op.like]: 'REQ-TEST-%' } },
          { requestNumber: 'REQ-2026-00006' },
          { requestNumber: 'REQ-2026-00007' },
          { requestNumber: 'REQ-2026-00008' }
        ] 
      } 
    });
    const testVReqIds = testVReqs.map(v => v.id);
    console.log('Found test vehicle requests:', testVReqIds);
    
    // Also include trip 13 (TRIP-TEST-001)
    const allTestTripIds = [...new Set([...testTripIds, 13])];
    console.log('All test trip IDs to clean:', allTestTripIds);
    
    // CORRECT ORDER: Delete child records first, then parents
    // Order: TripEvent, TripLocation, FuelIssueLog, Logbook, FuelRequest, Trip, VehicleRequest
    
    // 1. TripEvents for all test trips
    const eventsForTestTrips = await TripEvent.findAll({ where: { tripId: allTestTripIds } });
    const eventTestTripIds = eventsForTestTrips.map(e => e.id);
    console.log('Deleting trip events for test trips:', eventTestTripIds);
    if (eventTestTripIds.length > 0) {
      await TripEvent.destroy({ where: { id: eventTestTripIds } });
    }
    
    // 2. TripLocations for all test trips
    const locationsForTestTrips = await TripLocation.findAll({ where: { tripId: allTestTripIds } });
    const locationTestTripIds = locationsForTestTrips.map(l => l.id);
    console.log('Deleting trip locations for test trips:', locationTestTripIds);
    if (locationTestTripIds.length > 0) {
      await TripLocation.destroy({ where: { id: locationTestTripIds } });
    }
    
    // 3. FuelIssueLogs for all test trips
    const issueLogsForTestTrips = await FuelIssueLog.findAll({ where: { tripId: allTestTripIds } });
    const issueLogTestTripIds = issueLogsForTestTrips.map(i => i.id);
    console.log('Deleting fuel issue logs for test trips:', issueLogTestTripIds);
    if (issueLogTestTripIds.length > 0) {
      await FuelIssueLog.destroy({ where: { id: issueLogTestTripIds } });
    }
    
    // 4. Logbooks for all test trips
    const logbooksForTestTrips = await Logbook.findAll({ where: { tripId: allTestTripIds } });
    const logbookTestTripIds = logbooksForTestTrips.map(l => l.id);
    console.log('Deleting logbooks for test trips:', logbookTestTripIds);
    if (logbookTestTripIds.length > 0) {
      await Logbook.destroy({ where: { id: logbookTestTripIds } });
    }
    
    // 5. FuelRequests for all test trips
    const fuelForTestTrips = await FuelRequest.findAll({ where: { tripId: allTestTripIds } });
    const fuelTestTripIds = fuelForTestTrips.map(f => f.id);
    console.log('Deleting fuel requests for test trips:', fuelTestTripIds);
    if (fuelTestTripIds.length > 0) {
      await FuelRequest.destroy({ where: { id: fuelTestTripIds } });
    }
    
    // 6. Now delete the test trips (allTestTripIds)
    console.log('Deleting test trips:', allTestTripIds);
    if (allTestTripIds.length > 0) {
      await Trip.destroy({ where: { id: allTestTripIds } });
    }
    
    // 7. Now delete the test vehicle requests (they reference the trips)
    console.log('Deleting test vehicle requests:', testVReqIds);
    if (testVReqIds.length > 0) {
      await VehicleRequest.destroy({ where: { id: testVReqIds } });
    }
    
    console.log('=== Cleanup Complete ===');
    
    // Verify remaining data
    console.log('\n=== Remaining Data Counts ===');
    const usersCount = await User.count();
    const vehiclesCount = await Vehicle.count();
    const driversCount = await Driver.count();
    const vreqsCount = await VehicleRequest.count();
    const tripsCount = await Trip.count();
    const freqCount = await FuelRequest.count();
    const logbooksCount = await Logbook.count();
    const issueLogsCount = await FuelIssueLog.count();
    
    console.log('Users:', usersCount);
    console.log('Vehicles:', vehiclesCount);
    console.log('Drivers:', driversCount);
    console.log('VehicleRequests:', vreqsCount);
    console.log('Trips:', tripsCount);
    console.log('FuelRequests:', freqCount);
    console.log('Logbooks:', logbooksCount);
    console.log('FuelIssueLogs:', issueLogsCount);
    
    await sequelize.close();
  } catch (err) {
    console.error('Error:', err);
    await sequelize.close();
  }
}
cleanup();