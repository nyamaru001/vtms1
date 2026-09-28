const bcrypt = require('bcrypt');

async function testPassword() {
  const hash = '$2b$10$ioObllU6bRT3aESX/KwMqecS3JoLfnlXqsjQKMGL9RBCzuE6scqc6'; // driver1
  const result = await bcrypt.compare('Password123!', hash);
  console.log('Password123! matches:', result);
  
  const result2 = await bcrypt.compare('driver123', hash);
  console.log('driver123 matches:', result2);
  
  const result3 = await bcrypt.compare('driver1', hash);
  console.log('driver1 matches:', result3);
}

testPassword().catch(console.error);