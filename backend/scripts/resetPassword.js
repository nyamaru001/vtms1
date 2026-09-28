require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcrypt');
const sequelize = require('../config/database');
const { User } = require('../models');

const USERNAME = process.argv[2];
const PASSWORD = process.argv[3] || 'Password123!';

(async () => {
  if (!USERNAME) {
    console.error('Usage: node resetPassword.js <username> [password]');
    process.exit(1);
  }
  await sequelize.authenticate();
  const user = await User.findOne({ where: { username: USERNAME } });
  if (!user) {
    console.error('User not found:', USERNAME);
    process.exit(1);
  }
  user.passwordHash = await bcrypt.hash(PASSWORD, 10);
  await user.save();
  console.log(`Reset password for ${USERNAME} (${user.role})`);
  await sequelize.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
