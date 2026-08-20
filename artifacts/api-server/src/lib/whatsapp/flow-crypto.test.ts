import crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  decryptFlowRequest,
  encryptFlowRequestForTest,
  encryptFlowResponse,
  FlowCryptoError,
} from "./flow-crypto";

function generateTestKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

describe("flow-crypto", () => {
  it("round-trips encrypt/decrypt for a Flow data_exchange payload", () => {
    const keys = generateTestKeyPair();
    const payload = {
      version: "3.0",
      action: "data_exchange",
      screen: "BUDGET_SCREEN",
      data: { budget_range: "50000_100000" },
      flow_token: "opaque-meta-token",
    };

    const { body } = encryptFlowRequestForTest(payload, keys.publicKey);
    const { decrypted, aesKey, initialVector } = decryptFlowRequest(body, keys.privateKey);

    expect(decrypted).toEqual(payload);

    const response = {
      version: "3.0",
      screen: "PROJECT_SCREEN",
      data: { budget_range: "50000_100000" },
    };
    const encryptedResponse = encryptFlowResponse(response, aesKey, initialVector);
    expect(typeof encryptedResponse).toBe("string");
    expect(encryptedResponse.length).toBeGreaterThan(0);
  });

  it("throws FlowCryptoError when encrypted fields are missing", () => {
    const keys = generateTestKeyPair();
    expect(() =>
      decryptFlowRequest(
        {
          encrypted_flow_data: "",
          encrypted_aes_key: "",
          initial_vector: "",
        },
        keys.privateKey,
      ),
    ).toThrow(FlowCryptoError);
  });

  it("throws FlowCryptoError when AES key cannot be decrypted with wrong private key", () => {
    const keysA = generateTestKeyPair();
    const keysB = generateTestKeyPair();
    const { body } = encryptFlowRequestForTest({ version: "3.0", action: "ping" }, keysA.publicKey);

    expect(() => decryptFlowRequest(body, keysB.privateKey)).toThrow(FlowCryptoError);
  });
});
