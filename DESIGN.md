# Dirección de diseño — EPN Notas Mallas

> Este fichero es **dirección**, no reglas para el agente. El filtro anti-slop
> (`.claude/skills/antislop/SKILL.md`) se aplica encima de esto, nunca al revés.

## Design Read

Reading this as: **aplicación de seguimiento académico personal** para **estudiantes de
ingeniería de la EPN**, en lenguaje visual **"cuaderno de apuntes anotado con tinta azul
politécnica"**, dial **ENERGY 2 / RHYTHM 3 / MOTION 1**.

## Identidad

El producto es el cuaderno donde el estudiante lleva sus notas, no un sistema institucional.
La interfaz debe sentirse **suya**: papel, márgenes, anotaciones. El ancla a la EPN es
cromática y solo cromática — el azul politécnico es la tinta con la que se escribe.

**No es un sistema oficial de la EPN.** No se usa el escudo, no se imita la identidad oficial y
no se afirma respaldo institucional en ninguna pantalla.

### Motivo de identidad: la línea de cuaderno

El separador principal de la interfaz es una **regla horizontal fina**, no una caja. Donde otra
app pondría una tarjeta con borde y sombra, aquí hay una línea y aire. Es específico, se repite
en toda la app y es estructura, no decoración.

El **filo izquierdo de color** solo aparece donde codifica estado real de una materia
(aprobada, en curso, reprobada, anulada). Nunca como adorno.

## Paleta

Dos neutros, un acento, cuatro colores de estado. Nada más.

| Rol                           | Claro     | Oscuro    | Uso                          |
| ----------------------------- | --------- | --------- | ---------------------------- |
| Papel (fondo)                 | `#F7F5F1` | `#14161A` | El fondo de la app           |
| Página (superficie)           | `#FFFFFF` | `#1B1E24` | Tarjetas, tablas, diálogos   |
| Tinta (texto)                 | `#16191E` | `#E8E9EC` | Texto principal              |
| Tinta tenue                   | `#5D6470` | `#9AA1AC` | Texto secundario, etiquetas  |
| Regla (borde)                 | `#E2DED6` | `#2A2F37` | Líneas, bordes, separadores  |
| **Acento — azul politécnico** | `#0E4C87` | `#7FB2E5` | Un solo momento por pantalla |

El papel es un gris cálido, deliberadamente **no** el crema editorial. El acento es el único
color de marca: aparece en el elemento más importante de cada pantalla y en ningún otro sitio.

### Colores de estado (semánticos, no decorativos)

| Estado    | Claro       | Oscuro      |
| --------- | ----------- | ----------- |
| Aprobada  | `#2F6B4F`   | `#78C79B`   |
| En curso  | el acento   | el acento   |
| Reprobada | `#A32C29`   | `#EE8C88`   |
| Anulada   | `#8A6410`   | `#D9B65B`   |
| Sin tomar | tinta tenue | tinta tenue |

Los estados se codifican **por color y por forma** a la vez (un punto, un filo, una etiqueta),
nunca solo por color.

## Tipografía

Tres familias, cada una con un trabajo:

- **Fraunces** — titulares. Serif variable con eje óptico y eje _soft_: tiene calidez de libro
  sin ser decorativa. Es la voz "cuaderno".
- **Source Sans 3** — interfaz y texto corrido. Humanista, sobria, legible a 13-14 px, que es
  donde vive la mayor parte de esta app.
- **IBM Plex Mono** — **todo número que sea una nota, un crédito o un porcentaje**. Cifras
  tabulares para que las notas se alineen en columna, y 0/O y 1/l inconfundibles.

Sin mayúsculas con tracking exagerado. Sin monoespaciada como estética: la mono es para datos.

## Escala y ritmo

- **Radios:** `4px` (controles, chips), `8px` (superficies), `14px` reservado al **único**
  elemento focal de cada pantalla. Nada con forma de píldora salvo las etiquetas de estado.
- **Sombra:** solo para lo que flota de verdad (diálogos, menús, el cajón móvil). El papel
  descansa plano.
- **Blur:** ninguno. El desenfoque de fondo estaba en la barra lateral, la cabecera y las
  tarjetas a la vez; con todo esmerilado nada era primer plano.
- **Espaciado:** escala 4/8/12/16/24/40/64. El ritmo cambia entre secciones (RHYTHM 3): la
  pantalla de notas respira distinto que la malla.

## Un foco por pantalla

Cada pantalla tiene un elemento que es claramente el más importante, y todo lo demás cede:

| Pantalla            | El foco                             |
| ------------------- | ----------------------------------- |
| Inicio              | El avance de la malla               |
| Malla               | El mapa de materias                 |
| Notas (materia)     | La nota que llevas                  |
| Simulador           | Los créditos que puedes tomar       |
| Recursos            | El buscador de materia              |
| Calculadora pública | El número que necesitas en el suple |

## Movimiento (MOTION 1)

Solo estados de hover, foco visible y la transición del cajón móvil. Sin bucles perpetuos, sin
elementos que floten, sin fondos animados. Se respeta `prefers-reduced-motion`.

## Voz

Español rioplatense-neutro de Ecuador, en segunda persona, directo. Los términos son los que usa
el estudiante: _bimestre_, _aporte_, _suple_, _malla_, _pénsum_, _paralelo_. Los errores dicen
qué pasó y qué hacer, nunca piden disculpas.
