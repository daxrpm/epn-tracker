# Continuidad: extracción, seeds y carga de mallas FIS

Estado verificado: **2026-07-04**.

Este documento permite retomar el trabajo sin depender del historial de conversación. Describe qué
se extrajo, cómo se extrajo, qué quedó cargado en PostgreSQL, cómo reconstruirlo y qué conviene
revisar después.

## Resultado actual

Las cuatro carreras están creadas en la base local y sus pénsums están activos:

| Carrera | Pénsum | Entradas curriculares | Créditos | Prerrequisitos |
|---|---:|---:|---:|---:|
| Computación | 2020 | 50 | 135 | 39 |
| Software | 2020 | 51 | 135 | 36 |
| Sistemas de Información | 2023 | 51 | 135 | 26 |
| Ciencia de Datos e Inteligencia Artificial | 2023 | 52 | 135 | 27 |

> Las cifras de prerrequisitos subieron respecto a la extracción vectorial inicial tras la
> **corrección manual del grafo** (ver sección “Corrección del grafo de prerrequisitos”).

Todas tienen:

- 9 semestres;
- 6480 horas declaradas;
- materias con código, nombre, créditos, horas y semestre;
- grafo de prerrequisitos extraído de las líneas vectoriales del PDF;
- 7 requisitos de graduación no crediticios;
- prácticas laborales y de servicio comunitario modeladas como entradas curriculares con créditos.

La diferencia entre “Número de asignaturas” del resumen oficial y la cantidad del JSON es
intencional: el resumen no cuenta las dos prácticas acreditadas, pero ambas forman parte de los 135
créditos y deben existir en el sistema.

## Fuentes oficiales

Los PDFs fuente están en [`mallas/`](../mallas):

| Archivo | SHA-256 |
|---|---|
| `malla_computacion.pdf` | `2d5003d29c8e24e35b028f1d68fa47d164a58668e328dad00ad49cace0a32f5c` |
| `malla_software.pdf` | `024b349ffca15562f49c43fe2066265195a090c2c4d6c2f5a8d5714eb065bab5` |
| `malla_sistemas_informacion.pdf` | `fed453de216cfc6dfa490ea03668432dc1f8b5713b3569ef496ecfcc73acb168` |
| `malla_ciencia_datos_IA.pdf` | `7dcef8f1130661546bb0462ec0bccfbf742b0b90c88e7905264eaa8a6565a1f9` |

No hacen falta capturas adicionales: estos cuatro PDFs contienen texto y conectores vectoriales. Una
foto sería menos precisa porque perdería coordenadas, texto seleccionable y geometría de flechas.

## Archivos persistentes generados

Los datos importables viven en [`backend/seeds/data/`](../backend/seeds/data):

| Seed | SHA-256 |
|---|---|
| `computacion_2020.json` | `c3f4dc04eda35363964f31ddd747ca7e47565c62e0f337e1e1a35b40edd32ff2` |
| `software_2020.json` | `00b2dcec0763ca603cd374756dea17179857800424201fa7e9e77a0257533d77` |
| `sistemas_informacion_2023.json` | `5467568c8e195ca3ad0e50b97de4d79c2e40f8370cb2c9ee466e0ecfa8731862` |
| `ciencia_datos_ia_2023.json` | `b8a6f2fb1287223a605ed5d1e2da2ed1a9265b1b95274a12a705c0e76d3c1252` |

Estos JSON son la fuente persistente del sistema. PostgreSQL usa además el volumen Docker
`epn_pgdata`; si ese volumen se conserva, los registros sobreviven reinicios y reconstrucciones. Si
el volumen se elimina, el entrypoint ejecuta `python -m seeds.loader` y reconstruye las cuatro
mallas desde los JSON.

## Algoritmo exacto de extracción

El extractor reproducible es
[`backend/scripts/extract_curricula.py`](../backend/scripts/extract_curricula.py).

Requiere las herramientas Poppler `pdftotext` y `pdftocairo`.

### 1. Extracción de tarjetas

1. Ejecuta `pdftotext -bbox-layout` para obtener cada bloque de texto con `xMin`, `yMin`, `xMax` y
   `yMax`.
