import type { Request, Response, NextFunction } from 'express';

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    success: false,
    error: `Resource not found - Cannot ${req.method} ${req.originalUrl}`
  });
};

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('Unhandled Application Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
};