import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import prisma from '../lib/prisma.js';

const router = Router();

// Public routes have been migrated to authenticated tiers to enforce system security requirements.

export default router;