import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { updateAppointmentStatusSchema, queueFilterSchema } from '../utils/validation';
import { AppointmentStatus, QueueStatus } from '@prisma/client';

// ============ QUEUE MANAGEMENT ============

export const getAssignedQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get staff record to find assigned organization/department
    const staff = await prisma.staff.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!staff || staff.user.isDeleted) {
      res.status(403).json({ message: 'Staff account not found or inactive' });
      return;
    }

    // Parse query filters
    const parsed = queueFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { date, departmentId, doctorId } = parsed.data;
    const queryDate = date ? new Date(date) : new Date();
    queryDate.setHours(0, 0, 0, 0);

    // Build where clause based on staff assignment
    const where: any = {
      organizationId: staff.organizationId,
      date: {
        gte: queryDate,
        lt: new Date(queryDate.getTime() + 24 * 60 * 60 * 1000),
      },
      isDeleted: false,
      status: { not: AppointmentStatus.CANCELLED },
    };

    // If staff is assigned to specific department, filter by it
    if (staff.departmentId) {
      where.departmentId = staff.departmentId;
    } else if (departmentId) {
      where.departmentId = departmentId;
    }

    // Filter by doctorId if provided
    if (doctorId) {
      where.doctorId = doctorId;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
        queue: true,
      } as any,
      orderBy: [
        { isEmergency: 'desc' },
        { tokenNumber: 'asc' }
      ],
    });

    res.json(appointments);
  } catch (error) {
    next(error);
  }
};

export const callNextToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Get staff record
    const staff = await prisma.staff.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!staff || staff.user.isDeleted) {
      res.status(403).json({ message: 'Staff account not found or inactive' });
      return;
    }

    const { departmentId, doctorId } = req.body;
    const targetDoctorId = doctorId; // No longer defaults to staff.id

    if (!targetDoctorId) {
        res.status(400).json({ message: 'Doctor ID is required to call next token' });
        return;
    }

    // Verify department access
    if (staff.departmentId && departmentId !== staff.departmentId) {
      res.status(403).json({ message: 'Access denied: Not assigned to this department' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find next waiting appointment for this doctor
    const nextAppointment = await prisma.appointment.findFirst({
      where: {
        departmentId: departmentId || staff.departmentId,
        doctorId: targetDoctorId,
        organizationId: staff.organizationId,
        date: {
          gte: today,
          lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
        status: AppointmentStatus.BOOKED,
        isDeleted: false,
      },
      include: {
        queue: true,
      },
      orderBy: [
        { isEmergency: 'desc' },
        { tokenNumber: 'asc' }
      ],
    });

    if (!nextAppointment) {
      res.status(404).json({ message: 'No waiting appointments in queue for this doctor' });
      return;
    }

    // Update queue status to CALLED
    if (nextAppointment.queue) {
      await prisma.queue.update({
        where: { id: nextAppointment.queue.id },
        data: { status: QueueStatus.CALLED },
      });
    }

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.emit('tokenCalled', {
        appointmentId: nextAppointment.id,
        tokenNumber: nextAppointment.tokenNumber,
        departmentId: nextAppointment.departmentId,
        doctorId: nextAppointment.doctorId,
      });
      io.emit('queueUpdate', {
        departmentId: nextAppointment.departmentId,
        organizationId: nextAppointment.organizationId,
        date: nextAppointment.date,
        doctorId: nextAppointment.doctorId,
      });
    }

    res.json({
      message: 'Token called successfully',
      appointment: nextAppointment,
    });
  } catch (error) {
    next(error);
  }
};

export const pauseQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const staff = await prisma.staff.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!staff || staff.user.isDeleted) {
      res.status(403).json({ message: 'Staff account not found or inactive' });
      return;
    }

    const { departmentId, doctorId } = req.body;
    const targetDoctorId = doctorId;

    if (!targetDoctorId) {
        res.status(400).json({ message: 'Doctor ID is required to pause queue' });
        return;
    }

    // Verify department access
    if (staff.departmentId && departmentId !== staff.departmentId) {
      res.status(403).json({ message: 'Access denied: Not assigned to this department' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Update all WAITING queues to PAUSED for this doctor
    const result = await prisma.queue.updateMany({
      where: {
        status: QueueStatus.WAITING,
        appointment: {
          departmentId: departmentId || staff.departmentId,
          doctorId: targetDoctorId,
          organizationId: staff.organizationId,
          date: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      },
      data: { status: QueueStatus.PAUSED },
    });

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.emit('queuePaused', {
        departmentId: departmentId || staff.departmentId,
        organizationId: staff.organizationId,
        doctorId: targetDoctorId,
      });
    }

    res.json({
      message: 'Queue paused successfully',
      updatedCount: result.count,
    });
  } catch (error) {
    next(error);
  }
};

export const resumeQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const staff = await prisma.staff.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!staff || staff.user.isDeleted) {
      res.status(403).json({ message: 'Staff account not found or inactive' });
      return;
    }

    const { departmentId, doctorId } = req.body;
    const targetDoctorId = doctorId;

    if (!targetDoctorId) {
        res.status(400).json({ message: 'Doctor ID is required to resume queue' });
        return;
    }

    // Verify department access
    if (staff.departmentId && departmentId !== staff.departmentId) {
      res.status(403).json({ message: 'Access denied: Not assigned to this department' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Update all PAUSED queues to WAITING for this doctor
    const result = await prisma.queue.updateMany({
      where: {
        status: QueueStatus.PAUSED,
        appointment: {
          departmentId: departmentId || staff.departmentId,
          doctorId: targetDoctorId,
          organizationId: staff.organizationId,
          date: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        },
      },
      data: { status: QueueStatus.WAITING },
    });

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.emit('queueResumed', {
        departmentId: departmentId || staff.departmentId,
        organizationId: staff.organizationId,
        doctorId: targetDoctorId,
      });
    }

    res.json({
      message: 'Queue resumed successfully',
      updatedCount: result.count,
    });
  } catch (error) {
    next(error);
  }
};

