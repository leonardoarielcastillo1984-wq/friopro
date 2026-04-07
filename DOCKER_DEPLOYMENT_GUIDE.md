# 🐳 Deployment con Docker - Guía Completa

**Tu setup:** Docker
**Tiempo:** 15-20 minutos
**Archivos:** Dockerfile en apps/api/

---

## ⚡ Quick Start (Copy-Paste)

### Paso 1: Compilar & Commitear (3 min)

```bash
# En raíz del proyecto
cd apps/api
npm run build

# Verificar cambios
git status

# Commitear
git add src/routes/auth.ts
git commit -m "feat: Integrate 2FA with login endpoint"

# Push
git push origin main
```

---

### Paso 2: Construir Imagen Docker (5 min)

**Opción A: Dockerfile en apps/api/**

```bash
# En raíz del proyecto
docker build -t sgi-api:staging -f apps/api/Dockerfile .

# Verificar imagen creada
docker images | grep sgi-api
```

**Opción B: Si Dockerfile está en raíz**

```bash
docker build -t sgi-api:staging .
```

**Resultado esperado:**
```
Successfully tagged sgi-api:staging
```

---

### Paso 3: Push a Registry (5-10 min)

**Para Docker Hub:**

```bash
# Login (primera vez)
docker login

# Tag para docker hub
docker tag sgi-api:staging tu-usuario/sgi-api:staging

# Push
docker push tu-usuario/sgi-api:staging

# Verificar
docker images | grep sgi-api:staging
```

**Para AWS ECR:**

```bash
# Login
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com

# Tag
docker tag sgi-api:staging 123456789.dkr.ecr.us-east-1.amazonaws.com/sgi-api:staging

# Push
docker push 123456789.dkr.ecr.us-east-1.amazonaws.com/sgi-api:staging
```

**Para Google Container Registry:**

```bash
# Configure Docker
gcloud auth configure-docker

# Tag
docker tag sgi-api:staging gcr.io/tu-proyecto/sgi-api:staging

# Push
docker push gcr.io/tu-proyecto/sgi-api:staging
```

---

### Paso 4: Deploy en Servidor Staging (2-3 min)

**En tu servidor staging, ejecuta:**

```bash
# SSH al servidor
ssh user@staging-server

# O si usas docker-compose

# Opción A: Si tienes docker-compose.yml

cd /var/docker/sgi-360  # O donde sea tu docker-compose

# Actualizar imagen en docker-compose.yml
# Cambiar:
# image: sgi-api:old
# Por:
# image: tu-registry/sgi-api:staging

# Pull nueva imagen
docker-compose pull

# Reiniciar servicio
docker-compose up -d api  # O similar según tu config

# Ver logs
docker-compose logs -f api
```

**Opción B: Si corres containers directamente**

```bash
# SSH al servidor
ssh user@staging-server

# Parar container anterior
docker stop sgi-api || true
docker rm sgi-api || true

# Pull nueva imagen
docker pull tu-registry/sgi-api:staging

# Correr container
docker run -d \
  --name sgi-api \
  --restart unless-stopped \
  -p 3001:3001 \
  -e DATABASE_URL="postgresql://user:pass@db-host:5432/sgi360_staging" \
  -e JWT_SECRET="tu-secret-key-aqui" \
  -e NODE_ENV="staging" \
  -e CORS_ORIGIN="https://staging-app.tu-dominio.com" \
  tu-registry/sgi-api:staging

# Ver logs
docker logs -f sgi-api

# Esperar a que inicie (10-20 segundos)
sleep 15
docker ps | grep sgi-api
```

---

## ✅ Verificación (3 min)

### Test 1: Container está corriendo

```bash
# En servidor staging
docker ps | grep sgi-api

# Debería mostrar:
# CONTAINER ID  IMAGE              STATUS
# abc123...     tu-registry/sgi-api:staging  Up 2 minutes
```

### Test 2: Health endpoint

```bash
# Desde tu máquina local
curl https://staging-api.tu-dominio.com/healthz

# O si está en localhost:3001
curl http://localhost:3001/healthz

# Respuesta esperada:
# {"ok":true}
```

Si obtienes error de conexión, espera 30 segundos (el servidor puede estar iniciando).

### Test 3: Login normal (sin 2FA)

```bash
curl -X POST https://staging-api.tu-dominio.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'

# Respuesta esperada:
# {
#   "user": {"id":"...","email":"test@example.com"},
#   "activeTenant": {"id":"...","name":"...","slug":"..."},
#   "tenantRole": "TENANT_MEMBER",
#   "csrfToken": "..."
# }
```

### Test 4: Endpoints 2FA

```bash
# Primero, obtén un token válido del login anterior
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Probar GET /2fa/status
curl https://staging-api.tu-dominio.com/2fa/status \
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

## 🆘 Troubleshooting

### ❌ Error: "No such file or directory: Dockerfile"

```bash
# Asegúrate que estás en la raíz del proyecto
pwd
# Debería mostrar: /path/to/sgi-360

# Busca el Dockerfile
find . -name Dockerfile -type f
# Debería mostrar: ./apps/api/Dockerfile

# Usa la ruta correcta
docker build -t sgi-api:staging -f apps/api/Dockerfile .
```

### ❌ Error: "failed to authorize: failed to fetch anonymous token"

```bash
# Si usas Docker Hub
docker login
# Ingresa tu usuario y contraseña

# Si usas AWS ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.us-east-1.amazonaws.com
```

### ❌ Error: "Image pull failed" en servidor

```bash
# En servidor staging, verificar conectividad
docker pull tu-registry/sgi-api:staging

# Si falla, verificar:
# 1. Registry es accesible
# 2. Credenciales están configuradas
docker login tu-registry

# Reintentar
docker pull tu-registry/sgi-api:staging
```

### ❌ Container no inicia

```bash
# Ver logs detallados
docker logs sgi-api

# Problemas comunes:
# - DATABASE_URL inválido
# - JWT_SECRET no configurado
# - Puerto 3001 en uso

# Verificar variables de entorno
docker inspect sgi-api | grep -A 20 "Env"

# Recrear container con variables correctas
docker stop sgi-api
docker rm sgi-api
docker run -d \
  --name sgi-api \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  tu-registry/sgi-api:staging
```

### ❌ Health endpoint devuelve 404

```bash
# Esperar más tiempo a que inicie
sleep 30
curl http://localhost:3001/healthz

# Si sigue fallando, verificar logs
docker logs sgi-api

# Si logs vacíos, container puede estar crasheando
# Recrear con terminal interactiva
docker run -it tu-registry/sgi-api:staging /bin/sh
```

---

## 📊 Comandos Útiles

```bash
# Ver logs en tiempo real
docker logs -f sgi-api

# Ver estadísticas del container
docker stats sgi-api

# Ver variables de entorno
docker inspect sgi-api | grep -A 20 '"Env"'

# Ejecutar comando dentro del container
docker exec sgi-api npm run build

# Parar container
docker stop sgi-api

# Reiniciar container
docker restart sgi-api

# Eliminar container
docker rm sgi-api

# Eliminar imagen
docker rmi sgi-api:staging

# Ver historial de pull/push
docker image history sgi-api:staging

# Limpiar recursos no usados
docker system prune -a
```

---

## 🔄 Workflow Completo

```bash
# ====== LOCAL (Tu máquina) ======

# 1. Compilar
cd apps/api && npm run build

# 2. Commitear
git add src/routes/auth.ts
git commit -m "feat: 2FA integration"
git push origin main

# 3. Construir imagen
docker build -t sgi-api:staging -f apps/api/Dockerfile .

# 4. Push a registry
docker login
docker tag sgi-api:staging tu-usuario/sgi-api:staging
docker push tu-usuario/sgi-api:staging

# ====== STAGING SERVER (SSH) ======

# 5. Pull nueva imagen
docker pull tu-usuario/sgi-api:staging

# 6. Parar viejo container
docker stop sgi-api && docker rm sgi-api

# 7. Correr nuevo container
docker run -d \
  --name sgi-api \
  --restart unless-stopped \
  -p 3001:3001 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  -e NODE_ENV="staging" \
  tu-usuario/sgi-api:staging

# 8. Verificar
docker logs -f sgi-api

# ====== LOCAL (Tu máquina) ======

# 9. Probar
curl https://staging-api.tu-dominio.com/healthz
```

---

## ✨ Docker Compose (Alternativa)

Si usas docker-compose.yml:

```yaml
version: '3.8'

services:
  api:
    image: tu-registry/sgi-api:staging
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://user:pass@db:5432/sgi360_staging
      JWT_SECRET: tu-secret-key
      NODE_ENV: staging
      CORS_ORIGIN: https://staging-app.tu-dominio.com
    depends_on:
      - db
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: sgi360_staging
    volumes:
      - db_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  db_data:
```

Luego:

```bash
# Actualizar imagen
docker-compose pull

# Reiniciar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f api
```

---

## 🎯 Resumen

| Paso | Comando | Tiempo |
|------|---------|--------|
| Build | `docker build -t sgi-api:staging .` | 5 min |
| Push | `docker push tu-registry/sgi-api:staging` | 5 min |
| Deploy | `docker run -d ...` | 1 min |
| Test | `curl https://staging-api.../healthz` | 2 min |
| **TOTAL** | | **~15 min** |

---

## ✅ Checklist Final

- [ ] `npm run build` sin errores
- [ ] Imagen Docker construida (`docker images | grep sgi-api`)
- [ ] Push a registry exitoso
- [ ] Container corriendo en staging (`docker ps | grep sgi-api`)
- [ ] Health endpoint responde `{"ok":true}`
- [ ] Login funciona
- [ ] Endpoints 2FA responden

**Si todo ✓ → ¡Backend listo para testing!**

---

## 📝 Siguientes pasos

1. ✅ Backend deployed con Docker
2. ⏳ **Copiar componentes React** → `QUICK_INTEGRATION_GUIDE.md`
3. ⏳ Actualizar rutas
4. ⏳ Probar flujo completo
