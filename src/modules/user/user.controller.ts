import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { updateAvatar } from "../auth/auth.service.js";

export const uploadAvatarHandler = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw ApiError.badRequest("Avatar file is required");
  }

  const avatarPath = `/uploads/avatars/${req.file.filename}`;
  const user = await updateAvatar(req.user!.id, avatarPath);
  return sendSuccess(res, 200, "Avatar updated", { user });
});
