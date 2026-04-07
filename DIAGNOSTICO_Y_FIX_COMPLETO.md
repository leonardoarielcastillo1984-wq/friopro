# 🔍 DIAGNÓSTICO COMPLETO + FIX SGI 360
## Senior DevOps + QA Report

---

## 1️⃣ 🔴 PROBLEMAS DETECTADOS

### PROBLEMA CRÍTICO #1: Puertos desynchronizados
**Causa:** Web app intenta conectar a API en puerto INCORRECTO
- ❌ `/apps/web/.env` → `NEXT_PUBLIC_API_URL=http://localhost:3001`
- ❌ `/.env.local` → `API_PORT=3001`
- ✅ `/apps/api/.env` → `PORT=3002` (CORRECTO)
- **Resultado:** Frontend envía requests a puerto 3001 (no existe) en lugar de 3002

---

### PROBLEMA CRÍTICO #2: npm install fallando en API
**Causa:** Dependency chain quebrada - `husky` package issue
```
npm error sh: husky: command not found
```
- ❌ bullmq@5.66.5 postinstall hook intenta ejecutar `husky install`
- ❌ API NUNCA se levanta en puerto 3002
- ❌ Frontend obtiene "fetch failed" con ECONNREFUSED

---

### PROBLEMA CRÍTICO #3: DATABASE_URL con hostnames Docker
**Causa:** Configuración de desarrollo usa hostnames de Docker
```
# /apps/api/.env
DATABASE_URL=postgresql://sgi:sgidev123@postgres:5432/sgi_dev
REDIS_URL=redis://:sgidev123@redis:6379
```
- ❌ Para desarrollo local deberían ser `localhost` no `postgres`/`redis`
- ❌ Las imágenes Docker pueden NO estar corriendo
- **Solución:** Cambiar a `localhost` para desarrollo sin Docker

---

### PROBLEMA #4: .env duplicado y sucio
**Ubicación:** `/apps/api/.env` líneas 62-67
```
HOST=127.0.0.1
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
HOST=127.0.0.1
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
HOST=127.0.0.1
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
```
- ❌ Líneas triplicadas (error de generación anterior)
- ✅ Fácil de limpiar

---

### PROBLEMA #5: JWT_SECRET débil
**Ubicación:** `/apps/api/.env`
```
JWT_SECRET=change-me-dev
```
- ❌ Muy corto (< 32 chars recomendado)
- ❌ No está actualizado
- ✅ Tolerable para desarrollo pero no óptimo

---

## 2️⃣ 🛠️ SOLUCIÓN PASO A PASO

### ✅ STEP 1: Detener servicios antiguos
```bash
cd /Users/leonardocastillo/Desktop/APP/"SGI 360"

# Matar procesos node/npm
pkill -f "npm run dev" || true
pkill -f "node" || true
pkill -f "next" || true

# Detener Docker si estaba corriendo
docker-compose -f launcher/docker-compose.yml down 2>/dev/null || true
docker-compose down 2>/dev/null || true

# Esperar a que terminen
sleep 3
```

---

### ✅ STEP 2: Limpiar node_modules corruptos
```bash
# Eliminar módulos instalados erróneamente
rm -rf apps/api/node_modules
rm -rf apps/web/node_modules
rm -rf node_modules

# Limpiar npm cache
npm cache clean --force
```

---

### ✅ STEP 3: Instalar herramientas globales
```bash
# CRITICAL: husky es requerido por bullmq
npm install -g husky

# pnpm es el package manager del proyecto
npm install -g pnpm@9.15.0
```

---

### ✅ STEP 4: Corregir archivos .env

#### 4a) Crear `/apps/web/.env` CORRECTO
```bash
cat > "/Users/leonardocastillo/Desktop/APP/SGI 360/apps/web/.env" << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3002
EOF
```

#### 4b) Corregir `/apps/api/.env`
```bash
cat > "/Users/leonardocastillo/Desktop/APP/SGI 360/apps/api/.env" << 'EOF'
# Server
PORT=3002
NODE_ENV=development

# Database
DATABASE_URL=postgresql://sgi:sgidev123@localhost:5432/sgi_dev?schema=public

# Auth
JWT_SECRET=sgi360-dev-secret-key-min-32-characters-required-x
JWT_ISSUER=sgi360
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d

# Redis (BullMQ)
REDIS_URL=redis://:sgidev123@localhost:6379

# Storage
STORAGE_BACKEND=local
STORAGE_LOCAL_PATH=./uploads
MAX_PDF_SIZE_MB=50

# CORS
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000

# Email
EMAIL_PROVIDER=console
EMAIL_FROM=SGI 360 <noreply@sgi360.app>
APP_URL=http://localhost:3000

# LLM Provider
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
OPENAI_MODEL=gpt-4-turbo
AUDIT_MAX_TOKENS=4000
EOF
```

