/**
 * Clean Operational Data Script
 * 
 * Removes all demo/test operational data while preserving users and their credentials.
 * Cleans in foreign-key-safe order.
 */

const sequelize = require('../config/database');

async function cleanOperationalData() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('Starting operational data cleanup...');
    console.log('Preserving users table (all accounts, passwords, roles intact)\n');
    
    // Order: leaf tables first (tables that reference others but aren't referenced)
    // Then intermediate tables
    // Users table is NEVER touched
    
    const cleanupSteps = [
      // Level 1: Most dependent tables (referenced by nothing else)
      { table: 'audit_logs', description: 'Audit logs' },
      { table: 'notifications', description: 'Notifications' },
      { table: 'trip_locations', description: 'Trip GPS locations' },
      { table: 'trip_events', description: 'Trip events/changes' },
      { table: 'trip_completions', description: 'Trip completion records' },
      { table: 'fuel_issue_logs', description: 'Fuel issue logs' },
      { table: 'logbooks', description: 'Driver logbooks' },
      { table: 'r3_approvals', description: 'R3 approvals' },
      { table: 'hpmu_recommendations', description: 'HPMU recommendations' },
      { table: 'request_activities', description: 'Request activity history' },
      { table: 'extra_fuel_requests', description: 'Extra fuel requests' },
      { table: 'fuel_requests', description: 'Fuel requests' },
      { table: 'assignment_histories', description: 'Assignment history' },
      { table: 'driver_fuel_entries', description: 'Driver fuel entries' },
      
      // Level 2: Core operational tables
      { table: 'trips', description: 'Trips' },
      { table: 'vehicle_requests', description: 'Vehicle requests' },
      
      // Level 3: Reference tables (but still operational)
      { table: 'drivers', description: 'Driver profiles' },
      { table: 'vehicles', description: 'Vehicles' },
    ];
    
    for (const step of cleanupSteps) {
      const { table, description } = step;
      
      try {
        // Get count before deletion
        const [countResult] = await sequelize.query(
          `SELECT COUNT(*) as count FROM \`${table}\``,
          { transaction }
        );
        const count = countResult[0]?.count || 0;
        
        if (count > 0) {
          await sequelize.query(`DELETE FROM \`${table}\``, { transaction });
          console.log(`  ✓ Cleared ${description} (${table}): ${count} records removed`);
        } else {
          console.log(`  - ${description} (${table}): already empty`);
        }
      } catch (err) {
        // If table doesn't exist or other issue, log and continue
        console.log(`  ⚠ ${description} (${table}): ${err.message}`);
      }
    }
    
    // Verify users are preserved
    const [userCount] = await sequelize.query(
      'SELECT COUNT(*) as count, GROUP_CONCAT(username) as usernames FROM `users`',
      { transaction }
    );
    console.log(`\n✓ Users preserved: ${userCount[0]?.count || 0} accounts`);
    console.log(`  Usernames: ${userCount[0]?.usernames || 'none'}`);
    
    await transaction.commit();
    console.log('\n✓ Operational data cleanup completed successfully!');
    
  } catch (err) {
    await transaction.rollback();
    console.error('\n✗ Cleanup failed:', err.message);
    throw err;
  }
}

// Run if called directly
if (require.main === module) {
  cleanOperationalData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { cleanOperationalData };