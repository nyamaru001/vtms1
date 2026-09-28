const sequelize = require('../config/database');
const { User, Driver } = require('../models');

async function fixDriverProfiles() {
  const transaction = await sequelize.transaction();
  
  try {
    // Find all users with DRIVER role who don't have a Driver profile
    const driverUsers = await User.findAll({
      where: { role: 'DRIVER' },
      transaction
    });
    
    console.log(`Found ${driverUsers.length} users with DRIVER role`);
    
    for (const user of driverUsers) {
      // Check if driver profile exists
      const existingDriver = await Driver.findOne({
        where: { userId: user.id },
        transaction
      });
      
      if (!existingDriver) {
        // Create driver profile with a placeholder license number
        await Driver.create({
          userId: user.id,
          licenseNumber: `AUTO-${user.id}-${Date.now()}`,
          licenseExpiry: null,
          status: 'AVAILABLE',
        }, { transaction });
        
        console.log(`Created Driver profile for user: ${user.username} (${user.fullName})`);
      } else {
        console.log(`Driver profile already exists for: ${user.username}`);
      }
    }
    
    await transaction.commit();
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    await transaction.rollback();
    console.error('Error:', err);
    process.exit(1);
  }
}

fixDriverProfiles();