import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

// Generic body validator: parses+replaces req.body with the schema's typed
// output, or forwards a ZodError to the centralized error handler.
export const validateBody =
  (schema: ZodType) => (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(result.error);
    }
    req.body = result.data;
    next();
  };
