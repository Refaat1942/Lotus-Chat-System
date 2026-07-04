import { db } from "@workspace/db";
import { rolePermissionsTable, userPermissionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type PermissionKey =
  | "canViewChats"
  | "canSendMessages"
  | "canViewReports"
  | "canManageCustomers"
  | "canManageSettings";

export interface EffectivePermissions {
  canViewChats: boolean;
  canSendMessages: boolean;
  canViewReports: boolean;
  canManageCustomers: boolean;
  canManageSettings: boolean;
}

const ADMIN_DEFAULTS: EffectivePermissions = {
  canViewChats: true,
  canSendMessages: true,
  canViewReports: true,
  canManageCustomers: true,
  canManageSettings: true,
};

const AGENT_DEFAULTS: EffectivePermissions = {
  canViewChats: true,
  canSendMessages: true,
  canViewReports: false,
  canManageCustomers: true,
  canManageSettings: false,
};

let roleCache: Map<string, EffectivePermissions> | null = null;
let roleCacheAt = 0;
const CACHE_TTL_MS = 30_000;

async function loadRolePermissions(): Promise<Map<string, EffectivePermissions>> {
  const now = Date.now();
  if (roleCache && now - roleCacheAt < CACHE_TTL_MS) return roleCache;

  const rows = await db.select().from(rolePermissionsTable);
  const map = new Map<string, EffectivePermissions>();
  for (const row of rows) {
    map.set(row.role, {
      canViewChats: row.canViewChats,
      canSendMessages: row.canSendMessages,
      canViewReports: row.canViewReports,
      canManageCustomers: row.canManageCustomers,
      canManageSettings: row.canManageSettings,
    });
  }
  roleCache = map;
  roleCacheAt = now;
  return map;
}

export function invalidatePermissionCache() {
  roleCache = null;
}

export async function getEffectivePermissions(
  userId: number,
  role: "admin" | "agent",
): Promise<EffectivePermissions> {
  if (role === "admin") {
    const roleMap = await loadRolePermissions();
    const rolePerms = roleMap.get("admin") ?? ADMIN_DEFAULTS;
    return { ...rolePerms, canManageSettings: true };
  }

  const roleMap = await loadRolePermissions();
  const base = roleMap.get(role) ?? AGENT_DEFAULTS;

  const [override] = await db
    .select()
    .from(userPermissionsTable)
    .where(eq(userPermissionsTable.userId, userId));

  if (!override) return base;

  return {
    canViewChats: override.canViewChats ?? base.canViewChats,
    canSendMessages: override.canSendMessages ?? base.canSendMessages,
    canViewReports: override.canViewReports ?? base.canViewReports,
    canManageCustomers: override.canManageCustomers ?? base.canManageCustomers,
    canManageSettings: override.canManageSettings ?? base.canManageSettings,
  };
}

export async function hasPermission(
  userId: number,
  role: "admin" | "agent",
  key: PermissionKey,
): Promise<boolean> {
  const perms = await getEffectivePermissions(userId, role);
  return perms[key];
}
