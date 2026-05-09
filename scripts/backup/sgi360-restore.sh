#!/bin/bash
# ============================================================
# SGI360 — SCRIPT DE RESTORE ENTERPRISE
# Uso: ./sgi360-restore.sh [--mode MODE] [--timestamp YYYYMMDD_HHMM]
#
# MODOS:
#   full       — Restore completo (postgres + uploads + configs)
#   postgres   — Solo base de datos
#   uploads    — Solo archivos/documentos
#   configs    — Solo configuraciones
#   verify     — Simular restore sin aplicar cambios
# ============================================================

set -euo pipefail

BACKUP_ROOT="/backups"
FRIOPRO_PATH="/root/friopro"
PG_CONTAINER="sgi-postgres"
PG_USER="sgi"
PG_DB="sgi"
UPLOADS_PATH="/data/sgi360/uploads"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log()      { echo -e "$(date +"%H:%M:%S") $*"; }
log_ok()   { log "${GREEN}✓${NC} $*"; }
log_warn() { log "${YELLOW}⚠${NC}  $*"; }
log_err()  { log "${RED}✗${NC} $*"; }
log_info() { log "${BLUE}ℹ${NC}  $*"; }
log_head() { echo -e "\n${BOLD}═══ $* ═══${NC}"; }

MODE="full"
TIMESTAMP=""
DRY_RUN=false
FORCE=false

usage() {
  echo ""
  echo "SGI360 Restore Script"
  echo ""
  echo "Uso: $0 [opciones]"
  echo ""
  echo "Opciones:"
  echo "  --mode MODE          full | postgres | uploads | configs | verify"
  echo "  --timestamp TS       Timestamp del backup (YYYYMMDD_HHMM)"
  echo "  --dry-run            Simular sin aplicar cambios"
  echo "  --force              Omitir confirmaciones interactivas"
  echo ""
  echo "Ejemplos:"
  echo "  $0 --mode full --timestamp 20260509_0600"
  echo "  $0 --mode postgres --timestamp 20260509_0600 --force"
  echo "  $0 --mode verify --timestamp 20260509_0600 --dry-run"
  echo ""
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)      MODE="$2"; shift 2 ;;
    --timestamp) TIMESTAMP="$2"; shift 2 ;;
    --dry-run)   DRY_RUN=true; shift ;;
    --force)     FORCE=true; shift ;;
    --help|-h)   usage; exit 0 ;;
    *) log_err "Opción desconocida: $1"; usage; exit 1 ;;
  esac
done

# ── Seleccionar backup si no se especificó timestamp ─────────
if [ -z "${TIMESTAMP}" ]; then
  log_info "No se especificó timestamp. Listando backups disponibles:"
  echo ""
  ls -lt "${BACKUP_ROOT}/postgres/"*.dump 2>/dev/null | head -10 | while read -r line; do
    fname=$(echo "$line" | awk '{print $NF}' | xargs basename)
    ts=$(echo "$fname" | grep -oP '\d{8}_\d{4}' || echo "unknown")
    fsize=$(echo "$line" | awk '{print $5}')
    echo "  → ${ts}  (${fname}, $(numfmt --to=iec ${fsize} 2>/dev/null || echo ${fsize}))"
  done
  echo ""
  read -r -p "Ingresá el timestamp a restaurar (YYYYMMDD_HHMM): " TIMESTAMP
fi

PG_DUMP="${BACKUP_ROOT}/postgres/sgi_postgres_${TIMESTAMP}.dump"
UPLOADS_TAR="${BACKUP_ROOT}/uploads/uploads_${TIMESTAMP}.tar.gz"
CONFIGS_TAR="${BACKUP_ROOT}/configs/configs_${TIMESTAMP}.tar.gz"
MANIFEST="${BACKUP_ROOT}/manifests/manifest_${TIMESTAMP}.json"

# ── Verificar existencia de archivos ─────────────────────────
log_head "VERIFICACIÓN DE ARCHIVOS"
FILES_OK=true

check_file() {
  if [ -f "$1" ]; then
    log_ok "$1 ($(numfmt --to=iec $(stat -c%s "$1")))"
  else
    log_warn "No encontrado: $1"
    FILES_OK=false
  fi
}

check_file "${PG_DUMP}"
check_file "${UPLOADS_TAR}"
check_file "${CONFIGS_TAR}"
[ -f "${MANIFEST}" ] && log_ok "Manifest: ${MANIFEST}" || log_warn "Manifest no encontrado"

if [ "${FILES_OK}" = "false" ] && [ "${MODE}" = "full" ]; then
  log_err "Faltan archivos críticos. Verificá el timestamp."
  exit 1
fi

# ── Confirmación ─────────────────────────────────────────────
if [ "${FORCE}" = "false" ] && [ "${DRY_RUN}" = "false" ]; then
  echo ""
  log_warn "${RED}ATENCIÓN: Esta operación SOBREESCRIBIRÁ datos en producción.${NC}"
  log_warn "Modo: ${MODE} | Timestamp: ${TIMESTAMP}"
  echo ""
  read -r -p "¿Confirmar restore? Escribí 'SI RESTAURAR' para continuar: " confirm
  if [ "${confirm}" != "SI RESTAURAR" ]; then
    log_info "Restore cancelado."
    exit 0
  fi
