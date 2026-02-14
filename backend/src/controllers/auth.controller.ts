import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { RoleType } from '@prisma/client';
import prisma from '../lib/prisma';
import { signupSchema, loginSchema } from '../utils/validation';

const generateToken = (user: { id: string; role: string }) => {
  const secret = process.env.JWT_SECRET || 'super-secret-key-change-this';
  const options: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any };
  
  return jwt.sign(
    { id: user.id, role: user.role },
    secret,
    options
  );
};

export const signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { name, email, password } = parsed.data;

    // Hardcoded admin email restriction
    const adminEmail = 'malik.umerkhan97@gmail.com';
    if (email.toLowerCase() === adminEmail.toLowerCase()) {
      res.status(403).json({ message: 'Registration with this email is not allowed' });
      return;
    }

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
        role: RoleType.USER, 
      },
    });

    const token = generateToken({ id: user.id, role: user.role });

    res.status(201).json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.format() });
      return;
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      res.status(401).json({ message: 'Invalid credentials' });
      return; 
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user);

    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role }, token });
  } catch (error) {
    next(error);
  }
};

export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    return;
  }
  
  // req.user is populated by passport
  const user = req.user as any; 
  const token = generateToken(user);

  // Redirect to frontend with token
  res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
};
