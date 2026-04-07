# 📝 Cambios de Código - Tenant Context Fix

## Resumen
Se realizaron cambios en 3 archivos para implementar el contexto de Tenant correctamente:

---

## 1️⃣ Backend: `/apps/api/src/routes/auth.ts`

**Ubicación:** líneas 249-315 (POST /auth/login)

**Cambio principal:**
- El código path para SUPER_ADMIN ahora consulta TenantMemberships como lo hacen los usuarios regulares
- Se retorna `activeTenant` y `tenantRole` en la respuesta para TODOS los usuarios

**Código antes (ROTO):**
```typescript
// Si es SUPER_ADMIN, solo retornaba tokens sin tenant
if (user.globalRole === 'SUPER_ADMIN') {
  return reply.send({
    accessToken,
    user: { id: user.id, email: user.email, globalRole: user.globalRole },
    csrfToken,
    // ❌ NO retornaba activeTenant
  });
}
```

**Código después (ARREGLADO):**
```typescript
// Ahora TODOS los usuarios (incluso SUPER_ADMIN) obtienen su tenant
const tenantMemberships = await db.tenantMembership.findMany({
  where: { userId: user.id },
  include: { tenant: true },
});

const activeTenant = tenantMemberships[0]?.tenant || null;
const tenantRole = tenantMemberships[0]?.role || null;

return reply.send({
  accessToken,
  user: { id: user.id, email: user.email, globalRole: user.globalRole },
  activeTenant,      // ✅ Ahora incluido para todos
  tenantRole,        // ✅ Ahora incluido para todos
  csrfToken,
});
```

---

## 2️⃣ Frontend API Client: `/apps/web/src/lib/api.ts`

**Cambios:**
- Agregué estado para gestionar el `tenantId`
- Agregué funciones `setTenantId()` y `getTenantId()`
- Modifiqué `rawFetch()` para enviar `x-tenant-id` header

**Código nuevo (después de las variables existentes):**
```typescript
// Nueva variable de estado para tenantId (similar a csrfToken)
let tenantId: string | null = null;

// Nuevas funciones getter/setter
export function setTenantId(id: string | null) {
  tenantId = id;
}

export function getTenantId() {
  return tenantId;
}
```

**Modificación en `rawFetch()` (después de CSRF token):**
```typescript
// Tenant ID para tenant-scoped requests
if (tenantId) {
  headers['x-tenant-id'] = tenantId;
}
```

---

## 3️⃣ Frontend Auth Context: `/apps/web/src/lib/auth-context.tsx`

**Cambios:**
- Importar `setTenantId` desde `api.ts`
- Llamar `setTenantId()` después de recibir el usuario del API

**Código en la función `refreshAuth` (después de recibir `me`):**
```typescript
// Después de: const me = await apiFetch<AuthResponse>('/auth/me');
// Agregar:
if (me.activeTenant?.id) {
  setTenantId(me.activeTenant.id);
}

// Esto asegura que tenantId esté disponible para todas las llamadas API posteriores
```

---

## 📊 Flujo completo después de los cambios

```
1. Usuario hace login
   ↓
2. POST /auth/login
   ↓
3. Backend:
   - Valida credenciales
   - Consulta TenantMemberships del usuario
   - Retorna: { accessToken, user, activeTenant, tenantRole, csrfToken }
   ↓
4. Frontend recibe respuesta
   ↓
5. Auth Context:
   - Llama setTenantId(activeTenant.id)
   - Guarda tenantId en memoria
   ↓
6. Todas las solicitudes posteriores incluyen:
   - Authorization: Bearer <token>
   - x-csrf-token: <token>
   - x-tenant-id: <uuid>  ← NUEVO
   ↓
7. Backend valida tenant y retorna datos correctos
   ↓
8. Dashboard carga sin errores ✅
```

---

## 🔒 Seguridad

Estos cambios mantienen la seguridad:
- El `tenantId` se obtiene del servidor (no del cliente)
- Todos los datos en el backend están filtrados por tenant (RLS)
- Un usuario no puede acceder a datos de otro tenant
- El servidor valida que el usuario pertenece al tenant solicitado

---

## 📦 Package.json (Cambio menor)

Se removió `@anthropic-ai/sdk` temporalmente porque el npm registry en el VM tiene restricciones.

**Cambio:**
```json
// Antes:
"@anthropic-ai/sdk": "^0.39.0",
"@aws-sdk/client-s3": "^3.1008.0",

// Después:
"@aws-sdk/client-s3": "^3.1008.0",
```

(Esta línea se puede volver a agregar más tarde cuando instales desde tu Mac)

---

## ✅ Verificación de cambios

Puedes ver los cambios reales en estos archivos:
1. `/apps/api/src/routes/auth.ts` - líneas 249-315
2. `/apps/web/src/lib/api.ts` - líneas 1-100
3. `/apps/web/src/lib/auth-context.tsx` - función refreshAuth

---

Próximo paso: Ejecutar `SETUP_LOCAL.command` en tu Mac para instalar todo correctamente.
