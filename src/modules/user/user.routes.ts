import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { uploadAvatar } from "../../middlewares/upload.middleware.js";
import { uploadAvatarHandler } from "./user.controller.js";

const router = Router();

router.post("/avatar", requireAuth, uploadAvatar, uploadAvatarHandler);

export default router;
