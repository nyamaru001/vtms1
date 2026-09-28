require('dotenv').config();
const { Op } = require('sequelize');
const sequelize = require('./config/database');
const { Driver, User } = require('./models');

async function fix() {
  try {
    const drivers = await Driver.findAll({
      include: [{ model: User, as: 'user', attributes: ['id', 'fullName', 'username'] }],
    });
    console.log('All drivers:');
    for (const d of drivers) {
      console.log(`  ID: ${d.id}, Name: ${d.user?.fullName}, Status: ${d.status}, Vehicle: ${d.assignedVehicleId}`);
    }

    const [count] = await Driver.update(
      { status: 'AVAILABLE', assignedVehicleId: null },
      { where: { status: { [Op.in]: ['ASSIGNED', 'ON_TRIP'] } } }
    );
    console.log(`Reset ${count} drivers to AVAILABLE`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

fix();
