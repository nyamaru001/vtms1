const bcrypt = require('bcrypt');

async function testPassword() {
  const hash = '$2b$10$5.SOo7c0io8VNXRwmA8Wau50z6o.qqQb/m9tUwHNBIVGp1ZeZpgsC'; // hpmu1
  const result = await bcrypt.compare('Password123!', hash);
  console.log('Password123! matches:', result);
  
  const result2 = await bcrypt.compare('hpmu123', hash);
  console.log('hpmu123 matches:', result2);
}

testPassword().catch(console.error);