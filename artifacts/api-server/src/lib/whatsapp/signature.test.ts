import { describe, it, expect } from "vitest";
import {
  verifyMetaWebhookSignature,
  computeMetaWebhookSignature,
} from "./signature";

describe("verifyMetaWebhookSignature", () => {
  const secret = "test-app-secret";
  const body = Buffer.from('{"object":"whatsapp_business_account"}');

  it("accepts a valid signature", () => {
    const sig = computeMetaWebhookSignature(body, secret);
    expect(verifyMetaWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    expect(
      verifyMetaWebhookSignature(body, "sha256=deadbeef".padEnd(71, "0"), secret),
    ).toBe(false);
  });

  it("rejects when app secret is missing", () => {
    const sig = computeMetaWebhookSignature(body, secret);
    expect(verifyMetaWebhookSignature(body, sig, undefined)).toBe(false);
  });

  it("rejects when raw body is missing", () => {
    const sig = computeMetaWebhookSignature(body, secret);
    expect(verifyMetaWebhookSignature(undefined, sig, secret)).toBe(false);
  });
});
