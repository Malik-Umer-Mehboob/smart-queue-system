import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import { authorizeRoles } from '../middlewares/role.middleware';
import { RoleType } from '@prisma/client';
import * as adminController from '../controllers/admin.controller';

const router = Router();

router.post(
  '/create-staff',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.createStaff
);

// Organizations
router.post(
  '/organizations',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.createOrganization
);

router.get(
  '/organizations',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.getAllOrganizations
);

router.delete(
  '/organizations/:id',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.deleteOrganization
);

// Departments
router.post(
  '/departments',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.createDepartment
);

router.patch(
  '/departments/:id',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.updateDepartment
);

router.delete(
  '/departments/:id',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.deleteDepartment
);

// Appointments
router.get(
  '/appointments',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.getAllAppointments
);

router.post(
  '/appointments/emergency',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.addEmergencyAppointment
);

router.patch(
  '/appointments/:id/cancel',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.cancelAppointment
);

// User Management
router.get(
  '/users',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.getAllUsers
);

router.patch(
  '/users/:id/role',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.updateUserRole
);

router.delete(
  '/users/:id',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.deleteUser
);

// Staff Management
router.get(
  '/staff',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.getAllStaff
);

router.get(
  '/staff/:id',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.getStaffById
);

router.patch(
  '/staff/:id',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.updateStaff
);

router.patch(
  '/staff/:id/assign-department',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.assignStaffToDepartment
);

router.delete(
  '/staff/:id',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  adminController.deactivateStaff
);

export default router;
