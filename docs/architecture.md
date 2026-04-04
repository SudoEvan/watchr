# Watchr — Architecture

## Overview

Watchr is a self-hosted watchlist management app designed for small households. It runs on a local network behind a reverse proxy with no public exposure. The system follows a two-service architecture: a **FastAPI backend** serving a REST API, and a **React frontend** served via nginx.

```text
┌─────────────────────────────────────────────────────┐
│                   Docker Host (Synology)             │
│                                                      │
│  ┌──────────────┐        ┌──────────────────────┐   │
│  │   frontend    │        │      backend          │   │
│  │   (nginx)     │───────▶│   (FastAPI + Uvicorn) │   │
│  │   :80         │  /api  │   :8000               │   │
│  └──────────────┘        └──────────┬───────────┘   │
│                                      │               │
│                           ┌──────────▼───────────┐   │
│                           │   SQLite (file-based) │   │
│                           │   /data/watchr.db     │   │
│                           └──────────────────────┘   │
│                                      │               │
│                           ┌──────────▼───────────┐   │
│                           │   TMDB API (external) │   │
│                           │   api.themoviedb.org  │   │
│                           └──────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer       | Technology                          | Rationale                                            |
|-------------|-------------------------------------|------------------------------------------------------|
| Backend     | Python 3.12 / FastAPI               | Async-first, lightweight, excellent DX               |
| Database    | SQLite + aiosqlite + SQLAlchemy 2.0 | Zero infrastructure, single-file, perfect for <10 users |
| Migrations  | Alembic                             | Schema versioning alongside code                     |
| Auth        | JWT (python-jose + passlib/bcrypt)  | Stateless, simple, no session store needed           |
| Movie Data  | TMDB API                            | Free tier, best coverage, poster images included     |
| Frontend    | React 18 + TypeScript + Vite        | Fast builds, type safety, modern DX                  |
| Styling     | TailwindCSS                         | Utility-first, easy dark/light theming               |
| State       | TanStack Query (React Query)        | Server-state caching, auto-refetch, pagination       |
| Routing     | React Router v6                     | Standard SPA routing                                 |
| Container   | Docker + Docker Compose             | Reproducible, Synology-compatible                    |
| CI/CD       | Gitea Actions                       | Self-hosted, mirrors GitHub Actions syntax           |

## Project Structure

```text
watchr/
├── README.md
├── docker-compose.yml
├── .env.example
├── .gitignore
├── docs/
│   ├── architecture.md          ← you are here
│   ├── data-model.md
│   └── deployment.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              ← FastAPI app entry point
│   │   ├── config.py            ← pydantic-settings config
│   │   ├── database.py          ← async engine + session factory
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── watchlist.py
│   │   │   └── watch_item.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── watchlist.py
│   │   │   └── watch_item.py
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── watchlists.py
│   │   │   ├── watch_items.py
│   │   │   └── search.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── tmdb.py
│   │       └── recommendations.py
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py
│       └── ...
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── postcss.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   └── client.ts         ← axios instance w/ interceptors
│       ├── components/
│       │   ├── layout/
│       │   ├── watchlist/
│       │   └── common/
│       ├── pages/
│       │   ├── Login.tsx
│       │   ├── Dashboard.tsx
│       │   ├── WatchlistDetail.tsx
│       │   └── ItemDetail.tsx
│       ├── hooks/
│       ├── types/
│       └── theme/
│           └── colors.ts         ← design tokens from sample_style
└── samples/
    └── sample_style.html
```

## Design Principles

1. **Documentation-first** — every component is documented before implementation.
2. **No secrets in repo** — all sensitive values live in `.env` (gitignored). `.env.example` shows the shape.
3. **Single-command startup** — `docker compose up` gets the full stack running.
4. **LAN-only by design** — network isolation is handled at the host/reverse-proxy level, not in app code.
5. **Minimal dependencies** — no Redis, no Postgres, no message queue. SQLite handles everything for this scale.

## API Design

All API endpoints are prefixed with `/api/v1/`.

| Group        | Prefix                 | Purpose                                |
|--------------|------------------------|----------------------------------------|
| Auth         | `/api/v1/auth`         | Login, register, refresh token         |
| Users        | `/api/v1/users`        | Profile, preferences, theme            |
| Watchlists   | `/api/v1/watchlists`   | CRUD, sharing, favorites               |
| Watch Items  | `/api/v1/items`        | CRUD, watch records, status            |
| Search       | `/api/v1/search`       | TMDB proxy search + show details       |
| Recommend    | `/api/v1/recommend`    | Naive "what to watch next" per list    |

See `docs/data-model.md` for the full schema and `docs/deployment.md` for Docker/CI details.

## Authentication Flow

```text
1. POST /api/v1/auth/register  → creates user, returns JWT
2. POST /api/v1/auth/login     → validates creds, returns JWT
3. All other endpoints          → Bearer token in Authorization header
4. GET  /api/v1/auth/me        → returns current user from token
```

JWT is stateless. Token expiry is configurable via `JWT_ACCESS_TOKEN_EXPIRE_MINUTES`. For a LAN-only app, a long-lived token (24h) is reasonable.

## Theming

Design tokens are derived from the MkDocs Material "slate" theme:

| Token              | Dark Mode    | Light Mode   |
|--------------------|--------------|--------------|
| `--bg-primary`     | `#1a1a2e`    | `#ffffff`    |
| `--bg-secondary`   | `#16213e`    | `#f5f5f5`    |
| `--bg-surface`     | `#0f3460`    | `#e8e8e8`    |
| `--text-primary`   | `#e0e0e0`    | `#212121`    |
| `--text-secondary` | `#a0a0a0`    | `#757575`    |
| `--accent-primary` | `#4CAF50`    | `#2E7D32`    |
| `--accent-secondary`| `#536DFE`   | `#3D5AFE`    |
| `--border`         | `#2a2a4a`    | `#e0e0e0`    |

Font: **Roboto** (body), **Roboto Mono** (code/metadata).
