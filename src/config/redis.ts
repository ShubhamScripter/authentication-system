import { createClient } from "redis";
import type { RedisClientType } from "redis";
import { RedisConnection, createNodeRedisClient } from "bullmq";
import { env } from "./env.js";

// Single shared client for direct app usage: session-active flags, the
// "single active device" pointer, and (if needed) short-lived blacklists.
export const redisClient: RedisClientType = createClient({ url: env.REDIS_URL });

redisClient.on("error", (err) => console.error("Redis client error:", err));

export const connectRedis = async () => {
  await redisClient.connect();
  console.log("Redis connected");
};

// BullMQ ships built for ioredis by default. We already depend on the
// `redis` (node-redis) package for the rest of the app, so instead of
// pulling in ioredis as a second Redis driver we point BullMQ's connection
// factory at node-redis. Each Queue/Worker gets its own client (BullMQ
// manages connect/reconnect internally) - see bullmq's RedisConnection
// clientFactory docs.
RedisConnection.clientFactory = (opts) => {
  const url = env.REDIS_URL || `redis://${opts.host ?? "127.0.0.1"}:${opts.port ?? 6379}`;
  const raw = createClient({ url });
  raw.on("error", (err) => console.error("BullMQ redis client error:", err));
  return createNodeRedisClient(raw);
};

// ---- Session keys -------------------------------------------------------
// `session:<sessionId>` holds the userId while the session is valid; its
// TTL matches the refresh token's lifetime. Its mere presence is what the
// auth middleware checks on every request, so logout / a login from a new
// device can revoke an already-issued access token immediately instead of
// waiting out its (short) JWT expiry.
const sessionKey = (sessionId: string) => `session:${sessionId}`;
// `user:<userId>:activeSession` points at that user's one allowed active
// session, which is how "single active device" is enforced on login.
const activeSessionKey = (userId: string) => `user:${userId}:activeSession`;

export const redisSession = {
  async setActive(userId: string, sessionId: string, ttlSeconds: number) {
    const multi = redisClient.multi();
    multi.set(sessionKey(sessionId), userId, { expiration: { type: "EX", value: ttlSeconds } });
    multi.set(activeSessionKey(userId), sessionId, { expiration: { type: "EX", value: ttlSeconds } });
    await multi.exec();
  },

  async isActive(sessionId: string): Promise<boolean> {
    return (await redisClient.exists(sessionKey(sessionId))) === 1;
  },

  async getActiveSessionId(userId: string): Promise<string | null> {
    return redisClient.get(activeSessionKey(userId));
  },

  async revoke(userId: string, sessionId: string) {
    await redisClient.del([sessionKey(sessionId), activeSessionKey(userId)]);
  },
};
