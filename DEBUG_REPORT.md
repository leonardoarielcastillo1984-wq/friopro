# Reporte de Diagnóstico - Problema de Login del Cliente

**Fecha:** 2026-04-07
**Usuario Problemático:** lcastillo@dadalogitica.com
**Problema:** Error "Invalid credentials" (401) al intentar ingresar

---

## Análisis del Código de Login

### Flujo de Autenticación (POST /auth/login)
El endpoint de login en `apps/api/src/routes/auth.ts` (líneas 249-316) realiza estas validaciones **EN ORDEN**:

1. **Verifica si el usuario existe** en la base de datos por email
2. **Verifica que el usuario esté activo** (`isActive === true`)
3. **Verifica que el usuario NO esté eliminado** (`deletedAt === null`)
4. **Verifica que la contraseña sea correcta** (usando argon2)

Si CUALQUIERA de estas validaciones falla, retorna `401 "Invalid credentials"`

### ⚠️ PUNTO CRÍTICO: El plan de suscripción NO se valida durante el login

El código **NO** valida el `tenantSubscription` o `planTier` durante el proceso de login.
Esto significa que:
- ✅ Usuarios con `NO_PLAN` PUEDEN ingresar
- ✅ Usuarios con `CANCELED` PUEDEN ingresar
- ✅ Usuarios sin suscripción PUEDEN ingresar

La suscripción solo afecta qué módulos ve el usuario, no si puede ingresar.

---

## Posibles Causas del Error

Dado que el super admin (admin@sgi360.com) ingresa correctamente pero lcastillo@dadalogitica.com no, las posibles causas son:

### 1. **El usuario NO existe en la tabla PlatformUser** ❌
- Verifica que se creó correctamente
- El email debe ser: `lcastillo@dadalogitica.com` (exacto)

### 2. **El usuario está INACTIVO** ❌
- `isActive === false`
- Necesita ser reactivado

### 3. **El usuario está ELIMINADO** ❌
- `deletedAt !== null`
- Necesita ser restaurado

### 4. **La contraseña es INCORRECTA** ❌
- El hash almacenado no coincide con la contraseña ingresada
- Usuario menciona: "Cel1166169368" como contraseña
- Necesita reset

---

## Herramienta de Diagnóstico Implementada

He agregado un nuevo endpoint para diagnosticar al usuario:

### **GET /super-admin/debug/check-user?email=lcastillo@dadalogitica.com**

**Respuesta en caso de éxito:**
```json
{
  "exists": true,
  "user": {
    "id": "uuid",
    "email": "lcastillo@dadalogitica.com",
    "globalRole": null,
    "isActive": true/false,
    "isDeleted": true/false,
    "hasPasswordHash": true/false,
    "createdAt": "2026-01-01T00:00:00Z"
  },
  "loginStatus": {
    "canLogin": true/false,
    "reasons": {
      "isActive": "✓ Usuario activo" o "✗ Usuario INACTIVO",
      "isNotDeleted": "✓ Usuario no eliminado" o "✗ Usuario ELIMINADO",
      "hasPassword": "✓ Contraseña establecida" o "✗ Sin contraseña"
    }
  },
  "tenantMemberships": [...],
  "subscription": {...},
  "message": "Usuario puede iniciar sesión correctamente"
}
```

---

## Próximos Pasos

### Paso 1: Reiniciar la Aplicación
```bash
# Cerrar todos los puertos
lsof -i -P -n | grep LISTEN | grep -E "3000|3001" | awk '{print $2}' | xargs kill -9

# Iniciar API
cd apps/api && npm run dev

# En otra terminal, iniciar Web
cd apps/web && npm run dev
```

### Paso 2: Usar el Endpoint de Diagnóstico

Una vez que el API esté corriendo en puerto 3001:

```bash
curl "http://localhost:3001/super-admin/debug/check-user?email=lcastillo@dadalogitica.com"
```

### Paso 3: Interpretar Resultados

Basado en la respuesta:

#### Si `exists: false`
**El usuario NO está registrado**
- Necesita crearse desde el módulo de Company Access Data o manualmente en BD

#### Si `exists: true` pero `canLogin: false`
Revisar los `reasons`:
- Si `isActive: ✗` → El usuario está inactivo, necesita reactivación
- Si `isNotDeleted: ✗` → El usuario fue eliminado, necesita restauración
- Si `hasPassword: ✗` → Sin contraseña, necesita reseteo

#### Si `exists: true` y `canLogin: true`
- El usuario DEBERÍA poder ingresar
- Problema podría ser con el email exacto (espacios, mayúsculas)
- O problema en la validación de contraseña

---

## Endpoint para Resetear Contraseña (si es necesario)

He visto que existe: **PUT /super-admin/users/:email/reset-password**

Uso:
```bash
curl -X PUT "http://localhost:3001/super-admin/users/lcastillo%40dadalogitica.com/reset-password" \
  -H "Content-Type: application/json" \
  -d '{"newPassword": "NuevaContraseña123!"}'
```

---

## Cambios Realizados

### ✅ Archivo Modificado: `apps/api/src/routes/superAdmin.ts`

Agregué un nuevo endpoint de diagnóstico:

```typescript
// ── DIAGNOSTIC: Check user login status ──
app.get('/super-admin/debug/check-user', async (req: FastifyRequest, reply: FastifyReply) => {
  const { email } = req.query as { email?: string };
  // ... retorna información completa del usuario y su estado de login
});
```

**Ubicación:** Antes del cierre de la función (antes del `};` final)

---

## Resumen

| Pregunta | Respuesta |
|----------|-----------|
| ¿El NO_PLAN previene el login? | **NO** - El plan NO se valida en login |
| ¿Por qué da "Invalid credentials"? | Usuario no existe, está inactivo, está eliminado, o contraseña incorrecta |
| ¿Cómo debuggear? | Usar GET `/super-admin/debug/check-user?email=...` |
| ¿Cómo resetear contraseña? | PUT `/super-admin/users/{email}/reset-password` |

---

## Notas de Infraestructura

Hubo problemas al reinstalar dependencias debido a restricciones en el registro de npm (@aws-sdk fue bloqueado). Esto se puede resolver de varias formas:
1. Configurar un proxy npm corporativo
2. Usar un registy alternativo
3. Contactar al administrador de red

El código está listo - solo necesita que el API se reinicie correctamente.
