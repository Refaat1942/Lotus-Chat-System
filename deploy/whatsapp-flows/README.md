# Fratelanza Lead Qualification — Meta WhatsApp Flow JSON

Static Flow definition for Meta WhatsApp Manager. Import as **draft only** (do not publish from this repo).

## Files

| File | Purpose |
|------|---------|
| `fratelanza-lead-qualification.flow.json` | Full Flow JSON (version 6.0) |
| `validate-flow.mjs` | Local structural validation + path simulation |

## Validate locally

```bash
node deploy/whatsapp-flows/validate-flow.mjs
```

## Import into Meta Flow Builder

1. Open [WhatsApp Flows](https://business.facebook.com/wa/manage/flows/) in Meta Business Manager.
2. Create or edit the Fratelanza Lead Qualification flow (keep in **Draft**).
3. Replace the JSON with the contents of `fratelanza-lead-qualification.flow.json`.
4. Confirm **0 validation errors** in the Builder.
5. Enable **Interactive Preview** and walk both paths (see below).

## Routing design

### BUDGET_SCREEN (fixed)

- Single `Form` with `RadioButtonsGroup` `name="budget_range"` and one `Footer` **inside the Form** (not inside `If`).
- Footer navigates to `BUDGET_GATE` with payload: `budget_range`, static `source`, static `flow_name`.
- No `${form.budget_qualified}` anywhere.

### BUDGET_GATE (conditional routing)

Meta does not support a dynamic `navigate.next` from a single Footer. Branching uses a dedicated gate screen:

- Condition uses **`${data.budget_range}`** (screen data from the previous `navigate` payload), not live form bindings.
- **Under 50,000** (`under_30000`, `30000_49999`) → `NOT_QUALIFIED` (terminal).
- **50,000+** (`50000_100000`, `100000_250000`, `250000_plus`) → `PROJECT_SCREEN` → `CONTACT_SCREEN` → `CONFIRMATION_SCREEN` (terminal).

### Completion payloads

| Path | Screen | `budget_qualified` |
|------|--------|-------------------|
| Under 50k | `NOT_QUALIFIED` | static `false` |
| 50k+ | `CONFIRMATION_SCREEN` | static `true` |

Backend derives qualification from `budget_range`; client boolean is informational only.

## Preview test matrix

| Step | Under 50k | 50k+ |
|------|-----------|------|
| 1 | Select `under_30000` or `30000_49999` | Select `50000_100000` or higher |
| 2 | BUDGET_SCREEN → متابعة | BUDGET_SCREEN → متابعة |
| 3 | BUDGET_GATE → متابعة | BUDGET_GATE → متابعة |
| 4 | NOT_QUALIFIED → إنهاء (complete) | PROJECT → CONTACT → CONFIRMATION → إرسال |

Check the Builder **Actions** tab: each Footer click should log `navigate` or `complete`.
