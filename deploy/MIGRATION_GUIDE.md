# Lotus Pharmacies CRM — Hostinger VPS Migration Guide

Deploy your CRM to your Hostinger VPS using Docker.
You only need to copy/paste commands — no decisions required.

**Your VPS:** `srv1443693.hstgr.cloud` (`187.124.15.14`)

---

## Step 1 — Connect to your VPS

Open a terminal on your computer (Windows: PowerShell or "WSL"; Mac/Linux: Terminal).

```bash
ssh root@187.124.15.14
```

The first time, type `yes` when asked. Then paste your VPS root password (Hostinger sent it by email — you can also reset it from the Hostinger panel → "Manage" → "Reset root password").

You're now inside your VPS. The prompt should change to something like `root@srv1443693:~#`.

---

## Step 2 — Install Docker (one command)

Copy and paste this whole block:

```bash
curl -fsSL https://get.docker.com | sh && \
systemctl enable --now docker && \
apt-get install -y docker-compose-plugin git && \
docker --version && docker compose version
```

This takes about 2 minutes. When it finishes you should see two version numbers (Docker + Compose).

Docker is configured to **start automatically on every boot** — you don't need to do anything if the server reboots.

---

## Step 3 — Get the project code onto the VPS

You have two options. Pick **A** if your code is on GitHub, **B** if you want to upload directly from Replit.

### Option A — Clone from GitHub *(easiest if you already pushed to GitHub)*

```bash
cd /opt
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git lotus-crm
cd lotus-crm
```

Replace the URL with your repo. If it's private, use a personal access token in the URL:
`https://USERNAME:TOKEN@github.com/USERNAME/REPO.git`

### Option B — Upload from your computer *(no GitHub needed)*

1. On Replit, open the **Files** panel, click the three dots at the top, and **"Download as zip"**.
2. Unzip the file on your computer.
3. From your computer's terminal (not the VPS!) run:

   ```bash
   scp -r ./your-unzipped-folder root@187.124.15.14:/opt/lotus-crm
   ```

4. Then SSH back into the VPS and:

   ```bash
   cd /opt/lotus-crm
   ```

---

## Step 4 — Configure secrets (passwords + JWT key)

You need to create a `.env` file with two strong passwords. From inside `/opt/lotus-crm`:

```bash
cd deploy
cp .env.example .env
```

Now generate a secure random `JWT_SECRET` and a database password:

```bash
echo "JWT_SECRET=$(openssl rand -hex 48)"
echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)"
```

Open the `.env` file:

```bash
nano .env
```

Replace the placeholder values for `JWT_SECRET` and `POSTGRES_PASSWORD` with the ones the previous command printed. Save with **Ctrl+O**, then **Enter**, then **Ctrl+X** to exit.

Leave `RUN_SEED=true` for the first run so the database gets the sample users and data.

---

## Step 5 — Build and start everything (one command)

Still inside `/opt/lotus-crm/deploy`:

```bash
chmod +x deploy.sh
./deploy.sh up
```

The first build takes **5–10 minutes** (it's downloading Node, installing all packages, building the React app and the API). After that, restarts take seconds.

When it finishes you'll see logs scrolling by. Press **Ctrl+C** to stop tailing — the app keeps running in the background.

---

## Step 6 — Open the app

In your browser, go to:

```
http://187.124.15.14
```

Log in with the seeded admin account:

| Email                          | Password   | Role  |
|--------------------------------|------------|-------|
| `layla@lotuspharmacies.com`    | `admin123` | Admin |
| `ahmed@lotuspharmacies.com`    | `agent123` | Agent |
| `sara@lotuspharmacies.com`     | `agent123` | Agent |
| `omar@lotuspharmacies.com`     | `agent123` | Agent |
| `nora@lotuspharmacies.com`     | `agent123` | Agent |
| `youssef@lotuspharmacies.com`  | `agent123` | Agent |

> **Important:** Change the admin password once you're logged in.

---

## What runs after a server reboot?

Docker is set to start on boot, and every container has `restart: unless-stopped` — so if your VPS reboots (power outage, Hostinger maintenance, etc.) the entire app comes back up automatically. You don't have to do anything.

---

## Daily operations

All commands are run from `/opt/lotus-crm/deploy`:

| What you want                   | Command              |
|---------------------------------|----------------------|
| See if everything is running    | `./deploy.sh status` |
| View live logs                  | `./deploy.sh logs`   |
| Stop the app                    | `./deploy.sh down`   |
| Start the app                   | `./deploy.sh up`     |
| Pull latest code & restart      | `./deploy.sh update` |

---

## Connecting a domain (later)

When you have a domain name (e.g. `crm.yourcompany.com`):

1. In your DNS provider, create an **A record** pointing to `187.124.15.14`.
2. SSH into the VPS and install Certbot:

   ```bash
   apt-get install -y certbot python3-certbot-nginx
   ```

3. Stop the web container temporarily:

   ```bash
   cd /opt/lotus-crm/deploy && docker compose stop web
   ```

4. Run Certbot in standalone mode to get a certificate:

   ```bash
   certbot certonly --standalone -d crm.yourcompany.com
   ```

5. We'll then mount the cert into the nginx container — message me ("add HTTPS for `crm.yourcompany.com`") and I'll update the configs.

---

## Troubleshooting

**The build fails**
Run `docker compose logs api` — usually it's a missing env var. Make sure `.env` has `JWT_SECRET` set to a long string and `POSTGRES_PASSWORD` set.

**The page doesn't load at all**
Check if port 80 is open on your VPS:
```bash
ufw status
ufw allow 80/tcp
ufw allow 443/tcp
```

**"502 Bad Gateway" error**
The web container is up but the API isn't ready. Wait 30 seconds for the database to finish initializing on first boot. If it persists, check `docker compose logs api`.

**I want to wipe everything and start over**
```bash
cd /opt/lotus-crm/deploy
docker compose down -v       # the -v also deletes the database volume
./deploy.sh up
```

**The frontend shows but logging in returns "Invalid credentials"**
The seed didn't run. Check `docker compose logs api` for `Seed complete`. If you see a seed error, restart with `RUN_SEED=true` in `.env` and:
```bash
docker compose restart api
```
