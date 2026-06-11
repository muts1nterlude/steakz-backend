import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { enforceBranchIsolation } from '../middlewares/branchIsolation.js';

const router = Router();

router.use(authenticate, authorize('ADMIN', 'CHEF', 'CHIEF'), enforceBranchIsolation);

async function findAccessibleOrder(req: Request, id: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return null;
  if (req.user?.role !== 'ADMIN' && req.user?.branchId !== order.branchId) return null;
  return order;
}

// GET /api/chef/orders - kitchen-approved orders for the branch
router.get('/orders', async (req: Request, res: Response) => {
  const branchId = (req.user?.branchId as string) || (req.query['branchId'] as string);
  if (!branchId) return res.status(400).json({ error: 'branchId is required.' });

  try {
    const orders = await prisma.order.findMany({
      where: {
        branchId,
        status: { in: ['CONFIRMED', 'PREPARING', 'READY'] },
      },
      include: { items: { include: { menuItem: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch chef orders' });
  }
});

// GET /api/chef/low-stock - inventory items at or below their alert threshold
router.get('/low-stock', async (req: Request, res: Response) => {
  const branchId = (req.user?.branchId as string) || (req.query['branchId'] as string);
  if (!branchId) return res.status(400).json({ error: 'branchId is required.' });

  try {
    const items = await prisma.inventory.findMany({
      where: { branchId },
      orderBy: { quantity: 'asc' },
    });
    const lowStock = items.filter((i) => i.quantity <= i.lowStockAlertAt);
    return res.json(lowStock);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch low-stock items' });
  }
});

// PUT /api/chef/orders/:id/preparing
router.put('/orders/:id/preparing', async (req: Request, res: Response) => {
  try {
    const existing = await findAccessibleOrder(req, req.params['id'] as string);
    if (!existing) return res.status(404).json({ error: 'Order not found.' });

    const order = await prisma.order.update({
      where: { id: req.params['id'] as string },
      data: { status: 'PREPARING' },
    });
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update order status' });
  }
});

// PUT /api/chef/orders/:id/ready
router.put('/orders/:id/ready', async (req: Request, res: Response) => {
  try {
    const existing = await findAccessibleOrder(req, req.params['id'] as string);
    if (!existing) return res.status(404).json({ error: 'Order not found.' });

    const order = await prisma.order.update({
      where: { id: req.params['id'] as string },
      data: { status: 'READY' },
    });
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to mark order as ready' });
  }
});

export default router;
