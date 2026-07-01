# EPN Notas Mallas

Aplicación web para estudiantes de la Escuela Politécnica Nacional (inicio en FIS/EPN) que permite
controlar notas, avance de malla, requisitos de graduación y simulaciones de matrícula, con reglas
académicas configurables.

La especificación completa vive en [`ERS_EPN_Notas_Mallas.md`](./ERS_EPN_Notas_Mallas.md).

## Estructura del monorepo

```
EPN-system/
├── backend/            # API FastAPI (Python + uv) — arquitectura fba + dominio puro
├── frontend/           # SPA Vite + React + TS — HeroUI + Aceternity UI
├── mallas/             # PDFs fuente de las mallas FIS
├── Silabos/            # PDFs fuente de sílabos de ejemplo
└── ERS_EPN_Notas_Mallas.md
```

## Arquitectura

- **Backend:** FastAPI + SQLAlchemy 2 (async) + PostgreSQL + Redis, siguiendo el formato de
  [`fastapi-best-architecture`](https://github.com/fastapi-practices/fastapi_best_architecture)
  (capas `api` / `schema` / `service` / `crud` / `model` por módulo).
- **Núcleo de dominio puro** (`backend/app/domain/`): reglas académicas (notas, recuperación,
  elegibilidad, créditos, inglés) implementadas como funciones puras con `Decimal`, sin dependencias
  de framework y cubiertas por tests unitarios. **Toda la lógica académica vive aquí, nunca en
  routers ni CRUD.**

## Arranque completo con Docker (recomendado)

Con Docker instalado, un solo comando levanta Postgres + Redis + la API, aplica migraciones, carga la
malla de arranque y crea el super admin:

```bash
docker compose up --build
```

- API: `http://localhost:8000` · Docs: `http://localhost:8000/docs`
- Super admin inicial: `admin@epn.edu.ec` / `ChangeMe-12345` (cámbialo en `docker-compose.yml`).
- Readiness: `GET /api/v1/health/ready` (verifica base de datos y Redis).

## Desarrollo local (sin Docker para la app)

Requisitos: [`uv`](https://docs.astral.sh/uv/). La base de datos puede venir de `docker compose up -d
postgres redis`.

```bash
cd backend
uv sync
uv run pytest -q                   # 56 tests (dominio + integración, sin DB externa)
uv run alembic upgrade head        # migraciones (requiere Postgres)
uv run python -m seeds.loader      # malla de arranque
uv run python -m seeds.create_admin  # super admin (usa FIRST_SUPERADMIN_*)
uv run uvicorn app.main:app --reload
```

## Frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173 (proxya /api al backend en :8000)
```

Arquitectura, seguridad de tokens y comandos en `frontend/README.md`.

## Precisión numérica

Notas, pesos y créditos usan `Decimal` en el backend y `NUMERIC` en PostgreSQL. El redondeo es solo
visual en la UI; nunca se almacena redondeado. No se usa `float`.
