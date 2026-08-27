# Cómo trabajar en este repositorio

Esto describe el entorno y el flujo. Las reglas de arquitectura y seguridad están en
[`AGENTS.md`](./AGENTS.md), que aplica igual a personas y a agentes.

## Requisitos

Tres cosas, y las versiones importan porque son las que se despliegan:

|        | Versión                   | Anclada en                                             |
| ------ | ------------------------- | ------------------------------------------------------ |
| Python | 3.12                      | `backend/.python-version`, `backend/Dockerfile`        |
| Node   | 22                        | `frontend/.nvmrc`, `frontend/package.json` (`engines`) |
| Docker | cualquiera con Compose v2 | —                                                      |

[`uv`](https://docs.astral.sh/uv/) gestiona Python y las dependencias del backend; descarga la
versión correcta por su cuenta, no hace falta instalarla a mano.

Si prefieres no instalar nada: el repo trae un devcontainer (`.devcontainer/`) con todo dentro.

## Primeros pasos

```bash
make setup     # dependencias de ambos lados y .env.dev desde la plantilla
make up        # Postgres, Redis y MinIO
make migrate   # esquema de la base de datos
make seed      # las cuatro mallas FIS y el super admin
make dev       # API en :8000 y app en :5173
make hooks     # opcional pero recomendado: hooks de pre-commit
```

`make` sin argumentos lista todo lo disponible.

**Si algún puerto está ocupado** (5432, 6379 y 9000 son los que reclama cualquier otro stack):

```bash
make up POSTGRES_PORT=55432 REDIS_PORT=56379 MINIO_PORT=9100 MINIO_CONSOLE_PORT=9101
```

Pásale las mismas variables al resto de recetas (`make migrate POSTGRES_PORT=55432`), o
expórtalas una vez en tu sesión.

## El bucle de trabajo

```bash
make check     # exactamente lo que ejecuta CI: lint, tipos y pruebas
make format    # arregla el formato de los dos lados
```

`make check` es la puerta. CI corre las mismas recetas, así que si pasa en local pasa allí.

Para iterar rápido sobre reglas académicas, `make test-watch` corre solo las pruebas de dominio
(sin base de datos, medio segundo).

### Antes de abrir un PR

- [ ] `make check` en verde
- [ ] Si tocaste modelos: `make migration m="..."`, revisa el fichero generado a mano, y
      `make migrate-check` no detecta divergencia
- [ ] Si tocaste UI: lo abriste en el navegador. `make preview` sirve el build de producción;
      el servidor de desarrollo puede mostrar módulos cacheados que esconden errores reales
- [ ] Si arreglaste un bug: hay una prueba que habría fallado antes

## Formato y estilo

No hay debate de estilo: lo decide la herramienta.

- **Backend**: `ruff format` formatea, `ruff check` avisa, `mypy` comprueba tipos.
- **Frontend**: `prettier` formatea, `eslint` avisa, `tsc` comprueba tipos.

`eslint-config-prettier` va al final de la configuración de ESLint precisamente para que las dos
herramientas no opinen sobre la misma línea.

Configura tu editor con `.vscode/extensions.json` (VS Code lo ofrece solo al abrir el repo) o
apunta el tuyo a las mismas herramientas. `.editorconfig` cubre lo básico en cualquier editor.

## Migraciones

Se escriben y se revisan a mano, aunque las genere `--autogenerate`:

```bash
make migration m="añade columna de recuperación"
# revisa backend/alembic/versions/<hash>_....py
make migrate
make migrate-check   # debe decir "No new upgrade operations detected"
```

Una migración que añade una restricción sobre datos existentes tiene que limpiar primero, o
fallará en la base de producción y no en la tuya. Hay un ejemplo en
`a1c4f7e2b930_recovery_score_and_integrity_constraints.py`.

## Commits

En español, uno por asunto, con prefijo convencional:

```
tipo(ámbito): asunto en imperativo

Por qué, si no es evidente. Qué problema resuelve, no qué líneas cambiaste.
```

Tipos: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `chore`, `style`, `revert`.
El hook de `commit-msg` comprueba la forma.

Sin trailer de co-autoría. Los commits van firmados; si el agente de firma está bloqueado, el
commit se queda esperando: desbloquéalo en lugar de desactivar la firma.

**Un commit, un asunto.** Si arreglando algo encuentras otra cosa, anótala y hazla aparte. Es lo
que hace revisable este repo.

`git blame` ignora el commit de reformateo masivo gracias a `.git-blame-ignore-revs`. Si tu
cliente de Git no lo aplica solo:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

## Estructura

```
backend/app/domain/      Reglas académicas puras. Sin framework, sin I/O, sin float.
backend/app/modules/     Contextos acotados: api · schema · service · crud · model
backend/app/common/      Transversal: dependencias, errores, paginación, seguridad
frontend/src/features/   Una carpeta por área: api.ts · hooks.ts · pages/ · components/
frontend/src/components/ui/  Sistema de diseño. Los cambios visuales globales van aquí.
```

La regla que manda sobre todas: **toda la lógica académica vive en `backend/app/domain/`**, como
funciones puras sobre `Decimal`. Está explicada en [`AGENTS.md`](./AGENTS.md).

## Dónde mirar cuando algo no cuadra

| Síntoma                                             | Sitio                                                     |
| --------------------------------------------------- | --------------------------------------------------------- |
| Una nota sale mal                                   | `backend/app/domain/grading/`, y sus pruebas unitarias    |
| Un endpoint devuelve 500                            | ¿falta una comprobación de clave foránea en el `service`? |
| Un listado muestra datos ajenos                     | el filtro de visibilidad debe estar en el `crud`, en SQL  |
| El frontend muestra un número distinto al de la API | alguien lo recalculó en el cliente                        |
| Un error "imposible" en el navegador                | HMR con módulos viejos: `make preview`                    |
