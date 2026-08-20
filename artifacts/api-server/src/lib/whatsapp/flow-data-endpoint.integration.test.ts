/**
 * End-to-end Meta Flow Data API v3.0 integration verification.
 * Simulates Meta encrypting requests → POST Express route → decrypt response.
 */

import crypto from "node:crypto";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../../app";
import {
  decryptFlowResponse,
  encryptFlowRequestForTest,
} from "./flow-crypto";
import { BUDGET_SCREEN_ID, FLOW_DATA_API_VERSION } from "./flow-data-endpoint";

const FLOW_ROUTE = "/api/webhooks/whatsapp/flow";

function generateRsa2048KeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

function assertRsa2048OaepSha256(publicKeyPem: string, privateKeyPem: string): void {
  const publicKey = crypto.createPublicKey(publicKeyPem);
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const details = publicKey.asymmetricKeyDetails;
  expect(details?.modulusLength).toBe(2048);

  const plaintext = crypto.randomBytes(16);
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    plaintext,
  );
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encrypted,
  );
  expect(decrypted.equals(plaintext)).toBe(true);
}

function assertBase64(value: string): void {
  expect(value).toMatch(/^[A-Za-z0-9+/]+=*$/);
  expect(() => Buffer.from(value, "base64")).not.toThrow();
}

interface MetaRoundTripResult {
  httpStatus: number;
  contentType: string | null;
  encryptedBody: string;
  decryptedResponse: Record<string, unknown>;
  aesKey: Buffer;
  initialVector: Buffer;
}

