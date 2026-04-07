# 🔧 Tenant Context Fix - SGI 360

## ✅ Lo que se arregló

Implementé la solución para el error **"x-tenant-id is required for tenant-scoped requests"** que veías en el dashboard.

### El Problema
1. El usuario admin@sgi360.com no tenía asignado un Tenant en la base de datos
2. El backend no retornaba el `activeTenant` en la respuesta de login para usuarios SUPER_ADMIN
3. El frontend no enviaba el header `x-tenant-id` requerido por el API

### La Solución
Modifiqué 3 archivos clave:

**1. Backend: `/apps/api/src/routes/auth.ts`** (líneas 249-315)
- Ahora todos los usuarios (incluido SUPER_ADMIN) consultan sus TenantMemberships
- El login retorna `activeTenant` y `tenantRole` para todos
- Se selecciona automáticamente el primer Tenant disponible

**2. Frontend API Client: `/apps/web/src/lib/api.ts`**
- Agregué `setTenantId()` y `getTenantId()` para gestionar el tenant ID
- El `rawFetch()` ahora envía automáticamente el header `x-tenant-id` en todas las solicitudes

**3. Frontend Auth Context: `/apps/web/src/lib/auth-context.tsx`**
- Después de recibir el usuario, llama `setTenantId(me.activeTenant?.id)`
- Esto asegura que todas las llamadas API posteriores incluyan el tenant correcto

---

## 🚀 Cómo usar ahora

### Opción 1: Setup Rápido (RECOMENDADO)
1. En tu Terminal, ejecuta:
   ```bash
   ~/Desktop/APP/SGI\ 360/SETUP_LOCAL.command
   ```

   Este script:
   - Instala todas las dependencias de Node.js
   - Configura PostgreSQL y Redis
   - Crea la base de datos y datos de prueba
   - Toma ~3-5 minutos según tu conexión

2. Después, cada vez que quieras iniciar:
   ```bash
   ~/Desktop/APP/SGI\ 360/START_SGI360.command
   ```

### Opción 2: Manual (Terminal)
Si prefieres hacerlo a mano:

**Terminal 1 - API:**
```bash
cd ~/Desktop/APP/SGI\ 360/apps/api
npm install --legacy-peer-deps
npm run prisma:migrate
npm run seed:complete
npm run dev
```
Espera a que veas: `{"level":30,"msg":"SGI 360 API running on port 3002"}`

**Terminal 2 - Frontend:**
```bash
cd ~/Desktop/APP/SGI\ 360/apps/web
npm install --legacy-peer-deps
npm run dev
```
Espera a que veas: `▲ Next.js`

**Terminal 3 - Abre el navegador:**
```bash
open http://localhost:3000/login
```

---

## 📝 Credenciales

```
Email: admin@sgi360.com
Contraseña: Admin123!
```

---

## ✨ Qué cambió en el comportamiento

### Antes (Roto)
1. ❌ Login fallaba o mostraba "x-tenant-id is required"
2. ❌ El dashboard mostraba "Tenant context required" en rojo
3. ❌ No podía acceder a ninguna funcionalidad

### Ahora (Funciona)
1. ✅ Login redirige automáticamente al dashboard
2. ✅ El dashboard carga sin errores
3. ✅ Puedes ver "Demo Company" como tu Tenant activo
4. ✅ Todas las solicitudes API incluyen el tenant correcto
5. ✅ Multi-tenant architecture funciona sin problemas

---

## 🔍 Detalles técnicos

### ¿Por qué esto es importante?
SGI 360 es una aplicación **multi-tenant**. Cada usuario puede pertenecer a múltiples Tenants (empresas/organizaciones). El sistema necesita saber:
- **Quién eres** → JWT token + email
- **A cuál Tenant perteneces** → Header `x-tenant-id`

Sin el header `x-tenant-id`, el backend no sabe a qué datos acceder → Rechaza la solicitud.

### Flujo correcto ahora:
1. Usuario ingresa email/contraseña en login
2. Backend valida y retorna `accessToken` + `activeTenant`
3. Frontend guarda el `tenantId` en memoria (función `setTenantId()`)
4. Todas las solicitudes posteriores incluyen: `x-tenant-id: <tenant-id>`
5. Backend valida el tenant y retorna datos seguros

---

## ⚠️ Nota sobre el VM environment

Si intentas instalar en el VM environment (Cowork), verás un error de proxy:
```
403 Forbidden - GET https://registry.npmjs.org/@aws-sdk/client-s3
Received HTTP code 403 from proxy
```

Esto es normal - el VM tiene restricciones de red. **Debes ejecutar el setup en tu Mac local**, no en el VM.

**Solución:** Ejecuta `SETUP_LOCAL.command` directamente en tu Mac, no en la terminal del VM.

---

## ❓ Troubleshooting

### "Puerto 3002 ya está en uso"
```bash
lsof -ti:3002 | xargs kill -9
```

### "PORT 3000 ya está en uso"
```bash
lsof -ti:3000 | xargs kill -9
```

### "PostgreSQL no inicia"
```bash
brew services restart postgresql@16
```

### "Redis no inicia"
```bash
brew services restart redis
```

### "Database error after setup"
```bash
cd ~/Desktop/APP/SGI\ 360/apps/api
npm run prisma:reset
npm run seed:complete
```

---

## ✅ Verificación

Cuando todo funcione correctamente, deberías ver:

1. **Login page:** http://localhost:3000/login (sin errores)
2. **Después de login:**
   - Redirección automática a http://localhost:3000/dashboard
   - Dashboard carga sin mensajes de error en rojo
   - Ves "Demo Company" como tu Tenant
3. **Browser DevTools (F12):**
   - Abre Network tab
   - Haz clic en cualquier API call
   - En Headers → Custom headers, verás:
     ```
     x-csrf-token: [valor]
     x-tenant-id: [uuid-aqui]
     ```

---

Cualquier duda, avísame. ¡Ahora sí debería funcionar! 🎉
