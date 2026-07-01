.PHONY: install lint test test-unit migrate seed run

install:
	uv sync

lint:
	uv run ruff check .

test:
	uv run pytest -q

test-unit:
	uv run pytest tests/unit -q

migrate:
	uv run alembic upgrade head

seed:
	uv run python -m seeds.loader

run:
	uv run uvicorn app.main:app --reload
