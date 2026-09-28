const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const {
  authenticate,
  signTrainingSession,
  TRAINING_ROLES,
} = require('../middleware/auth');
const { logAction } = require('../services/auditService');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    if (user.status !== 'ACTIVE') {
      return res.status(403).json({ message: 'Your account is deactivated. Contact your Transport Officer.' });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    await logAction({
      userId: user.id, action: 'LOGIN', entity: 'User', entityId: user.id,
      description: `${user.username} logged in`, ipAddress: req.ip,
    });

    res.json({
      token,
      user: {
        id: user.id, fullName: user.fullName, username: user.username,
        email: user.email, role: user.role, profilePhoto: user.profilePhoto,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    const account = req.authUser || req.user;
    await logAction({
      userId: account.id, action: 'LOGOUT', entity: 'User', entityId: account.id,
      description: `${account.username} logged out`, ipAddress: req.ip,
    });
    res.json({ message: 'Logged out.' });
  } catch (err) {
    next(err);
  }
});

/*
|--------------------------------------------------------------------------
| ADMIN TRAINING SESSIONS
|--------------------------------------------------------------------------
| The Administrator keeps their own JWT. Starting a session only mints a
| backend-signed training token that tells the API "this Administrator is
| training in the PORTAL portal". No account is impersonated, no password
| is read, and no user record is modified.
|--------------------------------------------------------------------------
*/

router.post('/training/session', authenticate, async (req, res) => {
  const account = req.authUser || req.user;

  if (!account || account.role !== 'ADMIN') {
    return res.status(403).json({
      message: 'Only administrators can start a training session.',
    });
  }

  const portal = String(req.body?.portal || '').trim().toUpperCase();

  if (!portal) {
    return res.status(400).json({ message: 'Training portal is required.' });
  }

  if (!TRAINING_ROLES.includes(portal)) {
    return res.status(400).json({
      message: `Unknown training portal "${portal}". Allowed portals: ${TRAINING_ROLES.join(', ')}.`,
    });
  }

  const trainingToken = signTrainingSession(account, portal);

  await logAction({
    userId: account.id,
    action: 'TRAINING_SESSION_START',
    entity: 'TrainingSession',
    entityId: account.id,
    description: `${account.username} started an administrator training session for the ${portal} portal`,
    ipAddress: req.ip,
  });

  return res.json({
    portal,
    trainingToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    message: `Training session started for the ${portal} portal.`,
  });
});

/*
|--------------------------------------------------------------------------
| CURRENT USER
| Always returns the authenticated account. During training the
| Administrator stays an Administrator; the training portal is carried
| separately so protected /admin routes keep working after a refresh.
|--------------------------------------------------------------------------
*/

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const account = req.authUser || req.user;
    const user = await User.findByPk(account.id, {
      attributes: ['id', 'fullName', 'username', 'email', 'phone', 'role', 'profilePhoto', 'status', 'createdAt'],
    });

    if (!user) {
      return res.status(401).json({ message: 'Account not found. Please log in again.' });
    }

    const body = user.toJSON();
    body.training = req.isTraining
      ? { active: true, portal: req.trainingContext }
      : null;

    res.json(body);
  } catch (err) {
    next(err);
  }
});

// Self-service password change
router.put('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }
    const user = await User.findByPk(req.user.id);
    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(newPassword, salt);
    await user.save();
    await logAction({
      userId: user.id, action: 'CHANGE_PASSWORD', entity: 'User', entityId: user.id,
      description: `${user.username} changed their password`, ipAddress: req.ip,
    });
    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
});

// Username changes are intentionally not allowed.
// Account usernames are managed by administrators only.
router.put('/change-username', authenticate, async (req, res) => {
  return res.status(403).json({
    message: 'Username changes are not allowed. Contact an administrator.',
  });
});

module.exports = router;
