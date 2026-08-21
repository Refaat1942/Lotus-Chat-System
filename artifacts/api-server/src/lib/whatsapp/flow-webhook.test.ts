import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MetaWebhookPayload } from "./types";
import { QUALIFIED_50K_PLUS_TAG } from "./flow-response";

type CustomerRow = {
  id: number;
  phone: string;
  name: string;
  tags: string[];
  budgetQualified: boolean | null;
  budgetRange: string | null;
  projectType: string | null;
  projectDescription: string | null;
  companyName: string | null;
  leadSource: string | null;
  flowName: string | null;
};

type ConversationRow = {
  id: number;
  customerId: number;
  channel: string;
  status: string;
  unreadCount: number;
  tags: string[];
  lastMessage: string | null;
};

type MessageRow = {
  id: number;
  externalId: string | null;
  status: string;
  conversationId: number;
  body: string;
  senderType: string;
};

const store = {
  messages: [] as MessageRow[],
  customers: [] as CustomerRow[],
  conversations: [] as ConversationRow[],
  seq: { message: 1, customer: 1, conv: 1 },
  emitted: [] as Array<{ event: string; room?: string; payload: unknown }>,
};

function resetStore() {
  store.messages = [];
  store.customers = [];
  store.conversations = [];
  store.seq = { message: 1, customer: 1, conv: 1 };
  store.emitted = [];
}

const mockIo = {
  to: (room: string) => ({
    emit: (event: string, payload: unknown) => {
      store.emitted.push({ event, room, payload });
    },
  }),
  emit: (event: string, payload: unknown) => {
    store.emitted.push({ event, payload });
  },
};

vi.mock("@workspace/db", () => {
  const customersTable = "customers";
  const conversationsTable = "conversations";
  const messagesTable = "messages";

  return {
    customersTable,
    conversationsTable,
    messagesTable,
    db: {
      select: () => ({
        from: (table: string) => ({
          where: (condition: unknown) => ({
            limit: async (n: number) => {
              void condition;
              void n;
              if (table === messagesTable) {
                return store.messages;
              }
              if (table === customersTable) {
                return store.customers;
              }
              if (table === conversationsTable) {
                return store.conversations.filter(
                  (c) => c.channel === "whatsapp" && c.status === "open",
                );
              }
              return [];
            },
          }),
        }),
      }),
      insert: (table: string) => ({
        values: (row: Record<string, unknown>) => ({
          returning: async () => {
            if (table === messagesTable) {
              const extId = row.externalId as string;
              const dup = store.messages.find((m) => m.externalId === extId);
              if (dup) {
                const err = new Error("duplicate key") as Error & { code: string };
                err.code = "23505";
                throw err;
              }
              const m: MessageRow = {
                id: store.seq.message++,
                externalId: extId,
                status: (row.status as string) ?? "sent",
                conversationId: row.conversationId as number,
                body: row.body as string,
                senderType: row.senderType as string,
              };
              store.messages.push(m);
              return [m];
            }
            if (table === customersTable) {
              const phone = row.phone as string;
              const existing = store.customers.find((c) => c.phone === phone);
              if (existing) return [existing];
              const c: CustomerRow = {
                id: store.seq.customer++,
                phone,
                name: row.name as string,
                tags: (row.tags as string[]) ?? [],
                budgetQualified: null,
                budgetRange: null,
                projectType: null,
                projectDescription: null,
                companyName: null,
                leadSource: null,
                flowName: null,
              };
              store.customers.push(c);
              return [c];
            }
            if (table === conversationsTable) {
              const c: ConversationRow = {
                id: store.seq.conv++,
                customerId: row.customerId as number,
                channel: row.channel as string,
                status: row.status as string,
                unreadCount: (row.unreadCount as number) ?? 0,
                tags: (row.tags as string[]) ?? [],
                lastMessage: (row.lastMessage as string) ?? null,
              };
              store.conversations.push(c);
              return [c];
            }
            return [{}];
          },
        }),
      }),
      update: (table: string) => ({
        set: (patch: Record<string, unknown>) => ({
          where: () => ({
            returning: async () => {
              if (table === customersTable && store.customers[0]) {
                Object.assign(store.customers[0]!, patch);
                return [store.customers[0]!];
              }
              if (table === conversationsTable && store.conversations[0]) {
                Object.assign(store.conversations[0]!, patch);
                return [store.conversations[0]!];
              }
              if (table === messagesTable && store.messages[0]) {
                Object.assign(store.messages[0]!, patch);
                return [store.messages[0]!];
              }
              return [];
            },
          }),
        }),
      }),
    },
  };
});

const qualifiedFlowJson = {
  budget_qualified: true,
  budget_range: "50000-100000 EGP",
  project_type: "Retail fit-out",
  project_description: "New branch setup",
  customer_name: "Ahmed Refaat",
  company_name: "Fratelanza",
  source: "whatsapp_ad",
  flow_name: "Fratelanza Lead Qualification",
  flow_token: "flow-token-1",
  conversation_id: "1",
};

