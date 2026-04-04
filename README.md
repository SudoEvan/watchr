# Watchr

A self-hosted watchlist application for tracking movies and TV shows across shared lists with re-watch support, TMDB integration, and naive recommendations.

## Features

- **User Authentication** — Register/login with JWT-based sessions
- **Watchlists** — Create, share, and favorite lists with role-based access (owner / manager / viewer)
- **Re-watch Lists** — Items cycle back instead of archiving when marked watched
- **TMDB Integration** — Search movies & TV shows, auto-populate metadata and posters
- **Watch Records** — Track when you watched each item, with notes
- **Recommendations** — Naive "what to watch next" (top 3 least-recently-watched per list)
- **Ownership Transfer** — Hand off list ownership to another user
- **Dark/Light Theme** — Slate-inspired dark mode by default, per-user light mode toggle

## Tech Stack

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Backend  | Python 3.12+, FastAPI, async SQLAlchemy, SQLite   |
| Frontend | React 18, TypeScript, Vite, TailwindCSS, TanStack Query |
| Auth     | JWT (python-jose), bcrypt (passlib)               |
| Deploy   | Docker Compose, nginx reverse proxy               |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- A [TMDB API key](https://www.themoviedb.org/settings/api) (free)

### 1. Clone & configure

```bash
git clone <repo-url> watchr && cd watchr
cp .env.example .env
# Edit .env — set SECRET_KEY and TMDB_API_KEY at minimum
```

### 2. Run with Docker Compose

```bash
docker compose up -d --build
```

- **Frontend**: http://localhost:3000
- **Backend API docs**: http://localhost:8000/docs

### Local Development (without Docker)

**Backend:**

```bash
cd backend
poetry install
poetry run uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` requests to `localhost:8000`.

## Project Structure

```text
watchr/
├── backend/
│   ├── app/
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── services/      # Auth, TMDB, recommendations
│   │   ├── routers/       # FastAPI route handlers
│   │   ├── config.py      # Pydantic settings
│   │   ├── database.py    # Async engine & session
│   │   └── main.py        # App entry point
│   ├── tests/             # pytest + httpx async tests
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/           # Axios client with auth interceptors
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Route-level page components
│   │   └── types/         # Shared TypeScript interfaces
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docs/                  # Architecture, data model, deployment docs
├── docker-compose.yml
├── .env.example
└── .gitignore
```

## API Overview

All endpoints are under `/api/v1`. See full interactive docs at `/docs` when the backend is running.

| Group       | Endpoints                                             |
| ----------- | ----------------------------------------------------- |
| Auth        | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` |
| Users       | `PATCH /users/me`                                     |
| Watchlists  | CRUD, share, favorite, transfer ownership             |
| Watch Items | CRUD per list, watch records                          |
| Search      | TMDB multi-search, movie/TV detail                    |
| Recommend   | `GET /recommend` — top 3 per accessible list          |

## Environment Variables

See `.env.example` for all available settings. Key variables:

- **`SECRET_KEY`** — JWT signing secret (required, generate a random string)
- **`TMDB_API_KEY`** — TMDB v3 API key (required for search)
- **`DATABASE_URL`** — SQLite path (default: `sqlite+aiosqlite:///./data/watchr.db`)
- **`BACKEND_CORS_ORIGINS`** — Comma-separated allowed origins

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — System design, tech stack, theming tokens
- [`docs/data-model.md`](docs/data-model.md) — ERD, table schemas, behavioral rules
- [`docs/deployment.md`](docs/deployment.md) — Docker, Synology, Gitea CI/CD setup

## License

Private — personal use.
