import { sendBookingConfirmation } from '../utils/notifications';
import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { appointmentSchema } from '../utils/validation';

// Fetch all organizations
export const getAllOrganizations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const organizations = await prisma.organization.findMany({
      where: { isDeleted: false } as any,
      orderBy: { name: 'asc' },
    });
    res.json(organizations);
  } catch (error) {
    next(error);
  }
};

// Fetch departments for an organization
export const getDepartmentsByOrg = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const organizationId = req.params.id as string;
    const departments = await prisma.department.findMany({
      where: { organizationId, isDeleted: false } as any,
      orderBy: { name: 'asc' },
    });
    res.json(departments);
  } catch (error) {
    next(error);
  }
};

// Fetch available dates for a department (Show only available dates, disable past and fully booked)
export const getAvailableDates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departmentId = req.params.id as string;
    // For simplicity, returning next 30 days. 
    // real logic would check maxAppointments and existing bookings
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    res.json(dates);
  } catch (error) {
    next(error);
  }
};

// Fetch available slots for a date
export const getAvailableSlots = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const departmentId = req.params.id as string;
    const { date, doctorId } = req.query;

    if (!date || typeof date !== 'string') {
        res.status(400).json({ message: 'Date is required' });
        return;
    }

    if (!doctorId || typeof doctorId !== 'string') {
        res.status(400).json({ message: 'Doctor ID is required' });
        return;
    }

    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!dept || (dept as any).isDeleted) {
        res.status(404).json({ message: 'Department not found or inactive' });
        return;
    }

    // Generate slots based on slotDuration and work hours (e.g., 9-5)
    // and filter out already booked slots for the specific doctor
    const slots = [];
    const startHour = 9;
    const endHour = 17;
    const duration = dept.slotDuration;

    let current = new Date(`${date}T${String(startHour).padStart(2, '0')}:00:00`);
    const end = new Date(`${date}T${String(endHour).padStart(2, '0')}:00:00`);

    while (current < end) {
      const timeSlot = current.toTimeString().substring(0, 5);
      
      // Check count for this slot for the specific doctor
      const count = await prisma.appointment.count({
        where: {
          departmentId,
          doctorId,
          date: new Date(date),
          timeSlot,
          status: { not: 'CANCELLED' },
        }
      });

      if (count < dept.maxAppointments) {
        slots.push({
            timeSlot,
            available: true,
            remaining: dept.maxAppointments - count
        });
      } else {
        slots.push({
            timeSlot,
            available: false,
            remaining: 0
        });
      }

      current = new Date(current.getTime() + duration * 60000);
    }

    res.json(slots);
  } catch (error) {
    next(error);
  }
};

