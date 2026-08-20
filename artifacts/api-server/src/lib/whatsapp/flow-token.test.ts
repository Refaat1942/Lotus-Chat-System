import { describe, it, expect } from "vitest";
import {
  FLOW_TOKEN_PREFIX,
  signFlowToken,
  validateFlowTokenStructure,
  verifyFlowToken,
} from "./flow-token";

describe("flow-token", () => {
  it("rejects missing or empty flow_token", () => {
    expect(validateFlowTokenStructure(undefined).ok).toBe(false);
    expect(validateFlowTokenStructure("").ok).toBe(false);
    expect(validateFlowTokenStructure("   ").ok).toBe(false);
  });

  it("accepts opaque Meta / Builder tokens structurally", () => {
    expect(verifyFlowToken("meta-builder-preview-token").ok).toBe(true);
  });

  it("verifies signed frl.v1. tokens when secret is configured", () => {
    const secret = "test-flow-token-secret";
    const token = signFlowToken({ nonce: "session-1" }, secret);
    expect(token.startsWith(FLOW_TOKEN_PREFIX)).toBe(true);
    expect(verifyFlowToken(token, secret).ok).toBe(true);
    expect(verifyFlowToken(token, "wrong-secret").ok).toBe(false);
  });

  it("rejects tampered signed tokens", () => {
    const secret = "test-flow-token-secret";
    const token = signFlowToken({ nonce: "session-1" }, secret);
    expect(verifyFlowToken(`${token}x`, secret).ok).toBe(false);
  });
});
