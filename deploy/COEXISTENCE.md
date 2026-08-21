# Running Fratelanza alongside existing Lotus CRM

If Lotus CRM is **already running** on your VPS, do **not** pull the new code
into the same folder and rebuild in place unless you intend to **replace**
Lotus. That would stop the old app and point the same port/volume at the new
build.

Use one of the two paths below.

---

## Path A — Side-by-side (recommended for testing)

Keep Lotus running. Install Fratelanza as a **second** stack.

| Resource        | Lotus CRM (existing)     | Fratelanza (new)              |
|-----------------|--------------------------|-------------------------------|
| Folder          | `/opt/lotus-crm`         | `/opt/fratelanza-crm`         |
| Compose project | `lotus` (typical)        | `fratelanza`                  |
| Containers      | `lotus_postgres`, etc.   | `fratelanza_postgres`, etc.   |
| DB volume       | `lotus_db_data`          | `fratelanza_db_data`          |
| Public port     | `8090`                   | `15600`                       |
| Database        | `lotus`                  | `fratelanza`                  |

### Steps on the VPS

```bash
# 1. Clone into a NEW directory (do not touch /opt/lotus-crm)
mkdir -p /opt && cd /opt
git clone https://github.com/Refaat1942/Lotus-Chat-System.git fratelanza-crm
cd fratelanza-crm
git checkout main   # after PR #2 is merged

# 2. Configure an isolated stack
cp deploy/.env.example deploy/.env
nano deploy/.env
```

Set these in `deploy/.env`:

```env
COMPOSE_PROJECT_NAME=fratelanza
WEB_PORT=15600
POSTGRES_USER=fratelanza
POSTGRES_PASSWORD=<new-strong-password>
POSTGRES_DB=fratelanza
JWT_SECRET=<new-random-secret>
RUN_SEED=true
```

Use **new** passwords and JWT — do not copy Lotus values.

```bash
# 3. Build and start (only Fratelanza containers)
cd deploy
docker compose --env-file .env up -d --build

# 4. Verify — Lotus should still work on 8090, Fratelanza on 15600
curl -s http://localhost:8090/api/healthz   # existing Lotus
curl -s http://localhost:15600/api/healthz  # new Fratelanza
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
```

Access:

- Lotus: `http://<vps-ip>:8090`
- Fratelanza: `http://<vps-ip>:15600`

Open firewall for **15600** if needed:

```bash
ufw allow 15600/tcp
```

---

## Path B — Replace Lotus in-place (production cutover)

Use this when Fratelanza should **take over** the same URL/port and you no
longer need the old Lotus stack.

### 1. Backup Lotus data first

```bash
cd /opt/lotus-crm/deploy
docker exec lotus_postgres pg_dump -U lotus lotus | gzip > /backup/lotus-pre-fratelanza-$(date +%F).sql.gz
```

Adjust container/user/db names if yours differ (`docker ps` to check).

### 2. Stop the old stack (frees port 8090)

```bash
cd /opt/lotus-crm/deploy
docker compose down
# Do NOT add -v unless you intentionally want to delete Lotus DB volume
```

### 3. Deploy Fratelanza in the same folder OR migrate to new folder

**Option 1 — same folder (simplest):**

```bash
cd /opt/lotus-crm
git remote set-url origin https://github.com/Refaat1942/Lotus-Chat-System.git
git pull origin main
cd deploy
# Keep WEB_PORT=8090 in .env if you want the same public URL
docker compose --env-file .env up -d --build
```

**Option 2 — new folder, same port:**

Clone to `/opt/fratelanza-crm`, set `WEB_PORT=8090`, stop Lotus first.

### 4. Optional: migrate Lotus DB into Fratelanza Postgres

Only if you need **existing Lotus customers/chats** in the new install:

```bash
# Start Fratelanza first so Postgres exists
gunzip -c /backup/lotus-pre-fratelanza-YYYY-MM-DD.sql.gz | \
  docker exec -i fratelanza_postgres psql -U fratelanza -d fratelanza
```

Then restart API:

```bash
docker compose --env-file .env restart api
```

Set `RUN_SEED=false` in `.env` after cutover so demo seed does not run again.

---

## What causes conflicts (avoid these)

| Mistake | Result |
|---------|--------|
| Same `WEB_PORT` (e.g. both 8090) | Second stack fails to bind port |
| Same `container_name` | Docker refuses to create duplicate container |
| `docker compose down -v` on Lotus | **Deletes Lotus database volume** |
| Pull new code into `/opt/lotus-crm` and rebuild while Lotus users are live | Downtime; may overwrite running containers |
| Reusing Lotus `JWT_SECRET` on a separate Fratelanza DB | Old tokens won't match users (use new secret for fresh install) |

---

## Quick decision guide

- **Testing the new build while Lotus stays live** → Path A (15600, new folder)
- **Fratelanza becomes production on the same domain/port** → Path B (backup → stop Lotus → deploy → optional DB restore)
- **Not sure yet** → Path A first, then Path B when ready

---

## After Fratelanza is verified

1. Set `RUN_SEED=false` in `deploy/.env`
2. Change default admin passwords in Settings
3. Point your domain/reverse proxy to the port you chose (15600 or 8090)
4. Remove old Lotus stack when no longer needed:

```bash
cd /opt/lotus-crm/deploy
docker compose down    # without -v if you want to keep backup volume
```
