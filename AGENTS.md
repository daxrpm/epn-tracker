# AGENTS.md

Entry file for AI coding agents working on **EPN Notas Mallas**. Read this before writing code.
Human-facing setup lives in [`README.md`](./README.md); the design direction lives in
[`DESIGN.md`](./DESIGN.md).

Everything below is a claim about _this_ repository. Where a rule has a reason, the reason is
given — a rule you cannot justify is a rule you will apply in the wrong place.

---

## 1. What this product is

A web app for students of the Escuela Politécnica Nacional (starting with FIS) to track grades,
malla progress, graduation requirements and enrolment simulations.

**It is not an official EPN system.** Never add the EPN crest, imply institutional endorsement,
or present the app as authoritative. Grades here are the student's own record, not the
university's.

The users are undergraduates checking a number on a phone between classes. Optimise for that.

---

## 2. The one rule that outranks everything

> **All academic logic lives in `backend/app/domain/`, as pure functions over `Decimal`.**

No `float`, ever — `to_decimal()` raises on it deliberately. No academic rule in a router, a
crud function, or a React component. If you find yourself computing a grade, a credit limit or
an eligibility check outside `app/domain/`, you are in the wrong file.

Why it is worth being strict about: these numbers decide whether a student believes they passed.
A rule implemented twice is a rule that will disagree with itself, and the audit that produced
the current state found exactly that — the dashboard recomputing malla progress in JavaScript
floats while the backend computed it in `Decimal`.

**Corollary:** the frontend never re-derives an academic number. It displays what the API sends.
`formatDecimal` rounds for display only.

---

## 3. Architecture

```
backend/app/
  domain/          Pure academic rules. No FastAPI, no SQLAlchemy, no I/O. Fully unit-tested.
  modules/<name>/  One bounded context, always these five files:
      api.py       Routing, status codes, dependency wiring. No business rules.
      schema.py    Pydantic DTOs. Every input bounded (max_length, ge/le).
      service.py   Business rules, orchestration, authorisation decisions.
      crud.py      Data access only. No business rules. Filters that are security-relevant
                   (visibility, ownership) belong in SQL here, not in memory in the service.
      model.py     SQLAlchemy models.
  common/          Cross-cutting: deps, errors, pagination, security, sql helpers.
  core/            App config, logging, rate limiting, email, registrar.

frontend/src/
  features/<name>/ api.ts (typed client) · hooks.ts (React Query) · pages/ · components/
  components/ui/   Design-system primitives. Change these, not the pages, for global visuals.
  lib/             api client, query client, formatting helpers.
```

Modules: `academic`, `audit`, `evaluation`, `iam`, `offering`, `public`, `resources`,
`simulation`, `student`.

### Layer rules that are load-bearing

- **`service` decides, `crud` fetches.** A visibility rule expressed as a Python `if` after
  fetching everything is a data leak waiting for the next `list_*` call to forget it. See
  `evaluation/crud.list_schemes` and `resources/crud.list_resources`: the filter is in the query.
- **One definition per rule.** `evaluation.service.can_read_scheme` is _the_ scheme-visibility
  rule; four call sites use it. Do not inline a second copy.
- **Errors are `AppError` subclasses**, never bare `HTTPException`. The handler turns them into
  the standard envelope (`{"error": {"code", "message", "details"}}`).
- **Not-found and not-allowed return the same 404** on resources addressed by id, so an endpoint
  cannot be used to enumerate which ids exist.

---

## 4. Security rules that are not negotiable

These each correspond to a hole that was actually open in this repo. Re-introducing one is a
regression, and there is a test for each in `backend/tests/integration/test_access_control.py`.

1. **Every collection endpoint filters by visibility in SQL and is paginated.** Use
   `app.common.pagination.Page`. An unbounded list is both a leak and a denial of service.
2. **Every endpoint that reads a user-owned object checks ownership**, and returns 404 rather
   than 403 when the caller may not know the object exists.
3. **Changing a password, suspending or deleting a user revokes every refresh token**
   (`token_store.revoke_all`). A password change that leaves old sessions alive is not a
   password change.
4. **`/auth/refresh` re-checks that the account is still active** before rotating.
5. **Uploads are read in bounded chunks** (`_read_within_limit`), never `await file.read()`.
6. **Never echo a client-supplied `Content-Type` or filename.** Derive the MIME type from the
   validated extension (`content_type_for`) and sanitise the name (`safe_filename`).
7. **URLs from users are scheme-checked** (http/https only) before storage _and_ before render.
8. **Rate limits are keyed by both subject and origin.** Email-only keys let an attacker lock
   out a victim; origin-only keys let one attacker spray many accounts.
9. **`LIKE` patterns escape user input** with `app.common.sql.escape_like`.
10. **Outside `dev` the app fails closed:** weak secrets, missing Redis password, debug mode, or
    default credentials all refuse to boot (`Settings._check_production_secret`). Do not add an
    escape hatch.

