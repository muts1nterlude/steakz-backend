import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { enforceBranchIsolation } from '../middlewares/branchIsolation.js';

const router = Router();

router.use(authenticate, authorize('ADMIN', 'BRANCH_MANAGER'), enforceBranchIsolation);

function getBranchId(req: Request): string | null {
  return (req.user?.branchId as string) || (req.query['branchId'] as string) || null;
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// GET /api/manager/dashboard - single call for all dashboard stats
router.get('/dashboard', async (req: Request, res: Response) => {
  const branchId = getBranchId(req);
  if (!branchId) return res.status(400).json({ error: 'branchId required' });

  const { start, end } = todayRange();

  try {
    const [ordersToday, allOrders, reservationsToday, pendingReservations, deliveryStats, staff] = await Promise.all([
      prisma.order.findMany({
        where: { branchId, createdAt: { gte: start, lte: end } },
        select: { totalPrice: true, status: true },
      }),
      prisma.order.findMany({
        where: { branchId, status: { in: ['PAID', 'DELIVERED'] } },
        select: { totalPrice: true },
      }),
      prisma.reservation.count({
        where: { branchId, reservationTime: { gte: start, lte: end } },
      }),
      prisma.reservation.count({
        where: { branchId, status: 'PENDING' },
      }),
      prisma.delivery.findMany({
        where: { order: { branchId } },
        select: { delivery_status: true },
      }),
      prisma.user.findMany({
        where: { branchId, is_active: true },
        select: { id: true, name: true, role: true, email: true },
      }),
    ]);

    const revenueToday = ordersToday
      .filter((o) => o.status === 'PAID' || o.status === 'DELIVERED' || o.status === 'SERVED')
      .reduce((s, o) => s + Number(o.totalPrice), 0);

    const totalRevenue = allOrders.reduce((s, o) => s + Number(o.totalPrice), 0);

    const deliveriesTotal = deliveryStats.length;
    const deliveriesCompleted = deliveryStats.filter((d) => d.delivery_status === 'DELIVERED').length;

    return res.json({
      ordersToday: ordersToday.length,
      revenueToday,
      totalRevenue,
      reservationsToday,
      waitingList: pendingReservations,
      deliveriesTotal,
      deliveriesCompleted,
      staffCount: staff.length,
      staff,
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load dashboard stats' });
  }
});

// GET /api/manager/inventory
router.get('/inventory', async (req: Request, res: Response) => {
  const branchId = getBranchId(req);
  if (!branchId) return res.status(400).json({ error: 'branchId required' });

  try {
    const inventory = await prisma.inventory.findMany({ where: { branchId } });
    return res.json(inventory);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// GET /api/manager/payroll  →  { staffCount, totalPayroll, records[] }
router.get('/payroll', async (req: Request, res: Response) => {
  const branchId = getBranchId(req);
  if (!branchId) return res.status(400).json({ error: 'branchId required' });

  try {
    const records = await prisma.payroll.findMany({
      where: { employee: { branchId } },
      include: { employee: { select: { name: true, email: true, role: true } } },
    });
    const totalPayroll = records.reduce((s, r) => s + Number(r.salary), 0);
    return res.json({ staffCount: records.length, totalPayroll, records });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch payroll' });
  }
});

// GET /api/manager/revenue  →  { totalRevenue, orderCount }
router.get('/revenue', async (req: Request, res: Response) => {
  const branchId = getBranchId(req);
  if (!branchId) return res.status(400).json({ error: 'branchId required' });

  try {
    const orders = await prisma.order.findMany({
      where: { branchId, status: { in: ['PAID', 'DELIVERED'] } },
      select: { totalPrice: true },
    });
    const totalRevenue = orders.reduce((s, o) => s + Number(o.totalPrice), 0);
    return res.json({ totalRevenue, orderCount: orders.length });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch revenue' });
  }
});

// GET /api/manager/expenses  →  { totalExpenses, records[] }
router.get('/expenses', async (req: Request, res: Response) => {
  const branchId = getBranchId(req);
  if (!branchId) return res.status(400).json({ error: 'branchId required' });

  try {
    const records = await prisma.expense.findMany({ where: { branch_id: branchId } });
    const totalExpenses = records.reduce((s, r) => s + Number(r.amount), 0);
    return res.json({ totalExpenses, records });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch expenses' });
  }
});

// GET /api/manager/orders
router.get('/orders', async (req: Request, res: Response) => {
  const branchId = getBranchId(req);
  if (!branchId) return res.status(400).json({ error: 'branchId required' });

  try {
    const orders = await prisma.order.findMany({
      where: { branchId },
      include: { items: { include: { menuItem: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch branch orders' });
  }
});

// GET /api/manager/staff - Detailed staff listing
router.get('/staff', async (req: Request, res: Response) => {
  const branchId = getBranchId(req);
  if (!branchId) return res.status(400).json({ error: 'branchId required' });

  try {
    const staff = await prisma.user.findMany({
      where: { branchId },
      select: { id: true, name: true, email: true, role: true, salary: true, is_active: true, createdAt: true },
      orderBy: { name: 'asc' }
    });
    return res.json(staff);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch branch staff' });
  }
});

// PUT /api/manager/staff/:id - Update staff details
router.put('/staff/:id', async (req: Request, res: Response) => {
  const branchId = req.user?.branchId;
  if (!branchId) return res.status(400).json({ error: 'Manager must be assigned to a branch.' });

  const { name, email, role, salary, is_active } = req.body;

  try {
    const target = await prisma.user.findUnique({ where: { id: String(req.params['id']) } });
    if (!target || target.branchId !== branchId) {
      return res.status(403).json({ error: 'You can only manage users within your own branch.' });
    }

    const updatedFields: any = {};
    if (name !== undefined) updatedFields.name = name;
    if (email !== undefined) updatedFields.email = email;
    if (role !== undefined) updatedFields.role = role;
    if (salary !== undefined) updatedFields.salary = Number(salary);
    if (is_active !== undefined) updatedFields.is_active = Boolean(is_active);

    const updated = await prisma.user.update({
      where: { id: String(req.params['id']) },
      data: updatedFields
    });

    const { password: _, ...safe } = updated;
    return res.json(safe);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// PUT /api/manager/users/:id/role
router.put('/users/:id/role', async (req: Request, res: Response) => {
  const branchId = req.user?.branchId;
  if (!branchId) return res.status(400).json({ error: 'Manager must be assigned to a branch.' });

  try {
    const { role } = req.body;
    const target = await prisma.user.findUnique({ where: { id: String(req.params['id']) } });
    if (!target || target.branchId !== branchId) {
      return res.status(403).json({ error: 'You can only manage users within your own branch.' });
    }
    const updated = await prisma.user.update({ where: { id: String(req.params['id']) }, data: { role } });
    const { password: _, ...safe } = updated;
    return res.json(safe);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update user role' });
  }
});

export default router;
