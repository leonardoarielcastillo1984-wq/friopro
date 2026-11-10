# Flota360 — API pública v1

API REST para integrar sistemas externos con Flota360. Da acceso completo (lectura, alta, edición y baja) a los datos de flota de **una empresa** (tenant): cada API key pertenece a una sola empresa.

## Base URL

```
https://logismart.ar/flota360-api/public/v1
```

## Autenticación

Todas las requests llevan el header:

```
X-API-Key: f360_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

No se usan cookies, CSRF ni login. Mandá la clave solo desde el servidor (backend) y nunca la publiques en un frontend o en un repositorio.

### Permisos (scopes)

| Scope    | Permite                                              |
|----------|------------------------------------------------------|
| `read`   | `GET`                                                |
| `write`  | `POST`, `PUT`, `PATCH`                               |
| `delete` | `DELETE` y `POST .../eliminar`                       |

### Errores de autenticación

| HTTP | `code`             | Motivo                                   |
|------|--------------------|------------------------------------------|
| 401  | `API_KEY_MISSING`  | Falta el header `X-API-Key`              |
| 401  | `API_KEY_INVALID`  | La clave no existe o fue revocada        |
| 401  | `API_KEY_EXPIRED`  | La clave venció                          |
| 403  | `API_KEY_SCOPE`    | La clave no tiene el permiso necesario   |
| 403  | `LICENSE_EXPIRED`  | La licencia de la empresa está vencida   |
| 403  | `LICENSE_GRACE`    | Período de gracia: solo lectura          |
| 429  | —                  | Límite de 200 requests/minuto superado   |

## Verificar la clave

```bash
curl -H "X-API-Key: $KEY" https://logismart.ar/flota360-api/public/v1/me
```

## Endpoints principales

Todos son relativos a la Base URL. Las respuestas y los bodies son JSON.

### Vehículos — `/flota/vehiculos`
- `GET /flota/vehiculos` — lista las unidades
- `POST /flota/vehiculos` — crea una unidad (`dominio`, `tipo`, `marca`, `modelo`, `anio`, `currentOdometer`, ...)
- `GET /flota/vehiculos/:id/completo` — ficha completa
- `PATCH /flota/vehiculos/:id` — edita
- `DELETE /flota/vehiculos/:id` — baja lógica
- `POST /flota/vehiculos/:id/eliminar` — eliminación permanente (scope `delete`)
- `POST /flota/vehiculos/:id/mediciones` — registra odómetro
- `GET /flota/vehiculos/:id/proyeccion` · `/tco` · `/historial-cambios`

### Conductores — `/flota/conductores`
- `GET`, `POST /flota/conductores` · `PATCH`, `DELETE /flota/conductores/:id`
- `GET /flota/conductores/scorecard`

### Combustible
- `GET /flota/combustible` — todas las cargas
- `GET`, `POST /flota/vehiculos/:vehiculoId/combustible`
- `PATCH`, `DELETE /flota/vehiculos/:vehiculoId/combustible/:registroId`

### Vencimientos (VTV, seguro, RUTA, ...)
- `GET /flota/vencimientos`
- `POST /flota/vehiculos/:vehiculoId/vencimientos`
- `PATCH`, `DELETE /flota/vencimientos/:id`

### Neumáticos — `/flota/neumaticos`
- `GET`, `POST /flota/neumaticos` · `PATCH`, `DELETE /flota/neumaticos/:id`
- `POST /flota/neumaticos/:neumaticoId/montar` · `desmontar` · `rotar` · `medicion` · `presion` · `recap` · `danio`
- `GET /flota/neumaticos/mapa-flota`

### Gastos, multas e ingresos
- `GET`, `POST /flota/facturas` · `DELETE /flota/facturas/:id`
- `GET`, `POST /flota/multas` · `PATCH`, `DELETE /flota/multas/:id`
- `GET`, `POST /flota/vehiculos/:vehiculoId/ingresos`

### Servicios comerciales
- `GET`, `POST /flota/servicios` · `PATCH`, `DELETE /flota/servicios/:id`
- `POST /flota/servicios/:id/unidades`

### Talleres externos
- `GET`, `POST /flota/talleres` · `GET`, `PATCH`, `DELETE /flota/talleres/:id`
- `POST /flota/ots/:id/derivar` · `ingreso-taller` · `devolucion` · `recepcion`

### Tableros
- `GET /flota/dashboard` · `/flota/panel` · `/flota/panel-ejecutivo` · `/flota/stats` · `/flota/tco/analisis`

### Operación y mantenimiento
- `/fleet-ops/...` — centro de trabajo, conjuntos tractor+semi, reglas de componentes y costos
- `/maintenance/...` — órdenes de trabajo, planes, activos y repuestos
- `/fleet-recurrence/...` — recurrencia de fallas

Estos endpoints son los mismos que usa la aplicación web de Flota360, así que aplican las mismas validaciones y reglas de negocio. Además, cada cambio queda registrado en la auditoría a nombre del administrador que creó la clave.

## Ejemplos

```bash
KEY=f360_xxx
BASE=https://logismart.ar/flota360-api/public/v1

# Listar vehículos
curl -H "X-API-Key: $KEY" $BASE/flota/vehiculos

# Crear vehículo
curl -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"dominio":"AB123CD","tipo":"CAMION","marca":"Scania","modelo":"P360","anio":2021}' \
  $BASE/flota/vehiculos

# Cargar combustible
curl -X POST -H "X-API-Key: $KEY" -H "Content-Type: application/json" \
  -d '{"litros":250,"precioPorLitro":1200,"odometro":145300,"fecha":"2026-10-24"}' \
  $BASE/flota/vehiculos/<vehiculoId>/combustible
```

## Gestión de claves (administradores)

Estos endpoints se llaman con la sesión de un usuario `TENANT_ADMIN` de Flota360, no con una API key.

- `GET /api-keys` — lista las claves (no devuelve el secreto)
- `POST /api-keys` — crea una clave. Body: `{ "name": "Sistema X", "scopes": ["read","write","delete"], "expiresInDays": 365 }`. **La clave se muestra una sola vez.**
- `DELETE /api-keys/:id` — revoca la clave al instante

En la base solo se guarda el hash SHA-256 de cada clave, nunca el texto original.
