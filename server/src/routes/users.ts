import { Router, Request, Response } from "express";

const router = Router();

// Login - simplified (original used Cerner OAuth, now uses basic session)
router.post("/login", (req: Request, res: Response) => {
  req.session.currentUserId = "0";
  req.session.currentUserFirstname = "";
  res.json({ success: true, userId: "0" });
});

// Logout
router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed" });
    }
    res.json({ success: true });
  });
});

// Get current session
router.get("/session", (req: Request, res: Response) => {
  res.json({
    loggedIn: !!req.session.currentUserId,
    userId: req.session.currentUserId || null,
    firstname: req.session.currentUserFirstname || null,
  });
});

export default router;
