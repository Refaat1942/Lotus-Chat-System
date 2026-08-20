#!/usr/bin/env node
/**
 * Structural validator for Fratelanza Meta WhatsApp Flow JSON.
 * Checks Meta Builder-safe patterns (no If/Switch gate routing).
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

const ALLOWED_COMPONENT_TYPES = new Set([
  "TextHeading",
  "TextSubheading",
  "TextBody",
  "TextCaption",
  "Form",
  "RadioButtonsGroup",
  "Dropdown",
  "TextArea",
  "TextInput",
  "Footer",
  "If",
  "Switch",
]);

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

function collectNavigateActions(screen) {
  const actions = [];

  walkComponents(screen.layout, (node, path) => {
    if (node["on-click-action"]?.name === "navigate") {
      actions.push({ screen: screen.id, path, action: node["on-click-action"] });
    }
    if (node.type === "RadioButtonsGroup") {
      for (const opt of node["data-source"] ?? []) {
        if (opt["on-select-action"]?.name === "navigate") {
          actions.push({
            screen: screen.id,
            path: `${path}.data-source.${opt.id}`,
            action: opt["on-select-action"],
          });
        }
      }
    }
  });

  return actions;
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

function findSwitchWithFooters(screen) {
  const results = [];
  walkComponents(screen.layout, (node, path) => {
    if (node.type !== "Switch") return;
    for (const [caseKey, items] of Object.entries(node.cases ?? {})) {
      const footers = items.filter((c) => c.type === "Footer");
      if (footers.length) {
        results.push({ path, caseKey, footers: footers.length });
      }
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

function validateComponentTypes(flow) {
  for (const screen of flow.screens) {
    walkComponents(screen.layout, (node, path) => {
      if (!node.type) {
        err(`${screen.id}: component missing required "type" at ${path}`);
        return;
      }
      if (!ALLOWED_COMPONENT_TYPES.has(node.type)) {
        warn(`${screen.id}: uncommon component type "${node.type}" at ${path}`);
      }
      if (node.type === "If" || node.type === "Switch") {
        warn(
          `${screen.id}: ${node.type} at ${path} — Meta Builder may reject conditional routing; prefer on-select-action`,
        );
      }
    });
  }
}

function validateNoGateScreen(screensById) {
  if (screensById.has("BUDGET_GATE")) {
    err("BUDGET_GATE must be removed; Meta Builder rejects If/Switch gate routing");
  }
}

function validateNoConditionalFooters(flow) {
  for (const screen of flow.screens) {
    const ifFooters = findIfWithFooters(screen);
    if (ifFooters.length) {
      err(`${screen.id}: If blocks must not contain Footer (${ifFooters.length} found)`);
    }
    const switchFooters = findSwitchWithFooters(screen);
    if (switchFooters.length) {
      err(`${screen.id}: Switch cases must not contain Footer (${switchFooters.length} found)`);
    }
  }
}

function validateBudgetScreen(screen) {
  if (screen.id !== "BUDGET_SCREEN") return;

  let radioName = null;
  let footerNavigateTarget = null;
  const optionActions = new Map();

  walkComponents(screen.layout, (node) => {
    if (node.type === "RadioButtonsGroup") {
      radioName = node.name;
      for (const opt of node["data-source"] ?? []) {
        if (!BUDGET_IDS.has(opt.id)) {
          err(`Unknown budget_range option id: ${opt.id}`);
        }
        if (opt["on-select-action"]) {
          optionActions.set(opt.id, opt["on-select-action"]);
        }
      }
    }
    if (node.type === "Footer") {
      const action = node["on-click-action"];
      if (action?.name === "navigate") {
        footerNavigateTarget = action.next?.name;
        const payload = action.payload ?? {};
        if (payload.budget_range !== "${form.budget_range}") {
          err("BUDGET_SCREEN Footer payload must use budget_range: ${form.budget_range}");
        }
      }
    }
  });

  const forms = [];
  walkComponents(screen.layout, (node) => {
    if (node.type === "Form") forms.push(node);
  });

  if (forms.length !== 1) {
    err(`BUDGET_SCREEN must have exactly one Form (found ${forms.length})`);
  }

  if (radioName !== "budget_range") {
    err(`RadioButtonsGroup name must be budget_range (found ${radioName})`);
  }

  if (footerNavigateTarget !== "PROJECT_SCREEN") {
    err(`BUDGET_SCREEN Footer must navigate to PROJECT_SCREEN (found ${footerNavigateTarget})`);
  }

  for (const id of UNQUALIFIED_BUDGET_IDS) {
    const action = optionActions.get(id);
    if (!action || action.name !== "navigate") {
      err(`BUDGET_SCREEN option ${id} must on-select navigate to NOT_QUALIFIED`);
      continue;
    }
    if (action.next?.name !== "NOT_QUALIFIED") {
      err(`BUDGET_SCREEN option ${id} must navigate to NOT_QUALIFIED`);
    }
    if (action.payload?.budget_range !== id) {
      err(`BUDGET_SCREEN option ${id} payload budget_range must be static "${id}"`);
    }
  }

  for (const id of QUALIFIED_BUDGET_IDS) {
    if (optionActions.has(id)) {
      err(`BUDGET_SCREEN option ${id} must not use on-select-action (use Footer instead)`);
    }
  }
}

function validateNavigatePayloads(flow, screensById) {
  for (const screen of flow.screens) {
    for (const { action } of collectNavigateActions(screen)) {
      const nextName = action.next?.name;
      const nextScreen = screensById.get(nextName);
      if (!nextScreen) {
        err(`${screen.id}: navigate target unknown screen ${nextName}`);
        continue;
      }
      const dataKeys = new Set(Object.keys(nextScreen.data ?? {}));
      for (const key of Object.keys(action.payload ?? {})) {
        if (!dataKeys.has(key)) {
          err(
            `${screen.id}: navigate payload key "${key}" missing in ${nextName}.data model`,
          );
        }
      }
    }
  }
}

function validateRoutingModel(flow, screensById) {
  const model = flow.routing_model ?? {};

  for (const screen of flow.screens) {
    for (const { action } of collectNavigateActions(screen)) {
      const dest = action.next?.name;
      const allowed = model[screen.id] ?? [];
      if (!allowed.includes(dest)) {
        err(`routing_model missing edge ${screen.id} -> ${dest}`);
      }
    }
  }

  const entryScreens = [...screensById.keys()].filter((id) => {
    const referenced = new Set();
    for (const dests of Object.values(model)) {
      for (const d of dests) referenced.add(d);
    }
    return !referenced.has(id);
  });

  if (entryScreens.length !== 1 || entryScreens[0] !== "BUDGET_SCREEN") {
    err(`Expected BUDGET_SCREEN as sole entry screen, found: ${entryScreens.join(", ")}`);
  }
}

function simulatePath(budgetId) {
  const steps = ["BUDGET_SCREEN"];

  if (UNQUALIFIED_BUDGET_IDS.has(budgetId)) {
    steps.push("NOT_QUALIFIED");
    return { steps, terminal: "NOT_QUALIFIED" };
  }

  if (QUALIFIED_BUDGET_IDS.has(budgetId)) {
    steps.push("PROJECT_SCREEN", "CONTACT_SCREEN", "CONFIRMATION_SCREEN");
    return { steps, terminal: "CONFIRMATION_SCREEN" };
  }

  return { steps, terminal: "BUDGET_SCREEN" };
}

function validateTerminalScreens(screensById) {
  const nq = screensById.get("NOT_QUALIFIED");
  if (!nq?.terminal) err("NOT_QUALIFIED must be terminal: true");
  if (!nq?.success) err("NOT_QUALIFIED must be success: true");

  const confirm = screensById.get("CONFIRMATION_SCREEN");
  if (!confirm?.terminal) err("CONFIRMATION_SCREEN must be terminal: true");
  if (!confirm?.success) err("CONFIRMATION_SCREEN must be success: true");

  const nqFooter = nq?.layout?.children?.find((c) => c.type === "Footer");
  const nqPayload = nqFooter?.["on-click-action"]?.payload ?? {};
  if (nqPayload.budget_qualified !== false) {
    err("NOT_QUALIFIED complete payload must include budget_qualified: false");
  }

  const confirmFooter = confirm?.layout?.children?.find((c) => c.type === "Footer");
  const confirmPayload = confirmFooter?.["on-click-action"]?.payload ?? {};
  if (confirmPayload.budget_qualified !== true) {
    err("CONFIRMATION_SCREEN complete payload must include budget_qualified: true");
  }
}

function main() {
  const raw = readFileSync(FLOW_PATH, "utf8");
  const flow = JSON.parse(raw);
  const screensById = collectScreens(flow);

  walkForForbiddenBindings(flow);
  validateComponentTypes(flow);
  validateNoGateScreen(screensById);
  validateNoConditionalFooters(flow);

  const budgetScreen = screensById.get("BUDGET_SCREEN");
  if (!budgetScreen) err("Missing BUDGET_SCREEN");
  else validateBudgetScreen(budgetScreen);

  validateRoutingModel(flow, screensById);
  validateNavigatePayloads(flow, screensById);
  validateTerminalScreens(screensById);

  console.log("=== Flow JSON Validation ===\n");
  console.log(`File: ${FLOW_PATH}`);
  console.log(`Version: ${flow.version}`);
  console.log(`Screens: ${flow.screens.length}`);
  console.log(`Routing: BUDGET_SCREEN on-select -> NOT_QUALIFIED (under 50k)`);
  console.log(`         BUDGET_SCREEN Footer -> PROJECT_SCREEN (50k+)\n`);

  if (errors.length === 0) {
    console.log("Static validation: PASSED (0 errors)\n");
  } else {
    console.log(`Static validation: FAILED (${errors.length} errors)\n`);
    errors.forEach((e) => console.log(`  ERROR: ${e}`));
    console.log();
  }

  if (warnings.length) {
    console.log("Warnings:");
    warnings.forEach((w) => console.log(`  WARN: ${w}`));
    console.log();
  }

  console.log("=== Path Simulation ===\n");
  for (const budgetId of ["under_30000", "50000_100000"]) {
    const path = simulatePath(budgetId);
    console.log(`${budgetId}: ${path.steps.join(" -> ")}`);
  }

  console.log("\n=== Meta Builder Notes ===");
  console.log("- BUDGET_GATE removed (If/Switch + Footer breaks Builder Preview)");
  console.log("- Under-50k: selecting radio auto-navigates to NOT_QUALIFIED");
  console.log("- 50k+: select radio, then click Footer -> PROJECT_SCREEN");
  console.log("- Local pass does NOT guarantee Meta Builder acceptance; paste full JSON and verify Preview.\n");

  if (errors.length > 0) process.exit(1);
}

main();
