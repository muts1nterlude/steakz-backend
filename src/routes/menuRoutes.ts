import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';

import { enforceBranchIsolation } from '../middlewares/branchIsolation.js';

const router = Router();

// GET /api/menu - Public
router.get('/', async (req: Request, res: Response) => {
  const branchId = req.query['branchId'] as string | undefined;
  const category = req.query['category'] as string | undefined;
  try {
    const where: any = { isAvailable: true };
    if (branchId) where.branchId = branchId;
    if (category) where.category = category;

    const items = await prisma.menuItem.findMany({ where });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// GET /api/menu/:id - Public
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const item = await prisma.menuItem.findUnique({
      where: { id: req.params['id'] as string }
    });
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch menu item' });
  }
});

// Admin/HQ/Branch Manager Only
router.use(authenticate, authorize('ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER'), enforceBranchIsolation);

// POST /api/menu
router.post('/', async (req: Request, res: Response) => {
  const { name, description, price, category, branchId } = req.body;
  try {
    const item = await prisma.menuItem.create({
      data: { name, description, price, category, branchId }
    });
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

// PUT /api/menu/:id
router.put('/:id', async (req: Request, res: Response) => {
  const { name, description, price, category, isAvailable, branchId } = req.body;
  try {
    const item = await prisma.menuItem.update({
      where: { id: req.params['id'] as string },
      data: { name, description, price, category, isAvailable, branchId }
    });
    return res.json(item);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update menu item' });
  }
});

// DELETE /api/menu/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await prisma.menuItem.delete({
      where: { id: req.params['id'] as string }
    });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete menu item' });
  }
});

export default router;
