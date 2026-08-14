# Lotus Pharmacies CRM — Server / Domain Handoff

This document lists everything needed to host the project on your own
servers and domains. Hand this file to your IT support.

---

## 1. What it is (architecture in one paragraph)

Three Docker containers managed by **one** `docker-compose.yml`:

| Container       | Image / build          | Listens on   | Public? |
|-----------------|------------------------|--------------|---------|
| `lotus_postgres`| `postgres:16-alpine`   | `5432` (internal only) | No |
| `lotus_api`     | built from `./Dockerfile`     | `8080` (internal only) | No |
| `lotus_web`     | built from `./Dockerfile.web` (nginx) | `80` inside, mapped to host `${WEB_PORT}` (default `8090`) | **Yes** |

The browser only ever talks to **`lotus_web`** (nginx).
nginx serves the static React build and reverse-proxies anything
under `/api/` (including the WebSocket upgrade for Socket.io) to
`lotus_api:8080`. The API talks to Postgres on the internal
`lotus_net` Docker network.

There are **no Replit-runtime dependencies**. **Meta WhatsApp Cloud API**
integration is built in (see §10). Messenger / Instagram legacy generic
webhooks remain available; Meta Messenger/Instagram are not wired yet.

---

## 2. Required ports / firewall

Open **only** the host port mapped to nginx:

* `${WEB_PORT}` (default **8090**) — TCP, public

Everything else (`5432` Postgres, `8080` API) stays inside Docker.

If you put a reverse proxy (Caddy / nginx / Traefik / Cloudflare
Tunnel) in front of the container, terminate TLS there and forward
to `127.0.0.1:${WEB_PORT}`.

---

## 3. Domains & DNS

The app is fine on a bare IP, but for production give it a domain:

1. Create an **A record**: `crm.yourcompany.com` → server's public IP.
2. (Recommended) Put Caddy / nginx / Cloudflare Tunnel in front of
   port `${WEB_PORT}` to terminate TLS.
   Minimal Caddyfile example:
   ```
   crm.yourcompany.com {
       reverse_proxy 127.0.0.1:8090
   }
   ```
   Caddy will get a free Let's Encrypt cert automatically.
3. The frontend uses **relative URLs** (`/api/...`), so the app
   works under any hostname or sub-path — no env var to change.

---

## 4. Required environment variables

Copy `deploy/.env.example` → `deploy/.env` and fill in:

| Var | Purpose | Example |
|-----|---------|---------|
| `POSTGRES_USER` | DB user | `lotus` |
| `POSTGRES_PASSWORD` | **Strong** DB password | `openssl rand -hex 24` |
| `POSTGRES_DB` | DB name | `lotus` |
| `JWT_SECRET` | **Required.** Signs login tokens. Min 32 chars. | `openssl rand -hex 48` |
| `RUN_SEED` | Run demo seed on first boot | `true` (then set `false` later) |
| `FORCE_RESEED` | One-shot wipe + reseed of demo data (preserves users) | leave unset |
| `WEB_PORT` | Host port nginx is exposed on | `15600` (Fratelanza) / `8090` (Lotus) |

**Optional — Meta WhatsApp Cloud API** (required for live WhatsApp):

| Var | Purpose |
|-----|---------|
| `WHATSAPP_VERIFY_TOKEN` | String you choose; must match Meta Developer Console webhook verify token |
| `WHATSAPP_ACCESS_TOKEN` | System user permanent token with `whatsapp_business_messaging` |
| `WHATSAPP_PHONE_NUMBER_ID` | From Meta → WhatsApp → API Setup |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp Business Account (WABA) id |
| `WHATSAPP_APP_SECRET` | App secret for `X-Hub-Signature-256` validation |
| `WHATSAPP_GRAPH_API_VERSION` | Graph API version (default `v21.0`) |

**Optional — other messaging:**

| Var | Purpose |
|-----|---------|
| `WEBHOOK_SECRET` | Custom header auth for legacy messenger/instagram webhooks only |
| `MESSAGING_PROVIDER_URL` | Generic campaign send stub |

Do **not** commit `.env` or paste tokens into chat/logs.

---

## 5. First-time install on a fresh VPS

```bash
# 1. Install docker + git
curl -fsSL https://get.docker.com | sh
apt install -y git docker-compose-plugin

# 2. Clone
mkdir -p /opt && cd /opt
git clone https://github.com/Refaat1942/Pharma-SaaS-Hub.git lotus-crm
cd lotus-crm

# 3. Configure
cp deploy/.env.example deploy/.env
nano deploy/.env       # set POSTGRES_PASSWORD + JWT_SECRET

# 4. Build and start
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build

# 5. Verify
docker compose -f deploy/docker-compose.yml ps
curl -s http://localhost:8090/api/healthz   # should print {"status":"ok"}
```

App is now live at `http://<server-ip>:8090`.

---

## 6. Update / redeploy after a code change

```bash
cd /opt/lotus-crm
git pull
docker compose -f deploy/docker-compose.yml build --no-cache
docker compose -f deploy/docker-compose.yml up -d
```

DB schema changes are applied automatically on container boot
(`drizzle-kit push`); no manual migration step.

---

## 7. Default admin logins (created by seed)

| Email | Password | Role |
|-------|----------|------|
| `layla@lotuspharmacies.com` | `admin123` | admin |
| `omar@lotuspharmacies.com`  | `admin123` | admin |

Plus four demo agents (`sara@`, `youssef@`, `hana@`, `kareem@` —
all `agent123`). **Change these immediately in production**, or set
`RUN_SEED=false` and create users from scratch via Settings → Users.

---

## 8. Backups

Only Postgres holds state. Backup the named volume `lotus_db_data`:

