import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { enforceBranchIsolation } from '../middlewares/branchIsolation.js';

const router = Router();

// Secure all inventory endpoints behind authentication and regional location scoping
router.use(
  authenticate,
  authorize('ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER', 'CHEF'),
  enforceBranchIsolation
);

/**
 * 🔍 GET /api/inventory
 * Handles branch-isolated keyword searching AND pagination together.
 * Supports optional parameters: ?q=steak&page=1&limit=10
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const searchKeyword = (req.query.q as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const branchId = req.query['branchId'] ? String(req.query['branchId']) : undefined;

    // 1. Build a strict, safe query filter mapping strictly to your schema fields
    const queryConditions: any = {};
    
    if (branchId) {
      queryConditions.branchId = branchId;
    }

    // 🎯 SAFE FIX: Only search across itemName to avoid querying non-existent columns
    if (searchKeyword.trim() !== '') {
      queryConditions.itemName = {
        contains: searchKeyword,
        mode: 'insensitive'
      };
    }

    // 2. Fetch the data slice and totals
    const [items, totalCount] = await prisma.$transaction([
      prisma.inventory.findMany({
        where: queryConditions,
        skip: skip,
        take: limit,
        include: {
          branch: { select: { id: true, name: true, location: true } },
          _count: { select: { orders: true } }
        },
        orderBy: { itemName: 'asc' }
      }),
      prisma.inventory.count({
        where: queryConditions
      })
    ]);

    return res.json({
      success: true,
      data: items.map(item => ({
        ...item,
        _count: { orders: item._count.orders }
      })),
      pagination: {
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
        limit: limit
      }
    });
  } catch (error) {
    // 🚨 This prints the ACTUAL Prisma error trace straight into your terminal log!
    console.error('❌ DETAILED INVENTORY CRASH LOG:', error);
    return res.status(500).json({ error: 'Inventory control interface error.' });
  }
});

/**
 * 📋 GET /api/inventory/:id
 * Fetches an individual ingredient profile safely isolated by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const inventoryItem = await prisma.inventory.findUnique({
      where: { id: String(req.params['id']) },
      include: {
        branch: { select: { id: true, name: true, location: true } },
        _count: { select: { orders: true } }
      }
    });

    if (!inventoryItem) {
      return res.status(404).json({ error: 'Ingredient profile not found.' });
    }

    return res.json({
      id: inventoryItem.id,
      itemName: inventoryItem.itemName,
      quantity: inventoryItem.quantity,
      unit: inventoryItem.unit,
      lowStockAlertAt: inventoryItem.lowStockAlertAt,
      branchId: inventoryItem.branchId,
      branch: inventoryItem.branch,
      createdAt: inventoryItem.createdAt,
      updatedAt: inventoryItem.updatedAt,
      _count: { orders: inventoryItem._count.orders }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Could not retrieve ingredient profile.' });
  }
});

export default router;