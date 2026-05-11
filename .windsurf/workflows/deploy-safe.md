---
description: Deploy seguro a producción con verificación de build
---

# Deploy Seguro a Producción

Este workflow garantiza que el build de Next.js se complete correctamente antes de deployar.

## Pasos

### 1. Limpiar caché de builds anteriores
```bash
cd /root/friopro
docker builder prune -f --filter unused-for=24h
docker compose down web
docker volume rm friopro_web_build_cache 2>/dev/null || true
```

### 2. Build con verificación
```bash
docker compose build --no-cache web 2>&1 | tee /tmp/build.log
if grep -q "error\|ERROR\|failed\|FAILED" /tmp/build.log; then
  echo "❌ Build falló - revisar /tmp/build.log"
  exit 1
fi
```

### 3. Verificar chunks generados
```bash
docker run --rm friopro-web ls -la /app/apps/web/.next/static/chunks/ | head -10
if [ $? -ne 0 ]; then
  echo "❌ Chunks no encontrados - build corrupto"
  exit 1
fi
```

### 4. Iniciar servicio
```bash
docker compose up -d web
sleep 10
```

### 5. Healthcheck
```bash
curl -f http://localhost:3000/login -o /dev/null -w '%{http_code}' | grep -qE '200|307|308'
if [ $? -eq 0 ]; then
  echo "✅ Deploy exitoso"
else
  echo "❌ Healthcheck falló - haciendo rollback"
  docker compose down web
  exit 1
fi
```

### Comando completo (una línea)
```bash
cd /root/friopro && docker builder prune -f && docker compose down web && docker compose build --no-cache web && docker compose up -d web && sleep 10 && curl -f http://localhost:3000/login -o /dev/null && echo "✅ OK" || echo "❌ Falló"
```
