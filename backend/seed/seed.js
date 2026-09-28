require('dotenv').config();
const bcrypt = require('bcrypt');
const sequelize = require('../config/database');
const { User, Driver, Vehicle } = require('../models');

// This script is only for initial admin setup.
async function seed() {
  await sequelize.sync();

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@vtms.local';
  const adminFullName = process.env.ADMIN_FULL_NAME || 'System Admin';

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const [admin, created] = await User.findOrCreate({
    where: { username: adminUsername },
    defaults: {
      fullName: adminFullName,
      email: adminEmail,
      role: 'ADMIN',
      passwordHash,
    },
  });

  if (!created) {
    await admin.update({ passwordHash, fullName: adminFullName, email: adminEmail });
  }

  console.log('Seed complete.');
  console.log(`Admin user: ${adminUsername} / ${adminPassword}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
