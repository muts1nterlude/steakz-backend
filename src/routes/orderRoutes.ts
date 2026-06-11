import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { enforceBranchIsolation } from '../middlewares/branchIsolation.js';
import { sendOrderUpdateEmail } from '../services/emailService.js';

const router = Router();

/**
 * @route   POST /api/orders
 * @desc    Place a new customer order (Supports Guests)
 */
router.post('/', async (req: Request, res: Response) => {
  const { branchId, items, type, tableNumber, deliveryAddress, reservationId, customerName: guestName } = req.body;

  if (!branchId || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'branchId and items are required.' });
  }

  // Business rule: a dine-in order belongs to a physical table right now
  if ((!type || type === 'DINE_IN') && !Number(tableNumber)) {
    return res.status(400).json({ error: 'A table number is required for dine-in orders.' });
  }

  try {
    const customerId = req.user?.id || null;
    const customerName = req.user?.name || guestName || 'Guest Customer';

    const result = await prisma.$transaction(async tx => {
      let totalPrice = 0;
      const orderItemsData = [];

      for (const item of items) {
        const menuItem = await tx.menuItem.findUnique({
          where: { id: String(item.menuItemId) }
        });

        if (!menuItem) {
          throw new Error(`Menu item ${item.menuItemId} not found.`);
        }

        const price = Number(menuItem.price);
        const quantity = Number(item.quantity);
        totalPrice += price * quantity;

        orderItemsData.push({
          menuItemId: menuItem.id,
          quantity: quantity,
          price: price
        });
      }

      const orderType = type || 'DINE_IN';

      const order = await tx.order.create({
        data: {
          branchId: String(branchId),
          customerId: customerId,
          customer_name: customerName,
          type: orderType,
          status: 'PENDING',
          totalPrice: totalPrice,
          tableNumber: tableNumber ? Number(tableNumber) : null,
          deliveryAddress: deliveryAddress ? String(deliveryAddress) : null,
          // Optional link back to the reservation that brought this guest in
          ...(reservationId ? { reservationId: String(reservationId) } : {}),
          items: {
            create: orderItemsData
          }
        },
        include: {
          items: { include: { menuItem: true } }
        }
      });

      // Auto-create a Delivery record for delivery orders
      if (orderType === 'DELIVERY') {
        await tx.delivery.create({
          data: {
            order_id: order.id,
            delivery_status: 'PENDING',
          }
        });
      }

      return order;
    });

    return res.status(201).json({ 
      success: true, 
      order: result,
      message: 'Waiting for host to accept the order' 
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Order creation failed.';
    return res.status(400).json({ error: message });
  }
});

/**
 * @route   GET /api/orders
 * @desc    View orders (Auth required, branch isolation applied)
 */
router.get('/', authenticate, enforceBranchIsolation, async (req: Request, res: Response) => {
  try {
    // If Customer, only see their own orders
    if (req.user?.role === 'CUSTOMER') {
      const orders = await prisma.order.findMany({
        where: { customerId: req.user.id },
        include: { items: { include: { menuItem: true } } },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(orders);
    }

    // Staff see their own branch's orders; query param is only a fallback for global roles
    const branchId = req.user?.branchId
      ? String(req.user.branchId)
      : req.query['branchId']
        ? String(req.query['branchId'])
        : undefined;

    const whereClause: any = {};
    if (branchId) whereClause.branchId = branchId;

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: { items: { include: { menuItem: true } } },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(orders);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve orders.' });
  }
});

/**
 * @route   GET /api/orders/:id
 * @desc    Get order details
 */
router.get('/:id', authenticate, enforceBranchIsolation, async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: String(req.params['id']) },
      include: { items: { include: { menuItem: true } } }
    });

    if (!order) return res.status(404).json({ error: 'Order not found.' });

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve order details.' });
  }
});

/**
 * @route   PUT /api/orders/:id/status
 * @desc    Update order status (Staff only)
 */
