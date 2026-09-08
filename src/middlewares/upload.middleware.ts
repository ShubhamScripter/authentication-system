import fs from "node:fs";
import path from "node:path";
import multer, { type FileFilterCallback } from "multer";
import type { Request } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const avatarDir = path.join(process.cwd(), env.UPLOAD_DIR, "avatars");
fs.mkdirSync(avatarDir, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, avatarDir),
  filename: (req: Request, file, cb) => {
    const userId = req.user?.id ?? "anonymous";
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${userId}-${Date.now()}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(new ApiError(400, "Only PNG, JPG and WEBP images are allowed"));
    return;
  }
  cb(null, true);
};

export const uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: env.MAX_AVATAR_SIZE_MB * 1024 * 1024 },
}).single("avatar");