fi

[ "${DRY_RUN}" = "true" ] && log_warn "MODO DRY-RUN — No se aplicarán cambios"

RESTORE_LOG="${BACKUP_ROOT}/logs/restore_${TIMESTAMP}_$(date +%H%M%S).log"
exec > >(tee -a "${RESTORE_LOG}") 2>&1

log_head "INICIANDO RESTORE SGI360"
log_info "Timestamp: ${TIMESTAMP}"
log_info "Modo: ${MODE}"
log_info "Dry-run: ${DRY_RUN}"
START=$(date +%s)

# ── RESTORE POSTGRESQL ───────────────────────────────────────
restore_postgres() {
  log_head "RESTORE POSTGRESQL"

  if [ ! -f "${PG_DUMP}" ]; then
    log_err "Dump no encontrado: ${PG_DUMP}"
    return 1
  fi

  # Verificar integridad primero (copiar al container para evitar problemas de stdin)
  log_info "Verificando integridad del dump..."
  docker cp "${PG_DUMP}" "${PG_CONTAINER}:/tmp/verify_restore.dump" 2>/dev/null
  if ! docker exec "${PG_CONTAINER}" pg_restore --list /tmp/verify_restore.dump > /dev/null 2>&1; then
    docker exec "${PG_CONTAINER}" rm -f /tmp/verify_restore.dump 2>/dev/null || true
    log_err "Dump CORRUPTO — abortando restore de PostgreSQL"
    return 1
  fi
  docker exec "${PG_CONTAINER}" rm -f /tmp/verify_restore.dump 2>/dev/null || true
  log_ok "Dump válido"

  if [ "${DRY_RUN}" = "true" ]; then
    log_info "[DRY-RUN] Se haría: pg_restore sobre DB ${PG_DB}"
    return 0
  fi

  # Backup previo de seguridad antes de restaurar
  log_info "Creando backup de seguridad de la BD actual..."
  SAFETY_DUMP="${BACKUP_ROOT}/postgres/safety_before_restore_$(date +%Y%m%d_%H%M%S).dump"
  docker exec "${PG_CONTAINER}" pg_dump \
    -U "${PG_USER}" -d "${PG_DB}" -Fc \
    -f "/tmp/safety.dump" 2>/dev/null && \
  docker cp "${PG_CONTAINER}:/tmp/safety.dump" "${SAFETY_DUMP}" && \
  docker exec "${PG_CONTAINER}" rm -f "/tmp/safety.dump" && \
  log_ok "Safety dump: ${SAFETY_DUMP}" || \
  log_warn "No se pudo crear safety dump (continúa de todos modos)"

  # Copiar dump al container
  log_info "Copiando dump al container..."
  docker cp "${PG_DUMP}" "${PG_CONTAINER}:/tmp/restore.dump"

  # Drop y recrear BD
  log_info "Recreando base de datos ${PG_DB}..."
  docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${PG_DB}' AND pid <> pg_backend_pid();" \
    > /dev/null 2>&1 || true

  docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d postgres -c \
    "DROP DATABASE IF EXISTS ${PG_DB};" > /dev/null 2>&1 || true

  docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d postgres -c \
    "CREATE DATABASE ${PG_DB} OWNER ${PG_USER};" > /dev/null 2>&1

  # Restore
  log_info "Ejecutando pg_restore..."
  if docker exec "${PG_CONTAINER}" pg_restore \
    -U "${PG_USER}" \
    -d "${PG_DB}" \
    --no-owner \
    --no-acl \
    --exit-on-error \
    /tmp/restore.dump 2>&1; then
    log_ok "PostgreSQL restaurado exitosamente"
  else
    log_warn "pg_restore completó con advertencias (puede ser normal si hay objetos previos)"
  fi

  docker exec "${PG_CONTAINER}" rm -f /tmp/restore.dump

  # Validar restore
  log_info "Validando restore..."
  TENANT_COUNT=$(docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -t -c \
    "SELECT COUNT(*) FROM \"Tenant\" WHERE \"deletedAt\" IS NULL;" 2>/dev/null | tr -d ' \n' || echo "0")
  USER_COUNT=$(docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -t -c \
    "SELECT COUNT(*) FROM \"PlatformUser\" WHERE \"deletedAt\" IS NULL;" 2>/dev/null | tr -d ' \n' || echo "0")

  log_ok "Validación: ${TENANT_COUNT} tenants, ${USER_COUNT} usuarios"

  if [ "${TENANT_COUNT}" = "0" ]; then
    log_warn "⚠ No hay tenants en la BD restaurada — verificar manualmente"
  fi
}

