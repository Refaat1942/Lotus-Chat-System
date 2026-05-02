#!/usr/bin/env bash
# ----------------------------------------------------------------------------
#  Lotus Pharmacies CRM — one-command deployment helper
#  Usage:
#    ./deploy.sh init     # first-time setup (installs Docker if missing)
#    ./deploy.sh up       # build and start
#    ./deploy.sh down     # stop everything
#    ./deploy.sh logs     # tail container logs
#    ./deploy.sh status   # show container status
#    ./deploy.sh update   # pull latest code (git) + rebuild + restart
# ----------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")"

CMD="${1:-up}"

ensure_env() {
  if [[ ! -f .env ]]; then
    echo "==> No .env file found. Copying from .env.example."
    cp .env.example .env
    echo ""
    echo "!!! IMPORTANT: edit deploy/.env and set JWT_SECRET + POSTGRES_PASSWORD"
    echo "    A safe random JWT_SECRET can be generated with:"
    echo "        openssl rand -hex 48"
    echo ""
    exit 1
  fi
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "==> Docker not found — installing (requires sudo)."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
  fi
  if ! docker compose version >/dev/null 2>&1; then
    echo "!!! Docker Compose plugin missing. On Ubuntu run:"
    echo "    sudo apt-get update && sudo apt-get install -y docker-compose-plugin"
    exit 1
  fi
}

case "$CMD" in
  init)
    ensure_docker
    ensure_env
    echo "==> Init complete. Run './deploy.sh up' to build and start."
    ;;

  up)
    ensure_env
    echo "==> Building images..."
    docker compose build
    echo "==> Starting containers (detached, auto-restart on reboot)..."
    docker compose up -d
    echo ""
    echo "==> Done. Containers:"
    docker compose ps
    echo ""
    echo "==> Tailing logs (Ctrl-C to stop tailing, app keeps running)..."
    docker compose logs -f --tail=100
    ;;

  down)
    docker compose down
    ;;

  logs)
    docker compose logs -f --tail=200
    ;;

  status)
    docker compose ps
    ;;

  update)
    echo "==> Pulling latest code..."
    git -C .. pull
    echo "==> Rebuilding and restarting..."
    docker compose up -d --build
    docker compose ps
    ;;

  *)
    echo "Usage: $0 {init|up|down|logs|status|update}"
    exit 1
    ;;
esac