2. Detecta códigos con la expresión `[A-Z]{4}\d{3}`.
3. Asocia cada código con el encabezado `CRÉDITOS HORAS` situado en la misma columna.
4. Une los bloques entre el encabezado y el código para formar el nombre de la materia.
5. Asigna el semestre usando el número de periodo más cercano en el eje vertical.
6. Ordena las materias por semestre y coordenada horizontal, conservando el orden del PDF.

### 2. Eliminación de falsos positivos

Algunos prerrequisitos están impresos como códigos entre dos filas y pueden parecer tarjetas. El
extractor conserva la aparición curricular más temprana de cada código y trata las apariciones
posteriores como etiquetas de requisitos.

Hay una corrección documentada: el PDF de Computación repite `CSHD400` para “Artes y Humanidades”
y “Economía y Sociedad”. Los otros pénsums identifican “Artes y Humanidades” como `CSHD300`; se
normaliza a `CSHD300` para evitar dos materias distintas con el mismo código en una malla.

### 3. Extracción del grafo de prerrequisitos

1. Ejecuta `pdftocairo -svg` sobre el PDF.
2. Selecciona los paths de conectores (`stroke-width="0.75"`, `fill="none"`).
3. Aplica la matriz SVG de cada path para convertir sus puntos inicial y final a coordenadas de
   página.
4. Asocia el inicio con el código de la tarjeta origen.
5. Asocia el final con el encabezado de la tarjeta destino.
6. Si el destino está en un semestre posterior, crea un `PREREQUISITE`; si está en el mismo
   semestre, crea un `COREQUISITE`.
7. Deduplica relaciones que también aparezcan como etiquetas textuales.

Resultado actual: 116 relaciones, todas de prerrequisito. Los PDFs procesados no produjeron una
relación de correquisito que pasara la asociación geométrica.

### 4. Unidades curriculares

La clasificación actual es deliberadamente conservadora:

- `TITD*` → `CAPSTONE`;
- semestres 1 y 2, `MATD*` y `FISD*` → `BASIC`;
- resto → `PROFESSIONAL`.

Esta es la principal revisión de datos pendiente: los colores de las franjas del PDF contienen una
clasificación más fina y conviene contrastarla materia por materia antes de usar la unidad
curricular para reglas de negocio críticas.

## Corrección del grafo de prerrequisitos

La extracción puramente vectorial es incompleta: en mallas con muchas líneas que se cruzan, los
extremos de las flechas caen lejos del centro de las tarjetas y varias aristas se pierden (por eso
materias de 8.º/9.º quedaban sin prerrequisito y el simulador las habilitaba de más). El grafo se
revisó y corrigió a mano contra las **imágenes oficiales de cada malla**:

- **Computación 2020** y **Software 2020**: verificadas flecha por flecha contra las fotos provistas
  por el usuario. Se rellenaron los vacíos confirmados (p. ej. `ICCD814` Modelos y Simulación ←
  `ISWD743` Business Intelligence, que estaba vacío).
- **Sistemas de Información 2023** y **Ciencia de Datos e IA 2023**: corregidas desde los PDFs
  vectoriales renderizados a alta resolución. Se añadieron con alta confianza: (a) la secuencia
  troncal común de CS/matemáticas (Prog I→II, EDA I→II, etc.), (b) las **cajas-etiqueta de
  prerrequisito** que las propias mallas dibujan sobre algunas tarjetas (p. ej. `ICCD523`←`ICCD442`),
  y (c) las cadenas verticales evidentes (I→II). Las flechas diagonales ambiguas de la franja
  profesional (ISID/IDSD) se dejaron **sin asignar** en lugar de inventarlas: quedan pendientes de
  verificación con imágenes de esas dos carreras.

Criterio: para datos académicos, **vacío es preferible a incorrecto**. Un prerrequisito faltante no
introduce un bloqueo falso; uno inventado sí.

### Re-sincronización segura para progreso

`--replace-incomplete` borra y recrea las materias del pénsum, por lo que **se niega a correr si hay
progreso o matrículas**. Para aplicar solo las correcciones del grafo a una base que ya tiene
estados de estudiante, usar el modo que reescribe únicamente las aristas
`course_requirements` (empareja por código de materia y conserva cada `curriculum_courses` y los
`student_course_states` que las referencian):

```bash
cd backend
uv run python -m seeds.loader --sync-requirements
```

Implementado en `sync_requirements` / `sync_requirements_file`
([`backend/seeds/loader.py`](../backend/seeds/loader.py)); cubierto por
[`backend/tests/integration/test_requirement_sync.py`](../backend/tests/integration/test_requirement_sync.py).

