# ⚡ Backend Deployment - Quick Commands

**Copy & Paste Ready** - Todos los comandos para desplegar en 5 minutos

---

## 🔧 Paso 1: Preparación (5 min)

```bash
# Ir a la carpeta del API
cd apps/api

# Ver cambios
git status

# Instalar dependencias (si es necesario)
npm install

# Compilar
npm run build
```

**¿Sin errores?** → Continúa

---

## 📝 Paso 2: Commit (2 min)

```bash
# Agregar cambios
git add src/routes/auth.ts

# Commit
git commit -m "feat: Integrate 2FA with login endpoint and 2fa-complete"

# Ver commit
git log -1 --oneline
```

**✓ Commiteado?** → Continúa

---

## 🚀 Paso 3: Push (2 min)

```bash
# Push a repositorio
git push origin main

# O si usas rama de staging:
git push origin staging

# Verificar
git log -1 --oneline
```

**✓ Pusheado?** → Elige tu opción de deployment abajo

---

## 🌐 Deployment Options

### OPCIÓN A: Railway (Más fácil)

```bash
# Solo espera - Railway deploya automáticamente cuando hace push
# Verifica en: https://railway.app/dashboard

# Ver si terminó
curl https://staging-api.sgi360.com/healthz
```

---

### OPCIÓN B: Heroku

```bash
# Si tienes Heroku CLI instalado
git push heroku main

# Ver logs
heroku logs --tail -a tu-app-name
```

---

### OPCIÓN C: Docker (Self-hosted)

```bash
# Construir imagen
docker build -t sgi-api:staging -f apps/api/Dockerfile .

# Push a registry (ej: Docker Hub, ECR, etc.)
docker push tu-registry/sgi-api:staging

# En servidor staging
ssh user@staging-server
docker pull tu-registry/sgi-api:staging
docker-compose up -d  # O similar según tu setup
```

---

### OPCIÓN D: VPS Manual (Ubuntu/Linux)

```bash
# SSH al servidor
ssh user@staging-api.example.com

# En el servidor:
cd /var/www/sgi-360/apps/api

# Pull cambios
git pull origin main

# Instalar (si cambió package.json)
npm ci

# Compilar
npm run build

# Reiniciar
pm2 restart api
# O: sudo systemctl restart sgi-api
# O: docker-compose restart api
```

---

## ✅ Verificación (3 min)

```bash
# 1. Health endpoint
curl https://staging-api.sgi360.com/healthz

# Respuesta esperada:
# {"ok":true}

# ============================================

# 2. Login sin 2FA (requiere usuario válido)
curl -X POST https://staging-api.sgi360.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'

# Respuesta esperada (user sin 2FA):
# {
#   "user": {"id":"...","email":"test@example.com"},
#   "activeTenant": {"id":"...","name":"...","slug":"..."},
#   "tenantRole": "TENANT_MEMBER",
#   "csrfToken": "..."
# }

# ============================================

# 3. Verificar 2FA endpoints existen
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

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

---

## 🆘 Si algo falla

### Error en build

```bash
cd apps/api
npm run build

# Revisar error específico
# Si dice "module not found twoFactorAuth"
# → Asegúrate que existe: ls -la src/services/twoFactorAuth.ts
```

### Error de conexión a BD

```bash
# Verificar variable de entorno
echo $DATABASE_URL

# Probar conexión
psql $DATABASE_URL -c "SELECT 1"
```

### Server no responde

```bash
# Ver logs
docker logs sgi-api
# O
pm2 logs api

# Esperar 30 segundos y reintentar
sleep 30 && curl https://staging-api.sgi360.com/healthz
```

### Error 404 en endpoints

```bash
# Verificar que el servidor actualizado está corriendo
docker ps | grep sgi-api
pm2 list | grep api

# Si no está, reiniciar
docker restart sgi-api
pm2 restart api
```

---

## 📊 Resumen

| Paso | Tiempo | Comando |
|------|--------|---------|
| Build | 2 min | `npm run build` |
| Commit | 1 min | `git commit -m "..."` |
| Push | 1 min | `git push origin main` |
| Deploy | 5 min | Depende de tu setup |
| Verify | 3 min | `curl https://staging-api.../healthz` |
| **TOTAL** | **~15 min** | |

---

## ✨ Checklist Final

- [ ] `npm run build` sin errores
- [ ] `git push` exitoso
- [ ] Deploy iniciado (Railway/Heroku/Docker)
- [ ] `curl healthz` responde `{"ok":true}`
- [ ] Login funciona
- [ ] Endpoints 2FA responden

**Si todo ✓ → Backend está listo para testing!**

---

## 🎯 Próximo paso

Una vez que todo funciona:

1. ✅ Backend deployed
2. ⏳ **Copiar componentes React** → Ver `QUICK_INTEGRATION_GUIDE.md`
