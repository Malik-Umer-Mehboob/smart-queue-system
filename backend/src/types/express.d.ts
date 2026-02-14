import { RoleType } from '@prisma/client';

declare global {
  namespace Express {
    interface User {
      id: string;
      role: RoleType;
      email?: string;
      name?: string;
    }
    interface Request {
      user?: User;
    }
  }
}
