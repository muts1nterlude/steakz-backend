import { Router } from 'express';
import type { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, authorize } from '../middlewares/auth.js';
import { enforceBranchIsolation } from '../middlewares/branchIsolation.js';
import { sendReservationUpdateEmail } from '../services/emailService.js';

const router = Router();

router.use(authenticate, authorize('ADMIN', 'HQ_MANAGER', 'BRANCH_MANAGER', 'HOST', 'CUSTOMER'), enforceBranchIsolation);

// 1. BOOK A TABLE
router.post('/', async (req: Request, res: Response) => {
  const { branchId, tableNumber, reservationTime, timeSlot, guestsCount } = req.body;
  const targetBranchId = branchId || req.user?.branchId;

  if (!targetBranchId) {
    return res.status(400).json({ error: 'branchId is required.' });
  }

  try {
    const resDate = new Date(reservationTime);
    if (Number.isNaN(resDate.getTime())) {
      return res.status(400).json({ error: 'Invalid reservation time supplied.' });
    }

    const hours = resDate.getHours();
    const minutes = resDate.getMinutes();
    
    // Validate restaurant hours: 1:00 PM (13:00) to 11:30 PM (23:30)
    const timeInMinutes = hours * 60 + minutes;
    const openTime = 13 * 60; // 13:00
    const closeTime = 23 * 60 + 30; // 23:30

    if (timeInMinutes < openTime || timeInMinutes > closeTime) {
      return res.status(400).json({ error: 'Reservations are only accepted between 1:00 PM and 11:30 PM.' });
    }

    if (minutes % 30 !== 0) {
      return res.status(400).json({ error: 'Reservations may only be booked on the hour or half-hour (e.g. 13:00 or 13:30).' });
    }

    const normalizedTimeSlot = timeSlot || `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

    const conflictingReservation = await prisma.reservation.findFirst({
      where: {
        branchId: targetBranchId,
        tableNumber,
        timeSlot: normalizedTimeSlot,
        reservationTime: new Date(reservationTime),
        status: 'CONFIRMED'
      }
    });

    if (conflictingReservation) {
      return res.status(409).json({ message: 'Table occupied for specified time window.' });
    }

    const booking = await prisma.reservation.create({
      data: {
        branchId: targetBranchId,
        customerId: req.user!.id,
        tableNumber,
        reservationTime: new Date(reservationTime),
        timeSlot: normalizedTimeSlot,
        guestsCount,
        status: 'PENDING'
      }
    });
    return res.status(201).json(booking);
  } catch (error) {
    return res.status(500).json({ error: 'Could not write reservation.' });
  }
});

// 2. UPDATE RESERVATION STATUS (ADMIN/HQ/BRANCH MANAGER)
router.patch('/:id/status', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body; // "CONFIRMED", "PREPARING", "CANCELLED", "ARRIVED"
  const user = req.user;

  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: String(id) },
      include: { customer: true, branch: true }
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found.' });
    }

    // Branch isolation check for Branch Managers
    if (user?.role === 'BRANCH_MANAGER' && reservation.branchId !== user.branchId) {
      return res.status(403).json({ error: 'Forbidden: You can only manage reservations for your own branch.' });
    }

    const updatedReservation = await prisma.reservation.update({
      where: { id: String(id) },
      data: { status }
    });

    // Send email notification
    if (reservation.customer.email) {
      await sendReservationUpdateEmail({
        to: reservation.customer.email,
        customerName: reservation.customer.name,
        reservationId: updatedReservation.id,
        branchName: reservation.branch.name,
        status: updatedReservation.status,
        reservationTime: reservation.reservationTime
      });
    }

    return res.json(updatedReservation);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to update reservation status.' });
  }
});

// 3. VIEW SCHEDULES
router.get('/', async (req: Request, res: Response) => {
  try {
    if (req.user?.role === 'CUSTOMER') {
      const userBookings = await prisma.reservation.findMany({
        where: { customerId: req.user.id },
        include: { customer: { select: { name: true } } },
        orderBy: { reservationTime: 'asc' }
      });
      return res.json(userBookings);
    }
    
    const branchId = (req.user?.branchId as string) || (req.query['branchId'] as string);
    const whereClause = branchId ? { branchId } : {};
    
    const branchSchedule = await prisma.reservation.findMany({
      where: whereClause,
      include: { customer: { select: { name: true } } },
      orderBy: { reservationTime: 'asc' }
    });
    return res.json(branchSchedule);
  } catch (error) {
    return res.status(500).json({ error: 'Could not fetch schedules.' });
  }
});

export default router;
