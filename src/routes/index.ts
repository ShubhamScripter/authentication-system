import { Router } from "express";
import authRoutes from "../modules/auth/auth.routes.js";
import userRoutes from "../modules/user/user.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ success: true, message: "ok" });
});

router.use("/auth", authRoutes);
router.use("/users", userRoutes);

export default router;
