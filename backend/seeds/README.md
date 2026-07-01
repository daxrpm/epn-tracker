# Seeds

La documentación completa del proceso, hashes, decisiones y estado de PostgreSQL está en
[`../../docs/CURRICULUM_DATA_HANDOFF.md`](../../docs/CURRICULUM_DATA_HANDOFF.md).

Initial data loaded through the real curriculum import service (`commit_import`), i.e. the same
validated path used by the admin endpoint.

```bash
# Requires a running Postgres (docker compose up -d) and migrations applied.
uv run alembic upgrade head
uv run python -m seeds.loader
```

Re-running is safe: complete curricula that already exist are skipped. To upgrade an old development
seed that has a different course count and no student progress, use:

```bash
uv run python -m seeds.loader --replace-incomplete
```

## Data status

The seed directory contains the four official FIS curricula extracted from the vector PDFs under
`../../mallas/`:

- Computación, Pénsum 2020: 50 credited curriculum entries.
- Software, Pénsum 2020: 51 credited curriculum entries.
- Sistemas de Información, Pénsum 2023: 51 credited curriculum entries.
- Ciencia de Datos e Inteligencia Artificial, Pénsum 2023: 52 credited curriculum entries.

Each curriculum has 135 credits across 9 terms. The official “Número de asignaturas” excludes the
two credited practice activities, so the JSON entry count is two higher than that summary value.
All four include the seven non-credit graduation requirements.

Regenerate and audit the JSON from the PDFs with:

```bash
python scripts/extract_curricula.py
python scripts/extract_curricula.py --write
```
