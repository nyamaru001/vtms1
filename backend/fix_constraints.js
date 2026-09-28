require('dotenv').config();
const sequelize = require('./config/database');

async function fix() {
  try {
    // Check current column definition
    const [cols] = await sequelize.query(
      "SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fuel_issue_logs' AND COLUMN_NAME = 'fuel_request_id'"
    );
    console.log('Current fuel_request_id:', cols[0]);
    
    if (cols[0] && cols[0].IS_NULLABLE === 'NO') {
      // Fix to allow NULL
      await sequelize.query(
        "ALTER TABLE fuel_issue_logs MODIFY COLUMN fuel_request_id INT NULL"
      );
      console.log('Fixed: fuel_request_id now allows NULL');
    } else {
      console.log('Already allows NULL or column not found');
    }
    
    // Check extra_fuel_request_id too
    const [cols2] = await sequelize.query(
      "SELECT COLUMN_NAME, IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fuel_issue_logs' AND COLUMN_NAME = 'extra_fuel_request_id'"
    );
    console.log('Current extra_fuel_request_id:', cols2[0]);
    
    // Also check for any FK constraints on fuel_issue_logs
    const [constraints] = await sequelize.query(
      "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fuel_issue_logs' AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
    );
    console.log('FK constraints on fuel_issue_logs:', constraints.map(c => c.CONSTRAINT_NAME));
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

fix();
