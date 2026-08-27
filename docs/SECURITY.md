# Seguridad

Qué protege el sistema, cómo, y qué hay que respetar al cambiarlo. Cada regla de aquí
corresponde a un fallo real que estuvo abierto en este repositorio y que hoy tiene una prueba de
regresión en `backend/tests/integration/test_access_control.py`.

## Modelo de amenaza

Los datos sensibles son **las notas de un estudiante** y **el material que sube**. El atacante
realista es otro estudiante con cuenta institucional, no un actor estatal. Eso fija las
prioridades: control de acceso entre usuarios primero, criptografía exótica nunca.

## Identidad

- **Contraseñas con Argon2id** (`pwdlib`, parámetros recomendados).
- **Registro con código por correo institucional** `@epn.edu.ec`, 6 dígitos, 10 minutos,
  5 intentos, comparación con `compare_digest`.
- **Respuestas neutras**: pedir un código nunca revela si la cuenta existe, y un login fallido
  no distingue "contraseña incorrecta" de "cuenta suspendida".
- **Tiempo constante en login**: si el usuario no existe se verifica igualmente contra un hash
  señuelo, para que el tiempo de respuesta no filtre qué correos están registrados.

### Sesiones

|                    |                                                               |
| ------------------ | ------------------------------------------------------------- |
| Access token       | 15 min, **solo en memoria** del navegador                     |
| Refresh token      | 7 días, `localStorage`, **rotativo**                          |
| Detección de reuso | Presentar un `jti` ya consumido revoca **todas** las sesiones |

**Se revocan todas las sesiones al**: cambiar la contraseña, suspender la cuenta, eliminarla.
Un cambio de contraseña que deja vivas las sesiones anteriores no es un cambio de contraseña.

`/auth/refresh` vuelve a comprobar que la cuenta sigue activa antes de rotar: una cuenta
suspendida deja de emitir tokens en el acto, no cuando expire el access token.

## Autorización

Tres roles: `STUDENT`, `ADMIN`, `SUPER_ADMIN`.

- Los datos de un estudiante se comprueban por **propiedad**, no por rol.
- Un objeto que el llamante no puede ver devuelve **404, no 403**, para que el endpoint no sirva
  para enumerar ids.
- **La visibilidad se filtra en SQL**, en la capa `crud`. Filtrar en memoria después de traerlo
  todo es una fuga esperando al siguiente listado que se olvide.
- El panel de superadmin no permite **modificar la propia cuenta** ni **dejar al sistema sin un
  superadministrador activo**, y todo cambio queda en la auditoría con snapshots antes/después.

### La regla de una sola definición

`evaluation.service.can_read_scheme` es _la_ regla de visibilidad de esquemas, usada por el
detalle, el listado, la copia y la matrícula. Cuando existían cuatro comprobaciones separadas,
dos de ellas no existían: los esquemas privados eran legibles sin autenticación.

## Entrada del usuario

- **Todo DTO acotado**: `max_length` en cadenas y listas, `ge`/`le` en números,
  `decimal_places` en notas.
- **Todo listado paginado** (`app.common.pagination.Page`, tope de 200).
- **`LIKE` escapado** con `app.common.sql.escape_like`: sin ello, escribir `%` convierte
  cualquier búsqueda en "devuélvemelo todo".
- Las calculadoras y el simulador **públicos** tienen topes de tamaño de payload propios.

## Archivos subidos

Es la única superficie que acepta bytes arbitrarios. Cinco controles, en este orden:

1. **Lectura por trozos con corte al superar el límite** (50 MB por defecto). Leer entero y
   comprobar después permite fijar memoria arbitraria antes de rechazar.
2. **Extensión en lista blanca**; nada fuera de ella entra.
3. **Magic bytes** para PDF e imagen: un `.pdf` que no empieza por `%PDF` se rechaza.
4. **El `Content-Type` se deriva de la extensión validada**, nunca se toma del cliente. Un
   `.txt` declarado como `text/html` volvería a servirse como marcado ejecutable.
5. **El nombre se sanea** antes de entrar en `Content-Disposition`, y se sirve como `attachment`.

Los enlaces (`external_url`) solo admiten `http://` y `https://`, comprobado en el servidor y de
nuevo antes de renderizar.

## Cabeceras

Aplicadas a toda respuesta por `RequestContextMiddleware`:

```
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none';
                         form-action 'none'; sandbox
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Cross-Origin-Resource-Policy: same-site
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains   (fuera de dev)
```

La API sirve JSON y bytes subidos, nunca HTML propio, así que la CSP puede ser máximamente
restrictiva: eso neutraliza un `Content-Type` falsificado aunque los otros controles fallaran.

El `X-Request-ID` que llega del cliente **se valida** contra `^[A-Za-z0-9._-]{1,64}$` antes de
entrar en los logs o volver en la respuesta; si no encaja, se genera uno.

## Límites de tasa

Redis, con **dos contadores por acción**: uno por sujeto y otro por origen.

| Acción                 | Por sujeto  | Por IP      |
| ---------------------- | ----------- | ----------- |
| Login                  | 10 / 15 min | 50 / 15 min |
| Código de verificación | 5 / hora    | 20 / hora   |
| Alta de profesor       | 20 / hora   | —           |

Un contador solo por correo permite que cualquiera bloquee la cuenta de otro; uno solo por IP
permite rociar muchas cuentas desde un sitio. Los topes por IP son más laxos a propósito: una
NAT compartida del campus no debe dejar fuera a media facultad.

**Fuera de `dev`, si Redis no responde el sistema falla cerrado.** El límite de tasa es un
control de seguridad; degradarlo en silencio lo elimina justo cuando hace falta.

## Configuración de producción

La aplicación **se niega a arrancar** fuera de `dev` si:

- `JWT_SECRET` es corto o el de desarrollo
- `DEBUG` está activo
- `POSTGRES_PASSWORD`, `S3_SECRET_KEY` o `FIRST_SUPERADMIN_PASSWORD` usan el valor por defecto
- falta `REDIS_PASSWORD`
- `EMAIL_BACKEND` no es `smtp`

`/docs`, `/redoc` y `/openapi.json` solo existen en desarrollo.

## Despliegue

- `docker-compose.yml` **no publica** Postgres, Redis ni MinIO; solo el override de desarrollo
  lo hace. Producción usa el fichero base a solas.
- La imagen del backend corre como usuario sin privilegios, con `.dockerignore` y healthcheck.
- Uvicorn arranca con `--proxy-headers` para que el límite por IP vea al cliente real. **Detrás
  de un proxy inverso, ese proxy debe sobrescribir `X-Forwarded-For`**; si no, es un valor que
  controla el atacante.

## Reportar un fallo

Abre un issue privado o escribe al mantenedor. No publiques un exploit funcional antes de que
haya arreglo.
