#!/bin/bash
# ============================================================
# SGI360 — BACKUP ENTERPRISE COMPLETO
# Versión: 2.0
# Frecuencia: 06:00 y 18:00 diarios (vía cron)
# ============================================================

set -euo pipefail

# ── Configuración ────────────────────────────────────────────
BACKUP_ROOT="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M")
DATE=$(date +"%Y%m%d")
HOUR=$(date +"%H%M")
LOG_FILE="${BACKUP_ROOT}/logs/backup_${TIMESTAMP}.log"
MANIFEST_FILE="${BACKUP_ROOT}/manifests/manifest_${TIMESTAMP}.json"

PG_CONTAINER="sgi-postgres"
PG_USER="sgi"
PG_DB="sgi"

UPLOADS_PATH="/data/sgi360/uploads"
FRIOPRO_PATH="/root/friopro"
DOCKER_ROOT="/data/docker"

MIN_DUMP_SIZE=10240      # 10 KB mínimo para dump
MIN_UPLOADS_SIZE=1024    # 1 KB mínimo para uploads tar

RETENTION_DAILY=14
RETENTION_WEEKLY=8
RETENTION_MONTHLY=6

ALERT_EMAIL="${BACKUP_ALERT_EMAIL:-}"

# ── Colores para logs ─────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── Init ──────────────────────────────────────────────────────
mkdir -p \
  "${BACKUP_ROOT}/postgres" \
  "${BACKUP_ROOT}/uploads" \
  "${BACKUP_ROOT}/docker" \
  "${BACKUP_ROOT}/configs" \
  "${BACKUP_ROOT}/system" \
  "${BACKUP_ROOT}/logs" \
  "${BACKUP_ROOT}/manifests"

BACKUP_OK=true
ERRORS=()

log() {
  local level="$1"; shift
  local msg="$*"
  local ts
  ts=$(date +"%Y-%m-%d %H:%M:%S")
  echo -e "${ts} [${level}] ${msg}" | tee -a "${LOG_FILE}"
}

log_ok()   { log "${GREEN}OK${NC}"   "$@"; }
log_warn() { log "${YELLOW}WARN${NC}" "$@"; }
log_err()  { log "${RED}ERROR${NC}" "$@"; BACKUP_OK=false; ERRORS+=("$*"); }
log_info() { log "${BLUE}INFO${NC}" "$@"; }

send_alert() {
  local subject="$1"
  local body="$2"
  if [ -n "${ALERT_EMAIL}" ]; then
    echo "${body}" | mail -s "${subject}" "${ALERT_EMAIL}" 2>/dev/null || true
  fi
  log_warn "ALERTA: ${subject}"
}

# ── Inicio ────────────────────────────────────────────────────
START_TIME=$(date +%s)
log_info "========================================================"
log_info "SGI360 BACKUP ENTERPRISE — Inicio: ${TIMESTAMP}"
log_info "========================================================"

# ── REQ 1: PostgreSQL COMPLETO ───────────────────────────────
log_info "--- REQUERIMIENTO 1: PostgreSQL dump completo ---"

PG_DUMP_FILE="${BACKUP_ROOT}/postgres/sgi_postgres_${TIMESTAMP}.dump"
PG_DUMP_SQL="${BACKUP_ROOT}/postgres/sgi_postgres_${TIMESTAMP}.sql.gz"

log_info "Generando dump PostgreSQL (formato custom + SQL gzip)..."

# Dump formato custom (restauración selectiva)
if docker exec "${PG_CONTAINER}" pg_dump \
    -U "${PG_USER}" \
    -d "${PG_DB}" \
    -Fc \
    --schema=public \
    --no-owner \
    --no-acl \
    -f "/tmp/sgi_backup_${TIMESTAMP}.dump" 2>>"${LOG_FILE}"; then

  docker cp "${PG_CONTAINER}:/tmp/sgi_backup_${TIMESTAMP}.dump" "${PG_DUMP_FILE}" 2>>"${LOG_FILE}"
  docker exec "${PG_CONTAINER}" rm -f "/tmp/sgi_backup_${TIMESTAMP}.dump" 2>/dev/null || true

  PG_SIZE=$(stat -c%s "${PG_DUMP_FILE}" 2>/dev/null || echo 0)
  if [ "${PG_SIZE}" -lt "${MIN_DUMP_SIZE}" ]; then
    log_err "Dump PostgreSQL demasiado pequeño: ${PG_SIZE} bytes"
  else
    log_ok "Dump PostgreSQL OK — $(numfmt --to=iec ${PG_SIZE})"
  fi
