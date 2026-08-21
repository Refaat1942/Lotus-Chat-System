import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
  customersTable: "customers",
  conversationsTable: "conversations",
  messagesTable: "messages",
}));

import { verifyMetaWebhookSubscription } from "./webhook-handler";
import { normalizeWhatsAppPhone } from "./phone";

describe("verifyMetaWebhookSubscription", () => {
  const original = process.env.WHATSAPP_VERIFY_TOKEN;

  beforeEach(() => {
    process.env.WHATSAPP_VERIFY_TOKEN = "my-verify-token";
  });

  afterEach(() => {
    if (original === undefined) delete process.env.WHATSAPP_VERIFY_TOKEN;
    else process.env.WHATSAPP_VERIFY_TOKEN = original;
  });

  it("returns challenge on successful GET verification", () => {
    expect(
      verifyMetaWebhookSubscription({
        "hub.mode": "subscribe",
        "hub.verify_token": "my-verify-token",
        "hub.challenge": "999888777",
      }),
    ).toBe("999888777");
  });

  it("returns null on verification failure", () => {
    expect(
      verifyMetaWebhookSubscription({
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong-token",
        "hub.challenge": "999888777",
      }),
    ).toBeNull();
  });
});

describe("normalizeWhatsAppPhone", () => {
  it("strips non-digits", () => {
    expect(normalizeWhatsAppPhone("+1 (555) 123-4567")).toBe("15551234567");
  });
});
