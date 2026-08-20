/**
 * Meta WhatsApp Flows Data API v3.0 request decryption and response encryption.
 * @see https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint/
 */

import crypto from "node:crypto";

const AES_GCM_TAG_LENGTH = 16;

export interface EncryptedFlowRequestBody {
  encrypted_flow_data: string;
  encrypted_aes_key: string;
  initial_vector: string;
}

export class FlowCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FlowCryptoError";
  }
}

function loadPrivateKey(pem: string, passphrase?: string): crypto.KeyObject {
  const trimmed = pem.trim();
  if (!trimmed.includes("BEGIN")) {
    throw new FlowCryptoError("Invalid Flow private key PEM");
  }

  try {
    return crypto.createPrivateKey({
      key: trimmed,
      format: "pem",
      passphrase: passphrase?.trim() || undefined,
    });
  } catch {
    throw new FlowCryptoError("Unable to load Flow private key");
  }
}

/** Decrypt Meta's encrypted Flow Data Endpoint request envelope. */
export function decryptFlowRequest(
  body: EncryptedFlowRequestBody,
  privateKeyPem: string,
  privateKeyPassphrase?: string,
): {
  decrypted: Record<string, unknown>;
  aesKey: Buffer;
  initialVector: Buffer;
} {
  if (
    typeof body.encrypted_flow_data !== "string" ||
    typeof body.encrypted_aes_key !== "string" ||
    typeof body.initial_vector !== "string"
  ) {
    throw new FlowCryptoError("Missing encrypted Flow request fields");
  }

  const privateKey = loadPrivateKey(privateKeyPem, privateKeyPassphrase);

  let aesKey: Buffer;
  try {
    aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(body.encrypted_aes_key, "base64"),
    );
  } catch {
    throw new FlowCryptoError("Failed to decrypt AES key");
  }

  if (aesKey.length !== 16) {
    throw new FlowCryptoError("Invalid AES key length");
  }

  const initialVector = Buffer.from(body.initial_vector, "base64");
  const flowDataBuffer = Buffer.from(body.encrypted_flow_data, "base64");

  if (flowDataBuffer.length <= AES_GCM_TAG_LENGTH) {
    throw new FlowCryptoError("Encrypted flow data too short");
  }

  const ciphertext = flowDataBuffer.subarray(0, -AES_GCM_TAG_LENGTH);
  const authTag = flowDataBuffer.subarray(-AES_GCM_TAG_LENGTH);

  let decryptedBytes: Buffer;
  try {
    const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, initialVector);
    decipher.setAuthTag(authTag);
    decryptedBytes = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new FlowCryptoError("Failed to decrypt flow payload");
  }

  let decrypted: Record<string, unknown>;
  try {
    const parsed = JSON.parse(decryptedBytes.toString("utf8")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new FlowCryptoError("Decrypted payload is not a JSON object");
    }
    decrypted = parsed as Record<string, unknown>;
  } catch (err) {
    if (err instanceof FlowCryptoError) throw err;
    throw new FlowCryptoError("Decrypted payload is not valid JSON");
  }

  return { decrypted, aesKey, initialVector };
}

function flipInitializationVector(iv: Buffer): Buffer {
  const flipped = Buffer.alloc(iv.length);
  for (let i = 0; i < iv.length; i++) {
    flipped[i] = iv[i]! ^ 0xff;
  }
  return flipped;
}

/** Decrypt an endpoint response (same AES key + flipped IV as Meta client). */
export function decryptFlowResponse(
  encryptedBase64: string,
  aesKey: Buffer,
  requestInitialVector: Buffer,
): Record<string, unknown> {
  const flippedIv = flipInitializationVector(requestInitialVector);
  const buf = Buffer.from(encryptedBase64, "base64");
  if (buf.length <= AES_GCM_TAG_LENGTH) {
    throw new FlowCryptoError("Encrypted response too short");
  }
  const ciphertext = buf.subarray(0, -AES_GCM_TAG_LENGTH);
  const authTag = buf.subarray(-AES_GCM_TAG_LENGTH);
  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, flippedIv);
  decipher.setAuthTag(authTag);
  const decryptedBytes = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const parsed = JSON.parse(decryptedBytes.toString("utf8")) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new FlowCryptoError("Decrypted response is not a JSON object");
  }
  return parsed as Record<string, unknown>;
}

/** Encrypt a Flow Data Endpoint response for Meta (returns base64 plaintext body). */
export function encryptFlowResponse(
  response: Record<string, unknown>,
  aesKey: Buffer,
  requestInitialVector: Buffer,
): string {
  const flippedIv = flipInitializationVector(requestInitialVector);
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, flippedIv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(response), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return encrypted.toString("base64");
}

/** Encrypt a request envelope for round-trip tests (simulates Meta client). */
export function encryptFlowRequestForTest(
  payload: Record<string, unknown>,
  publicKeyPem: string,
): { body: EncryptedFlowRequestBody; aesKey: Buffer; initialVector: Buffer } {
  const aesKey = crypto.randomBytes(16);
  const initialVector = crypto.randomBytes(12);

  const publicKey = crypto.createPublicKey(publicKeyPem);
  const encryptedAesKey = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    aesKey,
  );

  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, initialVector);
  const encryptedFlowData = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  return {
    body: {
      encrypted_flow_data: encryptedFlowData.toString("base64"),
      encrypted_aes_key: encryptedAesKey.toString("base64"),
      initial_vector: initialVector.toString("base64"),
    },
    aesKey,
    initialVector,
  };
}
