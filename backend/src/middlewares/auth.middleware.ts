import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { RoleType } from '@prisma/client';

interface JwtPayload {
  id: string;
  role: RoleType;
}

// Express user type is now handled in src/types/express.d.ts

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET || 'super-secret-key-change-this', (err, user) => {
      if (err) {
        return res.status(403).json({ message: "Invalid or expired token" });
      }
      req.user = user as JwtPayload;
      next();
    });
  } else {
    res.status(401).json({ message: "Authorization header missing" });
  }
};
