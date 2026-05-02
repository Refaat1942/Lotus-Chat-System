import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin, AuthRequest } from "../middlewares/auth";

const router = Router();

router.get("/users", requireAuth, async (_req, res) => {
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    createdAt: usersTable.createdAt,
  }).from(usersTable).orderBy(usersTable.createdAt);
  res.json(users);
});

router.post("/users", requireAuth, requireAdmin, async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: "name, email, password, role required" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({ name, email, passwordHash, role }).returning({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    createdAt: usersTable.createdAt,
  });
  res.status(201).json(user);
});

router.get("/users/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const [user] = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
});

router.put("/users/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, email, role, password } = req.body;
  const updates: Record<string, unknown> = {};
  if (name) updates.name = name;
  if (email) updates.email = email;
  if (role) updates.role = role;
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    createdAt: usersTable.createdAt,
  });
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(user);
});

router.delete("/users/:id", requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (req.user?.id === id) {
    res.status(400).json({ error: "Cannot delete yourself" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

export default router;