// ============ APPOINTMENT MANAGEMENT ============

export const getStaffAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const staff = await prisma.staff.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!staff || staff.user.isDeleted) {
      res.status(403).json({ message: 'Staff account not found or inactive' });
      return;
    }

    const { date, status, departmentId } = req.query;

    const where: any = {
      organizationId: staff.organizationId,
      isDeleted: false,
    };

    // Filter by staff's assigned department if exists
    if (staff.departmentId) {
      where.departmentId = staff.departmentId;
    } else if (departmentId) {
      where.departmentId = departmentId as string;
    }

    // Filter by date if provided
    if (date && typeof date === 'string') {
      const queryDate = new Date(date);
      queryDate.setHours(0, 0, 0, 0);
      where.date = {
        gte: queryDate,
        lt: new Date(queryDate.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    // Filter by status if provided
    if (status && typeof status === 'string') {
      where.status = status as AppointmentStatus;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true } },
        queue: true,
      },
      orderBy: [{ date: 'desc' }, { tokenNumber: 'asc' }],
    });

    res.json(appointments);
  } catch (error) {
    next(error);
  }
};

export const updateAppointmentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    const appointmentId = req.params.id as string;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const staff = await prisma.staff.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!staff || staff.user.isDeleted) {
      res.status(403).json({ message: 'Staff account not found or inactive' });
      return;
    }

    const parsed = updateAppointmentStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { status } = parsed.data;

    // Get appointment and verify access
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment || appointment.isDeleted) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    // Verify staff has access to this appointment's department
    if (staff.departmentId && appointment.departmentId !== staff.departmentId) {
      res.status(403).json({ message: 'Access denied: Not assigned to this department' });
      return;
    }

    if (appointment.organizationId !== staff.organizationId) {
      res.status(403).json({ message: 'Access denied: Not assigned to this organization' });
      return;
    }

    // Validate status transition
    if (status === 'SERVING' && appointment.status !== AppointmentStatus.BOOKED) {
      res.status(400).json({ message: 'Can only start serving booked appointments' });
      return;
    }

    if (status === 'COMPLETED' && appointment.status !== AppointmentStatus.SERVING) {
      res.status(400).json({ message: 'Can only complete appointments that are being served' });
      return;
    }

    // Update appointment status
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: status as AppointmentStatus },
      include: {
        user: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
        queue: true,
      },
    });

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentUpdated', updatedAppointment);
      io.emit('queueUpdate', {
        departmentId: updatedAppointment.departmentId,
        organizationId: updatedAppointment.organizationId,
        date: updatedAppointment.date,
        doctorId: updatedAppointment.doctorId,
      });
    }

    res.json({
      message: 'Appointment status updated successfully',
      appointment: updatedAppointment,
    });
  } catch (error) {
    next(error);
  }
};

