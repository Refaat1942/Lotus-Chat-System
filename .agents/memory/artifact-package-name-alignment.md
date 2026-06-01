---
name: Artifact package name alignment
description: Why an artifact's package.json name must stay aligned with its Replit workflow, .replit deploy build, and Dockerfiles.
---

Each artifact's Replit dev workflow and the `.replit` deploy `build` command invoke
`pnpm --filter @workspace/<name> run ...`. The Dockerfiles do the same. The `<name>`
is fixed at artifact-registration time from the package.json `name`.

**Rule:** Keep `artifacts/<dir>/package.json` `name` aligned with the filter used by
the workflow / `.replit` / Dockerfiles (conventionally `@workspace/<dir>`).

**Why:** If the package is renamed (e.g. to `@workspace/fratelanza-crm`) but the
filters still say `@workspace/lotus-crm`, `pnpm --filter` matches **nothing** and
exits 0 — no error. Result: the dev web workflow "finishes" with "No projects matched
the filters" and never serves, and the deploy build **silently skips building the
frontend**, so the deployed server keeps serving a stale SPA. Symptom users report:
"logged in but lots of features missing/not found."

**How to apply:** When a frontend artifact won't start or the deployment serves an old
UI, check that package.json `name` matches the workflow/.replit filter. Prefer fixing
the package name (don't hand-edit `.replit`, which is Replit-managed). After renaming,
run `pnpm install` and restart the workflow.
