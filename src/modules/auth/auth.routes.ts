import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { authLimiter } from "../../middlewares/rateLimit.middleware.js";
import { loginSchema, registerSchema } from "./auth.validators.js";
import {
  login,
  logout,
  me,
  refresh,
  register,
  verifyEmailHandler,
} from "./auth.controller.js";

const router = Router();

router.post("/register", authLimiter, validateBody(registerSchema), register);
router.get("/verify-email", verifyEmailHandler);
router.post("/login", authLimiter, validateBody(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;
