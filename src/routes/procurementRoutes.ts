import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { enforceBranchIsolation } from '../middlewares/branchIsolation.js';

const router = Router();
const ACTIVE_PROCUREMENT_STATUSES = ['PENDING', 'IN_TRANSIT'];

router.use(authenticate, enforceBranchIsolation);

router.post('/', authorize('ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER', 'CHIEF'), async (req: Request, res: Response) => {
  const { inventoryItemId, quantityRequested } = req.body;

  if (!inventoryItemId || !Number.isInteger(Number(quantityRequested)) || Number(quantityRequested) <= 0) {
    return res.status(400).json({ error: 'inventoryItemId and a positive quantityRequested are required.' });
  }

  try {
    const inventoryItem = await prisma.inventory.findUnique({
      where: { id: String(inventoryItemId) },
      select: { id: true, branchId: true }
    });

    if (!inventoryItem) {
      return res.status(404).json({ error: 'Ingredient profile not found.' });
    }

    const duplicateActiveOrder = await prisma.procurementOrder.findFirst({
      where: {
        inventoryItemId: inventoryItem.id,
        status: { in: ACTIVE_PROCUREMENT_STATUSES }
      }
    });

    if (duplicateActiveOrder) {
      return res.status(409).json({
        error: 'A pending procurement order is already in transit for this ingredient profile.'
      });
    }

    const procurementOrder = await prisma.procurementOrder.create({
      data: {
        inventoryItemId: inventoryItem.id,
        branchId: inventoryItem.branchId,
        quantityRequested: Number(quantityRequested),
        requestedById: req.user?.id ?? null,
        status: 'PENDING'
      },
      include: {
        inventoryItem: true,
        branch: { select: { id: true, name: true, location: true } }
      }
    });

    return res.status(201).json(procurementOrder);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to initiate procurement order.' });
  }
});

router.get('/', authorize('ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER', 'CHIEF'), async (req: Request, res: Response) => {
  try {
    const branchId = req.query['branchId'] ? String(req.query['branchId']) : undefined;
    const procurementOrders = await prisma.procurementOrder.findMany({
      where: branchId ? { branchId } : {},
      include: {
        inventoryItem: true,
        branch: { select: { id: true, name: true, location: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(procurementOrders);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve procurement orders.' });
  }
});

router.patch('/:id/status', authorize('ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER', 'CHIEF'), async (req: Request, res: Response) => {
  const { status } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'status is required.' });
  }

  try {
    const modifiedOrder = await prisma.procurementOrder.update({
      where: { id: String(req.params['id']) },
      data: { status: String(status) },
      include: {
        inventoryItem: true,
        branch: { select: { id: true, name: true, location: true } }
      }
    });

    return res.json(modifiedOrder);
  } catch (error) {
    return res.status(500).json({ error: 'Procurement workflow adjustment failed.' });
  }
});

export default router;
