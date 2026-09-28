const {sequelize, User} = require('./models');

async function test() {
  await sequelize.authenticate();
  const users = await User.findAll({attributes: ['id', 'fullName', 'username', 'role', 'status']});
  users.forEach(u => console.log(u.id, u.username, u.role, u.status));
}

test();