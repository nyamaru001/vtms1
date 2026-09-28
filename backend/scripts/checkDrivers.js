const sequelize = require('../config/database');

sequelize.query('SELECT u.id, u.username, u.full_name, u.role, d.id as driver_id, d.user_id, d.license_number FROM users u LEFT JOIN drivers d ON u.id = d.user_id WHERE u.role = "DRIVER"').then(([results]) => {
  console.log('DRIVER users and their profiles:');
  results.forEach(r => console.log(' -', r.username, '(', r.full_name, ') - driver_id:', r.driver_id, 'user_id:', r.user_id, 'license:', r.license_number));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });