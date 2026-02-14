import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { RoleType } from '@prisma/client';
import prisma from '../lib/prisma';
import { signupSchema } from '../utils/validation';

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
