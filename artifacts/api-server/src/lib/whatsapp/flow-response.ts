/** Fratelanza Lead Qualification WhatsApp Flow — static (nfm_reply) response handling. */

export const QUALIFIED_50K_PLUS_TAG = "qualified_50k_plus";
export const BUDGET_QUALIFICATION_THRESHOLD_EGP = 50_000;

const MAX_PROJECT_TYPE = 100;
const MAX_PROJECT_DESCRIPTION = 2000;
const MAX_NAME = 200;
const MAX_SOURCE = 100;
const MAX_BUDGET_RANGE = 100;
const MAX_FLOW_NAME = 200;
const MAX_FLOW_TOKEN = 500;

export interface FlowQualificationData {
  budgetRange: string;
  budgetQualified: boolean;
  projectType: string;
  projectDescription: string | null;
  customerName: string | null;
  companyName: string | null;
  leadSource: string | null;
  flowName: string | null;
  flowToken: string | null;
  conversationIdFromFlow: number | null;
}

function trimString(value: unknown, maxLen: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function parseBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (lower === "true" || lower === "1" || lower === "yes") return true;
    if (lower === "false" || lower === "0" || lower === "no") return false;
  }
  return null;
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string") {
    const n = Number(value.trim());
    if (Number.isInteger(n) && n > 0) return n;
  }
  return null;
}

/** Safely parse Meta nfm_reply.response_json (object or JSON string). */
export function parseFlowResponseJson(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  return null;
}

function parseNumberFromString(value: string): number | null {
  const digits = value.replace(/[^\d.]/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/** Exact budget_range slugs from the Fratelanza Meta WhatsApp Flow. */
const META_FLOW_BUDGET_MIN_EGP: Readonly<Record<string, number>> = {
  under_30000: 0,
  "30000_49999": 30_000,
  "50000_100000": 50_000,
  "100000_250000": 100_000,
  "250000_plus": 250_000,
};

/**
 * Infer the minimum budget (EGP) represented by a Flow budget_range answer.
 * Returns null when the value cannot be interpreted reliably.
 */
export function parseBudgetRangeMinEgp(budgetRange: string): number | null {
  const raw = budgetRange.trim().toLowerCase();
  if (!raw) return null;

  const metaMin = META_FLOW_BUDGET_MIN_EGP[raw];
  if (metaMin !== undefined) {
    return metaMin;
  }

  const cleaned = raw
    .replace(/\begp\b/g, "")
    .replace(/\ble\b/g, "")
    .replace(/,/g, "")
    .trim();

  if (/^(under|below|less than|<)\s*[\d.]/.test(cleaned)) {
    return 0;
  }

  const openEnded = cleaned.match(/^([\d.]+)\s*(\+|and above|plus|or more|\+)/);
  if (openEnded) {
    return parseNumberFromString(openEnded[1]!);
  }

  const rangeMatch = cleaned.match(/^([\d.]+)\s*(?:-|–|—|to)\s*([\d.]+)/);
  if (rangeMatch) {
    return parseNumberFromString(rangeMatch[1]!);
  }

  const kMatch = cleaned.match(/^([\d.]+)\s*k\+?$/);
  if (kMatch) {
    const base = parseNumberFromString(kMatch[1]!);
    return base === null ? null : base * 1000;
  }

  return parseNumberFromString(cleaned);
}

/**
 * Derive qualification from budget_range. Client budget_qualified is only used
 * when the range alone cannot be parsed (never qualifies on boolean alone).
 */
export function deriveBudgetQualified(
  budgetRange: string,
  clientBudgetQualified?: boolean | null,
): boolean {
  const minEgp = parseBudgetRangeMinEgp(budgetRange);
  if (minEgp !== null) {
    return minEgp >= BUDGET_QUALIFICATION_THRESHOLD_EGP;
  }

  // Do not trust client boolean without a parseable range.
  if (clientBudgetQualified === true && budgetRange.trim()) {
    return false;
  }

  return false;
}

export function mergeTags(existing: string[], toAdd: string[]): string[] {
  const merged = new Set(existing);
  for (const tag of toAdd) {
    const t = tag.trim();
    if (t) merged.add(t);
  }
  return Array.from(merged);
}

/** Validate and normalize submitted Flow fields from parsed response_json. */
export function validateAndNormalizeFlowFields(
  parsed: Record<string, unknown>,
  metaFlowName?: string | null,
): FlowQualificationData | null {
  const budgetRange = trimString(parsed.budget_range, MAX_BUDGET_RANGE);
  const projectType = trimString(parsed.project_type, MAX_PROJECT_TYPE);

  if (!budgetRange || !projectType) {
    return null;
  }

  const clientBudgetQualified = parseBoolean(parsed.budget_qualified);
  const budgetQualified = deriveBudgetQualified(budgetRange, clientBudgetQualified);

  return {
    budgetRange,
    budgetQualified,
    projectType,
    projectDescription: trimString(parsed.project_description, MAX_PROJECT_DESCRIPTION),
    customerName: trimString(parsed.customer_name, MAX_NAME),
    companyName: trimString(parsed.company_name, MAX_NAME),
    leadSource: trimString(parsed.source, MAX_SOURCE),
    flowName:
      trimString(parsed.flow_name, MAX_FLOW_NAME) ??
      trimString(metaFlowName, MAX_FLOW_NAME),
    flowToken: trimString(parsed.flow_token, MAX_FLOW_TOKEN),
    conversationIdFromFlow: parsePositiveInt(parsed.conversation_id),
  };
}

/** Human-readable audit message stored on the conversation timeline. */
export function buildFlowAuditMessage(data: FlowQualificationData): string {
  const lines = [
    "[WhatsApp Flow submitted]",
    `Project: ${data.projectType}`,
    `Budget range: ${data.budgetRange}`,
    `Qualified (≥${BUDGET_QUALIFICATION_THRESHOLD_EGP.toLocaleString()} EGP): ${data.budgetQualified ? "Yes" : "No"}`,
  ];
  if (data.projectDescription) lines.push(`Description: ${data.projectDescription}`);
  if (data.customerName) lines.push(`Name: ${data.customerName}`);
  if (data.companyName) lines.push(`Company: ${data.companyName}`);
  if (data.leadSource) lines.push(`Source: ${data.leadSource}`);
  if (data.flowName) lines.push(`Flow: ${data.flowName}`);
  return lines.join("\n");
}
