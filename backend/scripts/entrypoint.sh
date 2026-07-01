#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations..."
uv run --no-dev alembic upgrade head

echo "[entrypoint] Seeding curricula..."
uv run --no-dev python -m seeds.loader

echo "[entrypoint] Bootstrapping super admin..."
uv run --no-dev python -m seeds.create_admin

echo "[entrypoint] Starting API server..."
exec uv run --no-dev uvicorn app.main:app --host 0.0.0.0 --port 8000
