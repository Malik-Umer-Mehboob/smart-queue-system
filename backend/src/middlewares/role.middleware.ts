import { Request, Response, NextFunction } from 'express';
import { RoleType } from '@prisma/client';

export const authorizeRoles = (...allowedRoles: RoleType[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role as RoleType)) {
      return res.status(403).json({ message: "Access denied: Insufficient permissions" });
    }
    next();
  };
};
