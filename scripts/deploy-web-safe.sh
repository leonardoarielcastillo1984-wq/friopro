#!/bin/bash
set -e

echo '[INFO] SGI360 Enterprise Deploy Script v2.0'
echo '[INFO] Target: Production Environment'
echo ''

cd /root/friopro

echo '[INFO] Step 1: Cleaning build cache...'
docker builder prune -f --filter unused-for=24h 2>/dev/null || true
docker compose down web 2>/dev/null || true
echo '[SUCCESS] Cache cleaned'
echo ''

echo '[INFO] Step 2: Building web container...'
if ! docker compose build --no-cache web 2>&1 | tee /tmp/build.log; then
  echo '[ERROR] Build failed - check /tmp/build.log'
  exit 1
fi

if grep -qi 'error\|failed' /tmp/build.log; then
  echo '[ERROR] Build completed with errors'
  exit 1
fi
echo '[SUCCESS] Build completed successfully'
echo ''

echo '[INFO] Step 3: Starting containers...'
docker compose up -d web
sleep 10
echo '[SUCCESS] Containers started'
echo ''

echo '[INFO] Step 4: Checking API health status...'
for i in 1 2 3 4 5 6; do
  HEALTH=$(docker inspect --format='{{.State.Health.Status}}' sgi-api 2>/dev/null || echo 'none')
  if [ "$HEALTH" = "healthy" ]; then
    echo "[SUCCESS] API container healthy (attempt $i)"
    break
  fi
  echo "[INFO] Attempt $i: API status=$HEALTH, waiting..."
  sleep 5
done

if [ "$HEALTH" != "healthy" ]; then
  echo '[ERROR] API container not healthy after 30s'
  docker logs sgi-api --tail 20
  exit 1
fi
echo ''

echo '[INFO] Step 5: Validating /health endpoint...'
for i in 1 2 3; do
  if curl -fsS --max-time 3 http://localhost:3002/health -o /dev/null; then
    echo "[SUCCESS] /health endpoint responding (attempt $i)"
    break
  fi
  echo "[INFO] Attempt $i: /health not ready..."
  sleep 2
done
echo ''

echo '[INFO] Step 6: Checking readiness endpoint...'
READY_RESP=$(curl -fsS --max-time 5 http://localhost:3002/ready 2>/dev/null || echo '{"ready":false}')
echo "[INFO] Readiness response: $READY_RESP"

if echo "$READY_RESP" | grep -q '"ready":true'; then
  echo '[SUCCESS] System ready for traffic'
else
  echo '[WARNING] System not fully ready (non-critical dependencies may be pending)'
fi
echo ''

echo '[INFO] Step 7: Final validation...'
for i in 1 2 3 4 5; do
  CODE=$(curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://localhost:3000/login || echo '000')
  if echo "$CODE" | grep -qE '200|307|308'; then
    echo "[SUCCESS] Web frontend responding HTTP $CODE"
    echo ''
    echo '========================================'
    echo '[SUCCESS] DEPLOY COMPLETED SUCCESSFULLY'
    echo '========================================'
    echo ''
    echo 'Container Status:'
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.State}}' | grep -E 'sgi-web|sgi-api'
    echo ''
    echo 'Health Endpoints:'
    echo "  - /health:  $(curl -fsS --max-time 2 -o /dev/null -w '%{http_code}' http://localhost:3002/health || echo 'FAIL')"
    echo "  - /ready:   $(curl -fsS --max-time 2 -o /dev/null -w '%{http_code}' http://localhost:3002/ready || echo 'FAIL')"
    exit 0
  fi
  echo "[INFO] Attempt $i: HTTP $CODE, retrying..."
  sleep 3
done

echo ''
echo '[ERROR] DEPLOY FAILED - System not responding'
echo '[INFO] Rollback command: docker compose down web && docker compose up -d web'
docker logs sgi-web --tail 30
exit 1
