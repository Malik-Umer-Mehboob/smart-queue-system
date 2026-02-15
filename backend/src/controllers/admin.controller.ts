import { sendBookingConfirmation } from '../utils/notifications';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { RoleType } from '@prisma/client';
import prisma from '../lib/prisma';
import { signupSchema, organizationSchema, departmentSchema, emergencyAppointmentSchema, updateRoleSchema } from '../utils/validation';

export const getAllUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      where: { isDeleted: false } as any,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (error) {
    next(error);
  }
};

export const updateUserRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user || (user as any).isDeleted) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    const { role } = parsed.data;
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role: role as RoleType },
    });

    res.json({
      message: 'User role updated successfully',
      user: { id: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    // Check if user has related records (appointments, etc.)
    // In a production app, we might want to soft-delete or handle cascade
    await prisma.user.update({
      where: { id },
      data: { isDeleted: true } as any
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const createStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { name, email, password } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: RoleType.STAFF,
      },
    });

    res.status(201).json({ 
      message: 'Staff account created successfully',
      user: { id: user.id, name: user.name, email: user.email, role: user.role } 
    });
  } catch (error) {
    next(error);
  }
};

// Organizations
export const createOrganization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = organizationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const org = await prisma.organization.create({
      data: parsed.data,
    });

    res.status(201).json(org);
  } catch (error) {
    next(error);
  }
};

export const getAllOrganizations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgs = await prisma.organization.findMany({
      where: { isDeleted: false } as any,
      orderBy: { name: 'asc' },
    });
    res.json(orgs);
  } catch (error) {
    next(error);
  }
};

export const deleteOrganization = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.organization.update({
      where: { id },
      data: { isDeleted: true } as any
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Departments
export const createDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = departmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { organizationId, ...rest } = parsed.data;

    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org || (org as any).isDeleted) {
      res.status(404).json({ message: 'Organization not found or inactive' });
      return;
    }

    const department = await prisma.department.create({
      data: {
        ...rest,
        organization: { connect: { id: organizationId } },
      },
    });

    res.status(201).json(department);
  } catch (error) {
    next(error);
  }
};

export const updateDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const parsed = departmentSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const department = await prisma.department.update({
      where: { id },
      data: parsed.data,
    });

    res.json(department);
  } catch (error) {
    next(error);
  }
};

export const deleteDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.department.update({
      where: { id },
      data: { isDeleted: true } as any
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Appointment Management
export const getAllAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const appointments = await prisma.appointment.findMany({
      where: { isDeleted: false } as any,
      include: {
        user: { select: { id: true, name: true, email: true } },
        bookedBy: { select: { id: true, name: true, email: true } },
        organization: true,
        department: true
      } as any,
      orderBy: { createdAt: 'desc' }
    });
    res.json(appointments);
  } catch (error) {
    next(error);
  }
};

export const addEmergencyAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookedById = req.user?.id;
    if (!bookedById) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const parsed = emergencyAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { userId, organizationId, departmentId, date, timeSlot, patientName, patientPhone } = parsed.data;
    
    // Check if user exists (if provided)
    let user = null;
    if (userId) {
        user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
    }

    // Check if organization exists
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      res.status(404).json({ message: 'Organization not found' });
      return;
    }

    // Check if department exists
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept) {
      res.status(404).json({ message: 'Department not found' });
      return;
    }

    // Generate Token (FIFO)
    const appointmentDate = new Date(date);
    const lastAppt = await prisma.appointment.findFirst({
        where: { departmentId, date: appointmentDate },
        orderBy: { tokenNumber: 'desc' }
    });
    const newToken = (lastAppt?.tokenNumber || 0) + 1;

    const appointment = await prisma.appointment.create({
      data: {
        userId: userId ?? null,
        patientName: patientName ?? null,
        patientPhone: patientPhone ?? null,
        bookedById: bookedById as string,
        organizationId,
        departmentId,
        date: appointmentDate,
        timeSlot,
        tokenNumber: newToken,
        status: 'BOOKED'
      } as any
    });

    const io = req.app.get('io');
    if (io) {
        io.emit('newAppointment', appointment);
        io.emit('queueUpdate', { departmentId, organizationId, date: appointmentDate });
    }

    // Send notification (simulated)
    if (user) {
        await sendBookingConfirmation(user.email, appointment);
    } else if (patientName) {
        // Notification for manual patient could be SMS, here we just log
        console.log(`Manual booking for ${patientName} notification sent`);
    }

    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
};
