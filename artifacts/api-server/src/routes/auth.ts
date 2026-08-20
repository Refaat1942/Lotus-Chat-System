import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, JWT_SECRET, AuthRequest } from "../middlewares/auth";

const router = Router();

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const username = typeof email === "string" ? email.trim() : "";

  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, username));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });
  const { passwordHash: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

router.get("/auth/me", requireAuth, (req: AuthRequest, res) => {
  const { passwordHash: _, ...safeUser } = req.user!;
  res.json(safeUser);
});

export default router;
