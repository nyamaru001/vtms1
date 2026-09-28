const {sequelize, User, Vehicle, Driver, VehicleRequest, Trip, FuelRequest, Logbook, Notification, AuditLog, HPMURecommendation, R3Approval} = require('./models');

async function testModels() {
  try {
    await sequelize.authenticate();
    console.log('Database connection: OK');
    
    // Count tables
    const tables = ['users', 'drivers', 'vehicles', 'vehicle_requests', 'trips', 'fuel_requests', 'logbooks', 'hpmu_recommendations', 'r3_approvals', 'trip_locations', 'notifications', 'audit_logs'];
    
    for (const table of tables) {
      const [results] = await sequelize.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`${table}: ${results[0].count} records`);
    }
    
    // Test creating a user
    const user = await User.create({
      fullName: 'Test Officer',
      username: 'testofficer',
      email: 'test@test.com',
      phone: '0712345678',
      role: 'OFFICER',
      status: 'ACTIVE'
    });
    console.log('User created:', user.id, user.role);
    await user.destroy();
    
    console.log('All model tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('Model test failed:', err.message);
    process.exit(1);
  }
}

testModels();