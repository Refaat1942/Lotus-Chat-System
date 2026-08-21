import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MetaWebhookPayload } from "./types";

const store = {
  messages: [] as Array<{
    id: number;
    externalId: string | null;
    status: string;
    conversationId: number;
    body: string;
    senderType: string;
  }>,
  customers: [] as Array<{ id: number; phone: string; name: string; tags: string[] }>,
  conversations: [] as Array<{
    id: number;
    customerId: number;
    channel: string;
    status: string;
    unreadCount: number;
  }>,
  seq: { message: 1, customer: 1, conv: 1 },
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
          where: () => ({
            limit: async () => {
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
              const m = {
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
              const c = {
                id: store.seq.customer++,
                phone,
                name: row.name as string,
                tags: (row.tags as string[]) ?? [],
              };
              store.customers.push(c);
              return [c];
            }
            if (table === conversationsTable) {
              const c = {
                id: store.seq.conv++,
                customerId: row.customerId as number,
                channel: row.channel as string,
                status: row.status as string,
                unreadCount: (row.unreadCount as number) ?? 0,
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
              if (table === messagesTable && store.messages[0]) {
                Object.assign(store.messages[0], patch);
                return [store.messages[0]];
              }
              return [];
            },
          }),
        }),
      }),
    },
  };
});

const samplePayload = (): MetaWebhookPayload => ({
  object: "whatsapp_business_account",
  entry: [
    {
      changes: [
        {
          field: "messages",
          value: {
            contacts: [{ wa_id: "15559998888", profile: { name: "Bob" } }],
            messages: [
              {
                from: "15559998888",
                id: "wamid.IN1",
                timestamp: "1700000000",
                type: "text",
                text: { body: "Inbound hello" },
              },
            ],
          },
        },
      ],
    },
  ],
});

describe("WhatsApp webhook handler (mocked db)", () => {
  beforeEach(() => {
    store.messages = [];
    store.customers = [];
    store.conversations = [];
    store.seq = { message: 1, customer: 1, conv: 1 };
    vi.resetModules();
  });

  it("processes incoming text message from Meta payload", async () => {
    const { processMetaWhatsAppWebhook } = await import("./webhook-handler");
    const stats = await processMetaWhatsAppWebhook(samplePayload());
    expect(stats.messagesProcessed).toBe(1);
    expect(store.messages.some((m) => m.externalId === "wamid.IN1")).toBe(true);
  });

  it("skips duplicate Meta webhook delivery", async () => {
    const { processMetaWhatsAppWebhook } = await import("./webhook-handler");
    store.messages.push({
      id: 1,
      externalId: "wamid.IN1",
      status: "delivered",
      conversationId: 1,
      body: "Already here",
      senderType: "customer",
    });

    const stats = await processMetaWhatsAppWebhook(samplePayload());
    expect(stats.messagesProcessed).toBe(0);
    expect(stats.duplicatesSkipped).toBe(1);
    expect(store.messages).toHaveLength(1);
  });

  it.each([
    ["delivered", "delivered"],
    ["read", "read"],
    ["failed", "failed"],
  ] as const)("applies %s status webhook", async (metaStatus, localStatus) => {
    const { processMetaWhatsAppWebhook } = await import("./webhook-handler");

    store.messages.push({
      id: 10,
      externalId: "wamid.OUT1",
      status: "sent",
      conversationId: 1,
      body: "Agent reply",
      senderType: "agent",
    });

    const payload: MetaWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                statuses: [
                  { id: "wamid.OUT1", status: metaStatus, timestamp: "1700000001" },
                ],
              },
            },
          ],
        },
      ],
    };

    const stats = await processMetaWhatsAppWebhook(payload);
    expect(stats.statusesProcessed).toBe(1);
    expect(store.messages[0]!.status).toBe(localStatus);
  });

  it("ignores sent status when message is already sent", async () => {
    const { processMetaWhatsAppWebhook } = await import("./webhook-handler");

    store.messages.push({
      id: 10,
      externalId: "wamid.OUT1",
      status: "sent",
      conversationId: 1,
      body: "Agent reply",
      senderType: "agent",
    });

    const stats = await processMetaWhatsAppWebhook({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                statuses: [{ id: "wamid.OUT1", status: "sent", timestamp: "1" }],
              },
            },
          ],
        },
      ],
    });

    expect(stats.statusesProcessed).toBe(0);
    expect(store.messages[0]!.status).toBe("sent");
  });
});
