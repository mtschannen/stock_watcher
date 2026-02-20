import { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    currentUserId: string | null;
    currentUserFirstname: string | null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.currentUserId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}
