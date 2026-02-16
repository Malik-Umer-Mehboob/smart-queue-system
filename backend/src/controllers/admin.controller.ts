import { sendBookingConfirmation } from '../utils/notifications';
import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { RoleType } from '@prisma/client';
import prisma from '../lib/prisma';
import { signupSchema, organizationSchema, departmentSchema, emergencyAppointmentSchema, updateRoleSchema, createStaffSchema, updateStaffSchema, assignDepartmentSchema } from '../utils/validation';

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
    const parsed = createStaffSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { name, email, password, organizationId, departmentId, position } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    // Verify organization exists
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org || (org as any).isDeleted) {
      res.status(404).json({ message: 'Organization not found or inactive' });
      return;
    }

    // Verify department exists if provided
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept || (dept as any).isDeleted || dept.organizationId !== organizationId) {
        res.status(404).json({ message: 'Department not found, inactive, or does not belong to the specified organization' });
        return;
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user and staff in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          role: RoleType.STAFF,
        },
      });

      const staff = await tx.staff.create({
        data: {
          userId: user.id,
          organizationId,
          departmentId: departmentId || null,
          position: position || null,
        },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          organization: { select: { id: true, name: true, type: true } },
          department: { select: { id: true, name: true } },
        },
      });

      return staff;
    });

    res.status(201).json({ 
      message: 'Staff account created successfully',
      staff: result
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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const filter = req.query.filter as string; // 'all' or 'admin_history'

    let where: any = { isDeleted: false };

    if (filter === 'admin_history') {
        where.bookedBy = {
            role: { in: [RoleType.ADMIN, RoleType.STAFF] }
        };
    }

    const [appointments, total] = await Promise.all([
        prisma.appointment.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true } },
                bookedBy: { select: { id: true, name: true, email: true, role: true } },
                organization: true,
                department: true
            } as any,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        }),
        prisma.appointment.count({ where })
    ]);

    res.json({
        items: appointments,
        total,
        page,
        totalPages: Math.ceil(total / limit)
    });
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

export const cancelAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    const appointment = await prisma.appointment.findUnique({
      where: { id }
    });

    if (!appointment || appointment.isDeleted) {
      res.status(404).json({ message: 'Appointment not found' });
      return;
    }

    const updatedAppt = await prisma.appointment.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    const io = req.app.get('io');
    if (io) {
        io.emit('appointmentUpdated', updatedAppt);
        io.emit('queueUpdate', { 
            departmentId: updatedAppt.departmentId, 
            organizationId: updatedAppt.organizationId, 
            date: updatedAppt.date 
        });
    }

    res.json({ message: 'Appointment cancelled successfully', appointment: updatedAppt });
  } catch (error) {
    next(error);
  }
};

// ============ STAFF MANAGEMENT ============

export const getAllStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const staff = await prisma.staff.findMany({
      where: {
        user: {
          isDeleted: false
        }
      },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, createdAt: true } },
        organization: { select: { id: true, name: true, type: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(staff);
  } catch (error) {
    next(error);
  }
};

export const getStaffById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    const staff = await prisma.staff.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, role: true, createdAt: true, isDeleted: true } },
        organization: { select: { id: true, name: true, type: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (!staff || staff.user.isDeleted) {
      res.status(404).json({ message: 'Staff not found' });
      return;
    }

    res.json(staff);
  } catch (error) {
    next(error);
  }
};

export const updateStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const parsed = updateStaffSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { name, email, organizationId, departmentId, position } = parsed.data;

    // Check if staff exists
    const existingStaff = await prisma.staff.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingStaff || existingStaff.user.isDeleted) {
      res.status(404).json({ message: 'Staff not found' });
      return;
    }

    // Check if email is being changed and if it's already in use
    if (email && email !== existingStaff.user.email) {
      const emailExists = await prisma.user.findUnique({ where: { email } });
      if (emailExists) {
        res.status(409).json({ message: 'Email already in use' });
        return;
      }
    }

    // Verify organization exists if being updated
    if (organizationId) {
      const org = await prisma.organization.findUnique({ where: { id: organizationId } });
      if (!org || (org as any).isDeleted) {
        res.status(404).json({ message: 'Organization not found or inactive' });
        return;
      }
    }

    // Verify department exists if being updated
    if (departmentId !== undefined && departmentId !== null) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      const targetOrgId = organizationId || existingStaff.organizationId;
      if (!dept || (dept as any).isDeleted || dept.organizationId !== targetOrgId) {
        res.status(404).json({ message: 'Department not found, inactive, or does not belong to the specified organization' });
        return;
      }
    }

    // Update user and staff in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user if name or email changed
      if (name || email) {
        await tx.user.update({
          where: { id: existingStaff.userId },
          data: {
            ...(name && { name }),
            ...(email && { email }),
          },
        });
      }

      // Update staff
      const updatedStaff = await tx.staff.update({
        where: { id },
        data: {
          ...(organizationId && { organizationId }),
          ...(departmentId !== undefined && { departmentId }),
          ...(position !== undefined && { position }),
        },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          organization: { select: { id: true, name: true, type: true } },
          department: { select: { id: true, name: true } },
        },
      });

      return updatedStaff;
    });

    res.json({
      message: 'Staff updated successfully',
      staff: result
    });
  } catch (error) {
    next(error);
  }
};

export const assignStaffToDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const parsed = assignDepartmentSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { departmentId } = parsed.data;

    // Check if staff exists
    const existingStaff = await prisma.staff.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existingStaff || existingStaff.user.isDeleted) {
      res.status(404).json({ message: 'Staff not found' });
      return;
    }

    // Verify department exists and belongs to staff's organization
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (!dept || (dept as any).isDeleted || dept.organizationId !== existingStaff.organizationId) {
        res.status(404).json({ message: 'Department not found, inactive, or does not belong to staff\'s organization' });
        return;
      }
    }

    const updatedStaff = await prisma.staff.update({
      where: { id },
      data: { departmentId },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        organization: { select: { id: true, name: true, type: true } },
        department: { select: { id: true, name: true } },
      },
    });

    res.json({
      message: 'Staff department assignment updated successfully',
      staff: updatedStaff
    });
  } catch (error) {
    next(error);
  }
};

export const deactivateStaff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    
    // Check if staff exists
    const staff = await prisma.staff.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!staff || staff.user.isDeleted) {
      res.status(404).json({ message: 'Staff not found' });
      return;
    }

    // Soft delete the user (which cascades to staff access)
    await prisma.user.update({
      where: { id: staff.userId },
      data: { isDeleted: true } as any
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

