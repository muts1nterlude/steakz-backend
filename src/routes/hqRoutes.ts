import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { enforceBranchIsolation } from '../middlewares/branchIsolation.js';

const router = Router();

// 🔐 Authentication & Role Verification: Restricted to Admin & HQ Corporate Management
router.use(authenticate, authorize('ADMIN', 'HQ_MANAGER'));

/**
 * 🎯 POST /api/hq/users
 * Enterprise-wide user provisioning. Admins/HQ Managers can create any staff or customer.
 */
router.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, role, branchId, salary } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'CUSTOMER',
        branchId: branchId || null,
        salary: salary || 0
      }
    });

    const { password: _, ...userWithoutPassword } = user;
    return res.status(201).json(userWithoutPassword);
  } catch (error) {
    next(error);
  }
});

/**
 * 🎯 PUT /api/hq/users/:id/role
 * Update user role and optionally branch assignment enterprise-wide.
 */
router.put('/users/:id/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params['id']);
    const { role, branchId } = req.body;

    const user = await prisma.user.update({
      where: { id },
      data: { 
        role: role || undefined,
        branchId: branchId !== undefined ? branchId : undefined
      }
    });

    const { password: _, ...userWithoutPassword } = user;
    return res.json(userWithoutPassword);
  } catch (error) {
    next(error);
  }
});

// ========================================================
// 🌍 GLOBAL MANAGEMENT ROUTES (Before Branch Isolation)
// ========================================================

/**
 * 🎯 GET /api/hq/experts
 * Pulls all highly skilled culinary staff (CHIEF/Chefs) across the enterprise 
 * to display in the management assignment dropdown.
 */
router.get('/experts', authenticate, authorize('ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chefs = await prisma.user.findMany({
      where: {
        role: { in: ['CHIEF', 'CHEF'] },
        isSuspended: false
      },
      select: {
        id: true,
        name: true,
        role: true,
        branchId: true,
        // Safely include branch name if relation exists
        branch: {
          select: { name: true }
        }
      }
    });

    return res.status(200).json(chefs);
  } catch (error) {
    console.error('❌ Failed to fetch restaurant culinary chefs:', error);
    next(error);
  }
});

/**
 * 🎯 POST /api/hq/assign
 * Deploys an expert Chef (CHIEF) to a target branch location to manage operations
 */
router.post('/assign', authenticate, authorize('ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { auditionId, expertChefId } = req.body;

    if (!auditionId || !expertChefId) {
      return res.status(400).json({ error: 'Missing target staff selection or expert chef parameter.' });
    }

    // 1. Identify the target staff member
    const targetStaff = await prisma.user.findUnique({
      where: { id: auditionId },
      select: { name: true, branchId: true }
    });

    if (!targetStaff) {
      return res.status(404).json({ error: 'Target staff member not found.' });
    }

    // 🎯 FIX: If target staff is global (null branch), grab the first available operating restaurant branch
    let operationalBranchId = targetStaff.branchId;
    
    if (!operationalBranchId) {
      const fallbackBranch = await prisma.branch.findFirst();
      if (!fallbackBranch) {
        return res.status(422).json({ error: 'Database mismatch: No operating restaurant branches exist yet to anchor this chef.' });
      }
      operationalBranchId = fallbackBranch.id;
    }

    // 2. Reassign/Deploy the Head Chef (CHIEF) to that specific branch location
    const updatedChef = await prisma.user.update({
      where: { id: expertChefId },
      data: {
        branchId: operationalBranchId
      }
    });

    const { password: _, ...chefWithoutPassword } = updatedChef;

    return res.status(200).json({
      message: `🎯 Success: Chef assigned to manage kitchen operations alongside ${targetStaff.name}.`,
      chef: chefWithoutPassword
    });
  } catch (error) {
    console.error('❌ Kitchen Staff Reassignment Failure:', error);
    next(error);
  }
});

// ========================================================
// 🔒 TENANT ISOLATED ROUTES (Enforced Branch Boundaries)
// ========================================================
router.use(enforceBranchIsolation);

