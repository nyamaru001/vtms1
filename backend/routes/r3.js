const express = require('express');

const {
  VehicleRequest,
  R3Approval,
  User,
} = require('../models');

const {
  authenticate,
  authorize,
} = require('../middleware/auth');

const {
  logAction,
} = require('../services/auditService');

const {
  notify,
} = require('../services/notificationService');

const { recordActivity } = require('../services/activityService');

const router = express.Router();

router.use(authenticate, authorize('R3'));

/*
=========================================================
R3 VEHICLE REQUEST DECISION
POST /api/r3/:requestId/decide

R3 is the approval gate before Transport Officer assignment.
=========================================================
*/

router.post('/:requestId/decide', async (req, res, next) => {
  try {
    const requestId = Number(req.params.requestId);
    const { decision, comment } = req.body;

    if (!Number.isInteger(requestId)) {
      return res.status(400).json({
        message: 'Invalid request ID.',
      });
    }

    if (!['APPROVE', 'REJECT', 'RETURN'].includes(decision)) {
      return res.status(400).json({
        message: 'Invalid R3 decision. Must be APPROVE, REJECT, or RETURN.',
      });
    }

    if (
      (decision === 'REJECT' || decision === 'RETURN') &&
      (!comment || !String(comment).trim())
    ) {
      return res.status(400).json({
        message: 'Comment is required for Reject or Return.',
      });
    }

    const vehicleRequest = await VehicleRequest.findByPk(requestId);

    if (!vehicleRequest) {
      return res.status(404).json({
        message: 'Vehicle request not found.',
      });
    }

    // R3 reviews requests in R3_REVIEW status
    if (vehicleRequest.status !== 'R3_REVIEW') {
      return res.status(400).json({
        message: `This request is not awaiting R3 review. Current status: ${vehicleRequest.status}`,
      });
    }

    // R3 APPROVED → moves to TRANSPORT_REVIEW for vehicle/driver assignment
    // R3 REJECTED → stays at R3_REJECTED
    // R3 RETURNED → goes back to R3_RETURNED
    let nextStatus = 'TRANSPORT_REVIEW';

    if (decision === 'REJECT') {
      nextStatus = 'R3_REJECTED';
    }

    if (decision === 'RETURN') {
      nextStatus = 'R3_RETURNED';
    }

    const approval = await R3Approval.create({
      requestId: vehicleRequest.id,
      reviewedBy: req.user.id,
      decision,
      comment: comment ? String(comment).trim() : null,
    });

    await vehicleRequest.update({
      status: nextStatus,
    });

    await logAction({
      userId: req.user.id,
      action: 'R3_DECISION',
      entity: 'VehicleRequest',
      entityId: vehicleRequest.id,
      description: `R3 decision ${decision} for vehicle request ${vehicleRequest.requestNumber || vehicleRequest.id}`,
      ipAddress: req.ip,
    });

    await recordActivity({
      requestId: vehicleRequest.id,
      actorId: req.user.id,
      actorRole: 'R3',
      action: `R3_${decision}`,
      fromStatus: 'R3_REVIEW',
      toStatus: nextStatus,
      comment: comment ? String(comment).trim() : null,
    });

    // Notify officer
    if (vehicleRequest.officerId) {
      await notify(
        vehicleRequest.officerId,
        `Vehicle request ${nextStatus.replace('R3_', '')}`,
        `Your vehicle request ${vehicleRequest.requestNumber || vehicleRequest.id} has been ${nextStatus.toLowerCase().replace('r3_', '')} by R3.`,
        `/officer/requests/${vehicleRequest.id}`
      );
    }

    // If approved, notify Transport Officers for assignment
    if (decision === 'APPROVE') {
      const transportOfficers = await User.findAll({
        where: { role: 'TRANSPORT_OFFICER', status: 'ACTIVE' },
      });

      await Promise.all(
        transportOfficers.map((user) =>
          notify(
            user.id,
            'Vehicle request approved by R3 - assignment required',
            `Vehicle request ${vehicleRequest.requestNumber || vehicleRequest.id} has been approved by R3 and is ready for vehicle/driver assignment.`,
            `/transport/requests/${vehicleRequest.id}`
          )
        )
      );
    }

    return res.json({
      success: true,
      message: `Vehicle request ${decision.toLowerCase()} successfully.`,
      decision,
      status: nextStatus,
      approval,
      request: vehicleRequest,
    });
  } catch (err) {
    console.error('R3 decision error:', err);
    next(err);
  }
});

module.exports = router;