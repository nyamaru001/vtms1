require('dotenv').config();
const bcrypt = require('bcrypt');
const sequelize = require('../config/database');
const { User } = require('../models');

async function seedAdmin() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database.');

    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error('ERROR: ADMIN_PASSWORD environment variable is required.');
      console.error('Set ADMIN_PASSWORD in your .env file before running this script.');
      process.exit(1);
    }

    if (adminPassword.length < 8) {
      console.error('ERROR: ADMIN_PASSWORD must be at least 8 characters.');
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    const [user, created] = await User.findOrCreate({
      where: { username: adminUsername },
      defaults: {
        fullName: 'System Administrator',
        username: adminUsername,
        email: process.env.ADMIN_EMAIL || 'admin@vtms.local',
        phone: null,
        role: 'ADMIN',
        passwordHash,
        status: 'ACTIVE',
      },
    });

    if (created) {
      console.log(`✅ Admin user created successfully.`);
      console.log(`   Username: ${adminUsername}`);
      console.log(`   Role: ADMIN`);
      console.log(`   Status: ACTIVE`);
    } else {
      console.log(`ℹ️ Admin user already exists: ${adminUsername}`);
      console.log(`   Updating password and ensuring ADMIN role...`);
      
      await user.update({
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE',
        fullName: 'System Administrator',
      });
      console.log(`✅ Admin user updated.`);
    }

    await sequelize.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Admin seeding failed:', err.message);
    await sequelize.close();
    process.exit(1);
  }
}

seedAdmin();