// Book appointment
export const bookAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const bookedById = req.user?.id;
    if (!bookedById) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    const parsed = appointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { organizationId, departmentId, doctorId, date, timeSlot, patientName, patientPhone, userId: providedUserId, isEmergency: requestedEmergency } = parsed.data;
    const appointmentDate = new Date(date);

    // Logic: 
    // If it's a normal user booking for themselves -> req.user.role is USER
    // If it's an admin booking manually -> req.user.role is ADMIN and may provide userId or patientName/Phone
    
    let userId = req.user?.role === 'USER' ? bookedById : providedUserId;
    
    // Emergency Logic: Only ADMIN can set isEmergency
    const isEmergency = req.user?.role === 'ADMIN' && requestedEmergency === true;

    // Restriction rule: One patient per department per date only. (Or per doctor?)
    // Request says "System still maintains: Slot availability per doctor", "Token generation per doctor".
    // Usually, you can't be in two queues for the same department at the same time.
    
    let existing = null;
    if (userId) {
        existing = await prisma.appointment.findFirst({
            where: {
                userId,
                departmentId,
                date: appointmentDate,
                status: { not: 'CANCELLED' }
            }
        });
    } else if (patientName && patientPhone) {
        existing = await prisma.appointment.findFirst({
            where: {
                patientName,
                patientPhone,
                departmentId,
                date: appointmentDate,
                status: { not: 'CANCELLED' }
            }
        });
    }

    if (existing) {
      res.status(400).json({ message: 'This patient already has an appointment with this department on this date' });
      return;
    }

    // Verify doctor existence and assignment to department
    const doctor = await (prisma as any).doctor.findFirst({
        where: { id: doctorId, departmentId, isDeleted: false, isActive: true }
    });

    if (!doctor) {
        res.status(404).json({ message: 'Doctor not found in this department or inactive' });
        return;
    }

    // Verify slot availability (Skip for Emergency)
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept || (dept as any).isDeleted) {
        res.status(404).json({ message: 'Department not found or inactive' });
        return;
    }

    if (!isEmergency) {
        const count = await prisma.appointment.count({
          where: {
            departmentId,
            doctorId,
            date: appointmentDate,
            timeSlot,
            status: { not: 'CANCELLED' }
          }
        });

        if (count >= dept.maxAppointments) {
          res.status(400).json({ message: 'Slot is no longer available for this doctor' });
          return;
        }
    }

    // Generate Token (FIFO per doctor)
    const lastAppt = await prisma.appointment.findFirst({
        where: { departmentId, doctorId, date: appointmentDate },
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
        doctorId,
        date: appointmentDate,
        timeSlot: isEmergency ? "EMERGENCY" : timeSlot,
        tokenNumber: newToken,
        status: 'BOOKED',
        isEmergency
      } as any
    });

    // Socket.IO emit update
    const io = req.app.get('io');
    if (io) {
        io.emit('newAppointment', appointment);
        io.emit('queueUpdate', { departmentId, organizationId, date: appointmentDate, doctorId });
    }

    // Send notification (simulated)
    const targetEmail = userId ? req.user?.email : null;
    if (targetEmail) {
        await sendBookingConfirmation(targetEmail, appointment);
    }

    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
};

// User Appointment History
export const getUserAppointments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const appointments = await prisma.appointment.findMany({
            where: { userId, isDeleted: false } as any,
            include: {
                organization: true,
                department: true,
                doctor: {
                    select: {
                        id: true,
                        name: true,
                        specialization: true
                    }
                }
            } as any,
            orderBy: { createdAt: 'desc' }
        });

        res.json(appointments);
    } catch (error) {
        next(error);
    }
};

// Fetch all doctors in a department
export const getDoctorsByDepartment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const departmentId = req.params.id as string;
        
        const doctors = await (prisma as any).doctor.findMany({
            where: { 
                departmentId, 
                isDeleted: false,
                isActive: true
            },
            orderBy: { name: 'asc' }
        });

        res.json(doctors);
    } catch (error) {
        next(error);
    }
};

export const cancelMyAppointment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.id;
        const id = req.params.id as string;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const appointment = await prisma.appointment.findUnique({
            where: { id }
        });

        if (!appointment || appointment.userId !== userId) {
            res.status(404).json({ message: 'Appointment not found or not owned by you' });
            return;
        }

        if (appointment.status !== 'BOOKED') {
            res.status(400).json({ message: 'Only booked appointments can be cancelled' });
            return;
        }

        const updatedAppt = await prisma.appointment.update({
            where: { id },
            data: { status: 'CANCELLED' }
        });

        // Socket.IO emit update
        const io = req.app.get('io');
        if (io) {
            io.emit('appointmentUpdated', updatedAppt);
            io.emit('queueUpdate', { 
                departmentId: updatedAppt.departmentId, 
                organizationId: updatedAppt.organizationId, 
                date: updatedAppt.date,
                doctorId: updatedAppt.doctorId
            });
        }

        res.json({ message: 'Appointment cancelled successfully', appointment: updatedAppt });
    } catch (error) {
        next(error);
    }
};
