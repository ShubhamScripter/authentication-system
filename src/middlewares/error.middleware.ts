import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { isProduction } from "../config/env.js";

// Express 5 forwards both sync throws and rejected promises from route
// handlers here automatically, so every error in the app - validation,
// JWT, Prisma, or anything we throw ourselves - funnels through one place.
export const notFoundHandler = (req: Request, _res: Response, next: NextFunction) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  if (err instanceof jwt.TokenExpiredError) {
    return res.status(401).json({ success: false, message: "Token expired" });
  }

  if (err instanceof jwt.JsonWebTokenError) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  // Prisma unique-constraint violation, e.g. duplicate email.
  if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
    return res.status(409).json({
      success: false,
      message: "A record with this value already exists",
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      ...(err.details ? { errors: err.details } : {}),
    });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({
    success: false,
    message: isProduction ? "Internal server error" : (err as Error)?.message || "Internal server error",
  });
};
