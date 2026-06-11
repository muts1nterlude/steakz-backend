import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma  from '../lib/prisma.js';
import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { authenticate, clearSessionCookie, createSessionToken, setSessionCookie } from '../middlewares/auth.js';

const router = Router();

function toUserModel(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  branchId: string | null;
  is_active: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    is_active: user.is_active,
  };
}

/**
 * @route   POST /api/auth/register
 * @desc    Register a new employee/customer account
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
      return;
    }

    // Check if the user already exists in the system
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(400).json({ success: false, error: 'An account with this email already exists.' });
      return;
    }

    // Securely hash the password string before database persistence
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Persist the user record to PostgreSQL via Prisma Client
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.CUSTOMER,
        branchId: null
      }
    });

    const token = createSessionToken(toUserModel(newUser));
    setSessionCookie(res, token);

    res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: toUserModel(newUser)
    });
  } catch (error: any) {
    console.error('Registration processing fallout:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error during registration.' });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate credentials and return an access token
 */
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    // Verify password match using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({ success: false, error: 'Invalid email or password.' });
      return;
    }

    const token = createSessionToken(toUserModel(user));
    setSessionCookie(res, token);

    res.status(200).json({
      success: true,
      message: 'Authentication successful.',
      user: toUserModel(user)
    });
  } catch (error: any) {
    console.error('Login processing fallout:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error during authentication.' });
  }
});

router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ success: false, error: 'No active session.' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    clearSessionCookie(res);
    res.status(401).json({ success: false, error: 'Session user no longer exists.' });
    return;
  }

  res.json({ success: true, user: toUserModel(user) });
});

router.post('/logout', (_req: Request, res: Response): void => {
  clearSessionCookie(res);
  res.json({ success: true, message: 'Session cleared.' });
});

export default router;
