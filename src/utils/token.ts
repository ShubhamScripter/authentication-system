import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string; // userId
  sid: string; // sessionId
}

export const signAccessToken = (payload: AccessTokenPayload): string => {
  const secret: jwt.Secret = env.JWT_ACCESS_SECRET;
  const options: jwt.SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>,
  };
  return jwt.sign(payload, secret, options);
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload & jwt.JwtPayload;
};

// Refresh tokens and email-verification tokens are opaque random strings
// (not JWTs) - we only ever store their SHA-256 hash, mirroring how you'd
// treat a password. The raw value is shown to the client/user exactly once.
export const generateOpaqueToken = (): string => crypto.randomBytes(48).toString("hex");

export const hashToken = (token: string): string =>
  crypto.createHash("sha256").update(token).digest("hex");
