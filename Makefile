# ── Watchr — Unified project commands ────────────────────────────

.PHONY: help lint lint-fix test test-cov backend-lint backend-test backend-test-cov \
        frontend-lint frontend-test frontend-test-cov typecheck \
        pre-commit install dev dev-down dev-logs docker-up docker-down

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Install ──────────────────────────────────────────────────────

install: ## Install all dependencies (backend + frontend + pre-commit)
	cd backend && poetry install
	cd frontend && npm install
	pre-commit install

# ── Lint — All ───────────────────────────────────────────────────

lint: backend-lint frontend-lint ## Run all linters
	markdownlint --config .markdownlint.yml '**/*.md'
	yamllint -c .yamllint.yml .

lint-fix: ## Auto-fix lint issues where possible
	cd backend && poetry run ruff check --fix --config ruff.toml .
	cd backend && poetry run ruff format --config ruff.toml .
	cd frontend && npm run lint:fix

# ── Lint — Backend ───────────────────────────────────────────────

backend-lint: ## Lint Python code with ruff + mypy
	cd backend && poetry run ruff check --config ruff.toml .
	cd backend && poetry run ruff format --check --config ruff.toml .
	cd backend && poetry run mypy app/ --config-file pyproject.toml

# ── Lint — Frontend ──────────────────────────────────────────────

frontend-lint: ## Lint TypeScript code with eslint
	cd frontend && npm run lint
	cd frontend && npm run typecheck

# ── Test — All ───────────────────────────────────────────────────

test: backend-test frontend-test ## Run all tests

test-cov: backend-test-cov frontend-test-cov ## Run all tests with coverage

# ── Test — Backend ───────────────────────────────────────────────

backend-test: ## Run backend tests
	cd backend && poetry run pytest -v

backend-test-cov: ## Run backend tests with coverage
	cd backend && poetry run pytest --cov=app --cov-report=term-missing --cov-report=html -v

# ── Test — Frontend ──────────────────────────────────────────────

frontend-test: ## Run frontend tests
	cd frontend && npm test

frontend-test-cov: ## Run frontend tests with coverage
	cd frontend && npm run test:coverage

typecheck: ## TypeScript type checking
	cd frontend && npm run typecheck

# ── Pre-commit ───────────────────────────────────────────────────

pre-commit: ## Run all pre-commit hooks on all files
	pre-commit run --all-files

# ── Docker — Dev (hot reload) ─────────────────────────────────────

dev: ## Start dev environment with hot reload (backend + frontend)
	docker compose -f docker-compose.dev.yml up -d --build

dev-down: ## Stop dev environment
	docker compose -f docker-compose.dev.yml down

dev-logs: ## Tail dev container logs
	docker compose -f docker-compose.dev.yml logs -f

# ── Docker — Production ──────────────────────────────────────────

docker-up: ## Build and start production services
	docker compose up -d --build

docker-down: ## Stop production services
	docker compose down
