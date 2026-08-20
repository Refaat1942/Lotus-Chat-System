import { describe, it, expect } from "vitest";
import {
  BUDGET_QUALIFICATION_THRESHOLD_EGP,
  QUALIFIED_50K_PLUS_TAG,
  buildFlowAuditMessage,
  deriveBudgetQualified,
  mergeTags,
  parseBudgetRangeMinEgp,
  parseFlowResponseJson,
  validateAndNormalizeFlowFields,
} from "./flow-response";

describe("parseFlowResponseJson", () => {
  it("parses a JSON string response_json", () => {
    const parsed = parseFlowResponseJson(
      JSON.stringify({
        budget_range: "50000-100000",
        project_type: "Retail",
      }),
    );
    expect(parsed).toEqual({
      budget_range: "50000-100000",
      project_type: "Retail",
    });
  });

  it("accepts an already-parsed object", () => {
    expect(parseFlowResponseJson({ budget_range: "50000+" })).toEqual({
      budget_range: "50000+",
    });
  });

  it("returns null for malformed JSON without throwing", () => {
    expect(parseFlowResponseJson("{not-json")).toBeNull();
    expect(parseFlowResponseJson("")).toBeNull();
    expect(parseFlowResponseJson(null)).toBeNull();
  });
});

describe("deriveBudgetQualified", () => {
  it("qualifies when budget range minimum is >= 50,000 EGP", () => {
    expect(deriveBudgetQualified("50000-100000")).toBe(true);
    expect(deriveBudgetQualified("50000+")).toBe(true);
    expect(deriveBudgetQualified("75000 EGP")).toBe(true);
  });

  it("does not qualify when budget range is below threshold", () => {
    expect(deriveBudgetQualified("30000-49999")).toBe(false);
    expect(deriveBudgetQualified("under 50000")).toBe(false);
  });

  it("does not trust client boolean without a parseable range", () => {
    expect(deriveBudgetQualified("unknown tier", true)).toBe(false);
  });

  it("does not qualify when client boolean contradicts parsed range", () => {
    expect(deriveBudgetQualified("under 30000", true)).toBe(false);
  });
});

describe("parseBudgetRangeMinEgp", () => {
  it("parses common Fratelanza-style ranges", () => {
    expect(parseBudgetRangeMinEgp("50000-100000 EGP")).toBe(50000);
    expect(parseBudgetRangeMinEgp("50k+")).toBe(50000);
  });
});

describe("validateAndNormalizeFlowFields", () => {
  const basePayload = {
    budget_range: "50000-100000",
    project_type: "Fit-out",
    project_description: "Mall kiosk renovation",
    customer_name: "Ahmed Refaat",
    company_name: "Fratelanza",
    source: "whatsapp_ad",
    flow_name: "Fratelanza Lead Qualification",
    flow_token: "token-abc",
    conversation_id: "42",
  };

  it("normalizes expected Fratelanza Flow fields", () => {
    const flow = validateAndNormalizeFlowFields(basePayload, "Meta Flow Name");
    expect(flow).toMatchObject({
      budgetRange: "50000-100000",
      budgetQualified: true,
      projectType: "Fit-out",
      projectDescription: "Mall kiosk renovation",
      customerName: "Ahmed Refaat",
      companyName: "Fratelanza",
      leadSource: "whatsapp_ad",
      flowName: "Fratelanza Lead Qualification",
      flowToken: "token-abc",
      conversationIdFromFlow: 42,
    });
  });

  it("returns null when required fields are missing", () => {
    expect(validateAndNormalizeFlowFields({ project_type: "X" })).toBeNull();
    expect(validateAndNormalizeFlowFields({ budget_range: "50000+" })).toBeNull();
  });

  it("uses nfm_reply.name when flow_name is absent", () => {
    const { flow_name: _removed, ...rest } = basePayload;
    const flow = validateAndNormalizeFlowFields(rest, "Lead Qualification Flow");
    expect(flow?.flowName).toBe("Lead Qualification Flow");
  });
});

describe("mergeTags", () => {
  it("preserves existing tags and adds qualified tag", () => {
    expect(mergeTags(["New", "VIP"], [QUALIFIED_50K_PLUS_TAG])).toEqual([
      "New",
      "VIP",
      QUALIFIED_50K_PLUS_TAG,
    ]);
  });

  it("does not duplicate tags", () => {
    expect(mergeTags(["New", QUALIFIED_50K_PLUS_TAG], [QUALIFIED_50K_PLUS_TAG])).toEqual([
      "New",
      QUALIFIED_50K_PLUS_TAG,
    ]);
  });
});

describe("buildFlowAuditMessage", () => {
  it("includes qualification threshold in audit body", () => {
    const msg = buildFlowAuditMessage({
      budgetRange: "50000+",
      budgetQualified: true,
      projectType: "Office",
      projectDescription: null,
      customerName: "Sara",
      companyName: null,
      leadSource: "ad",
      flowName: "Lead Flow",
      flowToken: null,
      conversationIdFromFlow: null,
    });
    expect(msg).toContain("[WhatsApp Flow submitted]");
    expect(msg).toContain(BUDGET_QUALIFICATION_THRESHOLD_EGP.toLocaleString());
    expect(msg).toContain("Qualified");
  });
});
