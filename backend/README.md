# EPN Backend

API del sistema EPN Notas Mallas. FastAPI + SQLAlchemy 2 async + PostgreSQL + Redis, gestionado con
[`uv`](https://docs.astral.sh/uv/).

## Layout

```
app/
├── main.py            # entrypoint (uvicorn app.main:app)
├── core/              # config, app factory, logging
├── database/          # engine/sesión async, base declarativa, redis
├── common/            # enums, excepciones, envelope de respuesta, seguridad, utilidades Decimal
├── middleware/        # request-id, logging de acceso
├── domain/            # ⭐ reglas académicas puras (sin framework) + testeadas
│   ├── grading/       # cálculo de notas, recuperación, validación de esquemas
│   └── simulation/    # elegibilidad, límites de crédito, reglas de inglés
├── router.py          # agrega routers de módulos bajo /api/v1
└── modules/           # cada módulo: api/ crud/ model/ schema/ service/
    ├── iam/ academic/ offering/ evaluation/ student/ simulation/ public/
alembic/               # migraciones
seeds/                 # carga inicial (mallas JSON)
tests/                 # unit/ (dominio, sin DB) + integration/ (API)
```

## Comandos

```bash
uv sync                          # instalar dependencias
uv run pytest tests/unit -q      # tests de dominio (no requieren DB)
uv run ruff check .              # lint
uv run alembic upgrade head      # migraciones (requiere Postgres)
uv run python -m seeds.loader    # datos iniciales
uv run uvicorn app.main:app --reload
```

Copia `.env.example` a `.env` y ajusta credenciales. Levanta Postgres/Redis con
`docker compose up -d` desde la raíz del monorepo.
