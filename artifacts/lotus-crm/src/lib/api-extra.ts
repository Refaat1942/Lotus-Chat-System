// Thin wrappers around customFetch for endpoints not yet in the openapi
// codegen pipeline (insights, branding, campaigns, role-permissions).
// Keeps things type-safe without requiring an orval regen for every new feature.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type ChatSeverity = "normal" | "medium" | "high" | "critical";

export interface UnrepliedChat {
  conversationId: number;
  customerId: number;
  customerName: string;
  phone: string;
  channel: string;
  lastMessage: string;
  lastMessageAt: string | null;
  agentName: string | null;
  minutesWaiting: number;
  severity: ChatSeverity;
}

export interface ActiveCustomer {
  customerId: number;
  customerName: string;
  phone: string;
  branch: string | null;
  messageCount: number;
  conversationCount: number;
  lastSeenAt: string | null;
}

export interface InsightsResponse {
  slaMinutes: number;
  summary: {
    unrepliedCount: number;
    urgentCount: number;
    avgReplyMinutes: number;
    mostActiveCount: number;
  };
  unrepliedChats: UnrepliedChat[];
  urgentChats: UnrepliedChat[];
  mostActive: ActiveCustomer[];
  channelCounts: Record<string, number>;
  generatedAt: string;
}

export function useInsights() {
  return useQuery({
    queryKey: ["/api/insights"],
    queryFn: () => customFetch<InsightsResponse>("/api/insights"),
    refetchInterval: 30_000,
  });
}

export interface Branding {
  companyName: string;
  logoUrl: string | null;
}

export function useBranding() {
  return useQuery({
    queryKey: ["/api/branding"],
    queryFn: () => customFetch<Branding>("/api/branding"),
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Marketing campaigns (ready-to-connect stub — no real provider)
// ---------------------------------------------------------------------------
export type CampaignChannel = "whatsapp" | "messenger" | "instagram" | "sms";
export type CampaignStatus = "draft" | "sent";

export interface Campaign {
  id: number;
  name: string;
  channel: CampaignChannel;
  message: string;
  audience: string;
  status: CampaignStatus;
  recipientCount: number;
  createdAt: string;
  sentAt: string | null;
}

export interface CreateCampaignInput {
  name: string;
  channel: CampaignChannel;
  message: string;
  audience?: string;
}

const CAMPAIGNS_KEY = ["/api/campaigns"] as const;

export function useCampaigns() {
  return useQuery({
    queryKey: CAMPAIGNS_KEY,
    queryFn: () => customFetch<Campaign[]>("/api/campaigns"),
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) =>
      customFetch<Campaign>("/api/campaigns", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>(`/api/campaigns/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<Campaign & { providerStatus: string; message: string }>(
        `/api/campaigns/${id}/send`,
        { method: "POST", body: "{}" },
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY }),
  });
}

// ---------------------------------------------------------------------------
// Role permissions (5 fixed booleans per role)
// ---------------------------------------------------------------------------
export type RoleName = "admin" | "agent";

export interface RolePermissions {
  role: RoleName;
  canViewChats: boolean;
  canSendMessages: boolean;
  canViewReports: boolean;
  canManageCustomers: boolean;
  canManageSettings: boolean;
  updatedAt: string;
}

const ROLE_PERMS_KEY = ["/api/role-permissions"] as const;

export function useRolePermissions() {
  return useQuery({
    queryKey: ROLE_PERMS_KEY,
    queryFn: () =>
      customFetch<RolePermissions[]>("/api/role-permissions"),
    staleTime: 60_000,
  });
}

export function useUpdateRolePermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      role,
      data,
    }: {
      role: RoleName;
      data: Partial<Omit<RolePermissions, "role" | "updatedAt">>;
    }) =>
      customFetch<RolePermissions>(`/api/role-permissions/${role}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ROLE_PERMS_KEY }),
  });
}

// ---------------------------------------------------------------------------
// Block / unblock customer
// ---------------------------------------------------------------------------
export function useBlockCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      customFetch<unknown>(`/api/customers/${id}/block`, {
        method: "POST",
        body: JSON.stringify({ reason: reason ?? "" }),
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      qc.invalidateQueries({ queryKey: [`/api/customers/${vars.id}`] });
    },
  });
}

export function useUnblockCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<unknown>(`/api/customers/${id}/unblock`, {
        method: "POST",
        body: "{}",
      }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      qc.invalidateQueries({ queryKey: [`/api/customers/${id}`] });
    },
  });
}

