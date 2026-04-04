#!/usr/bin/env bash
# ── Watchr deploy script ────────────────────────────────────────
# Can be run manually on the Synology or invoked by CI.
#
# Usage:
#   ./scripts/deploy.sh              # default: pull + build + up
#   ./scripts/deploy.sh --no-pull    # skip git pull (local changes)
#   ./scripts/deploy.sh --rollback   # restart with previous images
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

NO_PULL=false
ROLLBACK=false

for arg in "$@"; do
  case "$arg" in
    --no-pull)  NO_PULL=true ;;
    --rollback) ROLLBACK=true ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

log() { echo "==> $*"; }

# ── Rollback ────────────────────────────────────────────────────
if [ "$ROLLBACK" = true ]; then
  log "Rolling back — restarting previous containers..."
  docker compose up -d --force-recreate
  log "Rollback complete."
  exit 0
fi

# ── Pull ────────────────────────────────────────────────────────
if [ "$NO_PULL" = false ]; then
  log "Pulling latest from origin/main..."
  git fetch origin main
  git reset --hard origin/main
fi

# ── Validate .env exists ────────────────────────────────────────
if [ ! -f .env ]; then
  echo "ERROR: .env file not found at $PROJECT_DIR/.env"
  echo "Copy .env.example to .env and configure it before deploying."
  exit 1
fi

# ── Build + deploy ──────────────────────────────────────────────
log "Building containers..."
docker compose build --no-cache

log "Starting containers..."
docker compose up -d --force-recreate --remove-orphans

# ── Health check ────────────────────────────────────────────────
log "Waiting for backend health check..."
for i in $(seq 1 30); do
  if docker compose exec -T backend python -c \
    "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')" \
    2>/dev/null; then
    log "Backend healthy!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    log "ERROR: Backend failed health check after 30 attempts"
    docker compose logs --tail=50 backend
    exit 1
  fi
  echo "    Attempt $i/30 — waiting 5s..."
  sleep 5
done

# ── Cleanup ─────────────────────────────────────────────────────
log "Pruning dangling images..."
docker image prune -f

log "Deploy complete!"
docker compose ps
