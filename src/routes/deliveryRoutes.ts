import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { enforceBranchIsolation } from '../middlewares/branchIsolation.js';

const router = Router();

// Restricted to Delivery role and isolated by branch
router.use(authenticate, authorize('ADMIN', 'DELIVERY_GUY', 'HOST'), enforceBranchIsolation);

// GET /api/delivery/orders - View all pending deliveries for this driver's branch
router.get('/orders', async (req: Request, res: Response) => {
  try {
    const branchId = req.user?.branchId;
    if (!branchId) return res.status(400).json({ error: 'Driver must be assigned to a branch.' });

    const deliveries = await prisma.delivery.findMany({
      where: {
        order: { branchId },
        delivery_status: { not: 'DELIVERED' }
      },
      include: { order: { include: { items: { include: { menuItem: true } } } } },
      orderBy: { updatedAt: 'asc' }
    });
    return res.json(deliveries);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch delivery orders' });
  }
});

// PUT /api/delivery/orders/:id/delivered
router.put('/orders/:id/delivered', async (req: Request, res: Response) => {
  try {
    const delivery = await prisma.delivery.update({
      where: { id: req.params['id'] as string },
      data: { delivery_status: 'DELIVERED' }
    });
    
    // Also update main order status
    await prisma.order.update({
      where: { id: delivery.order_id },
      data: { status: 'DELIVERED' }
    });

    res.json(delivery);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update delivery status' });
  }
});

export default router;