router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const filterBranchId = req.query['branchId'] ? String(req.query['branchId']) : undefined;

    const branchPerformanceMetrics = await prisma.branch.findMany({
      where: filterBranchId ? { id: filterBranchId } : {},
      include: {
        _count: {
          select: { orders: true, reservations: true }
        },
        orders: {
          select: { totalPrice: true, createdAt: true, status: true }
        }
      }
    });

    const performanceReport = branchPerformanceMetrics.map(branch => {
      const totalRevenue = branch.orders
        .filter(o => o.status === 'PAID' || o.status === 'DELIVERED' || o.status === 'SERVED')
        .reduce((sum: number, order: any) => sum + Number(order.totalPrice), 0);

      return {
        branchId: branch.id,
        branchName: branch.name,
        location: branch.location,
        totalOrders: branch._count.orders,
        totalReservations: branch._count.reservations,
        totalRevenue: Number(totalRevenue.toFixed(2))
      };
    });

    // Daily Revenue Trends (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const orderWhere: any = {
      status: { in: ['PAID', 'DELIVERED', 'SERVED'] },
      createdAt: { gte: sevenDaysAgo }
    };
    if (filterBranchId) orderWhere.branchId = filterBranchId;

    const dailyTrendsRaw = await prisma.order.findMany({
      where: orderWhere,
      select: {
        totalPrice: true,
        createdAt: true
      }
    });

    const formattedTrendsMap: Record<string, { date: string; revenue: number; orders: number }> =
      dailyTrendsRaw.reduce((acc, curr) => {
        const dateParts = curr.createdAt instanceof Date
          ? curr.createdAt.toISOString().split('T')
          : ['unknown'];
        const dateKey = dateParts[0] ?? 'unknown';

        if (!acc[dateKey]) acc[dateKey] = { date: dateKey, revenue: 0, orders: 0 };
        acc[dateKey].revenue += Number(curr.totalPrice || 0);
        acc[dateKey].orders += 1;
        return acc;
      }, {} as Record<string, { date: string; revenue: number; orders: number }>);

    const orderItemWhere: any = {};
    if (filterBranchId) orderItemWhere.order = { branchId: filterBranchId };
    const itemSalesAggregation = await prisma.orderItem.groupBy({
      by: ['menuItemId'],
      where: orderItemWhere,
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    });

    const popularItemsReport = await Promise.all(
      itemSalesAggregation.map(async (group: any) => {
        const itemDetails = await prisma.menuItem.findUnique({
          where: { id: group.menuItemId },
          select: { name: true, category: true, price: true }
        });
        return {
          itemId: group.menuItemId,
          name: itemDetails?.name || 'Unknown Item',
          category: itemDetails?.category || 'General',
          price: itemDetails?.price ? Number(itemDetails.price) : 0,
          totalUnitsSold: group._sum.quantity || 0
        };
      })
    );

    const globalLowStockItems = await prisma.inventory.findMany({
      where: filterBranchId ? { branchId: filterBranchId } : {},
      include: {
        branch: { select: { name: true } }
      },
      orderBy: { quantity: 'asc' }
    });

    const lowStockAlerts = globalLowStockItems
      .filter((item: any) => item.quantity <= item.lowStockAlertAt)
      .map((item: any) => ({
        itemId: item.id,
        itemName: item.itemName,
        currentStock: item.quantity,
        unit: item.unit,
        threshold: item.lowStockAlertAt,
        branchName: item.branch.name
      }));

    const grossEnterpriseRevenue = performanceReport.reduce((acc, current) => acc + current.totalRevenue, 0);
    const totalEnterpriseOrders = performanceReport.reduce((acc, current) => acc + current.totalOrders, 0);

    return res.json({
      summary: {
        totalEnterpriseRevenue: Number(grossEnterpriseRevenue.toFixed(2)),
        totalEnterpriseOrders,
        activeAlertsCount: lowStockAlerts.length
      },
      branchPerformance: performanceReport,
      topSellingItems: popularItemsReport,
      inventoryAlerts: lowStockAlerts,
      dailyTrends: Object.values(formattedTrendsMap)
    });

  } catch (error: any) {
    console.error('❌ Analytics Failure:', error);
    return res.status(500).json({ error: 'Failed to generate metrics data.' });
  }
});

/**
 * 🎯 GET /api/hq/reports/financial
 * Monthly revenue and expense comparison report for the current year.
 */
router.get('/reports/financial', async (req: Request, res: Response) => {
  try {
    const filterBranchId = req.query['branchId'] ? String(req.query['branchId']) : undefined;
    const year = req.query['year'] ? Number(req.query['year']) : new Date().getFullYear();

    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59);

    const financialWhere: any = { monthYear: { gte: startOfYear, lte: endOfYear } };
    if (filterBranchId) financialWhere.branchId = filterBranchId;
    const financialRecords = await prisma.financialRecord.findMany({
      where: financialWhere,
      orderBy: { monthYear: 'asc' }
    });

    const monthlyData = financialRecords.reduce((acc: any, record) => {
      const month = record.monthYear.getMonth(); // 0-11
      if (!acc[month]) acc[month] = { month, revenue: 0, expenses: 0, payroll: 0 };
      acc[month].revenue += Number(record.revenue);
      acc[month].expenses += Number(record.expenses);
      acc[month].payroll += Number(record.payroll);
      return acc;
    }, {});

    return res.json({
      year,
      branchId: filterBranchId || 'GLOBAL',
      report: Object.values(monthlyData)
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to generate financial report.' });
  }
});

export default router;