# ── RESTORE UPLOADS ──────────────────────────────────────────
restore_uploads() {
  log_head "RESTORE UPLOADS"

  if [ ! -f "${UPLOADS_TAR}" ]; then
    log_err "Tar de uploads no encontrado: ${UPLOADS_TAR}"
    return 1
  fi

  log_info "Verificando tar.gz..."
  if ! tar -tzf "${UPLOADS_TAR}" > /dev/null 2>&1; then
    log_err "uploads tar.gz CORRUPTO"
    return 1
  fi
  log_ok "tar.gz válido ($(tar -tzf "${UPLOADS_TAR}" | wc -l) archivos)"

  if [ "${DRY_RUN}" = "true" ]; then
    log_info "[DRY-RUN] Se restauraría en: ${UPLOADS_PATH}"
    tar -tzf "${UPLOADS_TAR}" | head -10
    return 0
  fi

  # Backup de uploads actuales
  if [ -d "${UPLOADS_PATH}" ]; then
    SAFETY_UPLOADS="${UPLOADS_PATH}_backup_$(date +%Y%m%d_%H%M%S)"
    mv "${UPLOADS_PATH}" "${SAFETY_UPLOADS}"
    log_ok "Uploads actuales respaldados en: ${SAFETY_UPLOADS}"
  fi

  mkdir -p "$(dirname "${UPLOADS_PATH}")"
  tar -xzf "${UPLOADS_TAR}" -C "$(dirname "${UPLOADS_PATH}")" 2>&1
  log_ok "Uploads restaurados en: ${UPLOADS_PATH}"

  FILE_COUNT=$(find "${UPLOADS_PATH}" -type f 2>/dev/null | wc -l || echo 0)
  log_ok "Archivos restaurados: ${FILE_COUNT}"
}

# ── RESTORE CONFIGS ──────────────────────────────────────────
restore_configs() {
  log_head "RESTORE CONFIGURACIONES"

  if [ ! -f "${CONFIGS_TAR}" ]; then
    log_err "Tar de configs no encontrado: ${CONFIGS_TAR}"
    return 1
  fi

  if [ "${DRY_RUN}" = "true" ]; then
    log_info "[DRY-RUN] Contenido del tar de configs:"
    tar -tzf "${CONFIGS_TAR}"
    return 0
  fi

  CONFIGS_TMP="/tmp/restore_configs_$(date +%s)"
  mkdir -p "${CONFIGS_TMP}"
  tar -xzf "${CONFIGS_TAR}" -C "${CONFIGS_TMP}" 2>&1

  # Restaurar .env
  for envf in .env .env.testing; do
    local_env=$(find "${CONFIGS_TMP}" -name "${envf}" 2>/dev/null | head -1)
    if [ -n "${local_env}" ]; then
      cp "${local_env}" "${FRIOPRO_PATH}/${envf}"
      log_ok "${envf} restaurado"
    fi
  done

  # Restaurar nginx
  local_nginx=$(find "${CONFIGS_TMP}" -type d -name "nginx" 2>/dev/null | head -1)
  if [ -n "${local_nginx}" ] && [ -d "/etc/nginx" ]; then
    cp -r "${local_nginx}/." /etc/nginx/ 2>/dev/null || true
    nginx -t 2>&1 && log_ok "Nginx config restaurada y válida" || log_warn "Nginx config restaurada pero hay errores"
  fi

  rm -rf "${CONFIGS_TMP}"
  log_ok "Configuraciones restauradas"
}

# ── EJECUTAR SEGÚN MODO ──────────────────────────────────────
case "${MODE}" in
  full)
    restore_postgres
    restore_uploads
    restore_configs
    ;;
  postgres)
    restore_postgres
    ;;
  uploads)
    restore_uploads
    ;;
  configs)
    restore_configs
    ;;
  verify)
    DRY_RUN=true
    log_head "MODO VERIFICACIÓN — Sin cambios"
    restore_postgres
    restore_uploads
    restore_configs
    ;;
  *)
    log_err "Modo inválido: ${MODE}"
    usage
    exit 1
    ;;
esac

# ── Post-restore: reiniciar servicios ────────────────────────
if [ "${DRY_RUN}" = "false" ] && [ "${MODE}" = "full" ]; then
  log_head "REINICIANDO SERVICIOS"
  log_info "Reiniciando containers Docker de producción..."
  cd "${FRIOPRO_PATH}" && docker compose up -d --no-deps --force-recreate api web 2>&1 || \
    log_warn "No se pudo reiniciar automáticamente — hacerlo manualmente"
  log_ok "Servicios reiniciados"
fi

END=$(date +%s)
DURATION=$((END - START))

log_head "RESTORE COMPLETADO"
log_ok "Duración: ${DURATION}s"
log_info "Log: ${RESTORE_LOG}"

echo ""
echo -e "${BOLD}PRÓXIMOS PASOS POST-RESTORE:${NC}"
echo "  1. Verificar que la app funciona en https://logismart.ar"
echo "  2. Revisar logs: docker logs sgi-api --tail 50"
echo "  3. Validar BD: docker exec sgi-postgres psql -U sgi -d sgi -c 'SELECT COUNT(*) FROM \"Tenant\";'"
echo "  4. Verificar uploads: ls -la /data/sgi360/uploads/"
echo ""
