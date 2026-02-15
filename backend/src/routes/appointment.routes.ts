import { Router } from 'express';
import { authenticateJWT } from '../middlewares/auth.middleware';
import * as appointmentController from '../controllers/appointment.controller';

const router = Router();

// Fetch lists (some could be public, but usually at least user-role)
router.get('/organizations', appointmentController.getAllOrganizations);
router.get('/organizations/:id/departments', appointmentController.getDepartmentsByOrg);
router.get('/departments/:id/available-dates', appointmentController.getAvailableDates);
router.get('/departments/:id/available-slots', appointmentController.getAvailableSlots);

// User specific
router.post('/', authenticateJWT, appointmentController.bookAppointment);
router.get('/history', authenticateJWT, appointmentController.getUserAppointments);

export default router;
