# Seeds

Initial data loaded through the real curriculum import service (`commit_import`), i.e. the same
validated path used by the admin endpoint.

```bash
# Requires a running Postgres (docker compose up -d) and migrations applied.
uv run alembic upgrade head
uv run python -m seeds.loader
```

Re-running is safe: curricula that already exist are skipped.

## Data status

`data/computacion_2020.json` is a **starter subset** of the Computación 2020 curriculum (9 courses
across the early terms with representative prerequisite chains) plus the 7 non-credit graduation
requirements from ERS §8.19. It exists to make the API usable end-to-end out of the box.

The full FIS curricula (Computación, Software, Sistemas de Información, Ciencia de Datos e IA — 48–50
courses each with complete prerequisites) live in the source PDFs under `../../mallas/`. Transcribing
them to JSON is a separate data task; once transcribed, drop the files in `data/` and either re-run
the loader or upload them via `POST /api/v1/admin/curricula/import/commit`. The validation rules in
`app/modules/academic/service.py` (unique codes, existing requirement references, credit totals) will
guard the import.
