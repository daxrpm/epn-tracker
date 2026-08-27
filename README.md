# EPN Notas Mallas

Aplicación web para estudiantes de la Escuela Politécnica Nacional (inicio en FIS) que permite
controlar notas, avance de malla, requisitos de graduación y simulaciones de matrícula, con
reglas académicas configurables.

> Proyecto hecho por estudiantes. **No es un sistema oficial de la EPN** y no tiene respaldo
> institucional.

## Documentación

| Documento                                                              | Para qué                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------- |
| [`CONTRIBUTING.md`](./CONTRIBUTING.md)                                 | Entorno de desarrollo y flujo de trabajo                |
| [`AGENTS.md`](./AGENTS.md)                                             | Contrato de trabajo para agentes de IA y contribuyentes |
| [`CLAUDE.md`](./CLAUDE.md)                                             | Guía operativa de Claude Code en este repo              |
| [`DESIGN.md`](./DESIGN.md)                                             | Dirección de diseño y sistema visual                    |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)                       | Cómo está organizado el sistema y por qué               |
| [`docs/SECURITY.md`](./docs/SECURITY.md)                               | Modelo de amenaza y controles                           |
| [`docs/CURRICULUM_DATA_HANDOFF.md`](./docs/CURRICULUM_DATA_HANDOFF.md) | Extracción y carga de las mallas                        |
| [`ERS_EPN_Notas_Mallas.md`](./ERS_EPN_Notas_Mallas.md)                 | Especificación funcional completa                       |

## Estructura

```
EPN-system/
├── backend/      API FastAPI (Python + uv) — arquitectura fba + dominio puro
├── frontend/     SPA Vite + React + TS — shadcn/ui sobre Tailwind 4
├── mallas/       PDFs fuente de las mallas FIS
├── Silabos/      PDFs fuente de sílabos de ejemplo
└── .claude/      Skills del proyecto (anti-slop, taste-skill)
```

## Arranque con Docker

```bash
cp .env.dev.example .env.dev
docker compose --env-file .env.dev up --build
```

Levanta Postgres, Redis, MinIO y la API; aplica migraciones, carga las cuatro mallas FIS y crea
el super admin.

- API: `http://localhost:8000` · Docs: `http://localhost:8000/docs` (solo en dev)
- Readiness: `GET /api/v1/health/ready`
- Super admin inicial: `admin@epn.edu.ec` / `ChangeMe-12345`

`docker compose up` carga además `docker-compose.override.yml`, que publica los puertos de las
bases de datos en el host para poder inspeccionarlas. Si alguno está ocupado:

```bash
MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101 POSTGRES_PORT=55432 docker compose --env-file .env.dev up -d
```

Para entrar en local hay dos caminos: las credenciales de arriba, o registrarte y leer el código
en `docker compose --env-file .env.dev logs backend` (el backend `console` solo los imprime
cuando `APP_ENV=dev`).

## Desarrollo local

Requisitos: [`uv`](https://docs.astral.sh/uv/), Node 22 y Docker. Las versiones exactas están
ancladas en `backend/.python-version` y `frontend/.nvmrc`, y son las mismas que se despliegan.

```bash
make setup     # dependencias y .env.dev
make up        # Postgres, Redis y MinIO
make migrate   # esquema
make seed      # las cuatro mallas FIS y el super admin
make dev       # API en :8000 y app en :5173
```

`make` sin argumentos lista todas las tareas. Si algún puerto está ocupado:

```bash
make up POSTGRES_PORT=55432 REDIS_PORT=56379 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101
```

Detalles del flujo, formato, migraciones y commits: [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Verificación

```bash
make check         # lo mismo que ejecuta CI: formato, estilo, tipos y pruebas
make migrate-check # migraciones vs modelos, contra Postgres real
```

## Despliegue

Producción usa **solo** el fichero base de Compose, para que Postgres, Redis y MinIO queden en la
red interna y no publicados:

```bash
cp .env.prod.example .env.prod
# Reemplaza todos los CHANGE_ME. La app se niega a arrancar si queda alguno.
docker compose -f docker-compose.yml --env-file .env.prod config
docker compose -f docker-compose.yml --env-file .env.prod up --build -d
```

SMTP: usa `SMTP_STARTTLS=true` en el puerto 587, o `SMTP_USE_SSL=true` con `SMTP_STARTTLS=false`
para TLS implícito (465). Las migraciones se aplican antes de arrancar la API.

Los ficheros `.env.dev` y `.env.prod` están ignorados por Git; solo se versionan sus plantillas.

## Precisión numérica

Notas, pesos y créditos usan `Decimal` en el backend y `NUMERIC` en PostgreSQL. **No se usa
`float`**: `to_decimal()` lo rechaza explícitamente. El redondeo es solo visual; nunca se
almacena redondeado, y el frontend no recalcula ninguna nota — muestra lo que envía la API.
