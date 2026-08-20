#!/usr/bin/env node
/**
 * Structural validator for Fratelanza Meta WhatsApp Flow JSON.
 * Mirrors key Meta Flow validation rules used before Builder upload.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FLOW_PATH = join(__dirname, "fratelanza-lead-qualification.flow.json");

const BUDGET_IDS = new Set([
  "under_30000",
  "30000_49999",
  "50000_100000",
  "100000_250000",
  "250000_plus",
]);

const QUALIFIED_BUDGET_IDS = new Set([
  "50000_100000",
  "100000_250000",
  "250000_plus",
]);

const UNQUALIFIED_BUDGET_IDS = new Set(["under_30000", "30000_49999"]);

const errors = [];
const warnings = [];

function err(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

function walkComponents(node, visit, path = "root") {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item, i) => walkComponents(item, visit, `${path}[${i}]`));
    return;
  }
  visit(node, path);
  if (node.children) walkComponents(node.children, visit, `${path}.children`);
  if (node.then) walkComponents(node.then, visit, `${path}.then`);
  if (node.else) walkComponents(node.else, visit, `${path}.else`);
  if (node.cases) {
    for (const [key, arr] of Object.entries(node.cases)) {
      walkComponents(arr, visit, `${path}.cases.${key}`);
    }
  }
}

function collectScreens(flow) {
  const byId = new Map();
  for (const screen of flow.screens ?? []) {
    byId.set(screen.id, screen);
  }
  return byId;
}

function getNavigateTargets(screen) {
  const targets = new Set();
  walkComponents(screen.layout, (node) => {
    const action = node["on-click-action"];
    if (action?.name === "navigate" && action.next?.name) {
      targets.add(action.next.name);
    }
  });
  return targets;
}

function findScreenFooters(screen) {
  const footers = [];
  walkComponents(screen.layout, (node, path) => {
    if (node.type === "Footer") footers.push({ node, path });
  });
  return footers;
}

function findIfWithFooters(screen) {
  const results = [];
  walkComponents(screen.layout, (node, path) => {
    if (node.type !== "If") return;
    const thenFooters = (node.then ?? []).filter((c) => c.type === "Footer");
    const elseFooters = (node.else ?? []).filter((c) => c.type === "Footer");
    if (thenFooters.length || elseFooters.length) {
      results.push({ path, thenFooters: thenFooters.length, elseFooters: elseFooters.length });
    }
  });
  return results;
}

function jsonHasForbiddenBinding(value) {
  return typeof value === "string" && value.includes("${form.budget_qualified}");
}

function walkForForbiddenBindings(obj, path = "root") {
  if (typeof obj === "string") {
    if (jsonHasForbiddenBinding(obj)) {
      err(`Forbidden form binding at ${path}: ${obj}`);
    }
    return;
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => walkForForbiddenBindings(item, `${path}[${i}]`));
    return;
  }
  if (obj && typeof obj === "object") {
    for (const [k, v] of Object.entries(obj)) {
      walkForForbiddenBindings(v, `${path}.${k}`);
    }
  }
}

function validateBudgetScreen(screen) {
  if (screen.id !== "BUDGET_SCREEN") return;

  const ifBlocks = findIfWithFooters(screen);
  if (ifBlocks.length > 0) {
    err(
      `BUDGET_SCREEN must not contain If blocks with Footer (found ${ifBlocks.length})`,
    );
  }

  let formCount = 0;
  let radioName = null;
  let footerInForm = false;
  let footerOutsideForm = false;
  let footerNavigateTarget = null;

  walkComponents(screen.layout, (node, path) => {
    if (node.type === "Form") formCount += 1;
    if (node.type === "RadioButtonsGroup") {
      radioName = node.name;
      for (const opt of node["data-source"] ?? []) {
        if (!BUDGET_IDS.has(opt.id)) {
          err(`Unknown budget_range option id: ${opt.id}`);
        }
      }
    }
    if (node.type === "Footer") {
      const parentIsFormPath = path.includes(".children");
      if (screen.layout) {
        // Footer should live under Form.children on BUDGET_SCREEN
      }
      const action = node["on-click-action"];
      if (action?.name === "navigate") {
        footerNavigateTarget = action.next?.name;
        const payload = action.payload ?? {};
        if (!payload.budget_range || payload.budget_range !== "${form.budget_range}") {
          err("BUDGET_SCREEN Footer navigate payload must include budget_range: ${form.budget_range}");
        }
        for (const key of Object.keys(payload)) {
          if (jsonHasForbiddenBinding(payload[key])) {
            err(`BUDGET_SCREEN Footer payload must not use ${payload[key]}`);
          }
        }
      }
    }
  });

  // Verify Form structure: Radio + Footer as siblings inside one Form
  const forms = [];
  walkComponents(screen.layout, (node) => {
    if (node.type === "Form") forms.push(node);
  });

  if (forms.length !== 1) {
    err(`BUDGET_SCREEN must have exactly one Form (found ${forms.length})`);
  } else {
    const form = forms[0];
    const childTypes = (form.children ?? []).map((c) => c.type);
    if (!childTypes.includes("RadioButtonsGroup")) {
      err("BUDGET_SCREEN Form must contain RadioButtonsGroup");
    }
    if (!childTypes.includes("Footer")) {
      err("BUDGET_SCREEN Form must contain Footer");
    }
    const footerIdx = childTypes.indexOf("Footer");
    const radioIdx = childTypes.indexOf("RadioButtonsGroup");
    if (footerIdx >= 0 && radioIdx >= 0 && footerIdx < radioIdx) {
      err("BUDGET_SCREEN Footer must come after RadioButtonsGroup inside Form");
    }
    footerInForm = childTypes.includes("Footer");
  }

  if (radioName !== "budget_range") {
    err(`RadioButtonsGroup name must be budget_range (found ${radioName})`);
  }

  if (footerNavigateTarget !== "BUDGET_GATE") {
    err(
      `BUDGET_SCREEN Footer must navigate to BUDGET_GATE (found ${footerNavigateTarget})`,
    );
  }

  if (!footerInForm) {
    err("BUDGET_SCREEN Footer must be inside the Form component");
  }
}

function validateNavigatePayloads(flow, screensById) {
  for (const screen of flow.screens) {
    walkComponents(screen.layout, (node, path) => {
      const action = node["on-click-action"];
      if (action?.name !== "navigate") return;
      const nextName = action.next?.name;
      const nextScreen = screensById.get(nextName);
      if (!nextScreen) {
        err(`${screen.id}: navigate target unknown screen ${nextName}`);
        return;
      }
      const dataKeys = new Set(Object.keys(nextScreen.data ?? {}));
      for (const key of Object.keys(action.payload ?? {})) {
        if (!dataKeys.has(key)) {
          err(
            `${screen.id}: navigate payload key "${key}" missing in ${nextName}.data model`,
          );
        }
      }
    });
  }
}

function validateRoutingModel(flow, screensById) {
  const model = flow.routing_model ?? {};
  const screenIds = new Set(screensById.keys());

  for (const id of screenIds) {
    if (!Object.prototype.hasOwnProperty.call(model, id)) {
      warn(`routing_model missing entry for screen ${id}`);
    }
  }

  for (const [source, destinations] of Object.entries(model)) {
    if (!screensById.has(source)) {
      err(`routing_model references unknown screen ${source}`);
    }
    for (const dest of destinations) {
      if (!screensById.has(dest)) {
        err(`routing_model ${source} -> unknown ${dest}`);
      }
    }
  }

  for (const screen of flow.screens) {
    const targets = getNavigateTargets(screen);
    for (const t of targets) {
      const allowed = model[screen.id] ?? [];
      if (!allowed.includes(t)) {
        err(
          `routing_model missing edge ${screen.id} -> ${t} required by navigate action`,
        );
      }
    }
  }

  const entryScreens = [...screenIds].filter((id) => {
    const referenced = new Set();
    for (const dests of Object.values(model)) {
      for (const d of dests) referenced.add(d);
    }
    return !referenced.has(id);
  });

  if (entryScreens.length !== 1 || entryScreens[0] !== "BUDGET_SCREEN") {
    err(
      `Expected BUDGET_SCREEN as sole entry screen, found: ${entryScreens.join(", ")}`,
    );
  }
}

function simulatePath(flow, screensById, budgetId) {
  const steps = ["BUDGET_SCREEN"];
  let current = "BUDGET_SCREEN";
  let data = {
    budget_range: budgetId,
    source: "whatsapp_flow",
    flow_name: "Fratelanza Lead Qualification",
  };

  // BUDGET_SCREEN -> BUDGET_GATE
  current = "BUDGET_GATE";
  steps.push(current);

  const gate = screensById.get("BUDGET_GATE");
  const qualified =
    QUALIFIED_BUDGET_IDS.has(budgetId) &&
    gate.layout?.children?.[0]?.condition?.includes("50000_100000");

  if (QUALIFIED_BUDGET_IDS.has(budgetId)) {
    current = "PROJECT_SCREEN";
    steps.push(current);
    current = "CONTACT_SCREEN";
    steps.push(current);
    current = "CONFIRMATION_SCREEN";
    steps.push(current);
    return { steps, terminal: current, complete: true, data };
  }

  if (UNQUALIFIED_BUDGET_IDS.has(budgetId)) {
    current = "NOT_QUALIFIED";
    steps.push(current);
    return {
      steps,
      terminal: current,
      complete: true,
      data: { ...data, budget_qualified: false },
    };
  }

  return { steps, terminal: current, complete: false, data };
}

function validateTerminalScreens(screensById) {
  const nq = screensById.get("NOT_QUALIFIED");
  if (!nq?.terminal) err("NOT_QUALIFIED must be terminal: true");
  if (!nq?.success) err("NOT_QUALIFIED must be success: true");

  const confirm = screensById.get("CONFIRMATION_SCREEN");
  if (!confirm?.terminal) err("CONFIRMATION_SCREEN must be terminal: true");
  if (!confirm?.success) err("CONFIRMATION_SCREEN must be success: true");

  const nqFooter = findScreenFooters(nq)[0]?.node;
  if (nqFooter?.["on-click-action"]?.name !== "complete") {
    err("NOT_QUALIFIED Footer must use complete action");
  }
  const nqPayload = nqFooter?.["on-click-action"]?.payload ?? {};
  if (nqPayload.budget_qualified !== false) {
    err("NOT_QUALIFIED complete payload must include budget_qualified: false (static boolean)");
  }
  if (jsonHasForbiddenBinding(nqPayload.budget_qualified)) {
    err("NOT_QUALIFIED must not bind budget_qualified from form");
  }

  const confirmFooter = findScreenFooters(confirm)[0]?.node;
  const confirmPayload = confirmFooter?.["on-click-action"]?.payload ?? {};
  if (confirmPayload.budget_qualified !== true) {
    err("CONFIRMATION_SCREEN complete payload must include budget_qualified: true (static boolean)");
  }
  const requiredCompleteFields = [
    "budget_range",
    "project_type",
    "customer_name",
    "source",
    "flow_name",
  ];
  for (const field of requiredCompleteFields) {
    if (!(field in confirmPayload)) {
      err(`CONFIRMATION_SCREEN complete payload missing ${field}`);
    }
  }
}

function main() {
  const raw = readFileSync(FLOW_PATH, "utf8");
  const flow = JSON.parse(raw);

  if (!flow.version) err("Missing flow version");
  if (!Array.isArray(flow.screens) || flow.screens.length === 0) {
    err("screens array is required");
  }

  walkForForbiddenBindings(flow);

  const screensById = collectScreens(flow);
  const budgetScreen = screensById.get("BUDGET_SCREEN");
  if (!budgetScreen) err("Missing BUDGET_SCREEN");
  else validateBudgetScreen(budgetScreen);

  validateRoutingModel(flow, screensById);
  validateNavigatePayloads(flow, screensById);
  validateTerminalScreens(screensById);

  console.log("=== Flow JSON Validation ===\n");
  console.log(`File: ${FLOW_PATH}`);
  console.log(`Version: ${flow.version}`);
  console.log(`Screens: ${flow.screens.length}\n`);

  if (errors.length === 0) {
    console.log("Static validation: PASSED (0 errors)\n");
  } else {
    console.log(`Static validation: FAILED (${errors.length} errors)\n`);
    for (const e of errors) console.log(`  ERROR: ${e}`);
    console.log();
  }

  if (warnings.length) {
    console.log("Warnings:");
    for (const w of warnings) console.log(`  WARN: ${w}`);
    console.log();
  }

  console.log("=== Path Simulation ===\n");

  for (const budgetId of ["under_30000", "50000_100000"]) {
    const path = simulatePath(flow, screensById, budgetId);
    const label =
      budgetId === "under_30000" ? "Under 50k path" : "50k+ path";
    console.log(`${label} (${budgetId}):`);
    console.log(`  ${path.steps.join(" -> ")}`);
    console.log(`  Terminal: ${path.terminal}`);
    if (budgetId === "under_30000") {
      console.log("  Expected complete fields: budget_range, budget_qualified=false, source, flow_name");
    } else {
      console.log(
        "  Expected path: PROJECT_SCREEN -> CONTACT_SCREEN -> CONFIRMATION_SCREEN -> complete",
      );
    }
    console.log();
  }

  console.log("=== Preview Checklist (Meta Flow Builder) ===\n");
  console.log("1. Paste JSON into WhatsApp Flow Builder (draft, do not publish).");
  console.log("2. Enable Interactive Preview.");
  console.log("3. BUDGET_SCREEN: select budget, click متابعة -> must reach BUDGET_GATE.");
  console.log("4. Under 50k: BUDGET_GATE -> NOT_QUALIFIED -> إنهاء completes flow.");
  console.log("5. 50k+: BUDGET_GATE -> PROJECT -> CONTACT -> CONFIRMATION -> إرسال.");
  console.log("6. Actions tab must log navigate/complete for each step.\n");

  if (errors.length > 0) {
    process.exit(1);
  }
}

main();
