# Watchr — Deployment Guide

## Overview

Watchr uses Gitea Actions for CI/CD. On every merge to `main`:

1. **Backend job** — ruff lint, mypy type check, pytest
2. **Frontend job** — ESLint, TypeScript type check, Vitest
3. **Deploy job** — SSHs into Synology, pulls latest, rebuilds containers

The pipeline is defined in `.gitea/workflows/ci-deploy.yml`.

## Docker Compose Services

| Service    | Image   | Internal Port | Description                    |
|------------|---------|---------------|--------------------------------|
| `backend`  | Custom  | 8000          | FastAPI + Uvicorn              |
| `frontend` | Custom  | 80            | React app served via nginx     |

The frontend nginx config proxies `/api/` to the backend container, so no
`VITE_API_BASE_URL` is needed in production. The SQLite database is persisted
in a named Docker volume (`db-data`).

## Synology Setup (One-Time)

### 1. Install Docker

Open **Package Center** in DSM and install **Container Manager** (Docker).
Verify from SSH:

```bash
ssh <your-user>@<synology-ip>
docker --version
docker compose version
```

### 2. Install Git

If `git` is not available, install the **Git Server** package from Package
Center (only the CLI is needed — the server component can stay disabled).

### 3. Clone the repo

```bash
# Choose a persistent path — /volume1/docker is conventional
mkdir -p /volume1/docker && cd /volume1/docker
git clone <gitea-repo-url> watchr
cd watchr
```

### 4. Configure the environment

```bash
cp .env.example .env
```

Edit `.env` with production values:

| Variable               | Production Value                                   |
|------------------------|----------------------------------------------------|
| `APP_ENV`              | `production`                                       |
| `APP_DEBUG`            | `false`                                            |
| `JWT_SECRET_KEY`       | Generate: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `TMDB_API_KEY`         | Your TMDB v3 API key                               |
| `BACKEND_CORS_ORIGINS` | `["https://watchr.yourdomain.com"]` or `["http://synology-ip:3000"]` |
| `BACKEND_PORT`         | `8000` (or change to avoid conflicts)              |
| `FRONTEND_PORT`        | `3000` (or `80` if nothing else uses it)           |

`VITE_API_BASE_URL` is **not needed** — nginx handles the API proxy internally.

### 5. Initial deploy

```bash
docker compose up -d --build
```

Verify:

```bash
curl http://localhost:8000/api/v1/health
# {"status": "ok"}
```

### 6. Create an SSH deploy key

On your Synology (or any trusted machine), generate a dedicated deploy key:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/watchr_deploy -N "" -C "watchr-deploy"
```

Add the **public** key to the Synology user's `~/.ssh/authorized_keys`:

```bash
cat ~/.ssh/watchr_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Ensure the Synology SSH service is enabled (DSM → Control Panel → Terminal &
SNMP → Enable SSH service). Note the port.

### 7. Configure Gitea repo secrets

In your Gitea repo, go to **Settings → Actions → Secrets** and add:

| Secret              | Value                                          |
|---------------------|------------------------------------------------|
| `SYNOLOGY_HOST`     | Synology IP or hostname                        |
| `SYNOLOGY_SSH_PORT` | SSH port (usually `22`)                        |
| `SYNOLOGY_USER`     | SSH username on Synology                       |
| `SYNOLOGY_SSH_KEY`  | Contents of `~/.ssh/watchr_deploy` (private key) |
| `DEPLOY_PATH`       | Absolute path to repo, e.g. `/volume1/docker/watchr` |

### 8. Register a Gitea Actions runner

Gitea Actions requires at least one runner. You can run it on the Synology
itself, on the Gitea host, or on any machine with Docker.

```bash
# Download act_runner for your architecture
# https://gitea.com/gitea/act_runner/releases
wget https://gitea.com/gitea/act_runner/releases/download/v0.2.11/act_runner-0.2.11-linux-amd64
chmod +x act_runner-*
mv act_runner-* /usr/local/bin/act_runner

# Register with your Gitea instance
act_runner register \
  --instance https://your-gitea.com \
  --token <runner-registration-token> \
  --name watchr-runner \
  --labels ubuntu-latest:docker://node:20

# Run as a daemon (or create a systemd service)
act_runner daemon &
```

To get the registration token: Gitea → Site Administration → Runners → Create
new runner, or at the repo level under Settings → Actions → Runners.

**Recommended**: Run the runner as a systemd service or DSM Task Scheduler
entry so it survives reboots.

### 9. Reverse proxy (optional)

If you want HTTPS via Synology's built-in reverse proxy:

DSM → Control Panel → Login Portal → Advanced → Reverse Proxy:

| Source                      | Destination            |
|-----------------------------|------------------------|
| `https://watchr.local:443`  | `http://localhost:3000`|

## CI/CD Pipeline

The workflow (`.gitea/workflows/ci-deploy.yml`) runs automatically on push to
`main`. It:

1. Runs **backend lint + tests** in a `python:3.12-slim` container
2. Runs **frontend lint + tests** in a `node:20-alpine` container
3. If both pass, **deploys to Synology** via SSH:
   - `git fetch origin main && git reset --hard origin/main`
   - `docker compose build --no-cache`
   - `docker compose up -d --force-recreate --remove-orphans`
   - Waits up to 2.5 minutes for the backend health check
   - Prunes dangling Docker images

### Manual deploy

You can also deploy manually from the Synology:

```bash
cd /volume1/docker/watchr
./scripts/deploy.sh             # pull + build + up
./scripts/deploy.sh --no-pull   # rebuild without pulling (local changes)
./scripts/deploy.sh --rollback  # restart previous containers
```

## Volume & Backup

The SQLite database lives in the named Docker volume `db-data`:

```bash
# One-off backup
docker cp watchr-backend:/app/data/watchr.db ./backups/watchr-$(date +%Y%m%d).db
```

### Automated daily backup via DSM Task Scheduler

DSM → Control Panel → Task Scheduler → Create → Scheduled Task → User-defined script:

```bash
#!/bin/bash
BACKUP_DIR="/volume1/backups/watchr"
mkdir -p "$BACKUP_DIR"
docker cp watchr-backend:/app/data/watchr.db "$BACKUP_DIR/watchr-$(date +%Y%m%d-%H%M).db"
# Keep only last 30 days
find "$BACKUP_DIR" -name "watchr-*.db" -mtime +30 -delete
```

Schedule: Daily at 03:00.

## Health Check

```bash
curl http://localhost:8000/api/v1/health
# {"status": "ok"}

# Or via Docker
docker compose exec backend python -c \
  "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')"
```

## Troubleshooting

**Containers won't start:**

```bash
docker compose logs --tail=100
```

**Deploy SSH fails:**

- Verify the SSH key works: `ssh -i ~/.ssh/watchr_deploy <user>@<host> -p <port>`
- Ensure the deploy user has Docker permissions (member of `docker` group)
- Check that `DEPLOY_PATH` matches the actual repo location

**Runner not picking up jobs:**

- Verify `act_runner` is running: `ps aux | grep act_runner`
- Check runner is registered in Gitea (Settings → Actions → Runners)
- Ensure the runner label matches the workflow (`ubuntu-latest`)
