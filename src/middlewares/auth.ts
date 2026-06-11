import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

const isProduction = process.env['NODE_ENV'] === 'production';

function resolveSessionSecret(): string {
  const secret =
    process.env['SESSION_SECRET'] ||
    process.env['JWT_ACCESS_SECRET'] ||
    process.env['JWT_SECRET'];

  if (secret) return secret;

  if (isProduction) {
    throw new Error('SESSION_SECRET, JWT_ACCESS_SECRET, or JWT_SECRET must be set in production.');
  }

  return 'steakz_dev_session_secret';
}

const SESSION_SECRET = resolveSessionSecret();

export const SESSION_COOKIE_NAME = 'steakz_session';

export interface JwtPayload {
  id: string;
  email: string;
  role: Role;
  name?: string;
  branchId?: string | null;
}

/**
 * Global Authentication Guard
 * Validates the signed HttpOnly session cookie and attaches the decoded user context to the request.
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access denied. No authenticated session cookie provided.' });
  }

  try {
    const decoded = jwt.verify(token, SESSION_SECRET) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, error: 'Invalid or expired session.' });
  }
};

export function createSessionToken(user: JwtPayload): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      branchId: user.branchId ?? null
    },
    SESSION_SECRET,
    { expiresIn: (process.env['ACCESS_TOKEN_EXPIRES_IN'] || '8h') as any }
  );
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    // 🎯 FIXED: Dynamic configuration toggling to support seamless HTTP localhost operations
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
    path: '/'
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/'
  });
}

/**
 * Role-Based Access Control (RBAC) Guard
 * Restricts route invocation to specified administrative clearance profiles.
 */
export const authorize = (...allowedRoles: (Role | string)[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    // 🎯 FIXED: Cast checking parameters cleanly to support string and enum verification arrays
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ 
        success: false, 
        error: 'Forbidden: You do not have permission to perform this action.' 
      });
    }
    next();
  };
};
