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

router.get(
  '/test',
  authenticateJWT,
  authorizeRoles(RoleType.ADMIN),
  (req, res) => {
    res.json({ message: 'Admin access granted' });
  }
);

export default router;
