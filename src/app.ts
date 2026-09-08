import path from "node:path";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { apiLimiter } from "./middlewares/rateLimit.middleware.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import routes from "./routes/index.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true, // required so the browser sends/receives the refresh-token cookie
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(apiLimiter);

// Serves uploaded avatars back out, e.g. GET /uploads/avatars/<file>.
app.use("/uploads", express.static(path.join(process.cwd(), env.UPLOAD_DIR)));

app.use("/api", routes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
