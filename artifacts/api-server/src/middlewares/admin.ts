import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

declare global {
  namespace Express {
    interface Request {
      adminActorId?: string;
    }
  }
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  const userId = auth?.sessionClaims?.userId || auth?.userId;

  if (!userId) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }

  const allowedUserIds = (process.env.VYRO_ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (!allowedUserIds.includes(userId)) {
    res.status(403).json({
      error:
        "Administrator access is not enabled for this account. Add its Clerk user ID to VYRO_ADMIN_USER_IDS in Replit Secrets.",
    });
    return;
  }

  req.adminActorId = userId;
  next();
}
