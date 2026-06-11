import { type Request, type Response, type NextFunction } from 'express';
import prisma from '../lib/prisma.js';

const GLOBAL_BYPASS_ROLES = new Set(['ADMIN', 'HQ_MANAGER']);
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const TEAM_METRIC_PATHS = ['team', 'staff', 'metric', 'analytics', 'performance'];

function isTeamMetricsRequest(req: Request): boolean {
  const path = req.originalUrl.toLowerCase();
  return TEAM_METRIC_PATHS.some(segment => path.includes(segment));
}

async function resolveTargetBranchId(req: Request): Promise<string | null> {
  const directBranchId = req.params['branchId'] || req.query['branchId'] || req.body?.['branchId'];
  if (directBranchId) return String(directBranchId);

  const inventoryItemId = req.body?.['inventoryItemId'] || req.params['inventoryItemId'];
  if (inventoryItemId) {
    const item = await prisma.inventory.findUnique({
      where: { id: String(inventoryItemId) },
      select: { branchId: true }
    });
    return item?.branchId ?? null;
  }

  if (req.originalUrl.includes('/api/inventory/') && req.params['id']) {
    const item = await prisma.inventory.findUnique({
      where: { id: String(req.params['id']) },
      select: { branchId: true }
    });
    return item?.branchId ?? null;
  }

  // 🎯 FIXED: Direct split checking to evaluate the proper Prisma table model
  if (req.params['id']) {
    if (req.originalUrl.includes('/api/orders/')) {
      const order = await prisma.order.findUnique({
        where: { id: String(req.params['id']) },
        select: { branchId: true }
      });
      return order?.branchId ?? null;
    }

    if (req.originalUrl.includes('/api/procurement/')) {
      const procurement = await prisma.procurementOrder.findUnique({
        where: { id: String(req.params['id']) },
        select: { branchId: true }
      });
      return procurement?.branchId ?? null;
    }

    if (req.originalUrl.includes('/api/reservations/')) {
      const reservation = await prisma.reservation.findUnique({
        where: { id: String(req.params['id']) },
        select: { branchId: true }
      });
      return reservation?.branchId ?? null;
    }

    if (req.originalUrl.includes('/api/menu/')) {
      const menuItem = await prisma.menuItem.findUnique({
        where: { id: String(req.params['id']) },
        select: { branchId: true }
      });
      return menuItem?.branchId ?? null;
    }

    if (req.originalUrl.includes('/api/delivery/')) {
      const delivery = await prisma.delivery.findUnique({
        where: { id: String(req.params['id']) },
        include: { order: { select: { branchId: true } } }
      });
      return delivery?.order?.branchId ?? null;
    }
  }

  return null;
}

/**
 * Express 5 re-parses `req.query` from the URL on every access, so plain
 * mutation (`req.query.branchId = ...`) is silently discarded. Defining an
 * own property on the request instance shadows the prototype getter and
 * makes the enforced branch scope visible to downstream handlers.
 */
function pinBranchScope(req: Request, branchId: string): void {
  const scopedQuery = { ...req.query, branchId };
  Object.defineProperty(req, 'query', {
    value: scopedQuery,
    writable: true,
    configurable: true,
    enumerable: true
  });
}

/**
 * Multi-Tenant Branch Isolation Middleware
 * Prevents local staff members from viewing or altering data belonging to other branches.
 */
export async function verifyBranchAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Check if req.user exists (appended via authentication middleware downstream)
  if (!req.user) {
    res.status(401).json({ error: 'Authentication verification required.' });
    return;
  }

  const userRole = String(req.user.role);
  const userBranch = req.user.branchId;

  if (GLOBAL_BYPASS_ROLES.has(userRole) || userRole === 'CUSTOMER') {
    return next();
  }

  // Cashiers can read/write orders (to mark paid) and read inventory
  // Hosts can read/write orders (to approve/confirm dine-in orders)
  if (userRole === 'CASHIER' || userRole === 'HOST') {
    const url = req.originalUrl;
    const isAllowed = 
      url.startsWith('/api/orders') || 
      url.startsWith('/api/reservations') || 
      (userRole === 'HOST' && url.startsWith('/api/delivery'));
    
    if (!isAllowed) {
      res.status(403).json({ error: `Forbidden: ${userRole} access is limited to orders, reservations${userRole === 'CASHIER' ? ' and inventory' : ''}.` });
      return;
    }
  }

  if (!userBranch) {
    res.status(403).json({ error: 'Forbidden: This account is not assigned to a branch tenant.' });
    return;
  }

  try {
    const targetBranchId = await resolveTargetBranchId(req);

    if (!targetBranchId) {
      pinBranchScope(req, String(userBranch));
      return next();
    }

    if (String(targetBranchId) !== String(userBranch)) {
      res.status(403).json({
        error: `Access Denied: Your account is bound to Branch [${userBranch}] and is unauthorized to view or modify data for Branch [${targetBranchId}].`
      });
      return;
    }

    pinBranchScope(req, String(userBranch));
    return next();
  } catch (error) {
    next(error);
  }
}

export const enforceBranchIsolation = verifyBranchAccess;
