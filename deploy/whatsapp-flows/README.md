# Fratelanza Lead Qualification — Meta WhatsApp Flow JSON

Endpoint-powered Flow definition for Meta WhatsApp Manager (draft only).

## Validate locally

```bash
node deploy/whatsapp-flows/validate-flow.mjs
```

## Routing design (Meta-documented)

Pure static client-side branching from one 5-option screen is **not** supported in Meta Flow Builder v6.0 without:

- `If` / `Switch` + `Footer` (Builder Preview breaks), or
- `on-select-action: navigate` on radio items (rejected for this project)

The supported pattern is **Footer → `data_exchange`** on `BUDGET_SCREEN`, with the **Flow Data Endpoint** choosing the next screen. All other transitions use static `navigate` or terminal `complete`.

| Budget | Mechanism | Destination |
|--------|-----------|-------------|
| `under_30000`, `30000_49999` | Footer → `data_exchange` → endpoint | `NOT_QUALIFIED` (terminal, `complete`) |
| `50000_100000`, `100000_250000`, `250000_plus` | Footer → `data_exchange` → endpoint | `PROJECT_SCREEN` → `CONTACT_SCREEN` → `CONFIRMATION_SCREEN` |

Configure `endpoint_uri` on the Flow via **Flows API** or **Flow Builder** (not inside Flow JSON for v6.0). Set `data_api_version: "3.0"` in the JSON.

**Server endpoint (this repo):**

```
POST https://<your-domain>/api/webhooks/whatsapp/flow
```

Requires `WHATSAPP_FLOW_PRIVATE_KEY` (RSA private key matching Meta's uploaded public key) and `WHATSAPP_APP_SECRET` for `X-Hub-Signature-256` validation.

## Endpoint contract (BUDGET_SCREEN)

**Request** (decrypted `data_exchange` payload from Meta):

```json
{
  "version": "3.0",
  "action": "data_exchange",
  "screen": "BUDGET_SCREEN",
  "data": {
    "budget_range": "under_30000",
    "source": "whatsapp_flow",
    "flow_name": "Fratelanza Lead Qualification"
  },
  "flow_token": "<from Meta>"
}
```

**Response** — under 50k (`under_30000`, `30000_49999`):

```json
{
  "version": "3.0",
  "screen": "NOT_QUALIFIED",
  "data": {
    "budget_range": "under_30000",
    "source": "whatsapp_flow",
    "flow_name": "Fratelanza Lead Qualification"
  }
}
```

**Response** — 50k+ (`50000_100000`, `100000_250000`, `250000_plus`):

```json
{
  "version": "3.0",
  "screen": "PROJECT_SCREEN",
  "data": {
    "budget_range": "50000_100000",
    "source": "whatsapp_flow",
    "flow_name": "Fratelanza Lead Qualification"
  }
}
```

On invalid `budget_range`, return the same screen with `error_message` in `data` (Meta shows a snackbar).

Flow completion (`NOT_QUALIFIED`, `CONFIRMATION_SCREEN`) uses static **`complete`** actions — no endpoint call. Existing **`nfm_reply`** webhook handling applies unchanged.

## Import

1. Paste `fratelanza-lead-qualification.flow.json` into WhatsApp Flow Builder as **draft**.
2. Configure the Flow **endpoint URI** and encryption keys in Builder / Flows API.
3. Confirm **0 Flow JSON Errors** and test Preview with endpoint reachable.
