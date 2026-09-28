const bcrypt = require('bcrypt');

const hashes = {
  officer1: '$2b$10$kz1IobB26m3z3IKXRkLSUen.ZEwlneWuaOouszyGS.WHoHY8v3KVu',
  driver1: '$2b$10$34gYsZuYWoHVdVex5xZJHeY5S8hDyu/rQ3rSA7NxltROpRnwIH5Ke',
  driver2: '$2b$10$eAys.EoIOwELPvhhtr/NkebPL1DMAlpYzIrq2nMufNiHCCH2u1M/G',
  transport1: '$2b$10$BCV/wanpoP3p6ESYQwyUuO02wTVmcQbmrZO/JkRb2XuiVBcDwsDOm',
  hpmu1: '$2b$10$IZsvFuiJq0QQorA/ZPcjBOgP01AZqT3n1RKwFnZiIb4RGCUfHLimS',
  r3approver1: '$2b$10$gjExEftgmVVqeIKvBJxOqOVWxacJzHcfq1hFNjx8.EJ79A2jRs3Hm',
  nest1: '$2b$10$NT4WYuttEzyxLRwumyDEIOmzKCYVXGWedD5eS9x4ztUS1vJFkZev2'
};

const passwords = ['Officer@123', 'Driver@123', 'Transport@123', 'HPMU@123', 'R3@123', 'Nest@123', 'Password123!'];

async function test() {
  for (const [user, hash] of Object.entries(hashes)) {
    for (const p of passwords) {
      const match = await bcrypt.compare(p, hash);
      if (match) console.log(user, '->', p);
    }
  }
}
test();