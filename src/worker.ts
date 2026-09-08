import dotenv from "dotenv";
dotenv.config();

import { connectRedis } from "./config/redis.js";
import { startEmailWorker } from "./queues/email.worker.js";

// Runs as its own process (`npm run dev:worker` / `npm run start:worker`),
// separate from the HTTP server, so background email delivery never
// competes with or blocks request handling.
const main = async () => {
  await connectRedis();
  startEmailWorker();
  console.log("Email worker started, waiting for jobs...");
};

main().catch((error) => {
  console.error("Failed to start worker:", error);
  process.exit(1);
});
