import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { RoleType } from '@prisma/client';
import * as staffController from '../controllers/staff.controller';

const router = Router();

// Queue Management
router.get(
  '/queue',
  authenticateJWT,
  authorizeRoles(RoleType.STAFF),
  staffController.getAssignedQueue
);

router.post(
  '/queue/call-next',
  authenticateJWT,
  authorizeRoles(RoleType.STAFF),
  staffController.callNextToken
);

router.post(
  '/queue/pause',
  authenticateJWT,
  authorizeRoles(RoleType.STAFF),
  staffController.pauseQueue
);

router.post(
  '/queue/resume',
  authenticateJWT,
  authorizeRoles(RoleType.STAFF),
  staffController.resumeQueue
);

// Appointment Management
router.get(
  '/appointments',
  authenticateJWT,
  authorizeRoles(RoleType.STAFF),
  staffController.getStaffAppointments
);

router.patch(
  '/appointments/:id/status',
  authenticateJWT,
  authorizeRoles(RoleType.STAFF),
  staffController.updateAppointmentStatus
);

router.patch(
  '/appointments/:id/no-show',
  authenticateJWT,
  authorizeRoles(RoleType.STAFF),
  staffController.markNoShow
);

// Dashboard
router.get(
  '/dashboard',
  authenticateJWT,
  authorizeRoles(RoleType.STAFF),
  staffController.getStaffDashboard
);

export default router;
