# 🚀 Guía de Deployment a Staging

## Paso 1: Preparar el Backend para Staging

### 1.1 Verificar que los cambios estén commitados

```bash
cd apps/api
git status
```

Deberías ver cambios en:
- `src/routes/auth.ts` ← Incluye 2FA check en login + nuevo endpoint 2fa-complete

Si no está commitado:
```bash
git add src/routes/auth.ts
git commit -m "Integrar 2FA con login y endpoint 2fa-complete"
```

### 1.2 Construir el backend

```bash
cd apps/api
npm run build
```

✅ Debería completar sin errores

### 1.3 Hacer push a tu rama de staging

```bash
git push origin main  # o tu rama de staging
```

---

## Paso 2: Desplegar a Staging (según tu setup)

### Opción A: Docker/Kubernetes

```bash
# En tu servidor de staging
docker pull your-registry/sgi-360-api:latest
docker run -d \
  -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="your-secret" \
  -e NODE_ENV=staging \
  your-registry/sgi-360-api:latest
```

### Opción B: Railway / Vercel / Heroku

```bash
# Push automáticamente dispara deployment
git push origin staging
```

### Opción C: VPS Manual

```bash
cd /var/www/sgi-360/apps/api
git pull origin main
npm install
npm run build
npm run start:prod &
```

---

## Paso 3: Verificar que el Backend Funciona

### 3.1 Verificar health endpoint

```bash
curl https://staging-api.sgi360.com/healthz
# Response: {"ok":true}
```

### 3.2 Probar login SIN 2FA

```bash
curl -X POST https://staging-api.sgi360.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'

# Response esperado (SIN 2FA):
# {
#   "user": { "id": "...", "email": "test@example.com" },
#   "activeTenant": { "id": "...", "name": "...", "slug": "..." },
#   "tenantRole": "TENANT_MEMBER",
#   "csrfToken": "..."
# }
```

### 3.3 Verificar que endpoints 2FA existen

```bash
# Setup endpoint (requiere autenticación)
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl https://staging-api.sgi360.com/2fa/status \
  -H "Authorization: Bearer $TOKEN"

# Response esperado:
# {
#   "status": {
#     "isEnabled": false,
#     "isConfirmed": false,
#     "recoveryCodesRemaining": 0
#   }
# }
```

---

## Paso 4: Test de 2FA Completo (opcional pero recomendado)

### 4.1 Setup 2FA

```bash
curl -X POST https://staging-api.sgi360.com/2fa/setup \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'

# Response:
# {
#   "secret": "JBSWY3DPEBLW64TMMQ======",
#   "qrCodeUrl": "data:image/png;base64,...",
#   "manualEntryKey": "JBSWY3DPEBLW64TMMQ"
# }
```

### 4.2 Generar código TOTP (desde el secret)

Usa cualquier app: Google Authenticator, Authy, etc. O usa speakeasy en Node:

```bash
node -e "
const speakeasy = require('speakeasy');
const totp = speakeasy.totp({
  secret: 'JBSWY3DPEBLW64TMMQ======',
  encoding: 'base32'
});
console.log('Código 6 dígitos:', totp);
"
```

### 4.3 Confirmar 2FA

```bash
curl -X POST https://staging-api.sgi360.com/2fa/confirm \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "123456"  # Usa el código generado
  }'

# Response:
# {
#   "success": true,
#   "recoveryCodes": ["ABC123...", "DEF456...", ...]
# }
```

### 4.4 Probar login CON 2FA

```bash
# 1. Login normal
curl -X POST https://staging-api.sgi360.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'

# Response esperado (2FA HABILITADO):
# {
#   "requires2FA": true,
#   "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
#   "expiresIn": 600
# }

# 2. Verificar código TOTP
SESSION_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
TOTP_CODE="654321"  # Código actual de authenticator

curl -X POST https://staging-api.sgi360.com/2fa/verify \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "'$SESSION_TOKEN'",
    "token": "'$TOTP_CODE'"
  }'

# Response:
# { "success": true, "verified": true }

# 3. Completar login
curl -X POST https://staging-api.sgi360.com/auth/2fa-complete \
  -H "Content-Type: application/json" \
  -d '{
    "sessionToken": "'$SESSION_TOKEN'"
  }'

# Response (igual que login normal):
# {
#   "user": { "id": "...", "email": "test@example.com" },
#   "activeTenant": { "id": "...", "name": "...", "slug": "..." },
#   "tenantRole": "TENANT_MEMBER",
#   "csrfToken": "..."
# }
```

---

## Checklist de Verificación

✅ **Backend Deployed**
- [ ] Server respondiendo en staging
- [ ] Database conectada correctamente
- [ ] Logs sin errores

✅ **Login Normal (sin 2FA)**
- [ ] POST /auth/login funciona
- [ ] Retorna tokens correctos
- [ ] Usuario puede acceder a dashboard

✅ **2FA Endpoints**
- [ ] GET /2fa/status funciona
- [ ] POST /2fa/setup genera QR code
- [ ] POST /2fa/confirm habilitaautentic 2FA
- [ ] POST /2fa/verify valida códigos

✅ **2FA Login Flow**
- [ ] POST /auth/login retorna requires2FA: true
- [ ] sessionToken válido por 10 minutos
- [ ] POST /2fa/verify acepta token
- [ ] POST /auth/2fa-complete emite tokens finales

---

## Troubleshooting

### Error: "database connection failed"
```bash
# Verificar DATABASE_URL
echo $DATABASE_URL

# Verificar acceso a BD
psql $DATABASE_URL -c "SELECT 1"
```

### Error: "module not found: twoFactorAuth"
```bash
# Verificar que el archivo existe
ls -la apps/api/src/services/twoFactorAuth.ts

# Reimportar si necesario
npm run build
```

### Error: "function get2FAStatus not exported"
```bash
# Verificar que está exportado en twoFactorAuth.ts
grep "export function get2FAStatus" apps/api/src/services/twoFactorAuth.ts
```

### Timeout en verificación 2FA
```bash
# Aumentar timeout en cliente (frontend)
# Timeout debería ser >30 segundos
```

---

## Próximos Pasos

Una vez confirmado que el backend funciona:

1. ✅ Backend deployed ← AHORA
2. ⏳ Copiar componentes React
3. ⏳ Actualizar useAuth hook
4. ⏳ Agregar rutas
5. ⏳ Testing

---

## Comandos Rápidos

```bash
# Ver logs de staging
docker logs container-id -f

# Reiniciar servidor
pm2 restart api

# Ver status
curl https://staging-api.sgi360.com/healthz

# Test rápido de endpoint
curl -X POST https://staging-api.sgi360.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'
```

---

**Status:** Listo para deployment 🚀
