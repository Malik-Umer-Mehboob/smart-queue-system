import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  id: string;
  role: string;
}

declare global {
  namespace Express {
    interface User {
      id: string;
      role: string;
    }
    interface Request {
      user?: User;
    }
  }
}

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
