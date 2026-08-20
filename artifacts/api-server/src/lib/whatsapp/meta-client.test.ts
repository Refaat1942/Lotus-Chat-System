import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendTextMessage, isWhatsAppConfigured } from "./meta-client";

describe("meta-client sendTextMessage", () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "123456789";
    process.env.WHATSAPP_GRAPH_API_VERSION = "v21.0";
  });

  afterEach(() => {
    process.env = { ...envBackup };
    vi.restoreAllMocks();
  });

  it("returns wamid from Graph API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ messages: [{ id: "wamid.OUTBOUND1" }] }),
      }),
    );

    const result = await sendTextMessage("15551234567", "Hello from Fratelanza");
    expect(result.wamid).toBe("wamid.OUTBOUND1");

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/v21.0/123456789/messages");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-token");
    expect(JSON.stringify(init?.body)).toContain("Hello from Fratelanza");
  });

  it("throws on Graph API error without leaking token", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: "Invalid parameter", code: 100 } }),
      }),
    );

    await expect(sendTextMessage("15551234567", "Hi")).rejects.toThrow("Invalid parameter");
  });

  it("isWhatsAppConfigured reflects env presence", () => {
    expect(isWhatsAppConfigured()).toBe(true);
    delete process.env.WHATSAPP_ACCESS_TOKEN;
    expect(isWhatsAppConfigured()).toBe(false);
  });
});