## Regeneración y validación

Desde `backend/`:

```bash
# Solo audita; no escribe.
python scripts/extract_curricula.py

# Regenera los cuatro JSON.
python scripts/extract_curricula.py --write

# Valida estilo y datos.
uv run ruff check app seeds scripts tests/unit/test_curriculum_seed_data.py
uv run pytest tests/unit/test_curriculum_seed_data.py tests/integration/test_academic_import.py -q
```

La prueba [`backend/tests/unit/test_curriculum_seed_data.py`](../backend/tests/unit/test_curriculum_seed_data.py)
verifica para cada seed:

- contrato Pydantic válido;
- total de entradas esperado;
- 135 créditos;
- 9 semestres presentes;
- códigos únicos;
- ausencia de errores del validador de importación.

## Carga en PostgreSQL

Carga normal e idempotente:

```bash
cd backend
uv run python -m seeds.loader
```

Para actualizar un seed de desarrollo desactualizado:

```bash
uv run python -m seeds.loader --replace-incomplete
```

La actualización protegida:

- conserva el ID del pénsum, por lo que no rompe `student_profiles.current_curriculum_id`;
- compara cantidad de materias y cantidad de requisitos;
- se niega a reemplazar si encuentra progreso estudiantil o matrículas;
- reconstruye materias del pénsum, relaciones y requisitos de graduación dentro de una transacción.

La base local ya fue sincronizada con `--replace-incomplete`. La auditoría posterior devolvió:

```text
Ciencia de Datos e Inteligencia Artificial  2023  135.00  52 materias  24 prerrequisitos
Computación                                 2020  135.00  50 materias  35 prerrequisitos
Sistemas de Información                    2023  135.00  51 materias  24 prerrequisitos
Software                                    2020  135.00  51 materias  33 prerrequisitos
```

## UI implementada en la misma iteración

- Shell visual unificado con el estilo del login.
- Sidebar de escritorio estable, sin colapso por hover.
- Drawer móvil con backdrop, botón de cierre, cierre por Escape y cierre al navegar.
- Navegación activa y acceso directo a configuración de malla.
- Malla interactiva por filas de semestre, inspirada en el documento oficial.
- Tarjetas con código, nombre, créditos, horas, unidad y estado.
- Búsqueda por nombre/código y modal para cambiar el estado académico.
- Contrato API ampliado con `hours`, `total_hours` y `total_courses_reported`.
- Fallback temporal `créditos × 48` para horas cuando un backend antiguo aún no haya reiniciado.

Archivos frontend principales:

- [`frontend/src/layouts/AppLayout.tsx`](../frontend/src/layouts/AppLayout.tsx)
- [`frontend/src/features/curriculum/pages/CurriculumPage.tsx`](../frontend/src/features/curriculum/pages/CurriculumPage.tsx)
- [`frontend/src/features/curriculum/api.ts`](../frontend/src/features/curriculum/api.ts)

## Verificación ejecutada

```text
Frontend build: correcto
Frontend lint: correcto
Backend Ruff: correcto
Backend pytest: 83 pruebas aprobadas
Seeds específicos/importación: 8 pruebas aprobadas tras añadir el grafo vectorial
PostgreSQL: 4 carreras, 4 pénsums, 204 entradas curriculares, 116 prerrequisitos
```

## Próximos pasos recomendados

1. Verificar los prerrequisitos de la franja profesional (ISID/IDSD) de Sistemas de Información y
   Ciencia de Datos con imágenes oficiales de esas dos carreras, y completar los que quedaron sin
   asignar.
2. Revisar visualmente la clasificación `organization_unit` contra las franjas de color oficiales.
3. Añadir un test de snapshot del conjunto de aristas por carrera para detectar cambios geométricos
   si se reemplazan los PDFs.
4. Añadir filtro de malla por estado y una vista de “materias desbloqueadas”.
5. Probar el drawer en iOS Safari y Android Chrome reales.

> Los conectores de prerrequisito/correquisito ya se dibujan en la malla interactiva
> ([`CurriculumMap.tsx`](../frontend/src/features/curriculum/components/CurriculumMap.tsx)),
> con un overlay SVG que mide las tarjetas en vivo (azul = prerrequisito, naranja = correquisito).

