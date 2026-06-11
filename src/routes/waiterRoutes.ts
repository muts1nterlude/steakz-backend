import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { enforceBranchIsolation } from '../middlewares/branchIsolation.js';

const router = Router();

router.use(authenticate, authorize('ADMIN', 'WAITER'), enforceBranchIsolation);

async function findAccessibleOrder(req: Request, id: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return null;
  if (order.type === 'DELIVERY') return null;
  if (req.user?.role !== 'ADMIN' && req.user?.branchId !== order.branchId) return null;
  return order;
}

// GET /api/waiter/orders - dine-in orders that are in or leaving the kitchen
router.get('/orders', async (req: Request, res: Response) => {
  const branchId = (req.user?.branchId as string) || (req.query['branchId'] as string);
  if (!branchId) return res.status(400).json({ error: 'branchId is required.' });

  try {
    const orders = await prisma.order.findMany({
      where: { branchId, status: { in: ['PREPARING', 'READY'] }, type: { not: 'DELIVERY' } },
      include: { items: { include: { menuItem: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch waiter orders' });
  }
});

// GET /api/waiter/ready-orders (kept for backwards compatibility)
router.get('/ready-orders', async (req: Request, res: Response) => {
  const branchId = (req.user?.branchId as string) || (req.query['branchId'] as string);
  if (!branchId) return res.status(400).json({ error: 'branchId is required.' });

  try {
    const orders = await prisma.order.findMany({
      where: { branchId, status: 'READY' },
      include: { items: { include: { menuItem: true } } },
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch ready orders' });
  }
});

// PUT /api/waiter/orders/:id/served
router.put('/orders/:id/served', async (req: Request, res: Response) => {
  try {
    const existing = await findAccessibleOrder(req, req.params['id'] as string);
    if (!existing) return res.status(404).json({ error: 'Order not found.' });

    const order = await prisma.order.update({
      where: { id: req.params['id'] as string },
      data: { status: 'SERVED' },
    });
    return res.json(order);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to mark order as served' });
  }
});

export default router;
