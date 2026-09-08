import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { prisma } from "../../config/database.js";
import { redisSession } from "../../config/redis.js";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { parseDurationToMs } from "../../utils/duration.js";
import {
  generateOpaqueToken,
  hashToken,
  signAccessToken,
  verifyAccessToken,
} from "../../utils/token.js";
import { enqueueEmail } from "../../queues/email.queue.js";
import type { RegisterInput, LoginInput } from "./auth.validators.js";

const REFRESH_TTL_MS = () => parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN);
const REFRESH_TTL_SECONDS = () => Math.floor(REFRESH_TTL_MS() / 1000);

const publicUser = (user: {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  isVerified: boolean;
  createdAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  isVerified: user.isVerified,
  createdAt: user.createdAt,
});

export const registerUser = async ({ name, email, password }: RegisterInput) => {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const verificationToken = generateOpaqueToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationTokenExpiresAt = new Date(
    Date.now() + env.EMAIL_VERIFICATION_TOKEN_EXPIRES_IN_MIN * 60 * 1000,
  );

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      verificationTokenHash,
      verificationTokenExpiresAt,
    },
  });

  // Fire-and-forget: registration succeeds regardless of whether the email
  // queue/worker is up. The job just sits in Redis until a worker drains it.
  await enqueueEmail({
    type: "verification",
    to: user.email,
    name: user.name,
    verifyUrl: `${env.FRONTEND_URL}/verify-email?token=${verificationToken}`,
  });

  return publicUser(user);
};

export const verifyEmail = async (token: string) => {
  const tokenHash = hashToken(token);
  const user = await prisma.user.findFirst({ where: { verificationTokenHash: tokenHash } });

  if (!user || !user.verificationTokenExpiresAt || user.verificationTokenExpiresAt < new Date()) {
    throw ApiError.badRequest("Verification link is invalid or has expired");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { isVerified: true, verificationTokenHash: null, verificationTokenExpiresAt: null },
  });

  return publicUser(updated);
};

interface LoginContext {
  deviceInfo: string;
  ipAddress: string | undefined;
}

export const loginUser = async (
  { email, password }: LoginInput,
  { deviceInfo, ipAddress }: LoginContext,
) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  // --- Single active device/session enforcement -------------------------
  // Whatever session (if any) is currently active for this user gets
  // revoked, both in Redis (so an already-issued access token is rejected
  // on its very next request) and in Postgres (so the audit trail is
  // accurate). The new login below becomes the one and only active session.
  const previousSessionId = await redisSession.getActiveSessionId(user.id);
  if (previousSessionId) {
    await redisSession.revoke(user.id, previousSessionId);
    await prisma.session.updateMany({
      where: { id: previousSessionId, isActive: true },
      data: { isActive: false },
    });
  }
  await prisma.session.updateMany({
    where: { userId: user.id, isActive: true },
    data: { isActive: false },
  });

  const sessionId = crypto.randomUUID();
  const refreshToken = generateOpaqueToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS());

  await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      deviceInfo,
      isActive: true,
      expiresAt,
      ...(ipAddress ? { ipAddress } : {}),
    },
  });

  await redisSession.setActive(user.id, sessionId, REFRESH_TTL_SECONDS());

  const accessToken = signAccessToken({ sub: user.id, sid: sessionId });

  return { user: publicUser(user), accessToken, refreshToken };
};

export const refreshSession = async (refreshToken: string | undefined) => {
  if (!refreshToken) {
    throw ApiError.unauthorized("Missing refresh token");
  }

  const refreshTokenHash = hashToken(refreshToken);
  const session = await prisma.session.findFirst({
    where: { refreshTokenHash, isActive: true },
  });

  if (!session || session.expiresAt < new Date()) {
    throw ApiError.unauthorized("Session expired, please log in again");
  }

  const activeSessionId = await redisSession.getActiveSessionId(session.userId);
  if (activeSessionId !== session.id) {
    // This device's session was superseded by a login elsewhere.
    throw ApiError.unauthorized("Logged in on another device");
  }

  // Rotate the refresh token on every use so a leaked (but unused) old
  // token can't be replayed after this point.
  const newRefreshToken = generateOpaqueToken();
  const newRefreshTokenHash = hashToken(newRefreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS());

  await prisma.session.update({
    where: { id: session.id },
    data: { refreshTokenHash: newRefreshTokenHash, expiresAt, lastUsedAt: new Date() },
  });
  await redisSession.setActive(session.userId, session.id, REFRESH_TTL_SECONDS());

  const accessToken = signAccessToken({ sub: session.userId, sid: session.id });

  return { accessToken, refreshToken: newRefreshToken };
};

export const logoutUser = async (accessToken: string | undefined, refreshToken: string | undefined) => {
  let userId: string | undefined;
  let sessionId: string | undefined;

  if (accessToken) {
    try {
      const payload = verifyAccessToken(accessToken);
      userId = payload.sub;
      sessionId = payload.sid;
    } catch {
      // fall through to refresh-token lookup below
    }
  }

  if ((!userId || !sessionId) && refreshToken) {
    const session = await prisma.session.findFirst({
      where: { refreshTokenHash: hashToken(refreshToken) },
    });
    if (session) {
      userId = session.userId;
      sessionId = session.id;
    }
  }

  if (!userId || !sessionId) return;

  await redisSession.revoke(userId, sessionId);
  await prisma.session.updateMany({
    where: { id: sessionId },
    data: { isActive: false },
  });
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound("User not found");
  return publicUser(user);
};

export const updateAvatar = async (userId: string, avatarPath: string) => {
  const user = await prisma.user.update({ where: { id: userId }, data: { avatar: avatarPath } });
  return publicUser(user);
};

export const REFRESH_COOKIE_NAME = "refreshToken";
export const refreshCookieOptions = () => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: REFRESH_TTL_MS(),
  ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
});