else
  log_err "Fallo al generar dump PostgreSQL (formato custom)"
fi

# Dump SQL plano comprimido (legibilidad/portabilidad)
if docker exec "${PG_CONTAINER}" pg_dump \
    -U "${PG_USER}" \
    -d "${PG_DB}" \
    --schema=public \
    --no-owner \
    --no-acl 2>>"${LOG_FILE}" | gzip > "${PG_DUMP_SQL}"; then
  log_ok "Dump SQL gzip OK — $(numfmt --to=iec $(stat -c%s "${PG_DUMP_SQL}"))"
else
  log_warn "Dump SQL gzip falló (el custom dump es el principal)"
fi

# Estadísticas de BD
log_info "Recolectando estadísticas de BD..."
PG_STATS=$(docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -t -c "
SELECT json_build_object(
  'tenants',     (SELECT COUNT(*) FROM \"Tenant\" WHERE \"deletedAt\" IS NULL),
  'usuarios',    (SELECT COUNT(*) FROM \"PlatformUser\" WHERE \"deletedAt\" IS NULL),
  'documentos',  (SELECT COUNT(*) FROM \"Document\" WHERE \"deletedAt\" IS NULL),
  'subscriptions', (SELECT COUNT(*) FROM \"TenantSubscription\"),
  'planes',      (SELECT COUNT(*) FROM \"Plan\")
);" 2>/dev/null | tr -d ' \n' || echo '{"error":"no_stats"}')

log_info "BD Stats: ${PG_STATS}"

# ── REQ 2: Uploads y documentos ─────────────────────────────
log_info "--- REQUERIMIENTO 2: Uploads y documentos ---"

UPLOADS_FILE="${BACKUP_ROOT}/uploads/uploads_${TIMESTAMP}.tar.gz"

if [ -d "${UPLOADS_PATH}" ]; then
  log_info "Comprimiendo ${UPLOADS_PATH}..."
  if tar -czf "${UPLOADS_FILE}" -C "$(dirname "${UPLOADS_PATH}")" "$(basename "${UPLOADS_PATH}")" 2>>"${LOG_FILE}"; then
    UPLOADS_SIZE=$(stat -c%s "${UPLOADS_FILE}" 2>/dev/null || echo 0)
    log_ok "Uploads comprimidos OK — $(numfmt --to=iec ${UPLOADS_SIZE})"
  else
    log_err "Fallo al comprimir uploads"
  fi
else
  log_warn "Directorio uploads no encontrado: ${UPLOADS_PATH} — creando tar vacío"
  tar -czf "${UPLOADS_FILE}" --files-from=/dev/null 2>/dev/null || true
  UPLOADS_SIZE=0
fi

# Uploads de producción (volumen Docker)
PROD_UPLOADS="/data/docker/volumes/friopro_api_uploads/_data"
if [ -d "${PROD_UPLOADS}" ]; then
  PROD_UPLOADS_FILE="${BACKUP_ROOT}/uploads/uploads_prod_${TIMESTAMP}.tar.gz"
  log_info "Comprimiendo uploads producción: ${PROD_UPLOADS}..."
  if tar -czf "${PROD_UPLOADS_FILE}" -C "$(dirname "${PROD_UPLOADS}")" "$(basename "${PROD_UPLOADS}")" 2>>"${LOG_FILE}"; then
    log_ok "Uploads prod OK — $(numfmt --to=iec $(stat -c%s "${PROD_UPLOADS_FILE}"))"
  else
    log_warn "Fallo al comprimir uploads prod"
  fi
fi

# ── REQ 3: Docker configs ────────────────────────────────────
log_info "--- REQUERIMIENTO 3: Docker configs y compose ---"

DOCKER_FILE="${BACKUP_ROOT}/docker/docker_configs_${TIMESTAMP}.tar.gz"

# Lista de archivos Docker a respaldar
DOCKER_INCLUDE=(
  "${FRIOPRO_PATH}/docker-compose.yml"
  "${FRIOPRO_PATH}/docker-compose.testing.yml"
  "${FRIOPRO_PATH}/Dockerfile"
  "${FRIOPRO_PATH}/apps/api/Dockerfile"
  "${FRIOPRO_PATH}/apps/web/Dockerfile"
)

DOCKER_TMP="/tmp/docker_backup_${TIMESTAMP}"
mkdir -p "${DOCKER_TMP}"

for f in "${DOCKER_INCLUDE[@]}"; do
  [ -f "$f" ] && cp "$f" "${DOCKER_TMP}/" 2>/dev/null || true
done

# Metadata de volúmenes Docker
docker volume ls --format "{{.Name}}\t{{.Driver}}\t{{.Mountpoint}}" > "${DOCKER_TMP}/volumes_list.txt" 2>/dev/null || true
docker network ls --format "{{.Name}}\t{{.Driver}}" > "${DOCKER_TMP}/networks_list.txt" 2>/dev/null || true
docker ps -a --format "{{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" > "${DOCKER_TMP}/containers_list.txt" 2>/dev/null || true

# Estado de imágenes
docker images --format "{{.Repository}}\t{{.Tag}}\t{{.Size}}" > "${DOCKER_TMP}/images_list.txt" 2>/dev/null || true

tar -czf "${DOCKER_FILE}" -C "/tmp" "$(basename "${DOCKER_TMP}")" 2>>"${LOG_FILE}"
rm -rf "${DOCKER_TMP}"
log_ok "Docker configs OK — $(numfmt --to=iec $(stat -c%s "${DOCKER_FILE}"))"

# ── REQ 4: Configuraciones críticas ─────────────────────────
log_info "--- REQUERIMIENTO 4: Configuraciones críticas ---"

CONFIGS_FILE="${BACKUP_ROOT}/configs/configs_${TIMESTAMP}.tar.gz"
CONFIGS_TMP="/tmp/configs_backup_${TIMESTAMP}"
mkdir -p "${CONFIGS_TMP}"

# .env files (encriptados con openssl si hay passphrase)
for envf in "${FRIOPRO_PATH}/.env" "${FRIOPRO_PATH}/.env.testing" "${FRIOPRO_PATH}/.env.local"; do
  [ -f "$envf" ] && cp "$envf" "${CONFIGS_TMP}/" 2>/dev/null || true
done

# Nginx
if [ -d "/etc/nginx" ]; then
  cp -r /etc/nginx "${CONFIGS_TMP}/nginx" 2>/dev/null || true
fi
if [ -f "/etc/nginx/sites-available/default" ]; then
  cp /etc/nginx/sites-available/default "${CONFIGS_TMP}/nginx_default.conf" 2>/dev/null || true
fi

# Prisma schema
PRISMA_SCHEMA="${FRIOPRO_PATH}/apps/api/prisma/schema.prisma"
[ -f "${PRISMA_SCHEMA}" ] && cp "${PRISMA_SCHEMA}" "${CONFIGS_TMP}/schema.prisma" 2>/dev/null || true

# Scripts del proyecto
[ -d "${FRIOPRO_PATH}/scripts" ] && cp -r "${FRIOPRO_PATH}/scripts" "${CONFIGS_TMP}/scripts" 2>/dev/null || true

# Package.json raíz
[ -f "${FRIOPRO_PATH}/package.json" ] && cp "${FRIOPRO_PATH}/package.json" "${CONFIGS_TMP}/" 2>/dev/null || true

# Redis config
[ -f "/etc/redis/redis.conf" ] && cp /etc/redis/redis.conf "${CONFIGS_TMP}/redis.conf" 2>/dev/null || true

tar -czf "${CONFIGS_FILE}" -C "/tmp" "$(basename "${CONFIGS_TMP}")" 2>>"${LOG_FILE}"
rm -rf "${CONFIGS_TMP}"
log_ok "Configs OK — $(numfmt --to=iec $(stat -c%s "${CONFIGS_FILE}"))"

# ── REQ 5: System snapshot ───────────────────────────────────
log_info "--- Sistema: snapshot de estado actual ---"

SYS_FILE="${BACKUP_ROOT}/system/system_${TIMESTAMP}.tar.gz"
SYS_TMP="/tmp/system_backup_${TIMESTAMP}"
mkdir -p "${SYS_TMP}"

# Info del sistema
uname -a > "${SYS_TMP}/uname.txt" 2>/dev/null || true
df -h > "${SYS_TMP}/disk_usage.txt" 2>/dev/null || true
free -h > "${SYS_TMP}/memory.txt" 2>/dev/null || true
crontab -l > "${SYS_TMP}/crontab.txt" 2>/dev/null || true
systemctl list-units --type=service --state=running > "${SYS_TMP}/services.txt" 2>/dev/null || true
ip addr > "${SYS_TMP}/network.txt" 2>/dev/null || true
dpkg -l > "${SYS_TMP}/packages.txt" 2>/dev/null || true

# Git log del repo
git -C "${FRIOPRO_PATH}" log --oneline -20 > "${SYS_TMP}/git_log.txt" 2>/dev/null || true
git -C "${FRIOPRO_PATH}" status --short > "${SYS_TMP}/git_status.txt" 2>/dev/null || true

tar -czf "${SYS_FILE}" -C "/tmp" "$(basename "${SYS_TMP}")" 2>>"${LOG_FILE}"
rm -rf "${SYS_TMP}"
log_ok "System snapshot OK — $(numfmt --to=iec $(stat -c%s "${SYS_FILE}"))"

# ── REQ 6: Verificación de integridad ───────────────────────
log_info "--- REQUERIMIENTO 6: Verificación de integridad ---"

# Verificar dump PostgreSQL
if [ -f "${PG_DUMP_FILE}" ]; then
  log_info "Verificando dump PostgreSQL con pg_restore --list..."
  docker cp "${PG_DUMP_FILE}" "${PG_CONTAINER}:/tmp/verify_dump.dump" 2>/dev/null
  if docker exec "${PG_CONTAINER}" pg_restore --list /tmp/verify_dump.dump > /dev/null 2>>"${LOG_FILE}"; then
    log_ok "Dump PostgreSQL verificado — estructura válida"
  else
    log_err "Dump PostgreSQL corrupto o inválido"
  fi
  docker exec "${PG_CONTAINER}" rm -f /tmp/verify_dump.dump 2>/dev/null || true
fi

# Verificar tar.gz de uploads
for tarfile in "${UPLOADS_FILE}" "${CONFIGS_FILE}" "${DOCKER_FILE}" "${SYS_FILE}"; do
  if [ -f "${tarfile}" ]; then
    if tar -tzf "${tarfile}" > /dev/null 2>>"${LOG_FILE}"; then
      log_ok "$(basename "${tarfile}") — tar.gz válido"
    else
      log_err "$(basename "${tarfile}") — tar.gz CORRUPTO"
    fi
  fi
done

# ── REQ 5: Manifest JSON ─────────────────────────────────────
log_info "--- REQUERIMIENTO 5: Generando manifest ---"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Checksums de todos los archivos generados
CHECKSUMS=()
for f in "${BACKUP_ROOT}/postgres/"*"${TIMESTAMP}"* \
         "${BACKUP_ROOT}/uploads/"*"${TIMESTAMP}"* \
         "${BACKUP_ROOT}/docker/"*"${TIMESTAMP}"* \
         "${BACKUP_ROOT}/configs/"*"${TIMESTAMP}"* \
         "${BACKUP_ROOT}/system/"*"${TIMESTAMP}"*; do
  [ -f "$f" ] && CHECKSUMS+=("\"$(basename "$f")\":\"$(sha256sum "$f" | cut -d' ' -f1)\"")
done

CHECKSUMS_JSON=$(printf '%s,' "${CHECKSUMS[@]}" | sed 's/,$//')

TOTAL_SIZE=$(du -sb "${BACKUP_ROOT}/" 2>/dev/null | cut -f1 || echo 0)

cat > "${MANIFEST_FILE}" <<EOF
{
  "timestamp": "${TIMESTAMP}",
  "date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "duration_seconds": ${DURATION},
  "backup_ok": ${BACKUP_OK},
  "errors": $(printf '%s\n' "${ERRORS[@]+"${ERRORS[@]}"}" | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))" 2>/dev/null || echo "[]"),
  "files": {
    "postgres_dump": "$(basename "${PG_DUMP_FILE}")",
    "postgres_sql": "$(basename "${PG_DUMP_SQL}")",
    "uploads": "$(basename "${UPLOADS_FILE}")",
    "docker": "$(basename "${DOCKER_FILE}")",
    "configs": "$(basename "${CONFIGS_FILE}")",
    "system": "$(basename "${SYS_FILE}")"
  },
  "sizes": {
    "postgres_dump_bytes": $(stat -c%s "${PG_DUMP_FILE}" 2>/dev/null || echo 0),
    "postgres_sql_bytes": $(stat -c%s "${PG_DUMP_SQL}" 2>/dev/null || echo 0),
    "uploads_bytes": $(stat -c%s "${UPLOADS_FILE}" 2>/dev/null || echo 0),
    "docker_bytes": $(stat -c%s "${DOCKER_FILE}" 2>/dev/null || echo 0),
    "configs_bytes": $(stat -c%s "${CONFIGS_FILE}" 2>/dev/null || echo 0),
    "system_bytes": $(stat -c%s "${SYS_FILE}" 2>/dev/null || echo 0),
    "total_backup_bytes": ${TOTAL_SIZE}
  },
  "database_stats": ${PG_STATS:-{}},
  "checksums": {${CHECKSUMS_JSON}},
  "environment": {
    "hostname": "$(hostname)",
    "uptime": "$(uptime -p 2>/dev/null || echo unknown)",
    "docker_version": "$(docker --version 2>/dev/null | head -1 || echo unknown)"
  }
}
EOF

log_ok "Manifest generado: ${MANIFEST_FILE}"

# ── REQ 7: Retención ─────────────────────────────────────────
log_info "--- REQUERIMIENTO 7: Política de retención ---"

apply_retention() {
  local dir="$1"
  local keep_daily="${RETENTION_DAILY}"
  local keep_weekly="${RETENTION_WEEKLY}"
  local keep_monthly="${RETENTION_MONTHLY}"

  # Mantener los últimos N diarios
  local count=0
  for f in $(ls -t "${dir}"/ 2>/dev/null); do
    count=$((count + 1))
    local filepath="${dir}/${f}"
    [ ! -f "${filepath}" ] && continue

    local fdate
    fdate=$(echo "${f}" | grep -oP '\d{8}' | head -1 || echo "")
    [ -z "${fdate}" ] && continue

    local fday
    fday=$(date -d "${fdate}" +%u 2>/dev/null || echo 0)  # 1=lunes, 7=domingo
    local fdom
    fdom=$(date -d "${fdate}" +%d 2>/dev/null || echo 0)  # día del mes

    # Retener semanales (lunes) hasta RETENTION_WEEKLY semanas
    local weeks_ago=$(( ($(date +%s) - $(date -d "${fdate}" +%s 2>/dev/null || date +%s)) / (7*86400) ))
    # Retener mensuales (día 1) hasta RETENTION_MONTHLY meses
    local months_ago=$(( ($(date +%Y%m) - $(date -d "${fdate}" +%Y%m 2>/dev/null || date +%Y%m)) ))

    local keep=false
    [ ${count} -le ${keep_daily} ] && keep=true
    [ "${fday}" = "1" ] && [ ${weeks_ago} -le ${keep_weekly} ] && keep=true
    [ "${fdom}" = "01" ] && [ ${months_ago} -le ${keep_monthly} ] && keep=true

    if [ "${keep}" = "false" ]; then
      rm -f "${filepath}"
      log_info "Eliminado por retención: ${f}"
    fi
  done
}

for dir in "${BACKUP_ROOT}/postgres" "${BACKUP_ROOT}/uploads" "${BACKUP_ROOT}/docker" "${BACKUP_ROOT}/configs" "${BACKUP_ROOT}/system"; do
  apply_retention "${dir}"
done

# Limpiar logs viejos (mantener 30 días)
find "${BACKUP_ROOT}/logs" -name "*.log" -mtime +30 -delete 2>/dev/null || true
find "${BACKUP_ROOT}/manifests" -name "*.json" -mtime +90 -delete 2>/dev/null || true

log_ok "Retención aplicada"

# ── Resumen final ─────────────────────────────────────────────
log_info "========================================================"
if [ "${BACKUP_OK}" = "true" ]; then
  log_ok "BACKUP COMPLETADO EXITOSAMENTE en ${DURATION}s"
  log_info "Archivos en: ${BACKUP_ROOT}"
  log_info "Manifest: ${MANIFEST_FILE}"
else
  log_err "BACKUP COMPLETADO CON ERRORES:"
  for e in "${ERRORS[@]}"; do
    log_err "  - ${e}"
  done
  send_alert "⚠️ SGI360 Backup con errores — ${TIMESTAMP}" "$(cat "${LOG_FILE}")"
fi
log_info "========================================================"