/**
 * Convenience: returns the permissions for a given role, with safe defaults
 * while the request is loading or before the row exists.
 */
export function usePermissionsFor(role: RoleName | undefined) {
  const { data } = useRolePermissions();
  const row = data?.find((r) => r.role === role);
  return {
    canViewChats: row?.canViewChats ?? true,
    canSendMessages: row?.canSendMessages ?? true,
    canViewReports: row?.canViewReports ?? (role === "admin"),
    canManageCustomers: row?.canManageCustomers ?? true,
    canManageSettings: row?.canManageSettings ?? (role === "admin"),
  };
}

// ---------------------------------------------------------------------------
// Chat Reason Categories (Awfar-inspired) — admin CRUD
// ---------------------------------------------------------------------------
export interface ChatReasonCategory {
  id: number;
  titleEn: string;
  titleAr: string;
  isActive: boolean;
  createdAt: string;
}

export function useChatReasonCategories() {
  return useQuery({
    queryKey: ["/api/chat-reason-categories"],
    queryFn: () => customFetch<ChatReasonCategory[]>("/api/chat-reason-categories"),
  });
}

export function useCreateChatReasonCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { titleEn: string; titleAr: string }) =>
      customFetch<ChatReasonCategory>("/api/chat-reason-categories", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/chat-reason-categories"] }),
  });
}

export function useUpdateChatReasonCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; titleEn?: string; titleAr?: string }) =>
      customFetch<ChatReasonCategory>(`/api/chat-reason-categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/chat-reason-categories"] }),
  });
}

export function useDeleteChatReasonCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>(`/api/chat-reason-categories/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/chat-reason-categories"] });
      qc.invalidateQueries({ queryKey: ["/api/chat-reasons"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Chat Reasons — admin CRUD; agents read for the conversation picker
// ---------------------------------------------------------------------------
export interface ChatReason {
  id: number;
  nameEn: string;
  nameAr: string;
  color: string;
  categoryId: number | null;
  isActive: boolean;
  createdAt: string;
  categoryTitleEn?: string | null;
  categoryTitleAr?: string | null;
}

export function useChatReasons() {
  return useQuery({
    queryKey: ["/api/chat-reasons"],
    queryFn: () => customFetch<ChatReason[]>("/api/chat-reasons"),
  });
}

export function useCreateChatReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { nameEn: string; nameAr: string; color: string; categoryId: number | null }) =>
      customFetch<ChatReason>("/api/chat-reasons", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/chat-reasons"] }),
  });
}

export function useUpdateChatReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; nameEn?: string; nameAr?: string; color?: string; categoryId?: number | null }) =>
      customFetch<ChatReason>(`/api/chat-reasons/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/chat-reasons"] }),
  });
}

export function useDeleteChatReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>(`/api/chat-reasons/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/chat-reasons"] }),
  });
}

// ---------------------------------------------------------------------------
// Not-ready reasons — admin CRUD; agents pick when going off-shift
// ---------------------------------------------------------------------------
export interface NotReadyReason {
  id: number;
  key: string;
  value: string;
  isActive: boolean;
  createdAt: string;
}

export function useNotReadyReasons() {
  return useQuery({
    queryKey: ["/api/not-ready-reasons"],
    queryFn: () => customFetch<NotReadyReason[]>("/api/not-ready-reasons"),
  });
}

export function useCreateNotReadyReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { key: string; value: string }) =>
      customFetch<NotReadyReason>("/api/not-ready-reasons", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/not-ready-reasons"] }),
  });
}

export function useUpdateNotReadyReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: number; key?: string; value?: string }) =>
      customFetch<NotReadyReason>(`/api/not-ready-reasons/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/not-ready-reasons"] }),
  });
}

export function useDeleteNotReadyReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      customFetch<void>(`/api/not-ready-reasons/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/not-ready-reasons"] }),
  });
}

// ---------------------------------------------------------------------------
// Agent availability (ready / not-ready with reason)
// ---------------------------------------------------------------------------
export interface MyAvailability {
  isReady: boolean;
  notReadyReasonId: number | null;
  notReadySince: string | null;
  notReadyReason: string | null;
}

export function useMyAvailability() {
  return useQuery({
    queryKey: ["/api/me/availability"],
    queryFn: () => customFetch<MyAvailability>("/api/me/availability"),
    refetchInterval: 30_000,
  });
}

export function useUpdateMyAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { notReadyReasonId: number | null }) =>
      customFetch<{ ok: boolean; isReady: boolean }>("/api/me/availability", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/me/availability"] }),
  });
}

