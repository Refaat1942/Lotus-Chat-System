import { Router } from "express";
import { db } from "@workspace/db";
import { userPermissionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireAdmin, AuthRequest } from "../middlewares/auth";
import { getEffectivePermissions, invalidatePermissionCache } from "../lib/permissions";

const router = Router();

const PERM_KEYS = [
  "canViewChats",
  "canSendMessages",
  "canViewReports",
  "canManageCustomers",
  "canManageSettings",
] as const;

router.get("/users/:id/permissions", requireAuth, requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const role = (req.query.role as "admin" | "agent") ?? "agent";
  const effective = await getEffectivePermissions(userId, role);
  const [override] = await db
    .select()
    .from(userPermissionsTable)
    .where(eq(userPermissionsTable.userId, userId));
  res.json({ userId, role, effective, override: override ?? null });
});

router.put("/users/:id/permissions", requireAuth, requireAdmin, async (req, res) => {
  const userId = Number(req.params.id);
  const body = req.body ?? {};
  const patch: Record<string, boolean | null> = {};

  for (const key of PERM_KEYS) {
    if (body[key] === null) patch[key] = null;
    else if (typeof body[key] === "boolean") patch[key] = body[key];
  }

  const [existing] = await db
    .select()
    .from(userPermissionsTable)
    .where(eq(userPermissionsTable.userId, userId));

  if (existing) {
    const [row] = await db
      .update(userPermissionsTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(userPermissionsTable.userId, userId))
      .returning();
    invalidatePermissionCache();
    res.json(row);
    return;
  }

  const [row] = await db
    .insert(userPermissionsTable)
    .values({
      userId,
      canViewChats: patch.canViewChats ?? null,
      canSendMessages: patch.canSendMessages ?? null,
      canViewReports: patch.canViewReports ?? null,
      canManageCustomers: patch.canManageCustomers ?? null,
      canManageSettings: patch.canManageSettings ?? null,
    })
    .returning();
  invalidatePermissionCache();
  res.json(row);
});

router.get("/me/permissions", requireAuth, async (req: AuthRequest, res) => {
  const role = req.user!.role as "admin" | "agent";
  const perms = await getEffectivePermissions(req.user!.id, role);
  res.json(perms);
});

export default router;