const belowThresholdFlowJson = {
  budget_qualified: true,
  budget_range: "under 30000",
  project_type: "Small project",
};

function flowPayload(
  responseJson: string | Record<string, unknown>,
  wamid = "wamid.FLOW1",
): MetaWebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              contacts: [{ wa_id: "201001234567", profile: { name: "Ahmed" } }],
              messages: [
                {
                  from: "201001234567",
                  id: wamid,
                  timestamp: "1700000000",
                  type: "interactive",
                  interactive: {
                    type: "nfm_reply",
                    nfm_reply: {
                      response_json: responseJson,
                      name: "Fratelanza Lead Qualification",
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function textPayload(): MetaWebhookPayload {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              messages: [
                {
                  from: "201001234567",
                  id: "wamid.TEXT1",
                  timestamp: "1700000000",
                  type: "text",
                  text: { body: "Hello" },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe("WhatsApp Flow nfm_reply webhook handling", () => {
  beforeEach(() => {
    resetStore();
    vi.resetModules();
  });

  it("continues to process normal text messages", async () => {
    const { processMetaWhatsAppWebhook } = await import("./webhook-handler");
    const stats = await processMetaWhatsAppWebhook(textPayload(), mockIo as never);
    expect(stats.messagesProcessed).toBe(1);
    expect(stats.flowsProcessed).toBe(0);
    expect(store.messages.some((m) => m.externalId === "wamid.TEXT1")).toBe(true);
  });

  it("detects and processes nfm_reply submissions", async () => {
    const { processMetaWhatsAppWebhook } = await import("./webhook-handler");
    const stats = await processMetaWhatsAppWebhook(
      flowPayload(qualifiedFlowJson),
      mockIo as never,
    );
    expect(stats.flowsProcessed).toBe(1);
    expect(stats.messagesProcessed).toBe(1);
    expect(store.customers[0]?.phone).toBe("201001234567");
    expect(store.conversations[0]?.customerId).toBe(store.customers[0]?.id);
  });

  it("adds qualified_50k_plus when budget range qualifies", async () => {
    const { processMetaWhatsAppWebhook } = await import("./webhook-handler");
    await processMetaWhatsAppWebhook(flowPayload(qualifiedFlowJson), mockIo as never);
    expect(store.customers[0]?.tags).toContain(QUALIFIED_50K_PLUS_TAG);
    expect(store.conversations[0]?.tags).toContain(QUALIFIED_50K_PLUS_TAG);
    expect(store.customers[0]?.budgetQualified).toBe(true);
  });

  it("does not add qualified_50k_plus when below threshold", async () => {
    const { processMetaWhatsAppWebhook } = await import("./webhook-handler");
    await processMetaWhatsAppWebhook(flowPayload(belowThresholdFlowJson), mockIo as never);
    expect(store.customers[0]?.tags).not.toContain(QUALIFIED_50K_PLUS_TAG);
    expect(store.customers[0]?.budgetQualified).toBe(false);
  });

  it("preserves existing tags when adding qualification tag", async () => {
    store.customers.push({
      id: 1,
      phone: "201001234567",
      name: "Ahmed",
      tags: ["New", "VIP"],
      budgetQualified: null,
      budgetRange: null,
      projectType: null,
      projectDescription: null,
      companyName: null,
      leadSource: null,
      flowName: null,
    });

    const { processMetaWhatsAppWebhook } = await import("./webhook-handler");
    await processMetaWhatsAppWebhook(flowPayload(qualifiedFlowJson), mockIo as never);

    expect(store.customers[0]?.tags).toEqual(["New", "VIP", QUALIFIED_50K_PLUS_TAG]);
  });

  it("skips malformed response_json without crashing the webhook", async () => {
    const { processMetaWhatsAppWebhook } = await import("./webhook-handler");
    const stats = await processMetaWhatsAppWebhook(
      flowPayload("{bad-json"),
      mockIo as never,
    );
    expect(stats.flowsSkipped).toBe(1);
    expect(stats.flowsProcessed).toBe(0);
    expect(store.messages).toHaveLength(0);
  });

  it("does not duplicate customer/conversation/message on repeated Flow delivery", async () => {
    const { processMetaWhatsAppWebhook } = await import("./webhook-handler");
    const payload = flowPayload(qualifiedFlowJson, "wamid.FLOW-DUP");

    const first = await processMetaWhatsAppWebhook(payload, mockIo as never);
    const second = await processMetaWhatsAppWebhook(payload, mockIo as never);

    expect(first.flowsProcessed).toBe(1);
    expect(second.duplicatesSkipped).toBe(1);
    expect(store.customers).toHaveLength(1);
    expect(store.conversations).toHaveLength(1);
    expect(store.messages).toHaveLength(1);
  });

  it("emits flow_submitted alongside new_message", async () => {
    const { processMetaWhatsAppWebhook } = await import("./webhook-handler");
    await processMetaWhatsAppWebhook(flowPayload(qualifiedFlowJson), mockIo as never);

    const events = store.emitted.map((e) => e.event);
    expect(events).toContain("new_message");
    expect(events).toContain("flow_submitted");
  });
});
