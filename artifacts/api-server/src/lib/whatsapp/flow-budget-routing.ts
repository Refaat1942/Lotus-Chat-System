/**
 * Strict budget_range → screen routing for the Flow Data Endpoint.
 * Uses exact Meta Flow budget IDs only (no threshold inference).
 */

export const FRATELANZA_FLOW_NAME = "Fratelanza Lead Qualification";
export const FRATELANZA_FLOW_SOURCE = "whatsapp_flow";

export const META_FLOW_BUDGET_IDS = [
  "under_30000",
  "30000_49999",
  "50000_100000",
  "100000_250000",
  "250000_plus",
] as const;

export type MetaFlowBudgetId = (typeof META_FLOW_BUDGET_IDS)[number];

const UNQUALIFIED_BUDGET_IDS = new Set<MetaFlowBudgetId>(["under_30000", "30000_49999"]);

const QUALIFIED_BUDGET_IDS = new Set<MetaFlowBudgetId>([
  "50000_100000",
  "100000_250000",
  "250000_plus",
]);

export type BudgetRouteScreen = "NOT_QUALIFIED" | "PROJECT_SCREEN";

export function isKnownBudgetId(value: string): value is MetaFlowBudgetId {
  return (META_FLOW_BUDGET_IDS as readonly string[]).includes(value);
}

/** Route by exact budget slug. Returns null for unknown values. */
export function routeBudgetScreen(budgetRange: string): BudgetRouteScreen | null {
  const id = budgetRange.trim();
  if (UNQUALIFIED_BUDGET_IDS.has(id as MetaFlowBudgetId)) {
    return "NOT_QUALIFIED";
  }
  if (QUALIFIED_BUDGET_IDS.has(id as MetaFlowBudgetId)) {
    return "PROJECT_SCREEN";
  }
  return null;
}

export interface BudgetExchangeScreenData {
  budget_range: string;
  source: string;
  flow_name: string;
}

export function buildBudgetExchangeScreenData(
  budgetRange: MetaFlowBudgetId,
  source: string,
  flowName: string,
): BudgetExchangeScreenData {
  return {
    budget_range: budgetRange,
    source,
    flow_name: flowName,
  };
}
