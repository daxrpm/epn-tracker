# EPN Notas Mallas — tareas del proyecto.
#
# `make` sin argumentos lista lo disponible. Cada receta hace una cosa y falla ruidosamente:
# el objetivo es que nadie tenga que recordar la invocación exacta de uv, npm, alembic o compose.
#
# Los puertos de las bases de datos son configurables porque 5432, 6379 y 9000 son justo los que
# reclama cualquier otro stack local:
#   make up POSTGRES_PORT=55432 REDIS_PORT=56379 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101

.DEFAULT_GOAL := help
SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c

BACKEND  := backend
FRONTEND := frontend
COMPOSE  := docker compose --env-file .env.dev
UV       := cd $(BACKEND) && uv run

# Exportadas para que compose y el backend vean los mismos valores.
export POSTGRES_PORT      ?= 5432
export REDIS_PORT         ?= 6379
export MINIO_PORT         ?= 9000
export MINIO_CONSOLE_PORT ?= 9001

# El backend se conecta al host, no a la red de compose, cuando corre fuera de Docker.
BACKEND_ENV := \
	POSTGRES_HOST=localhost POSTGRES_PORT=$(POSTGRES_PORT) \
	POSTGRES_USER=epn POSTGRES_PASSWORD=epn POSTGRES_DB=epn \
	REDIS_HOST=localhost REDIS_PORT=$(REDIS_PORT) REDIS_PASSWORD=epnredis \
	S3_ENDPOINT_URL=http://localhost:$(MINIO_PORT) \
	S3_PUBLIC_ENDPOINT_URL=http://localhost:$(MINIO_PORT)

.PHONY: help
help: ## Muestra esta ayuda
	@echo "EPN Notas Mallas"
	@echo
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[1m%-16s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "  Empieza con: make setup && make up && make migrate && make seed && make dev"

# --- Puesta a punto ---------------------------------------------------------------------------

.PHONY: setup
setup: ## Instala dependencias y crea .env.dev si falta
	@test -f .env.dev || (cp .env.dev.example .env.dev && echo "→ .env.dev creado desde la plantilla")
	cd $(BACKEND) && uv sync
	cd $(FRONTEND) && npm install
	@echo "→ Listo. Siguiente: make up"

.PHONY: hooks
hooks: ## Instala los hooks de pre-commit (opcional, recomendado)
	# `uv tool install` deja pre-commit en el PATH. Con `uv run --with` el binario solo existe
	# dentro de esa invocación, así que el hook que git escribe no lo encontraría después.
	uv tool install --quiet pre-commit
	pre-commit install --install-hooks
	@echo "→ Hooks instalados. Sáltalos puntualmente con: git commit --no-verify"
	@echo "→ Para quitarlos: pre-commit uninstall"

# --- Servicios --------------------------------------------------------------------------------

.PHONY: up
up: ## Levanta Postgres, Redis y MinIO
	$(COMPOSE) up -d postgres redis minio
	@echo "→ Postgres :$(POSTGRES_PORT) · Redis :$(REDIS_PORT) · MinIO :$(MINIO_PORT) (consola :$(MINIO_CONSOLE_PORT))"

.PHONY: down
down: ## Detiene los servicios (conserva los datos)
	$(COMPOSE) down

.PHONY: clean
clean: ## Detiene los servicios y BORRA los volúmenes de datos
	$(COMPOSE) down -v

.PHONY: logs
logs: ## Sigue los logs de los servicios
	$(COMPOSE) logs -f

# --- Base de datos ----------------------------------------------------------------------------

.PHONY: migrate
migrate: ## Aplica las migraciones pendientes
	$(BACKEND_ENV) $(UV) alembic upgrade head

.PHONY: migration
migration: ## Genera una migración: make migration m="descripción"
	@test -n "$(m)" || (echo "Falta el mensaje: make migration m=\"añade columna X\"" && exit 1)
	$(BACKEND_ENV) $(UV) alembic revision --autogenerate -m "$(m)"
	@echo "→ Revísala a mano antes de commitear: autogenerate no acierta siempre."

.PHONY: migrate-check
migrate-check: ## Verifica que migraciones y modelos no divergen (necesita Postgres)
	$(BACKEND_ENV) $(UV) alembic check

.PHONY: seed
seed: ## Carga las mallas FIS y crea el super admin
	$(BACKEND_ENV) cd $(BACKEND) && uv run python -m seeds.loader
	$(BACKEND_ENV) cd $(BACKEND) && uv run python -m seeds.create_admin

.PHONY: db
db: ## Abre psql contra la base de datos de desarrollo
	$(COMPOSE) exec postgres psql -U epn -d epn

.PHONY: reset
reset: clean up ## Borra los datos y vuelve a migrar y sembrar desde cero
	@echo "→ Esperando a Postgres…"
	@until $(COMPOSE) exec -T postgres pg_isready -U epn -d epn >/dev/null 2>&1; do sleep 1; done
	@$(MAKE) --no-print-directory migrate seed

# --- Desarrollo -------------------------------------------------------------------------------

.PHONY: dev
dev: ## Arranca backend y frontend a la vez (Ctrl-C detiene ambos)
	@echo "→ API http://localhost:8000 · App http://localhost:5173"
	@trap 'kill 0' EXIT INT TERM; \
	( $(BACKEND_ENV) cd $(BACKEND) && uv run uvicorn app.main:app --reload ) & \
	( cd $(FRONTEND) && npm run dev ) & \
	wait

.PHONY: dev-api
dev-api: ## Arranca solo la API
	$(BACKEND_ENV) cd $(BACKEND) && uv run uvicorn app.main:app --reload

.PHONY: dev-web
dev-web: ## Arranca solo el frontend
	cd $(FRONTEND) && npm run dev

# --- Calidad ----------------------------------------------------------------------------------

.PHONY: check
check: lint typecheck test ## Todo lo que ejecuta CI, en el mismo orden

.PHONY: format
format: ## Formatea backend y frontend
	cd $(BACKEND) && uv run ruff format . && uv run ruff check --fix .
	cd $(FRONTEND) && npx prettier --write "src/**/*.{ts,tsx,css}" "*.{json,ts}"

.PHONY: lint
lint: ## Comprueba formato y reglas de estilo
	cd $(BACKEND) && uv run ruff format --check . && uv run ruff check .
	cd $(FRONTEND) && npx prettier --check "src/**/*.{ts,tsx,css}" && npm run lint

.PHONY: typecheck
typecheck: ## Comprueba tipos en backend y frontend
	cd $(BACKEND) && uv run mypy
	cd $(FRONTEND) && npm run typecheck

.PHONY: test
test: ## Ejecuta las pruebas de backend y frontend
	cd $(BACKEND) && uv run pytest -q
	cd $(FRONTEND) && npm run test

.PHONY: test-watch
test-watch: ## Pruebas del dominio en modo watch (lo más rápido de iterar)
	cd $(BACKEND) && uv run pytest tests/unit -q --looponfail 2>/dev/null \
		|| uv run pytest tests/unit -q

.PHONY: coverage
coverage: ## Cobertura de ambos lados
	cd $(BACKEND) && uv run --with pytest-cov pytest --cov=app --cov-report=term-missing -q
	cd $(FRONTEND) && npm run test:coverage

# --- Build ------------------------------------------------------------------------------------

.PHONY: build
build: ## Compila el frontend para producción
	cd $(FRONTEND) && npm run build

.PHONY: preview
preview: build ## Sirve el build de producción contra la API local
	@echo "→ http://localhost:4173 (proxy a la API en :8000)"
	cd $(FRONTEND) && npx vite preview --port 4173
