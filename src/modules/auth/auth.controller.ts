import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import {
  loginUser,
  logoutUser,
  refreshSession,
  registerUser,
  verifyEmail,
  getCurrentUser,
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from "./auth.service.js";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const user = await registerUser(req.body);
  return sendSuccess(res, 201, "Registered successfully. Check your email to verify your account.", { user });
});

export const verifyEmailHandler = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.query.token as string) ?? req.body.token;
  const user = await verifyEmail(token);
  return sendSuccess(res, 200, "Email verified successfully", { user });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const deviceInfo = req.headers["user-agent"] ?? "unknown-device";
  const { user, accessToken, refreshToken } = await loginUser(req.body, {
    deviceInfo,
    ipAddress: req.ip,
  });

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  return sendSuccess(res, 200, "Logged in successfully", { user, accessToken });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const incomingRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  const { accessToken, refreshToken } = await refreshSession(incomingRefreshToken);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
  return sendSuccess(res, 200, "Token refreshed", { accessToken });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  const accessToken = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

  await logoutUser(accessToken, refreshToken);

  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
  return sendSuccess(res, 200, "Logged out successfully");
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await getCurrentUser(req.user!.id);
  return sendSuccess(res, 200, "Current user", { user });
});
