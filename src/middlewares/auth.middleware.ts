import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/token.js";
import { redisSession } from "../config/redis.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Verifies the access token AND that its session is still the user's one
// active session in Redis. This is what makes "single active device" real:
// logging in elsewhere overwrites the Redis pointer, so every older token
// fails here immediately instead of staying valid until it naturally expires.
export const requireAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    throw ApiError.unauthorized("Missing access token");
  }

  const payload = verifyAccessToken(token);

  const isSessionActive = await redisSession.isActive(payload.sid);
  if (!isSessionActive) {
    throw ApiError.unauthorized("Session expired or logged in on another device");
  }

  const activeSessionId = await redisSession.getActiveSessionId(payload.sub);
  if (activeSessionId !== payload.sid) {
    throw ApiError.unauthorized("Session expired or logged in on another device");
  }

  req.user = { id: payload.sub, sessionId: payload.sid };
  next();
});
