require('dotenv').config();
const sequelize = require('./config/database');

async function migrate() {
  const qi = sequelize.getQueryInterface();
  
  try {
    // Check if columns exist
    const tableDesc = await qi.describeTable('fuel_requests');
    
    if (!tableDesc.request_type) {
      await qi.addColumn('fuel_requests', 'request_type', {
        type: require('sequelize').DataTypes.ENUM('NORMAL', 'EMERGENCY'),
        allowNull: false,
        defaultValue: 'NORMAL',
      });
      console.log('Added request_type column');
    } else {
      console.log('request_type already exists');
    }

    if (!tableDesc.emergency_reason) {
      await qi.addColumn('fuel_requests', 'emergency_reason', {
        type: require('sequelize').DataTypes.TEXT,
        allowNull: true,
      });
      console.log('Added emergency_reason column');
    } else {
      console.log('emergency_reason already exists');
    }

    // Add indexes
    try {
      await qi.addIndex('fuel_requests', ['request_type'], { name: 'idx_fuel_requests_request_type' });
      console.log('Added index idx_fuel_requests_request_type');
    } catch (e) {
      console.log('Index idx_fuel_requests_request_type may already exist');
    }

    try {
      await qi.addIndex('fuel_requests', ['emergency_reason'], { name: 'idx_fuel_requests_emergency_reason', length: 100 });
      console.log('Added index idx_fuel_requests_emergency_reason');
    } catch (e) {
      console.log('Index idx_fuel_requests_emergency_reason may already exist');
    }

    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await sequelize.close();
  }
}

migrate();