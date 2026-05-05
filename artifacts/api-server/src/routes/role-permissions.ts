import { Router } from "express";
import { db } from "@workspace/db";
import { rolePermissionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = Router();

const PERMISSION_KEYS = [
  "canViewChats",
  "canSendMessages",
  "canViewReports",
  "canManageCustomers",
  "canManageSettings",
] as const;

router.get("/role-permissions", requireAuth, async (_req, res) => {
  const rows = await db.select().from(rolePermissionsTable);
  res.json(rows);
});

router.put(
  "/role-permissions/:role",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const role = req.params.role;
    if (role !== "admin" && role !== "agent") {
      res.status(400).json({ error: "role must be 'admin' or 'agent'" });
      return;
    }

    const updates: Record<string, boolean> = {};
    for (const key of PERMISSION_KEYS) {
      const v = (req.body ?? {})[key];
      if (typeof v === "boolean") updates[key] = v;
    }

    // Admins always retain manageSettings — guard against accidental lockout.
    if (role === "admin") updates["canManageSettings"] = true;

    const [existing] = await db
      .select()
      .from(rolePermissionsTable)
      .where(eq(rolePermissionsTable.role, role));

    if (!existing) {
      const [row] = await db
        .insert(rolePermissionsTable)
        .values({ role, ...updates, updatedAt: new Date() })
        .returning();
      res.json(row);
      return;
    }

    const [row] = await db
      .update(rolePermissionsTable)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rolePermissionsTable.role, role))
      .returning();
    res.json(row);
  },
);

export default router;
