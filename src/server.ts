import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import { connectRedis } from "./config/redis.js";
import { startEmailWorker } from "./queues/email.worker.js";

const startServer = async () => {
  try {
    await connectDatabase();
    await connectRedis();
    startEmailWorker();

    app.listen(env.PORT, () => {
      console.log(`server running on port ${env.PORT}`);
    });
  } catch (error) {
    console.error("failed to start server", error);
    process.exit(1);
  }
};

startServer();
