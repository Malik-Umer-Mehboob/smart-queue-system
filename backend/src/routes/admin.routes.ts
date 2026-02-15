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

export default router;
