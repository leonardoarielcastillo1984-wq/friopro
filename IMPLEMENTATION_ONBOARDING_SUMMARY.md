# Implementación del Sistema de Onboarding de Empresas - FASES 1-5

## Resumen Ejecutivo
Se ha implementado un sistema completo de onboarding multitenante con 5 fases:
1. ✅ Landing page pública con registro de empresas
2. ✅ Panel de Super Admin para aprobación de registros
3. ✅ Creación automática de tenants y usuarios
4. ✅ **NUEVA:** Selección de planes y procesamiento de pagos con MercadoPago
5. ✅ **NUEVA:** Módulos Seguridad 360 y Audit360 con estado "Próximamente"

---

## 🎯 Funcionalidades Implementadas

### 1. Landing Page Pública
**Archivo:** `/apps/web/src/app/page.tsx`
- Página inicial con diseño moderno en gradiente oscuro
- Presentación de 3 módulos independientes:
  - **SGI 360** (Azul) - Sistema Integrado de Gestión ISO
  - **Seguridad 360** (Rojo) - Sistema de Gestión de Seguridad Vial
  - **Audit360** (Púrpura) - Sistema especializado para Auditorías
- Modal de registro de empresa con campos:
  - Nombre de empresa (obligatorio)
  - Razón social
  - RUT / Tax ID (obligatorio)
  - Email (obligatorio)
  - Teléfono (obligatorio)
  - Sitio web
  - Dirección (obligatorio)
  - Logo de empresa (subida de archivos)
  - Color principal de marca

### 2. Rutas Públicas de Registro
**Archivo:** `/apps/api/src/routes/publicRoutes.ts`

#### POST /register-company
- Recibe datos de registro de empresa
- Valida datos con esquema Zod
- Almacena solicitud en `.company-registrations.json`
- Responde con ID de registro y mensaje de confirmación

#### GET /company-registrations
- Retorna lista de registros de empresas
- Protegido para Super Admin (requiere autenticación)

### 3. Panel de Super Admin - Gestión de Registros
**Archivo:** `/apps/web/src/app/(app)/admin/page.tsx`

#### Nuevo Componente: CompanyRegistrations
- Pantalla de gestión de solicitudes de registro pendientes
- Funcionalidades:
  - **Listar solicitudes**: Muestra registros pendientes con detalles completos
  - **Aprobar solicitud**:
    - Crea automáticamente un Tenant con los datos de la empresa
    - Crea un Usuario Admin para el Tenant
    - Genera suscripción BÁSICA inicial
    - Habilita solo el módulo de "Gestión de Licencias"
    - Muestra credenciales temporales (email + contraseña)
  - **Rechazar solicitud**: Requiere razón de rechazo
  - Categorización automática:
    - Registros Pendientes (Pendientes de aprobación)
    - Registros Aprobados (Tenants creados)
    - Registros Rechazados (Con razón del rechazo)

#### KPI Card Adicional
- Nuevo indicador: "Solicitudes pendientes"
- Muestra en tiempo real cantidad de registros sin procesar

### 4. Endpoints de Super Admin
**Archivo:** `/apps/api/src/routes/superAdmin.ts`

#### GET /super-admin/company-registrations
- Obtiene lista de registros de empresas
- Protegido: requiere rol SUPER_ADMIN

#### POST /super-admin/company-registrations/:id/approve
- Aprueba una solicitud de registro
- Operaciones atómicas:
  1. Lee solicitud del archivo de registros
  2. Crea Tenant con datos de la empresa
  3. Crea Usuario Admin con contraseña temporal
  4. Crea suscripción BASIC para el Tenant
  5. Habilita módulo de "license" (Gestión de Licencias)
  6. Actualiza estado a "APPROVED"
  7. Retorna credenciales del usuario creado

#### POST /super-admin/company-registrations/:id/reject
- Rechaza una solicitud de registro
- Requiere razón del rechazo
- Actualiza estado a "REJECTED"

### 5. Proxy Next.js
**Archivo:** `/apps/web/src/app/api/register-company/route.ts`
- Actúa como proxy entre frontend y API Fastify
- Maneja FormData con archivos (logo)
- Reenvía solicitudes a `${NEXT_PUBLIC_API_URL}/register-company`

### 6. Integración en app.ts
**Archivo:** `/apps/api/src/app.ts`
- Registrado: `await app.register(publicRoutes);`
- Las rutas públicas son accesibles sin autenticación
- Disponibles en puerto 3001

## FASE 4: PLANES Y PAGOS 🚀

### 1. Página de Selección de Planes
**Archivo:** `/apps/web/src/app/(app)/plan-selection/page.tsx`
- Interfaz moderna con gradiente de colores
- Presenta 3 planes: BASIC, PROFESSIONAL, PREMIUM
- Muestra precios mensuales y anuales
- Listado de módulos incluidos por plan
- Botones de selección que redirigen a MercadoPago
- Estados: PENDING, PROFESSIONAL, PREMIUM con estilos únicos

