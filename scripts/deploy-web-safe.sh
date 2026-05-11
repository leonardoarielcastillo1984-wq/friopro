#!/bin/bash
set -e

echo '🔧 Deploy seguro de web...'

cd /root/friopro

echo '🧹 Limpiando caché...'
docker builder prune -f --filter unused-for=24h 2>/dev/null || true
docker compose down web 2>/dev/null || true

echo '🔨 Build de web...'
if ! docker compose build --no-cache web 2>&1 | tee /tmp/build.log; then
  echo '❌ Build falló'
  exit 1
fi

if grep -qi 'error\|failed' /tmp/build.log; then
  echo '❌ Errores detectados en el build'
  exit 1
fi

echo '🚀 Iniciando web...'
docker compose up -d web

echo '⏳ Esperando inicio de servicios...'
sleep 10

echo '🔍 Verificando healthcheck de API...'
for i in 1 2 3 4 5 6; do
  HEALTH=$(docker inspect --format='{{.State.Health.Status}}' sgi-api 2>/dev/null || echo 'none')
  if [ "$HEALTH" = "healthy" ]; then
    echo "✅ API healthy"
    break
  fi
  echo "   Intento $i: API health=$HEALTH, esperando..."
  sleep 5
done

if [ "$HEALTH" != "healthy" ]; then
  echo '❌ API no está healthy después de 30s'
  docker logs sgi-api --tail 20
  exit 1
fi

echo '🔍 Verificando endpoint /api/health...'
for i in 1 2 3; do
  if curl -fsS http://localhost:3002/health -o /dev/null; then
    echo "✅ Endpoint /api/health responde OK"
    break
  fi
  sleep 2
done

echo '🔍 Verificando web responde...'
for i in 1 2 3 4 5; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login || echo '000')
  if echo "$CODE" | grep -qE '200|307|308'; then
    echo "✅ Deploy exitoso (HTTP $CODE)"
    echo ''
    echo '📊 Estado de contenedores:'
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.State}}' | grep -E 'sgi-web|sgi-api'
    exit 0
  fi
  echo "   Intento $i: HTTP $CODE, reintentando..."
  sleep 3
done

echo '❌ Healthcheck falló después de 5 intentos'
docker logs sgi-web --tail 30
echo '⚠️  Hacer rollback manual: docker compose down web && docker compose up -d web'
exit 1
