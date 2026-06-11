import { Role } from '@prisma/client';

export interface AuthenticatedUserPayload {
  id: string;
  email: string;
  role: Role;
  branchId?: string | null; // Removed '| number' to satisfy Prisma
  name?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUserPayload;
    }
  }
}
