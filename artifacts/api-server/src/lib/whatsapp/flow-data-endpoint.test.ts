import crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import { encryptFlowRequestForTest } from "./flow-crypto";
import {
  BUDGET_SCREEN_ID,
  FLOW_DATA_API_VERSION,
  handleDecryptedFlowDataRequest,
  handleFlowDataEndpointRequest,
} from "./flow-data-endpoint";
import { META_FLOW_BUDGET_IDS } from "./flow-budget-routing";
import { computeMetaWebhookSignature } from "./signature";

function generateTestKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

function budgetExchangeRequest(budgetRange: string, extraData: Record<string, unknown> = {}) {
  return {
    version: FLOW_DATA_API_VERSION,
    action: "data_exchange",
    screen: BUDGET_SCREEN_ID,
    flow_token: "meta-preview-token",
    data: {
      budget_range: budgetRange,
      source: "whatsapp_flow",
      flow_name: "Fratelanza Lead Qualification",
      ...extraData,
    },
  };
}

describe("handleDecryptedFlowDataRequest", () => {
  it("routes all five budget IDs to the correct screens", () => {
    const cases: Array<{ budget: string; screen: string }> = [
      { budget: "under_30000", screen: "NOT_QUALIFIED" },
      { budget: "30000_49999", screen: "NOT_QUALIFIED" },
      { budget: "50000_100000", screen: "PROJECT_SCREEN" },
      { budget: "100000_250000", screen: "PROJECT_SCREEN" },
      { budget: "250000_plus", screen: "PROJECT_SCREEN" },
    ];

    for (const { budget, screen } of cases) {
      const response = handleDecryptedFlowDataRequest(budgetExchangeRequest(budget));
      expect(response.screen, budget).toBe(screen);
      expect(response.data).toMatchObject({
        budget_range: budget,
        source: "whatsapp_flow",
        flow_name: "Fratelanza Lead Qualification",
      });
    }

    expect(META_FLOW_BUDGET_IDS).toHaveLength(5);
  });

  it("returns a Flow error for missing budget_range", () => {
    const response = handleDecryptedFlowDataRequest({
      version: FLOW_DATA_API_VERSION,
      action: "data_exchange",
      screen: BUDGET_SCREEN_ID,
      flow_token: "token",
      data: { source: "whatsapp_flow" },
    });

    expect(response.screen).toBe(BUDGET_SCREEN_ID);
    expect((response.data as { error_message?: string }).error_message).toMatch(/Invalid budget/i);
  });

  it("returns a Flow error for unknown budget_range and never qualifies", () => {
    const response = handleDecryptedFlowDataRequest(budgetExchangeRequest("99999_99999"));
    expect(response.screen).toBe(BUDGET_SCREEN_ID);
    expect((response.data as { error_message?: string }).error_message).toBeDefined();
    expect(response.data).not.toHaveProperty("budget_qualified");
  });

  it("rejects client-supplied budget_qualified", () => {
    const response = handleDecryptedFlowDataRequest(
      budgetExchangeRequest("50000_100000", { budget_qualified: true }),
    );
    expect(response.screen).toBe(BUDGET_SCREEN_ID);
    expect((response.data as { error_message?: string }).error_message).toMatch(/Invalid request/i);
  });

  it("responds to ping health checks", () => {
    const response = handleDecryptedFlowDataRequest({
      version: FLOW_DATA_API_VERSION,
      action: "ping",
      flow_token: "token",
    });
    expect(response.data).toEqual({ status: "active" });
  });

  it("rejects invalid flow_token", () => {
    const response = handleDecryptedFlowDataRequest({
      ...budgetExchangeRequest("50000_100000"),
      flow_token: "",
    });
    expect(response.screen).toBe(BUDGET_SCREEN_ID);
    expect((response.data as { error_message?: string }).error_message).toMatch(/session/i);
  });
});

describe("handleFlowDataEndpointRequest", () => {
  it("returns encrypted 200 for a valid encrypted budget exchange", () => {
    const keys = generateTestKeyPair();
    const payload = budgetExchangeRequest("under_30000");
    const { body } = encryptFlowRequestForTest(payload, keys.publicKey);
    const rawBody = Buffer.from(JSON.stringify(body));

    const result = handleFlowDataEndpointRequest({
      encryptedBody: body,
      rawBody,
      env: { privateKeyPem: keys.privateKey },
    });

    expect(result.statusCode).toBe(200);
    expect(result.contentType).toBe("text/plain");
    expect(result.body.length).toBeGreaterThan(0);
  });

  it("returns 403 when signature validation fails", () => {
    const keys = generateTestKeyPair();
    const { body } = encryptFlowRequestForTest(budgetExchangeRequest("50000_100000"), keys.publicKey);
    const rawBody = Buffer.from(JSON.stringify(body));

    const result = handleFlowDataEndpointRequest({
      encryptedBody: body,
      rawBody,
      signatureHeader: "sha256=deadbeef",
      env: {
        privateKeyPem: keys.privateKey,
        appSecret: "app-secret",
      },
    });

    expect(result.statusCode).toBe(403);
  });

  it("accepts valid signature when app secret is configured", () => {
    const keys = generateTestKeyPair();
    const { body } = encryptFlowRequestForTest(budgetExchangeRequest("250000_plus"), keys.publicKey);
    const rawBody = Buffer.from(JSON.stringify(body));
    const appSecret = "app-secret";

    const result = handleFlowDataEndpointRequest({
      encryptedBody: body,
      rawBody,
      signatureHeader: computeMetaWebhookSignature(rawBody, appSecret),
      env: {
        privateKeyPem: keys.privateKey,
        appSecret,
      },
    });

    expect(result.statusCode).toBe(200);
  });

  it("returns 421 when decryption fails", () => {
    const keys = generateTestKeyPair();
    const otherKeys = generateTestKeyPair();
    const { body } = encryptFlowRequestForTest(budgetExchangeRequest("30000_49999"), keys.publicKey);

    const result = handleFlowDataEndpointRequest({
      encryptedBody: body,
      env: { privateKeyPem: otherKeys.privateKey },
    });

    expect(result.statusCode).toBe(421);
  });
});
