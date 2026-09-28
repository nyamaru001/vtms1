const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, authorize('HPMU'));

/*
|--------------------------------------------------------------------------
| NEST ROUTES REMOVED
|--------------------------------------------------------------------------
| The NEST role and all NEST recommendation routes have been removed.
| Use /api/hpmu for all fuel and extra fuel review operations.
|--------------------------------------------------------------------------
*/

router.all('*', (req, res) => {
  return res.status(410).json({
    message: 'The NEST review workflow has been removed. Use /api/hpmu instead.',
  });
});

module.exports = router;
