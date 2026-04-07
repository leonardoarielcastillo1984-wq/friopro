# ✅ Backend Deployment Checklist

**Objetivo:** Desplegar los cambios de 2FA a staging
**Tiempo estimado:** 30 minutos
**Estado:** Listo para ejecutar

---

## Pre-Deployment Verification

### ✓ Step 1: Verificar que los cambios están en su lugar (2 min)

```bash
# En la raíz del proyecto
cd apps/api

# Ver cambios realizados
git diff src/routes/auth.ts | head -20
```

**Deberías ver:**
- Import: `import { get2FAStatus, create2FASession }`
- Nuevo código de 2FA check en login
- Nuevo endpoint `/auth/2fa-complete`

**✓ Verificado?** Continúa →

---

## Preparación para Deployment

### ✓ Step 2: Instalar dependencias (2 min)

```bash
cd apps/api

# Instalar/actualizar dependencias
npm install

# Verifica que speakeasy está instalado (para TOTP)
npm list speakeasy
```

**Debería mostrar:**
```
├── speakeasy@2.x.x
```

Si no está instalado:
```bash
npm install speakeasy
```

**✓ Verificado?** Continúa →

---

### ✓ Step 3: Compilar el código (5 min)

```bash
# En apps/api/
npm run build
```

**Deberías ver:**
```
✓ Build successful
✓ No TypeScript errors
```

Si hay errores, detente y revisa el mensaje.

**✓ Verificado?** Continúa →

---

### ✓ Step 4: Verificar que twoFactorAuth.ts existe

```bash
# Desde apps/api/
ls -la src/services/twoFactorAuth.ts
```

**Debería mostrar el archivo (no "file not found")**

```
-rw-r--r-- 1 user group 50000 Mar 16 10:00 src/services/twoFactorAuth.ts
```

**✓ Verificado?** Continúa →

---

## Commit & Push

### ✓ Step 5: Commitear cambios (2 min)

```bash
# Desde apps/api/
git status
```

**Deberías ver cambios en:**
- `src/routes/auth.ts` (MODIFICADO)

Si hay otros cambios no deseados, úsalos con cuidado.

```bash
# Agregar solo auth.ts
git add src/routes/auth.ts

# Commit
git commit -m "feat: Integrate 2FA with login endpoint

- Add 2FA check in /auth/login endpoint
- Create temporary 2FA session if 2FA enabled
- Add /auth/2fa-complete endpoint to finalize login
- Maintain backward compatibility for non-2FA users"
```

**✓ Commiteado?** Continúa →

---

### ✓ Step 6: Push a repositorio (2 min)

```bash
# Verificar rama actual
git branch -a

# Push
git push origin main  # O tu rama de staging

# Verificar
git log -1 --oneline
```

**Deberías ver tu commit más reciente**

**✓ Pusheado?** Continúa →

---

## Deployment (varía según tu setup)

### 🔷 OPCIÓN A: Railway / Vercel / Heroku

#### Si usas Railway:

```bash
# El deployment debería iniciar automáticamente
# Verifica en tu dashboard de Railway:
# 1. Ir a tu proyecto
# 2. Ver tab "Deployments"
# 3. Esperar a que muestre "✓ Deployed"
```

#### Si usas Vercel:

```bash
# El deployment debería iniciar automáticamente
# Verifica en vercel.com dashboard
```

#### Si usas Heroku:

```bash
# Deploy manual (si no tiene auto-deploy)
git push heroku main

# Ver logs
heroku logs --tail
```

---

### 🔷 OPCIÓN B: Docker (Self-hosted)

```bash
# En raíz del proyecto (donde está Dockerfile)
docker build -t sgi-api:staging -f apps/api/Dockerfile .

# Push a tu registry
docker tag sgi-api:staging your-registry/sgi-api:staging
docker push your-registry/sgi-api:staging

# En servidor staging
docker pull your-registry/sgi-api:staging
docker stop sgi-api || true
docker rm sgi-api || true
docker run -d \
  --name sgi-api \
  -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  -e NODE_ENV=staging \
  your-registry/sgi-api:staging

# Ver logs
docker logs -f sgi-api
```

---

