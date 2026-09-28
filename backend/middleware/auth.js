const jwt = require('jsonwebtoken');
const { User, Driver } = require('../models');

/**
 * Portals an Administrator may open in Training Mode.
 * Training never changes account credentials - it only opens a
 * backend-authorized training context for the selected portal.
 */
const TRAINING_ROLES = ['OFFICER', 'DRIVER', 'TRANSPORT_OFFICER', 'R3', 'NEST', 'HPMU'];

const TRAINING_HEADER = 'x-training-token';

/* =========================================================
   TRAINING SESSION TOKEN
   Signed by the backend after an Administrator starts a
   training session. The Administrator stays authenticated
   with their own JWT - the training token only adds a
   server-verified training context.
========================================================= */

function signTrainingSession(adminUser, portal) {
  return jwt.sign(
    {
      training: true,
      portal,
      adminId: adminUser.id,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

/* =========================================================
   TRAINING IDENTITY
   Resolves a representative, read-only "act as" identity for
   the selected portal so the real portal pages can load real
   database data. No credentials are read or modified.
========================================================= */

async function resolveTrainingIdentity(portal, adminUser) {
  if (portal === 'DRIVER') {
    const driver =
      (await Driver.findOne({ where: { status: 'AVAILABLE' }, order: [['id', 'ASC']] })) ||
      (await Driver.findOne({ order: [['id', 'ASC']] }));

    if (driver) {
      return { id: driver.userId, role: 'DRIVER', trainingDriverId: driver.id };
    }

    // No driver profile exists - keep the session usable (empty data).
    return { id: adminUser.id, role: 'DRIVER', trainingDriverId: null };
  }

  const representative = await User.findOne({
    where: { role: portal, status: 'ACTIVE' },
    order: [['id', 'ASC']],
  });

  if (representative) {
    return { id: representative.id, role: portal, trainingDriverId: null };
  }

  // No active user with this role (e.g. NEST was retired) - the
  // Administrator still enters the portal, with empty role-scoped data.
  return { id: adminUser.id, role: portal, trainingDriverId: null };
}

/* =========================================================
   TRAINING SAFETY
   Training Mode opens real portal pages, so destructive or
   account-level writes are refused while a training session
   is active. Production data can never be deleted from
   training, and accounts/passwords can never be modified.
========================================================= */

const TRAINING_MUTATION_BLOCKLIST = [
  '/api/users',
  '/api/drivers',
  '/api/auth/change-password',
  '/api/auth/change-username',
  '/api/admin',
];

function trainingWriteBlock(req) {
  if (!req.isTraining) return null;

  const method = String(req.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;

  if (method === 'DELETE') {
    return 'Records cannot be deleted during a training session. This action was blocked to protect production data.';
  }

  const path = String(req.originalUrl || req.url || '').split('?')[0];
  const blocked = TRAINING_MUTATION_BLOCKLIST.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`)
  );

  if (blocked) {
    return 'Account, password and user-management changes are disabled during a training session. This action was blocked to protect production data.';
  }

  return null;
}

/* =========================================================
   AUTHENTICATE
========================================================= */

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ message: 'Authentication required.' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
    }

    if (!payload || !payload.id) {
      return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
    }

    const user = await User.findByPk(payload.id);

    if (!user) {
      return res.status(401).json({ message: 'Account not found. Please log in again.' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ message: 'Account is not active. Contact your Transport Officer.' });
    }

    // The authenticated account (never replaced by training mode).
    req.authUser = {
      id: user.id,
      role: user.role,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
    };

    const trainingToken = req.headers[TRAINING_HEADER];

    if (trainingToken) {
      let trainingPayload;
      try {
        trainingPayload = jwt.verify(trainingToken, process.env.JWT_SECRET);
      } catch (err) {
        return res.status(401).json({
          message: 'Training session is invalid or expired. Re-enter training mode from the Admin Training portal.',
        });
      }

      if (!trainingPayload || trainingPayload.training !== true || !trainingPayload.portal) {
        return res.status(401).json({
          message: 'Training session is invalid or expired. Re-enter training mode from the Admin Training portal.',
        });
      }

      if (trainingPayload.adminId !== user.id) {
        return res.status(401).json({
          message: 'Training session does not belong to the signed-in administrator.',
        });
      }

      if (user.role !== 'ADMIN') {
        return res.status(403).json({ message: 'Only administrators can use training mode.' });
      }

      const portal = String(trainingPayload.portal).toUpperCase();
      if (!TRAINING_ROLES.includes(portal)) {
        return res.status(400).json({
          message: `Invalid training portal. Allowed portals: ${TRAINING_ROLES.join(', ')}.`,
        });
      }

      const identity = await resolveTrainingIdentity(portal, user);

      req.isTraining = true;
      req.trainingContext = portal;
      req.user = {
        id: identity.id,
        role: identity.role,
        fullName: user.fullName,
        username: user.username,
        isTraining: true,
        originalRole: user.role,
        originalUserId: user.id,
        trainingAdminId: user.id,
        trainingDriverId: identity.trainingDriverId,
      };
    } else {
      req.isTraining = false;
      req.trainingContext = null;
      req.user = {
        id: user.id,
        role: user.role,
        fullName: user.fullName,
        username: user.username,
      };
    }

    const blocked = trainingWriteBlock(req);
    if (blocked) {
      return res.status(403).json({ message: blocked });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired or invalid. Please log in again.' });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

// Only an Administrator running a training session may pass.
function requireTrainingMode(req, res, next) {
  if (!req.user || req.user.originalRole !== 'ADMIN' || !req.user.isTraining) {
    return res.status(403).json({ message: 'Training mode required. Only administrators can access this.' });
  }
  next();
}

module.exports = {
  authenticate,
  authorize,
  requireTrainingMode,
  signTrainingSession,
  TRAINING_ROLES,
  TRAINING_HEADER,
};