---

## 5. Testing

Coverage is a floor, not a goal. What matters is that **each test names a behaviour a user
depends on**, and would fail if that behaviour broke.

```bash
make check   # formato, estilo, tipos y pruebas de ambos lados — lo mismo que CI
make test    # solo las pruebas
```

Las recetas están en el `Makefile` y CI las ejecuta tal cual, así que no hay dos verdades sobre
qué comando comprueba qué.

- `backend/tests/unit/domain/` — the academic rules, no I/O. Fast; run them constantly.
- `backend/tests/integration/` — the real ASGI app over in-memory SQLite and `fakeredis`. Real
  routing, real dependencies, real exception handlers.
- `backend/tests/factories.py` — shared builders. **Use these.** A test that spends 30 lines on
  setup is a test nobody will read when it fails.
- `frontend/src/**/*.test.ts` — the pure logic (grade parsing, prerequisite checks). The parts
  most likely to silently corrupt a student's data.

**When you fix a bug, write the test that would have caught it, and say so in the test's
docstring.** Every test in `test_access_control.py` does this.

Storage in tests: use the `fake_storage` fixture in `tests/integration/conftest.py`. It mirrors
the real `storage` contract exactly, so a change to that contract breaks the fixture first.

---

## 6. UI work

Read [`DESIGN.md`](./DESIGN.md) for direction, then apply the anti-slop filter in
`.claude/skills/`. Direction first, filter second — the filter removes slop but cannot add
character, so applying it without direction produces something sterile rather than something
good.

Non-negotiables from the design system:

- **No `backdrop-filter`.** It was on the sidebar, header and cards at once; with everything
  frosted nothing was foreground.
- **Three radii** (`rounded-sm` / `rounded-md` / `rounded-lg`). The largest is reserved for the
  single focal element of a screen.
- **Shadow only on things that float**: dialogs, dropdowns, the mobile drawer.
- **One accent, one moment per screen.** The politécnico blue marks what matters; spending it on
  every button makes it mean nothing.
- **State is never colour alone.** A dot, an edge, or a label goes with it.
- **Every grade, credit and percentage carries `.grade`** (mono + tabular figures), so columns
  of numbers line up and 0/O never blur.
- **Empty, loading and error states name the cause and the next action.** "No hay datos" is not
  a state, it is a shrug.
- **MOTION 1**: transitions and hover states. No ambient animation, no perpetual loops.

Every interactive element must do something real or not exist. A link to a route that does not
exist is a bug, not a placeholder — the previous login page shipped one for weeks.

---

## 7. Conventions

- **Code, identifiers, comments and docstrings: English. User-facing strings: Spanish.**
  The product locale is Spanish (Ecuador); the codebase is read by tools and contributors who
  may not be.
- **Comments explain _why_, never _what_.** `# increment counter` above `count += 1` is noise.
  `# Derived from the vote rows so concurrent votes cannot collapse into one` is a comment.
- **Commits are modular and in Spanish**, one concern each, imperative mood, `type(scope):`
  prefix. Do not add a co-author trailer.
- Line length 100 (backend, enforced by ruff) / 100 (frontend, Prettier defaults).
- Migrations are hand-written and verified against a real Postgres:
  `uv run alembic upgrade head && uv run alembic check` must report no drift.

---

## 8. Working effectively in this repo

**Before changing academic behaviour**, read `ERS_EPN_Notas_Mallas.md` — it is the specification
and it is specific (Art. 61 credit limits, §8.5 recovery thresholds). When the ERS leaves a
value unspecified, make it a named constant or a setting and say so in a comment, rather than
inventing a number that will later look like a rule. `MAX_CREDITS_SPECIAL_AUTHORIZATION` is the
worked example.

**Verify against a running system, not just the test suite.** The suite is in-memory SQLite;
migrations, `ilike` semantics and constraint behaviour differ on Postgres:

```bash
docker compose --env-file .env.dev up -d postgres redis minio
cd backend && uv run alembic upgrade head && uv run alembic check
```

For UI changes, `npm run build && npx vite preview` and look at it. The dev server's HMR can
show stale modules that hide real errors; the production build does not.

**When you find a second bug while fixing the first**, note it rather than silently expanding
the change. Modular commits are what makes this repo reviewable.

---

## 9. Known gaps

Honest list, so nobody rediscovers them as surprises:

- `SyllabusJobStatus`, `MissingPolicy` and `CalculationMode` are declared for a future
  syllabus-ingestion phase and have no consumers today.
- Resource `extracted_text` is populated for small files but nothing reads it yet; it is
  scaffolding for a later search/AI phase.
- `mypy` runs in the pragmatic configuration described in `pyproject.toml`, not `strict`.
  Tightening it is worth doing module by module rather than by flipping the flag.
- The malla map is horizontal-scroll only; it is usable but cramped on a phone.
