import type { NextFunction, Request, Response } from "express";

type AsyncRouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

// Wraps async controllers so rejected promises reach the centralized
// error-handling middleware instead of crashing the process.
export const asyncHandler =
  (handler: AsyncRouteHandler) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
