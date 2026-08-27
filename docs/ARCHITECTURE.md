# Arquitectura

Cómo está organizado el sistema y **por qué**. Las decisiones sin razón envejecen mal: cuando
alguien no sabe por qué existe una capa, la salta.

## Vista general

```
Navegador ──► SPA (React + Vite)
                │  Bearer access token en memoria
                │  refresh token en localStorage
                ▼
           API (FastAPI)
                ├── PostgreSQL   datos académicos y de estudiante
                ├── Redis        códigos de verificación, refresh tokens vigentes, rate limits
                └── MinIO / S3   archivos de recursos de estudio
```

## Las cuatro capas del backend

El backend sigue el formato de
[`fastapi-best-architecture`](https://github.com/fastapi-practices/fastapi_best_architecture),
con una adición propia: **un núcleo de dominio puro**.

### 1. `app/domain/` — reglas académicas

Funciones puras sobre `Decimal`. Sin FastAPI, sin SQLAlchemy, sin I/O, sin fechas del sistema.

Todo lo que decide si un estudiante aprobó vive aquí:

| Módulo                      | Responsabilidad                                                    |
| --------------------------- | ------------------------------------------------------------------ |
| `grading/grade_calculation` | Componente → aporte → nota final sobre 40                          |
| `grading/recovery`          | Elegibilidad y resultado del suple (§8.5-8.6)                      |
| `grading/projection`        | Qué promedio falta para llegar a una meta                          |
| `grading/scheme_validation` | Un esquema válido: dos aportes, 100 %, tope de 35 % por componente |
| `simulation/eligibility`    | Prerrequisitos, correquisitos, validez de una selección            |
| `simulation/credit_limits`  | Máximo de créditos combinando repetición, inglés y autorización    |
| `simulation/english_rules`  | Restricción por nivel de inglés (Art. 68-71)                       |

**Por qué está separado:** estas reglas son las que un estudiante usa para decidir si se
matricula. Se prueban sin base de datos, corren en milisegundos y no pueden divergir entre dos
implementaciones porque solo hay una.

**`float` está prohibido.** `to_decimal()` lanza `TypeError` si recibe uno. El redondeo es solo
de presentación (`display_round`, 2 decimales, `ROUND_HALF_UP`); nunca se almacena redondeado.

### 2. `app/modules/<contexto>/` — contextos acotados

Nueve módulos, cada uno con cinco ficheros y un reparto estricto:

- **`api.py`** — rutas, códigos de estado, inyección de dependencias. Cero reglas de negocio.
- **`schema.py`** — DTOs de Pydantic. Toda entrada acotada: `max_length`, `ge`/`le`,
  `decimal_places`.
- **`service.py`** — reglas de negocio y decisiones de autorización.
- **`crud.py`** — solo acceso a datos. **Los filtros de seguridad se expresan aquí, en SQL.**
- **`model.py`** — modelos SQLAlchemy.

**Por qué el filtro de visibilidad va en el `crud` y no en el `service`:** filtrar en memoria
después de traerlo todo funciona hasta que alguien añade un segundo listado y se olvida. La
consulta que no puede devolver filas ajenas no depende de que nadie se olvide.

### 3. `app/common/` — transversal

`deps` (sesión, usuario actual, rol, IP), `exception` (errores de aplicación → envelope
estándar), `pagination` (todo listado acotado), `security` (JWT, Argon2id), `sql`
(escapado de `LIKE`).

### 4. `app/core/` — infraestructura

Configuración validada al arrancar, logging, rate limiting, correo, factoría de la app.

## Decisiones que conviene conocer

### Tokens: acceso en memoria, refresh rotativo

El access token (15 min) vive **solo en memoria** del navegador: un XSS no lo encuentra en
`localStorage`. El refresh token (7 días) sí se persiste, y por eso el backend lo **rota** en
cada uso y **detecta reuso**: presentar un `jti` ya consumido revoca todas las sesiones de ese
usuario.

Consecuencia práctica: tras recargar la página no hay access token, así que el arranque refresca
primero y luego consulta. Hacerlo al revés costaba un 401 por cada consulta en paralelo.

### Los tres estados de una materia

Una materia tiene estado en dos sitios y hay una regla de precedencia:

- **`StudentCourseState`** (la malla) — lo que el estudiante ve en el mapa.
- **El cuaderno de notas** — se deriva de los componentes y del suple.

Cuando el cuaderno queda **decidido** (aprobado o reprobado en firme), actualiza la malla con
`source = GRADEBOOK`. **Una decisión manual del estudiante nunca se pisa**: si marcó la materia a
mano como anulada, el cálculo no la cambia. `IN_PROGRESS` sí se considera indeciso y puede ser
reemplazado.

Una nota en la banda de recuperación (18-28/40) **no** decide nada hasta que se registre el
suple.

### Moderación comunitaria

Esquemas de evaluación y recursos comparten el mismo ciclo: `PERSONAL` (privado) o
`COMMUNITY_PENDING` → `COMMUNITY_VERIFIED` con tres aprobaciones externas, o `ADMIN_VERIFIED` si
lo publica un administrador. Tres rechazos archivan.

El contador **se deriva de las filas de voto**, no se incrementa: dos votos simultáneos con
`+= 1` se pierden uno.

### Almacenamiento de recursos

Los archivos van a MinIO/S3. La API los sirve por un proxy del mismo origen
(`/resources/{id}/content`) con el tipo MIME **derivado de la extensión validada**, como
`attachment`, y bajo una CSP que no permite ejecutar nada. La descarga directa usa una URL
prefirmada contra el endpoint _público_, porque la firma SigV4 depende del host al que el
navegador realmente llama.

## Modelo de datos

Separación deliberada en tres niveles (ERS §33):

- **`courses`** — materia del catálogo, independiente de cualquier malla.
- **`curriculum_courses`** — esa materia dentro de una malla, con su semestre y créditos.
- **`course_offerings` / `sections`** — la oferta real de un periodo, con sus paralelos.

Las notas del estudiante cuelgan de `student_enrollments`, que apunta a `curriculum_courses` y a
un esquema de evaluación.

Toda cantidad numérica es `NUMERIC` en Postgres y `Decimal` en Python.

## Frontend

- **React Query** es la única fuente de estado del servidor. Nada de duplicarlo en Zustand.
- **Zustand** guarda solo lo que no viene del servidor: sesión y tema.
- **Las páginas van con `lazy()`.** La mayoría de visitas aterrizan en la calculadora pública,
  que no necesita el mapa de malla ni el renderizador de markdown.
- **Los números académicos no se recalculan en el cliente.** El avance de malla se pide a
  `GET /student/progress`.

Ver [`DESIGN.md`](../DESIGN.md) para el sistema visual.
