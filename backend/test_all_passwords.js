const bcrypt = require('bcrypt');

async function testPassword() {
  const hashes = {
    'driver1': '$2b$10$ioObllU6bRT3aESX/KwMqecS3JoLfnlXqsjQKMGL9RBCzuE6scqc6',
    'officer1': '$2b$10$qcr1j5rQ2AxD1D5NfcsyJO4CilP3VOZG4MgxVq5WVmUIjfyulhrp2',
    'admin': '$2b$10$bLzMzNikhHX0MAbRC2LXA.T6KniU6pbPcDrL05s3zi3XInQ2PDNce',
  };
  
  const passwords = ['Password123!', 'driver123', 'officer123', 'admin123', 'admin'];
  
  for (const [user, hash] of Object.entries(hashes)) {
    console.log(`\nTesting ${user}:`);
    for (const pwd of passwords) {
      const result = await bcrypt.compare(pwd, hash);
      if (result) console.log(`  ✓ ${pwd}`);
    }
  }
}

testPassword().catch(console.error);