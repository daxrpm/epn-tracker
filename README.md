# EPN Notas Mallas

Aplicación web para estudiantes de la Escuela Politécnica Nacional (inicio en FIS/EPN) que permite
controlar notas, avance de malla, requisitos de graduación y simulaciones de matrícula, con reglas
académicas configurables.

La especificación completa vive en [`ERS_EPN_Notas_Mallas.md`](./ERS_EPN_Notas_Mallas.md).

## Estructura del monorepo

```
EPN-system/
├── backend/            # API FastAPI (Python + uv) — arquitectura fba + dominio puro
├── mallas/             # PDFs fuente de las mallas FIS
├── Silabos/            # PDFs fuente de sílabos de ejemplo
└── ERS_EPN_Notas_Mallas.md
```

El frontend (Vite + React + Hero UI) se agregará en una entrega posterior.

## Arquitectura

- **Backend:** FastAPI + SQLAlchemy 2 (async) + PostgreSQL + Redis, siguiendo el formato de
  [`fastapi-best-architecture`](https://github.com/fastapi-practices/fastapi_best_architecture)
  (capas `api` / `schema` / `service` / `crud` / `model` por módulo).
- **Núcleo de dominio puro** (`backend/app/domain/`): reglas académicas (notas, recuperación,
  elegibilidad, créditos, inglés) implementadas como funciones puras con `Decimal`, sin dependencias
  de framework y cubiertas por tests unitarios. **Toda la lógica académica vive aquí, nunca en
  routers ni CRUD.**

## Desarrollo

Requisitos: [`uv`](https://docs.astral.sh/uv/) y (para la base de datos) Docker.

```bash
# Servicios de datos (Postgres + Redis)
docker compose up -d

# Backend
cd backend
uv sync
uv run pytest tests/unit -q        # tests de dominio (no requieren DB)
uv run alembic upgrade head        # migraciones
uv run python -m seeds.loader      # datos iniciales EPN/FIS
uv run uvicorn app.main:app --reload
```

API en `http://localhost:8000`, documentación en `/docs`.

## Precisión numérica

Notas, pesos y créditos usan `Decimal` en el backend y `NUMERIC` en PostgreSQL. El redondeo es solo
visual en la UI; nunca se almacena redondeado. No se usa `float`.