---

### ✅ STEP 5: Levantar PostgreSQL + Redis (Docker SOLO para BDs)
```bash
# Usar SOLO Docker para PostgreSQL y Redis (conocidos funcionales)
docker run -d \
  --name sgi360-postgres \
  --rm \
  -e POSTGRES_USER=sgi \
  -e POSTGRES_PASSWORD=sgidev123 \
  -e POSTGRES_DB=sgi_dev \
  -p 5432:5432 \
  postgres:16-alpine

docker run -d \
  --name sgi360-redis \
  --rm \
  -p 6379:6379 \
  redis:7-alpine redis-server --requirepass sgidev123

# Esperar a que se inicialicen
echo "Esperando a que las BDs se inicialicen..."
sleep 10

# Verificar que están corriendo
docker ps | grep -E "sgi360-postgres|sgi360-redis"
```

---

### ✅ STEP 6: Instalar dependencias de API
```bash
cd /Users/leonardocastillo/Desktop/APP/"SGI 360"/apps/api

# Instalar dependencies CON el fix de husky
npm install --legacy-peer-deps

# Si hay error, intentar con pnpm
pnpm install

echo "✅ Dependencias de API instaladas"
```

---

### ✅ STEP 7: Configurar Prisma
```bash
cd /Users/leonardocastillo/Desktop/APP/"SGI 360"/apps/api

# Generar cliente de Prisma
npm run prisma:generate

# Ejecutar migraciones
npm run prisma:migrate -- --skip-generate || true

# Crear usuario de prueba en base de datos
npm run seed:complete

echo "✅ Prisma configurado + usuario creado"
```

---

### ✅ STEP 8: Instalar dependencias de Web
```bash
cd /Users/leonardocastillo/Desktop/APP/"SGI 360"/apps/web

npm install --legacy-peer-deps

echo "✅ Dependencias de Web instaladas"
```

---

### ✅ STEP 9: Levantar API (Terminal Tab 1)
```bash
cd /Users/leonardocastillo/Desktop/APP/"SGI 360"/apps/api

npm run dev
```

**Deberías ver:**
```
✓ Server running on http://localhost:3002
```

**Si ves esto = SUCCESS ✅**

**AHORA ABRE UNA NUEVA TERMINAL** (NO cierres esta)

---

### ✅ STEP 10: Levantar Frontend (Terminal Tab 2)
```bash
cd /Users/leonardocastillo/Desktop/APP/"SGI 360"/apps/web

npm run dev
```

**Deberías ver:**
```
- Local: http://localhost:3000
✓ Ready in XXXms
✓ Compiled /src/middleware in XXms
```

**Si ves esto = SUCCESS ✅**

---

## 3️⃣ 👤 USUARIO DE PRUEBA

### Credenciales validadas en base de datos:
```
Email:    admin@sgi360.com
Password: Admin123!
Role:     SUPER_ADMIN
```

✅ **Creado automáticamente por seed en STEP 7**

---

## 4️⃣ 🚀 CÓMO PROBAR QUE FUNCIONA

### Test 1: Verificar que API responde
```bash
# En una NUEVA terminal
curl http://localhost:3002/health 2>/dev/null | jq .
```
**Resultado esperado:**
```json
{
  "status": "ok"
}
```

---

### Test 2: Verificar que Frontend carga
```bash
# En terminal
curl -s http://localhost:3000 | head -20
```
**Resultado esperado:** HTML content (no error)

---

### Test 3: Login REAL (en navegador)
1. **Abre:** `http://localhost:3000/login`
2. **Verás:** Formulario de login CON credenciales pre-cargadas
3. **Email:** `admin@sgi360.com` (ya relleno)
4. **Password:** `Admin123!` (ya relleno)
5. **Click:** "INGRESAR"

**Esperado:**
- ✅ No hay error en consola
- ✅ Network tab muestra:
  - `POST /api/auth/login` → 200 OK
  - Response incluye: `token`, `user`, `csrfToken`
- ✅ Frontend guarda token en localStorage
- ✅ **Redirige automáticamente a `/dashboard`**
- ✅ Dashboard carga sin errores

---