```bash
# Daily dump (cron)
docker exec lotus_postgres pg_dump -U lotus lotus | gzip > /backup/lotus-$(date +%F).sql.gz

# Restore
gunzip -c /backup/lotus-2026-05-05.sql.gz | docker exec -i lotus_postgres psql -U lotus -d lotus
```

Uploaded files (e.g. branding logo) are stored as base64 inside the
DB, so the SQL dump captures them too.

---

## 9. Complete REST API surface (for reference)

All endpoints are served at `/api/...` and require a Bearer JWT
from `POST /api/auth/login` **except** `/api/auth/login` and
`/api/healthz`.

```
POST   /api/auth/login
GET    /api/auth/me

GET    /api/me/availability
PATCH  /api/me/availability

GET    /api/users           POST /api/users
PUT    /api/users/:id       DELETE /api/users/:id

GET    /api/customers       POST /api/customers
GET    /api/customers/:id   PUT /api/customers/:id   DELETE /api/customers/:id
POST   /api/customers/:id/block
POST   /api/customers/:id/unblock
GET    /api/customers/:id/conversations

GET    /api/conversations   POST /api/conversations
GET    /api/conversations/:id
PATCH  /api/conversations/:id            (status, assignee, tags, reason…)
GET    /api/conversations/:id/messages
POST   /api/conversations/:id/messages

GET    /api/tags            POST /api/tags   PUT /api/tags/:id   DELETE /api/tags/:id
GET    /api/quick-replies   POST /api/quick-replies   …
GET    /api/chat-reason-categories   POST/PUT/DELETE
GET    /api/chat-reasons             POST/PUT/DELETE
GET    /api/not-ready-reasons        POST/PUT/DELETE
GET    /api/role-permissions         PUT /api/role-permissions/:role

GET    /api/settings        PUT /api/settings        (branding, distribution)

GET    /api/insights
GET    /api/analytics/summary
GET    /api/analytics/chats-over-time
GET    /api/analytics/agent-performance
GET    /api/analytics/recent-activity
GET    /api/reports/overview
GET    /api/reports/chat-volume
GET    /api/reports/response-times
GET    /api/reports/customers
GET    /api/reports/branches
GET    /api/reports/tags
GET    /api/reports/heatmap
GET    /api/reports/export

GET    /api/campaigns       POST /api/campaigns
DELETE /api/campaigns/:id
POST   /api/campaigns/:id/send          ⚠ STUB — no real messaging provider

GET    /api/healthz                     (no auth, for monitoring/uptime checks)

GET    /api/webhooks/whatsapp           (Meta verification — no JWT)
POST   /api/webhooks/whatsapp           (Meta inbound — no JWT, signature validated)
POST   /api/webhooks/messenger          (legacy generic — optional WEBHOOK_SECRET)
POST   /api/webhooks/instagram          (legacy generic — optional WEBHOOK_SECRET)
```

A live realtime channel runs over **Socket.io** at `/api/socket.io/`
(nginx already proxies the WebSocket upgrade).

---

## 10. Meta WhatsApp Cloud API

### Webhook URL (production)

Meta requires **HTTPS**. Register:

```
https://<your-domain>/api/webhooks/whatsapp
```

Example: `https://crm.yourcompany.com/api/webhooks/whatsapp`

**Do not** use bare `http://IP:port` — Meta will reject it.

### Meta Developer Console setup

1. Create/open a Meta App with **WhatsApp** product enabled.
2. Link your **WhatsApp Business Account** and phone number.
3. Under **WhatsApp → Configuration → Webhook**:
   - **Callback URL:** `https://<your-domain>/api/webhooks/whatsapp`
   - **Verify token:** same value as `WHATSAPP_VERIFY_TOKEN` in `deploy/.env`
4. Click **Verify and save** (calls `GET /api/webhooks/whatsapp`).
5. Subscribe to **`messages`** field (includes inbound messages and status updates).
6. Copy **Phone number ID**, **WABA ID**, generate **System User access token**.
7. Copy **App Secret** from App Settings → Basic.

Add all values to `deploy/.env` (see §4), then rebuild:

```bash
cd /opt/fratelanza-crm/deploy
docker compose up -d --build
```

### How messages flow

| Direction | Path |
|-----------|------|
| Customer → Fratelanza | Meta POST webhook → DB → Socket.io `new_message` |
| Fratelanza → Customer | Agent sends in UI → `POST /api/conversations/:id/messages` → Meta Graph API |
| Status updates | Meta POST webhook statuses → DB → Socket.io `message_status` |

Text messages are fully supported. Image/document/audio/video ingestion is structured for future extension.

### Local / staging testing

1. Use **ngrok** or **Cloudflare Tunnel** to expose HTTPS to your local or VPS stack:
   ```bash
   ngrok http 15600
   ```
2. Set the ngrok HTTPS URL + `/api/webhooks/whatsapp` in Meta Console.
3. Send a WhatsApp message to your business number from a personal phone.
4. Confirm it appears in **Inbox → WhatsApp**.
5. Reply from the UI; confirm delivery on the phone.

### Security notes

- Webhook routes are **not** JWT-protected (Meta cannot use our tokens).
- POST webhooks validate `X-Hub-Signature-256` when `WHATSAPP_APP_SECRET` is set.
- Access tokens and app secrets must only live in environment variables.

---

## 11. Source of truth

* GitHub: <https://github.com/Refaat1942/Pharma-SaaS-Hub>
* Build / runtime config: `Dockerfile`, `Dockerfile.web`,
  `deploy/docker-compose.yml`, `deploy/nginx.conf`, `deploy/.env.example`
* DB schema: `lib/db/src/schema.ts`
* OpenAPI / API contract: `lib/api-spec/`