### 🔷 OPCIÓN C: VPS Manual (SSH)

```bash
# SSH al servidor staging
ssh user@staging-api.example.com

# En el servidor
cd /var/www/sgi-360/apps/api

# Hacer pull de cambios
git pull origin main

# Instalar dependencias (si hay cambios en package.json)
npm ci  # Más seguro que npm install

# Compilar
npm run build

# Reiniciar servidor
pm2 restart api
# O si usas systemd:
# sudo systemctl restart sgi-api

# Ver logs
pm2 logs api
# O
# tail -f /var/log/sgi-api/app.log
```

---

## Post-Deployment Verification

### ✓ Step 7: Verificar que el servidor está funcionando (3 min)

```bash
# Probar health endpoint
curl https://staging-api.sgi360.com/healthz

# Respuesta esperada:
# {"ok":true}
```

Si obtienes error de conexión:
- Espera 30 segundos (el servidor puede estar iniciando)
- Verifica que el servidor está corriendo
- Revisa logs: `pm2 logs api` o `docker logs sgi-api`

**✓ Health OK?** Continúa →

---

### ✓ Step 8: Probar login normal (SIN 2FA) (2 min)

```bash
curl -X POST https://staging-api.sgi360.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'

# Respuesta esperada (user sin 2FA):
# {
#   "user": { "id": "...", "email": "test@example.com" },
#   "activeTenant": { "id": "...", "name": "...", "slug": "..." },
#   "tenantRole": "TENANT_MEMBER",
#   "csrfToken": "..."
# }
```

**¿Funciona?** ✓ Continúa →

---

### ✓ Step 9: Verificar endpoints 2FA existen (2 min)

```bash
# Obtener un token válido primero (desde login anterior)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Probar GET /2fa/status
curl https://staging-api.sgi360.com/2fa/status \
  -H "Authorization: Bearer $TOKEN"

# Respuesta esperada:
# {
#   "status": {
#     "isEnabled": false,
#     "isConfirmed": false,
#     "recoveryCodesRemaining": 0
#   }
# }
```

**¿Funciona?** ✓ Excelente →

---

## Problemas Comunes

### ❌ Error: "Cannot find module 'twoFactorAuth'"

**Solución:**
```bash
# Verificar que el archivo existe
ls -la apps/api/src/services/twoFactorAuth.ts

# Si no existe, necesitas restaurar el archivo de una copia anterior
# o regenerarlo
```

### ❌ Error: "database connection failed"

**Solución:**
```bash
# Verificar DATABASE_URL
echo $DATABASE_URL

# Probar conexión
psql $DATABASE_URL -c "SELECT 1"
```

### ❌ Error: "404 Not Found" en healthz

**Solución:**
```bash
# Esperar más tiempo (servidor iniciando)
sleep 30
curl https://staging-api.sgi360.com/healthz

# Si sigue fallando, revisar logs
docker logs sgi-api  # O pm2 logs api
```

### ❌ Error: "Connection refused"

**Solución:**
```bash
# Verificar que el servidor está corriendo
docker ps  # O pm2 list

# Si no está, revisar por qué se apagó
docker logs sgi-api
```

---

## ✅ Deployment Exitoso - Checklist Final

- [x] Cambios committeados
- [x] Push a repositorio exitoso
- [x] Build completó sin errores
- [x] Server respondiendo en staging
- [x] Health endpoint funciona
- [x] Login normal funciona
- [x] Endpoints 2FA existen
- [ ] (Próximo) Probar 2FA completo

---

## 🎯 Próximo paso

Una vez que todo funciona arriba:

1. ✅ **Backend deployed** ← AQUÍ ESTÁS
2. ⏳ **Copiar componentes React** (QUICK_INTEGRATION_GUIDE.md)
3. ⏳ **Actualizar rutas**
4. ⏳ **Probar flujo completo en navegador**

---

## 📞 Soporte rápido

Si algo no funciona:

1. Revisa los logs del servidor
2. Verifica las variables de entorno
3. Asegúrate que la base de datos está accesible
4. Verifica que compiló sin errores (`npm run build`)

**Tiempo típico:** 30 minutos (incluida verificación)