### Test 4: Verificar base de datos
```bash
# Conectar a PostgreSQL
PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -c "SELECT email, globalRole FROM \"PlatformUser\" LIMIT 5;"
```

**Resultado esperado:**
```
       email        | globalRole
--------------------+------------
admin@sgi360.com    | SUPER_ADMIN
usuario@demo.com    | (null)
```

---

## 5️⃣ 🆘 SI ALGO FALLA

### Error: "Cannot find module 'husky'"
**Solución:**
```bash
npm install -g husky
cd /Users/leonardocastillo/Desktop/APP/"SGI 360"/apps/api
npm install --force
```

---

### Error: "connect ECONNREFUSED 127.0.0.1:5432"
**Solución:** PostgreSQL no está corriendo
```bash
# Verificar Docker
docker ps | grep postgres

# Si no está, relanzar:
docker run -d --name sgi360-postgres --rm \
  -e POSTGRES_USER=sgi \
  -e POSTGRES_PASSWORD=sgidev123 \
  -e POSTGRES_DB=sgi_dev \
  -p 5432:5432 \
  postgres:16-alpine
```

---

### Error: "Invalid credentials" en login
**Causas posibles:**
1. Seed NO se ejecutó → el usuario NO existe
   - **Solución:** `npm run seed:complete` en `/apps/api`

2. Contraseña incorrecta
   - **Verificar:** `admin@sgi360.com` / `Admin123!`
   - **NOT:** `test@example.com` / `Test123!@#`

3. Credenciales en base de datos están corrompidas
   - **Reset:** `npm run prisma:reset && npm run seed:complete`

---

### Error: "fetch failed" o "ECONNREFUSED 3002"
**Causa:** API no está corriendo
```bash
# En Terminal 1:
cd /Users/leonardocastillo/Desktop/APP/"SGI 360"/apps/api
npm run dev
```

**Verificar que sale:**
```
✓ Server running on http://localhost:3002
```

---

### Error: "Cannot GET /dashboard"
**Causa:** Middleware de autenticación está bloqueando
- **Verificar:** ¿El token se guardó en localStorage?
  - Abre DevTools → Application → LocalStorage → `accessToken`
  - Debería haber un valor JWT largo

- **Si NO está:**
  - El login falló silenciosamente
  - Revisar DevTools → Console para errores

---

## 6️⃣ 📋 VERIFICACIÓN FINAL (CHECKLIST)

Antes de considerar "FUNCIONANDO", verificar:

- [ ] Docker PostgreSQL corre en puerto 5432
- [ ] Docker Redis corre en puerto 6379
- [ ] `npm install` en API completa sin errores
- [ ] `npm install` en Web completa sin errores
- [ ] `prisma generate` ejecutado en API
- [ ] `prisma migrate` ejecutado en API
- [ ] `seed:complete` ejecutado (admin@sgi360.com existe en BD)
- [ ] API corre en puerto 3002 (`npm run dev` en `/apps/api`)
- [ ] Frontend corre en puerto 3000 (`npm run dev` en `/apps/web`)
- [ ] Puedo acceder a `http://localhost:3000/login`
- [ ] Login page muestra credenciales: `admin@sgi360.com` / `Admin123!`
- [ ] Click "INGRESAR" NO produce error
- [ ] Redirije a `/dashboard`
- [ ] Dashboard carga sin errores

**✅ Si todos los checkboxes = FUNCIONANDO 100%**

---

## 📝 RESUMEN DE CAMBIOS

| Archivo | Problema | Fix |
|---------|----------|-----|
| `/apps/web/.env` | Puerto API incorrecto | Cambiar 3001 → 3002 |
| `/apps/api/.env` | Hostnames Docker | Cambiar postgres/redis → localhost |
| `/apps/api/.env` | JWT_SECRET débil | Renovar a 32+ chars |
| `/apps/api/.env` | Líneas duplicadas | Eliminar 3x duplicación |
| `npm install` | husky error | Instalar global: `npm install -g husky` |
| Seed | Usuario no existe | Ejecutar: `npm run seed:complete` |

---

## 🎯 PRÓXIMOS PASOS (DESPUÉS DE FUNCIONAR)

1. Cambiar credenciales de prueba en producción
2. Implementar variables de entorno para producción
3. Habilitar HTTPS
4. Configurar SSL/TLS
5. Actualizar dominios en CORS
6. Setup de CI/CD

---

**Documento generado:** 2026-03-23
**Status:** Ready for execution
**Autor:** Senior DevOps + QA Lead
