import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { doctorSchema } from '../utils/validation';

export const createDoctor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = doctorSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { name, email, specialization, organizationId, departmentId, isActive } = parsed.data;

    // Verify organization exists
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org || org.isDeleted) {
      res.status(404).json({ message: 'Organization not found or inactive' });
      return;
    }

    // Verify department exists
    const dept = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!dept || dept.isDeleted || dept.organizationId !== organizationId) {
      res.status(404).json({ message: 'Department not found or does not belong to the organization' });
      return;
    }

    const doctor = await (prisma as any).doctor.create({
      data: {
        name,
        email,
        specialization,
        organizationId,
        departmentId,
        isActive: isActive ?? true,
      },
      include: {
        organization: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    res.status(201).json(doctor);
  } catch (error) {
    next(error);
  }
};

export const getAllDoctors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { organizationId, departmentId, search } = req.query;

    const where: any = { isDeleted: false };

    if (organizationId) {
      where.organizationId = organizationId as string;
    }

    if (departmentId) {
      where.departmentId = departmentId as string;
    }

    if (search) {
      where.name = { contains: search as string, mode: 'insensitive' };
    }

    const doctors = await (prisma as any).doctor.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json(doctors);
  } catch (error) {
    next(error);
  }
};

export const getDoctorById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const doctor = await (prisma as any).doctor.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (!doctor || doctor.isDeleted) {
      res.status(404).json({ message: 'Doctor not found' });
      return;
    }

    res.json(doctor);
  } catch (error) {
    next(error);
  }
};

export const updateDoctor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const parsed = doctorSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const doctor = await (prisma as any).doctor.findUnique({ where: { id } });
    if (!doctor || doctor.isDeleted) {
      res.status(404).json({ message: 'Doctor not found' });
      return;
    }

    const updatedDoctor = await (prisma as any).doctor.update({
      where: { id },
      data: parsed.data,
      include: {
        organization: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    res.json(updatedDoctor);
  } catch (error) {
    next(error);
  }
};

export const deleteDoctor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    await (prisma as any).doctor.update({
      where: { id },
      data: { isDeleted: true },
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
