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

echo '⏳ Esperando healthcheck...'
sleep 15

for i in 1 2 3 4 5; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/login || echo '000')
  if echo "$CODE" | grep -qE '200|307|308'; then
    echo "✅ Deploy exitoso (HTTP $CODE)"
    exit 0
  fi
  echo "   Intento $i: HTTP $CODE, reintentando..."
  sleep 5
done

echo '❌ Healthcheck falló después de 5 intentos'
docker logs sgi-web --tail 30
echo '⚠️  Hacer rollback manual si es necesario'
exit 1