async function postMetaEncryptedRequest(
  baseUrl: string,
  publicKeyPem: string,
  payload: Record<string, unknown>,
): Promise<MetaRoundTripResult> {
  const { body, aesKey, initialVector } = encryptFlowRequestForTest(payload, publicKeyPem);
  const res = await fetch(`${baseUrl}${FLOW_ROUTE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const encryptedBody = await res.text();
  const contentType = res.headers.get("content-type");

  const decryptedResponse = decryptFlowResponse(encryptedBody, aesKey, initialVector);

  return {
    httpStatus: res.status,
    contentType,
    encryptedBody,
    decryptedResponse,
    aesKey,
    initialVector,
  };
}

function budgetExchangePayload(budgetRange: string, extra: Record<string, unknown> = {}) {
  return {
    version: FLOW_DATA_API_VERSION,
    action: "data_exchange",
    screen: BUDGET_SCREEN_ID,
    flow_token: "integration-test-flow-token",
    data: {
      budget_range: budgetRange,
      source: "whatsapp_flow",
      flow_name: "Fratelanza Lead Qualification",
      ...extra,
    },
  };
}

describe("Meta Flow Data API v3.0 — HTTP integration", () => {
  let server: Server;
  let baseUrl: string;
  let publicKey: string;
  let privateKey: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    ({ publicKey, privateKey } = generateRsa2048KeyPair());
    assertRsa2048OaepSha256(publicKey, privateKey);

    for (const key of ["WHATSAPP_FLOW_PRIVATE_KEY", "WHATSAPP_APP_SECRET", "WHATSAPP_FLOW_TOKEN_SECRET"]) {
      savedEnv[key] = process.env[key];
    }

    process.env.WHATSAPP_FLOW_PRIVATE_KEY = privateKey;
    delete process.env.WHATSAPP_APP_SECRET;
    delete process.env.WHATSAPP_FLOW_TOKEN_SECRET;

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") throw new Error("Failed to bind test server");
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("1–2. RSA-2048 key pair + Meta-style encryption reaches Express route", () => {
    expect(publicKey).toContain("BEGIN PUBLIC KEY");
    expect(privateKey).toContain("BEGIN PRIVATE KEY");
  });

  it("3. ping: encrypt → POST → decrypt → { data: { status: active } }", async () => {
    const payload = { version: FLOW_DATA_API_VERSION, action: "ping" };
    const result = await postMetaEncryptedRequest(baseUrl, publicKey, payload);

    expect(result.httpStatus).toBe(200);
    expect(result.contentType).toMatch(/text\/plain/);
    assertBase64(result.encryptedBody);
    expect(result.decryptedResponse).toEqual({ data: { status: "active" } });
  });

  it("4. data_exchange routes all five budget IDs correctly", async () => {
    const cases: Array<{ budget: string; screen: string }> = [
      { budget: "under_30000", screen: "NOT_QUALIFIED" },
      { budget: "30000_49999", screen: "NOT_QUALIFIED" },
      { budget: "50000_100000", screen: "PROJECT_SCREEN" },
      { budget: "100000_250000", screen: "PROJECT_SCREEN" },
      { budget: "250000_plus", screen: "PROJECT_SCREEN" },
    ];

    for (const { budget, screen } of cases) {
      const result = await postMetaEncryptedRequest(
        baseUrl,
        publicKey,
        budgetExchangePayload(budget),
      );

      expect(result.httpStatus, budget).toBe(200);
      expect(result.contentType, budget).toMatch(/text\/plain/);
      assertBase64(result.encryptedBody);
      expect(result.decryptedResponse.screen, budget).toBe(screen);
      expect(result.decryptedResponse.version).toBe(FLOW_DATA_API_VERSION);
      expect(result.decryptedResponse.data).toEqual({
        budget_range: budget,
        source: "whatsapp_flow",
        flow_name: "Fratelanza Lead Qualification",
      });
    }
  });

  it("5. response uses AES-GCM, same AES key, flipped IV, Base64 body", async () => {
    const { body, aesKey, initialVector } = encryptFlowRequestForTest(
      { version: FLOW_DATA_API_VERSION, action: "ping" },
      publicKey,
    );

    const res = await fetch(`${baseUrl}${FLOW_ROUTE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const encryptedBody = await res.text();
    assertBase64(encryptedBody);

    const decrypted = decryptFlowResponse(encryptedBody, aesKey, initialVector);
    expect(decrypted).toEqual({ data: { status: "active" } });

    // Wrong AES key must fail authentication.
    const wrongKey = crypto.randomBytes(16);
    expect(() => decryptFlowResponse(encryptedBody, wrongKey, initialVector)).toThrow();

    // Un-flipped IV must fail authentication.
    const buf = Buffer.from(encryptedBody, "base64");
    const tag = buf.subarray(-16);
    const ciphertext = buf.subarray(0, -16);
    const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, initialVector);
    decipher.setAuthTag(tag);
    expect(() => {
      Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    }).toThrow();
  });

  it("8. invalid budget_range stays on BUDGET_SCREEN with error — never PROJECT_SCREEN", async () => {
    for (const bad of ["unknown_slug", "75000", "", "50000-100000"]) {
      const result = await postMetaEncryptedRequest(
        baseUrl,
        publicKey,
        budgetExchangePayload(bad),
      );

      expect(result.httpStatus, bad).toBe(200);
      expect(result.decryptedResponse.screen, bad).toBe(BUDGET_SCREEN_ID);
      expect(result.decryptedResponse.screen, bad).not.toBe("PROJECT_SCREEN");
      expect(
        (result.decryptedResponse.data as { error_message?: string }).error_message,
        bad,
      ).toBeDefined();
    }
  });

  it("9. client-supplied budget_qualified:true cannot force PROJECT_SCREEN", async () => {
    const result = await postMetaEncryptedRequest(
      baseUrl,
      publicKey,
      budgetExchangePayload("50000_100000", { budget_qualified: true }),
    );

    expect(result.httpStatus).toBe(200);
    expect(result.decryptedResponse.screen).toBe(BUDGET_SCREEN_ID);
    expect(result.decryptedResponse.screen).not.toBe("PROJECT_SCREEN");
    expect(
      (result.decryptedResponse.data as { error_message?: string }).error_message,
    ).toMatch(/Invalid request/i);
  });
});
