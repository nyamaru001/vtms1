const sequelize = require('../config/database');

sequelize.query('SELECT u.id, u.username, u.full_name, u.role, u.status, d.id as driver_id, d.user_id, d.license_number, d.status as driver_status FROM users u LEFT JOIN drivers d ON u.id = d.user_id WHERE u.role = "DRIVER"').then(([results]) => {
  console.log('DRIVER users and their profiles:');
  results.forEach(r => console.log(' -', r.username, '(', r.full_name, ') - driver_id:', r.driver_id, 'user_id:', r.user_id, 'license:', r.license_number, 'driver_status:', r.driver_status, 'user_status:', r.status));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });