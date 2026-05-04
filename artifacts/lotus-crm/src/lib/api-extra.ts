// Thin wrappers around customFetch for endpoints not yet in the openapi
// codegen pipeline (insights, branding). Keeps things type-safe without
// requiring an orval regen for every new feature.
import { useQuery } from "@tanstack/react-query";
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
