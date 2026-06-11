import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

function canAccessBranchStaff(req: Request): boolean {
  const role = req.user?.role;
  if (role === 'ADMIN' || role === 'HQ_MANAGER') return true;
  return role === 'BRANCH_MANAGER' && req.user?.branchId === req.params['id'];
}

// GET /api/branches - Public: browse branches
router.get('/', async (req: Request, res: Response) => {
  try {
    const branches = await prisma.branch.findMany();
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

// GET /api/branches/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const branch = await prisma.branch.findUnique({
      where: { id: req.params['id'] as string }
    });
    if (!branch) return res.status(404).json({ error: 'Branch not found' });
    res.json(branch);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branch' });
  }
});

// GET /api/branches/:id/staff
router.get('/:id/staff', authenticate, authorize('ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    if (!canAccessBranchStaff(req)) {
      return res.status(403).json({ error: 'Forbidden: You can only view staff for your assigned branch.' });
    }

    const staff = await prisma.user.findMany({
      where: { branchId: req.params['id'] as string },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isSuspended: true,
        is_active: true,
      },
      orderBy: { name: 'asc' },
    });

    const result = staff.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      status: member.isSuspended ? 'SUSPENDED' : member.is_active ? 'ACTIVE' : 'INACTIVE',
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch branch staff' });
  }
});

// Admin Only Routes
router.use(authenticate, authorize('ADMIN'));

// POST /api/branches
router.post('/', async (req: Request, res: Response) => {
  const { name, location, city, address } = req.body;
  const resolvedLocation = location || address || city;

  if (!name || !resolvedLocation) {
    return res.status(400).json({ error: 'Branch name and location are required' });
  }

  try {
    const branch = await prisma.branch.create({
      data: { name, location: resolvedLocation, city, address }
    });
    res.status(201).json(branch);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// PUT /api/branches/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { name, location, city, address } = req.body;
  const resolvedLocation = location || address || city;

  if (!name || !resolvedLocation) {
    return res.status(400).json({ error: 'Branch name and location are required' });
  }

  try {
    const branch = await prisma.branch.update({
      where: { id: req.params['id'] as string },
      data: { name, location: resolvedLocation, city, address }
    });
    return res.json(branch);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update branch' });
  }
});

// DELETE /api/branches/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.branch.delete({
      where: { id: req.params['id'] as string }
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete branch' });
  }
});

export default router;