export const markNoShow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    const appointmentId = req.params.id as string;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const staff = await prisma.staff.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!staff || staff.user.isDeleted) {
      res.status(403).json({ message: 'Staff account not found or inactive' });
      return;
    }

    // Get appointment and verify access
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment || appointment.isDeleted) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    // Verify staff has access to this appointment's department
    if (staff.departmentId && appointment.departmentId !== staff.departmentId) {
      res.status(403).json({ message: 'Access denied: Not assigned to this department' });
      return;
    }

    if (appointment.organizationId !== staff.organizationId) {
      res.status(403).json({ message: 'Access denied: Not assigned to this organization' });
      return;
    }

    // Update appointment status to NO_SHOW
    const updatedAppointment = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: AppointmentStatus.NO_SHOW },
      include: {
        user: { select: { id: true, name: true, email: true } },
        department: { select: { id: true, name: true } },
        queue: true,
      },
    });

    // Emit Socket.IO event
    const io = req.app.get('io');
    if (io) {
      io.emit('appointmentNoShow', updatedAppointment);
      io.emit('queueUpdate', {
        departmentId: updatedAppointment.departmentId,
        organizationId: updatedAppointment.organizationId,
        date: updatedAppointment.date,
        doctorId: updatedAppointment.doctorId,
      });
    }

    res.json({
      message: 'Appointment marked as no-show',
      appointment: updatedAppointment,
    });
  } catch (error) {
    next(error);
  }
};

// ============ DASHBOARD ============

export const getStaffDashboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const staff = await prisma.staff.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, email: true, isDeleted: true } },
        organization: { select: { id: true, name: true, type: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (!staff || staff.user.isDeleted) {
      res.status(403).json({ message: 'Staff account not found or inactive' });
      return;
    }

    const { doctorId } = req.query;
    const targetDoctorId = doctorId as string;

    if (!targetDoctorId) {
        res.status(400).json({ message: 'Doctor ID is required for dashboard' });
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = {
      organizationId: staff.organizationId,
      doctorId: targetDoctorId,
      date: {
        gte: today,
        lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
      isDeleted: false,
    };

    if (staff.departmentId) {
      where.departmentId = staff.departmentId;
    }

    // Get statistics
    const [totalToday, waiting, served, noShows, currentServing] = await Promise.all([
      prisma.appointment.count({
        where: {
          ...where,
          status: { not: AppointmentStatus.CANCELLED },
        },
      }),
      prisma.appointment.count({
        where: {
          ...where,
          status: AppointmentStatus.BOOKED,
        },
      }),
      prisma.appointment.count({
        where: {
          ...where,
          status: AppointmentStatus.COMPLETED,
        },
      }),
      prisma.appointment.count({
        where: {
          ...where,
          status: AppointmentStatus.NO_SHOW,
        },
      }),
      prisma.appointment.findFirst({
        where: {
          ...where,
          status: AppointmentStatus.SERVING,
        },
        include: {
          user: { select: { name: true } },
        },
        orderBy: { tokenNumber: 'asc' },
      }),
    ]);

    res.json({
      staff: {
        id: staff.id,
        name: staff.user.name,
        email: staff.user.email,
        organization: staff.organization,
        department: staff.department,
      },
      statistics: {
        totalToday,
        waiting,
        served,
        noShows,
        currentServing: currentServing ? {
          id: currentServing.id,
          tokenNumber: currentServing.tokenNumber,
          patientName: currentServing.patientName || currentServing.user?.name || 'Unknown',
        } : null,
      },
    });
  } catch (error) {
    next(error);
  }
};
