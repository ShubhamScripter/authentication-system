import { Queue } from "bullmq";
import { env } from "../config/env.js";
import "../config/redis.js"; // side effect: registers RedisConnection.clientFactory

export const EMAIL_QUEUE_NAME = "email";

export type EmailJobData =
  | { type: "verification"; to: string; name: string; verifyUrl: string }
  | { type: "welcome"; to: string; name: string };

// BullMQ's connection factory is wired up in config/redis.ts (bridges to
// our node-redis client instead of pulling in ioredis). The `connection`
// option below is required by BullMQ's types, but at runtime it's ignored
// in favor of RedisConnection.clientFactory (see config/redis.ts), which
// always dials env.REDIS_URL - the value here just satisfies TypeScript.
// Producers (the auth service) only ever touch this Queue; the actual
// sending happens in queues/email.worker.ts, run from a separate process
// (`npm run dev:worker`) so a slow/broken SMTP server never blocks a request.
export const emailQueue = new Queue<EmailJobData, void, string>(EMAIL_QUEUE_NAME, {
  connection: { url: env.REDIS_URL },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const enqueueEmail = (data: EmailJobData) => emailQueue.add(data.type, data);
