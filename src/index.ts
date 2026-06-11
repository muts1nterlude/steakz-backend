import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { requestLogger } from './middlewares/logger.js';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import hqRoutes from './routes/hqRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import procurementRoutes from './routes/procurementRoutes.js';
import reservationRoutes from './routes/reservationRoutes.js';
import publicRoutes from './routes/publicRoutes.js';
import branchRoutes from './routes/branchRoutes.js';
import menuRoutes from './routes/menuRoutes.js';
import chefRoutes from './routes/chefRoutes.js';
import waiterRoutes from './routes/waiterRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import managerRoutes from './routes/managerRoutes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { seedAdmin } from './lib/seed.js';

const app = express();
const port = process.env['PORT'] || 3001;
const allowedOrigins = (process.env['FRONTEND_URL'] ?? 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);

// Health checks and graceful API prefix normalization:
app.get('/', (_req, res) => {
  res.json({ success: true, message: 'STEAKZ MIS backend is running.' });
});

app.get('/api', (_req, res) => {
  res.json({ success: true, message: 'STEAKZ MIS API root is active.', routes: ['/api/auth', '/api/public', '/api/branches'] });
});

app.use((req, _res, next) => {
  if (/^\/api\/api(\/|$)/.test(req.url)) {
    req.url = req.url.replace(/^\/api\/api/, '/api');
  }
  next();
});

// Active Steakz Management Information System API Tiers
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hq', hqRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/procurement', procurementRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/chef', chefRoutes);
app.use('/api/waiter', waiterRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/manager', managerRoutes);

// Fallback Handlers
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(port, async () => {
  try {
    await seedAdmin();
    console.log(`🚀 Backend running on http://localhost:${port}`);
  } catch (error) {
    console.error('⚠️ Failed to run database seed on startup:', error);
  }
});