router.put(
  '/:id/status',
  authenticate,
  enforceBranchIsolation,
  authorize('ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER', 'HOST', 'CHEF', 'CHIEF', 'WAITER', 'CASHIER'),
  async (req: Request, res: Response) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required.' });

  try {
    const existing = await prisma.order.findUnique({ where: { id: String(req.params['id']) } });
    if (!existing) return res.status(404).json({ error: 'Order not found.' });

    // Business Logic: Delivery orders must be PAID before they can be CONFIRMED or PREPARING
    if (existing.type === 'DELIVERY' && (status === 'CONFIRMED' || status === 'PREPARING')) {
      if (existing.status !== 'PAID') {
        return res.status(400).json({ error: 'Delivery orders must be paid before they can be confirmed or prepared.' });
      }
    }

    // Business Logic: Dine-in orders (non-delivery) can only be marked PAID after they are SERVED or DELIVERED
    if (existing.type !== 'DELIVERY' && status === 'PAID') {
      if (!['DELIVERED', 'SERVED'].includes(existing.status)) {
        return res.status(400).json({ error: 'Dine-in orders can only be paid after they have been served or delivered to the table.' });
      }
    }

    const order = await prisma.order.update({
      where: { id: String(req.params['id']) },
      data: { status },
      include: { 
        items: { include: { menuItem: true } },
        customer: true,
        branch: true
      }
    });

    // Record revenue when staff mark an order as paid (mirrors the /pay route)
    if (status === 'PAID' && existing.status !== 'PAID') {
      const date = new Date();
      const monthYear = new Date(date.getFullYear(), date.getMonth(), 1);

      await prisma.financialRecord.upsert({
        where: {
          branchId_monthYear: {
            branchId: order.branchId,
            monthYear: monthYear
          }
        },
        update: {
          revenue: { increment: order.totalPrice }
        },
        create: {
          branchId: order.branchId,
          monthYear: monthYear,
          revenue: order.totalPrice
        }
      });
    }

    // Send email notification if customer has an email
    if (order.customer?.email) {
      await sendOrderUpdateEmail({
        to: order.customer.email,
        customerName: order.customer.name,
        orderId: order.id,
        branchName: order.branch.name,
        status: order.status,
        totalPrice: Number(order.totalPrice)
      });
    }

    return res.json(order);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update order status.' });
  }
});

/**
 * @route   PUT /api/orders/:id/pay
 * @desc    Customer marks their own order as paid
 */
router.put('/:id/pay', authenticate, async (req: Request, res: Response) => {
  try {
    const order = await prisma.order.findUnique({ 
      where: { id: String(req.params['id']) },
      include: { items: { include: { menuItem: true } } }
    });
    
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if (order.customerId !== req.user!.id) return res.status(403).json({ error: 'Not authorised to pay for this order.' });
    if (order.status === 'CANCELLED') return res.status(400).json({ error: 'Cannot pay for a cancelled order.' });

    // Business Logic: Dine-in orders must be SERVED or DELIVERED before payment
    if (order.type !== 'DELIVERY' && !['DELIVERED', 'SERVED'].includes(order.status)) {
      return res.status(400).json({ error: 'Order must be served or delivered before payment can be processed.' });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID' },
      include: { items: { include: { menuItem: true } } }
    });

    // Update FinancialRecord
    const date = new Date();
    const monthYear = new Date(date.getFullYear(), date.getMonth(), 1);
    
    await prisma.financialRecord.upsert({
      where: {
        branchId_monthYear: {
          branchId: updated.branchId,
          monthYear: monthYear
        }
      },
      update: {
        revenue: { increment: updated.totalPrice }
      },
      create: {
        branchId: updated.branchId,
        monthYear: monthYear,
        revenue: updated.totalPrice
      }
    });

    return res.json({ 
      success: true, 
      order: updated,
      receipt: updated.items,
      message: updated.type === 'DELIVERY' ? 'Payment received. Waiting for host to accept the order' : 'Payment successful. Thank you!'
    });
  } catch (error) {
    return res.status(500).json({ error: 'Payment processing failed.' });
  }
});

/**
 * @route   DELETE /api/orders/:id
 * @desc    Cancel/Delete order (Admin/Manager only)
 */
router.delete('/:id', authenticate, enforceBranchIsolation, authorize('ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER'), async (req: Request, res: Response) => {
  try {
    await prisma.order.delete({
      where: { id: String(req.params['id']) }
    });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete order.' });
  }
});

export default router;

