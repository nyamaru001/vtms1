require('dotenv').config();
const sequelize = require('./config/database');

async function migrate() {
  const qi = sequelize.getQueryInterface();
  
  try {
    // Check if columns exist
    const tableDesc = await qi.describeTable('trips');
    
    if (!tableDesc.trip_type) {
      await qi.addColumn('trips', 'trip_type', {
        type: require('sequelize').DataTypes.ENUM('NORMAL', 'EMERGENCY'),
        allowNull: false,
        defaultValue: 'NORMAL',
      });
      console.log('Added trip_type column');
    } else {
      console.log('trip_type already exists');
    }

    if (!tableDesc.emergency_reason) {
      await qi.addColumn('trips', 'emergency_reason', {
        type: require('sequelize').DataTypes.TEXT,
        allowNull: true,
      });
      console.log('Added emergency_reason column');
    } else {
      console.log('emergency_reason already exists');
    }

    if (!tableDesc.emergency_notes) {
      await qi.addColumn('trips', 'emergency_notes', {
        type: require('sequelize').DataTypes.TEXT,
        allowNull: true,
      });
      console.log('Added emergency_notes column');
    } else {
      console.log('emergency_notes already exists');
    }

    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await sequelize.close();
  }
}

migrate();
