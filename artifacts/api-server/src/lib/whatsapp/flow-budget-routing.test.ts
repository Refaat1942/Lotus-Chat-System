import crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import { isKnownBudgetId, routeBudgetScreen } from "./flow-budget-routing";

describe("flow-budget-routing", () => {
  it("recognizes only the five Meta budget IDs", () => {
    expect(isKnownBudgetId("under_30000")).toBe(true);
    expect(isKnownBudgetId("50000_100000")).toBe(true);
    expect(isKnownBudgetId("50000-100000")).toBe(false);
    expect(isKnownBudgetId("")).toBe(false);
  });

  it("routes under-50k IDs to NOT_QUALIFIED", () => {
    expect(routeBudgetScreen("under_30000")).toBe("NOT_QUALIFIED");
    expect(routeBudgetScreen("30000_49999")).toBe("NOT_QUALIFIED");
  });

  it("routes 50k+ IDs to PROJECT_SCREEN", () => {
    expect(routeBudgetScreen("50000_100000")).toBe("PROJECT_SCREEN");
    expect(routeBudgetScreen("100000_250000")).toBe("PROJECT_SCREEN");
    expect(routeBudgetScreen("250000_plus")).toBe("PROJECT_SCREEN");
  });

  it("returns null for invalid input", () => {
    expect(routeBudgetScreen("unknown")).toBeNull();
    expect(routeBudgetScreen("75000")).toBeNull();
  });
});
