#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# Réplica PRODUCCIÓN → TESTING (SGI360 / DADA)
#
# Corre en el servidor de PRODUCCIÓN (54.94.33.5). Hace pg_dump de la
# base prod y la restaura completa en sgi-postgres-testing, para que
# testing siempre tenga los datos reales y frescos del tenant DADA.
#
# ATENCIÓN: pisa TODA la base de testing. Cualquier dato cargado a mano
# en testing se pierde en cada sincronización.
#
# Requiere en el host prod:
#   ~/.ssh/logismart-testing.pem  → clave SSH del servidor testing
# Instalación cron (una línea en `crontab -e` del user ubuntu en prod):
#   0 * * * * /home/ubuntu/sync-prod-to-testing.sh >> /var/log/sgi-sync-testing.log 2>&1
# ═══════════════════════════════════════════════════════════════════
set -e

TESTING_HOST="ubuntu@18.191.206.203"
TESTING_KEY="$HOME/.ssh/logismart-testing.pem"
STAMP=$(date +%Y%m%d-%H%M)
DUMP="sgi-prod-${STAMP}.dump"
REMOTE_DUMP="/tmp/${DUMP}"
LOG_PREFIX="[sync-testing $(date '+%F %T')]"

echo "$LOG_PREFIX Iniciando dump de prod…"
docker exec sgi-postgres pg_dump -U sgi -Fc sgi > "/tmp/${DUMP}"
SIZE=$(du -h "/tmp/${DUMP}" | cut -f1)
echo "$LOG_PREFIX Dump listo: ${SIZE}"

echo "$LOG_PREFIX Enviando a testing…"
scp -i "$TESTING_KEY" -o StrictHostKeyChecking=accept-new "/tmp/${DUMP}" "${TESTING_HOST}:${REMOTE_DUMP}"

echo "$LOG_PREFIX Restaurando en testing…"
ssh -i "$TESTING_KEY" "$TESTING_HOST" "
  docker exec -i sgi-postgres-testing psql -U sgi -d sgi -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' &&
  cat ${REMOTE_DUMP} | docker exec -i sgi-postgres-testing pg_restore -U sgi -d sgi --no-owner --no-privileges || true
  rm -f ${REMOTE_DUMP}
"

rm -f "/tmp/${DUMP}"
echo "$LOG_PREFIX Réplica completada."