### 2. Endpoints de Planes y Pagos
**Archivo:** `/apps/api/src/routes/license.ts`

#### GET /license/plans
- Obtiene lista de planes con precios
- Retorna: `{ plans: [{ id, tier, name, price, features, limits }] }`
- Precios definidos:
  - BASIC: $35/mes
  - PROFESSIONAL: $69/mes
  - PREMIUM: $99/mes

#### POST /license/create-payment
- Crea preferencia de pago en MercadoPago
- Parámetros: `{ planTier, planId, amount }`
- Retorna: `{ preferenceId, preferenceUrl }`
- Redirige a MercadoPago para procesar pago

#### POST /license/payment-success
- Confirma pago completado
- Crea nueva suscripción activa (1 año)
- Elimina módulos previos
- Habilita todos los módulos del plan seleccionado
- Responde con lista de módulos habilitados

### 3. Configuración Pública de MercadoPago
**Archivo:** `/apps/api/src/routes/publicRoutes.ts`

#### GET /mercadopago-config/public
- Endpoint público para verificar configuración de MercadoPago
- Retorna: `{ configured: boolean, publicKey, userId }`
- No expone tokens sensibles
- Permite al frontend verificar disponibilidad de pagos

### 4. Precios de Planes
**En:** `/apps/api/src/routes/license.ts`
```javascript
const PLAN_PRICES = {
  monthly: {
    BASIC: 35,
    PROFESSIONAL: 69,
    PREMIUM: 99
  },
  annual: {
    BASIC: 399,        // 35 * 12 * 0.95
    PROFESSIONAL: 786, // 69 * 12 * 0.95
    PREMIUM: 1128      // 99 * 12 * 0.95
  }
};
```

## FASE 5: MÓDULOS PRÓXIMAMENTE 🔮

### 1. Módulo Seguridad 360
**Archivo:** `/apps/web/src/app/(app)/seguridad360/page.tsx`
- Página especializada en Gestión de Seguridad Vial
- Estado: **Próximamente**
- Características anunciadas:
  - Gestión de flotas vehiculares
  - Monitoreo de seguridad vial en tiempo real
  - Análisis de incidentes y comportamiento del conductor
  - Reportes de cumplimiento normativo
  - Capacitaciones en seguridad vial
- Botón para notificaciones cuando esté disponible
- Diseño con tema rojo/naranja

### 2. Módulo Audit360
**Archivo:** `/apps/web/src/app/(app)/audit360/page.tsx`
- Plataforma especializada para profesionales de auditoría
- Estado: **Próximamente**
- Características anunciadas:
  - Gestión integral de proyectos de auditoría
  - Planificación y seguimiento de auditorías
  - Gestión de evidencia y documentación
  - Generación automática de informes
  - Colaboración en equipo
  - Cumplimiento de estándares internacionales
- Botón para notificaciones
- Diseño con tema púrpura/rosa

### 3. Configuración de Módulos
**En:** `/apps/api/src/routes/license.ts`

Se agregaron 2 módulos nuevos al MODULE_CONFIG:
```javascript
seguridad360: {
  name: 'Seguridad 360',
  minPlan: 'PROFESSIONAL',
  icon: 'Shield',
  comingSoon: true
},
audit360: {
  name: 'Audit360',
  minPlan: 'PROFESSIONAL',
  icon: 'ClipboardList',
  comingSoon: true
}
```

---

## 📊 Flujo Completo

```
1. USUARIO FINAL
   ├─ Accede a landing page (/)
   ├─ Completa formulario de registro
   └─ Entra en estado "PENDIENTE"

2. SUPER ADMIN
   ├─ Accede a panel (/dashboard → admin)
   ├─ Ve solicitudes pendientes en sección "Gestión de Registros"
   ├─ Aprueba solicitud
   │  └─ Se crea automáticamente:
   │     ├─ Tenant con datos de empresa
   │     ├─ Usuario Admin con credenciales temporales
   │     ├─ Suscripción BASIC
   │     └─ Módulo de licencias habilitado
   └─ Recibe credenciales para compartir con cliente

3. CLIENTE (Usuario Admin del Tenant)
   ├─ Recibe email + contraseña temporal
   ├─ Accede a login
   ├─ Debe cambiar contraseña
   ├─ Ve panel con módulo de licencias
   └─ Puede seleccionar plan y habilitar módulos
```

---

## 🔐 Seguridad

- **Validación**: Zod schema en endpoints públicos
- **Autenticación**: Endpoints de Super Admin requieren rol SUPER_ADMIN
- **Contraseñas**: Hasheadas con Argon2
- **Temporales**: Usuarios deben cambiar en primer acceso
- **Persistencia**: Registros almacenados en JSON (no en DB hasta aprobación)

---

## 📁 Archivos Modificados/Creados

