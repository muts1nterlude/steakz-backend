import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { enforceBranchIsolation } from '../middlewares/branchIsolation.js';

const router = Router();

// Secure all admin routes behind authentication and strict RBAC
router.use(authenticate, authorize('ADMIN'), enforceBranchIsolation);

// POST /api/admin/create-admin
router.post('/create-admin', async (req: Request, res: Response) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required.' });
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    const { password: _, ...user } = await prisma.user.create({
      data: { name, email, password: hashed, role: 'ADMIN' }
    });
    return res.status(201).json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create admin' });
  }
});

// GET /api/admin/users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        branchId: true,
        is_active: true,
      },
      orderBy: { name: 'asc' },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', async (req: Request, res: Response) => {
  const { role } = req.body;
  try {
    const { password: _, ...user } = await prisma.user.update({
      where: { id: req.params['id'] as string },
      data: { role }
    });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update user role' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    await prisma.user.delete({ where: { id: req.params['id'] as string } });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

// PUT /api/admin/users/:id/status
router.put('/users/:id/status', async (req: Request, res: Response) => {
  const { is_active } = req.body;
  try {
    const { password: _, ...user } = await prisma.user.update({
      where: { id: req.params['id'] as string },
      data: { is_active }
    });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update user status' });
  }
});

export default router;