### FASE 1-3:
#### Creados:
- ✅ `/apps/web/src/app/page.tsx` - Landing page pública
- ✅ `/apps/api/src/routes/publicRoutes.ts` - Rutas de registro público
- ✅ `/apps/web/src/app/api/register-company/route.ts` - Proxy Next.js

#### Modificados:
- ✅ `/apps/web/src/app/(app)/admin/page.tsx` - Agregado componente CompanyRegistrations
- ✅ `/apps/api/src/routes/superAdmin.ts` - Agregados 3 endpoints de gestión de registros
- ✅ `/apps/api/src/app.ts` - Registrada ruta pública

### FASE 4:
#### Creados:
- ✅ `/apps/web/src/app/(app)/plan-selection/page.tsx` - Página de selección de planes
- ✅ Endpoints en `/apps/api/src/routes/license.ts`:
  - GET /license/plans
  - POST /license/create-payment
  - POST /license/payment-success
- ✅ Endpoint en `/apps/api/src/routes/publicRoutes.ts`:
  - GET /mercadopago-config/public

### FASE 5:
#### Creados:
- ✅ `/apps/web/src/app/(app)/seguridad360/page.tsx` - Página Seguridad 360 (Próximamente)
- ✅ `/apps/web/src/app/(app)/audit360/page.tsx` - Página Audit360 (Próximamente)

#### Modificados:
- ✅ `/apps/api/src/routes/license.ts` - Agregados módulos seguridad360 y audit360 al MODULE_CONFIG

---

## 📝 Estado Actual - TODAS LAS FASES COMPLETADAS ✅

```
✅ FASE 1: Registrar publicRoutes en app.ts
✅ FASE 2: Crear sección en Super Admin para aprobar empresas
✅ FASE 3: Integrar creación automática de tenant + usuario
✅ FASE 4: Implementar selección de planes y pagos con MercadoPago
✅ FASE 5: Agregar módulos Seguridad 360 y Audit360 (Próximamente)
```

## 🔄 Flujo Completo del Sistema (End-to-End)

```
1. USUARIO FINAL (Landing Page)
   ↓
   Accede a / (landing page)
   Completa formulario de registro de empresa
   Solicitud queda PENDIENTE en base de datos

2. SUPER ADMIN (Panel de Administración)
   ↓
   Accede a /dashboard → Admin → Gestión de Registros
   Revisa solicitudes pendientes
   APRUEBA registro

   Sistema automáticamente:
   ├─ Crea Tenant con datos de empresa
   ├─ Crea Usuario Admin con contraseña temporal
   ├─ Crea Suscripción BASIC
   └─ Habilita solo módulo "license"

   Super Admin recibe credenciales temporales
   Comparte email + contraseña con cliente

3. CLIENTE (Usuario Admin del Tenant)
   ↓
   Recibe email + contraseña temporal
   Accede a /login
   Ve dashboard con solo módulo de Licencias
   Es redirigido a /plan-selection

   En plan-selection:
   ├─ Ve 3 planes: BASIC ($35), PROFESSIONAL ($69), PREMIUM ($99)
   ├─ Selecciona un plan
   └─ Es redirigido a MercadoPago para pago

4. PROCESAMIENTO DE PAGO (MercadoPago)
   ↓
   Usuario completa pago en MercadoPago
   MercadoPago redirige a /plan-selection?payment=success
   Sistema confirma pago y:
   ├─ Crea nueva Suscripción (1 año)
   ├─ Elimina módulos previos
   └─ Habilita TODOS los módulos del plan

5. CLIENTE (Con Plan Activo)
   ↓
   Accede a dashboard
   Ve en sidebar:
   ├─ 14 módulos de SGI 360 (según plan)
   ├─ Próximamente: Seguridad 360 (rojo)
   └─ Próximamente: Audit360 (púrpura)

   Puede acceder a módulos según plan
   Puede cambiar módulos habilitados/deshabilitados
   Puede gestionar usuarios del Tenant
```

## 🎯 Próximas Mejoras Sugeridas

1. **Webhook de MercadoPago**: Implementar webhook automático para confirmar pagos
2. **Renovación automática**: Sistema de renovación de suscripción
3. **Módulos Seguridad 360 y Audit360**: Desarrollo de funcionalidades
4. **Dashboard de Analytics**: Visualizar uso de módulos y métricas
5. **Integraciones adicionales**: Google Workspace, Active Directory, etc.

---

## 🔧 Comandos Útiles

### Iniciar servicios:
```bash
# API (Puerto 3001)
cd apps/api
npm run dev

# Web (Puerto 3000)
cd apps/web
npm run dev
```

### Acceder:
- Landing Page: `http://localhost:3000/`
- Admin Panel: `http://localhost:3000/dashboard` → Admin → Gestión de Registros
- API: `http://localhost:3001/`

---

**Fecha de Implementación:** Abril 4, 2026
**Estado:** Completo y Funcional ✅
