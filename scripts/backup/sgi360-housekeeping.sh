#!/bin/bash
# ============================================================
# SGI360 — HOUSEKEEPING ENTERPRISE SEGURO
# Versión: 1.0
# Frecuencia: Domingos 04:00 AM (después del snapshot Hetzner)
# Cron: 0 4 * * 0 /root/sgi360-housekeeping.sh
# ============================================================

set -euo pipefail

LOG_FILE="/backups/logs/housekeeping.log"
LOCK_FILE="/tmp/sgi360-housekeeping.lock"

DISK_ABORT_THRESHOLD=95   # Abortar si disco >95%
MIN_FREE_MB=500            # Mínimo espacio libre requerido

PG_CONTAINER="sgi-postgres"
PG_USER="sgi"
PG_DB="sgi"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

mkdir -p "$(dirname "${LOG_FILE}")"

log()      { echo -e "$(date +"%Y-%m-%d %H:%M:%S") [$1] $2" | tee -a "${LOG_FILE}"; }
log_ok()   { log "${GREEN}OK${NC}"    "$1"; }
log_err()  { log "${RED}ERROR${NC}"  "$1"; }
log_warn() { log "${YELLOW}WARN${NC}" "$1"; }
log_info() { log "${BLUE}INFO${NC}"  "$1"; }
log_head() { echo -e "\n$(date +"%Y-%m-%d %H:%M:%S") [====] $1" | tee -a "${LOG_FILE}"; }

# Contadores de reporte
FREED_BYTES=0
ACTIONS=()
ERRORS=()

track_freed() {
  local before="$1"
  local after="$2"
  local delta=$(( before - after ))
  [ ${delta} -gt 0 ] && FREED_BYTES=$(( FREED_BYTES + delta ))
}

add_action() { ACTIONS+=("$1"); }
add_error()  { ERRORS+=("$1"); log_err "$1"; }

disk_used_pct() { df / | awk 'NR==2 {print $5}' | tr -d '%'; }
disk_free_kb()  { df / | awk 'NR==2 {print $4}'; }
disk_total_kb() { df / | awk 'NR==2 {print $2}'; }

# ── Control de ejecución simultánea ──────────────────────────
if [ -f "${LOCK_FILE}" ]; then
  LOCK_PID=$(cat "${LOCK_FILE}" 2>/dev/null || echo "")
  if [ -n "${LOCK_PID}" ] && kill -0 "${LOCK_PID}" 2>/dev/null; then
    log_warn "Housekeeping ya en ejecución (PID ${LOCK_PID}). Abortando."
    exit 0
  fi
  rm -f "${LOCK_FILE}"
fi
echo $$ > "${LOCK_FILE}"
trap 'rm -f "${LOCK_FILE}"' EXIT

# ── Inicio ────────────────────────────────────────────────────
START_TIME=$(date +%s)
TIMESTAMP=$(date +"%Y%m%d_%H%M")

log_head "SGI360 HOUSEKEEPING ENTERPRISE — Inicio: ${TIMESTAMP}"

# ── PRE-CHECKS DE SEGURIDAD ───────────────────────────────────
log_head "PRE-CHECKS DE SEGURIDAD"

# Check disco
DISK_USE=$(disk_used_pct)
DISK_FREE_KB=$(disk_free_kb)
DISK_FREE_MB=$((DISK_FREE_KB / 1024))
log_info "Disco actual: ${DISK_USE}% usado — ${DISK_FREE_MB} MB libres"

if [ "${DISK_USE}" -ge "${DISK_ABORT_THRESHOLD}" ]; then
  add_error "Disco al ${DISK_USE}% — por encima del umbral de aborto (${DISK_ABORT_THRESHOLD}%). Continuando de todas formas (es una emergencia de espacio)."
fi

if [ "${DISK_FREE_MB}" -lt "${MIN_FREE_MB}" ]; then
  log_warn "Espacio libre crítico: ${DISK_FREE_MB} MB — procediendo con limpieza de emergencia"
fi

# Check PostgreSQL
log_info "Verificando PostgreSQL..."
if ! docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -c "SELECT 1;" > /dev/null 2>&1; then
  add_error "PostgreSQL no responde — abortando housekeeping para proteger integridad"
  log_err "ABORTADO: PostgreSQL no está healthy"
  exit 1
fi
log_ok "PostgreSQL healthy"

# Check Docker
log_info "Verificando Docker daemon..."
if ! docker info > /dev/null 2>&1; then
  add_error "Docker daemon no responde — abortando"
  exit 1
fi
log_ok "Docker daemon OK"

# Verificar containers críticos corriendo
CRITICAL_CONTAINERS=("sgi-api" "sgi-postgres")
for ct in "${CRITICAL_CONTAINERS[@]}"; do
  STATUS=$(docker inspect --format='{{.State.Status}}' "${ct}" 2>/dev/null || echo "missing")
  if [ "${STATUS}" != "running" ]; then
    log_warn "Container ${ct} no está running (status: ${STATUS})"
  else
    log_ok "Container ${ct}: running"
  fi
done

DISK_BEFORE_KB=$(disk_free_kb)
log_info "Espacio libre antes: $((DISK_BEFORE_KB / 1024)) MB"

# ── A) Docker dangling images ─────────────────────────────────
log_head "A) Limpieza Docker — imágenes dangling"

DANGLING_BEFORE=$(docker images -f "dangling=true" -q | wc -l)
log_info "Imágenes dangling encontradas: ${DANGLING_BEFORE}"

if [ "${DANGLING_BEFORE}" -gt 0 ]; then
  DOCKER_SIZE_BEFORE=$(docker system df --format '{{.Size}}' 2>/dev/null | head -1 || echo "0")
  if docker image prune -f > /dev/null 2>&1; then
    DANGLING_AFTER=$(docker images -f "dangling=true" -q | wc -l)
    REMOVED=$((DANGLING_BEFORE - DANGLING_AFTER))
    log_ok "Imágenes dangling eliminadas: ${REMOVED}"
    add_action "Docker: ${REMOVED} imágenes dangling eliminadas"
  else
    log_warn "docker image prune tuvo advertencias (no crítico)"
  fi
else
  log_info "Sin imágenes dangling — nada que limpiar"
fi

# ── B) Docker builder cache ───────────────────────────────────
log_head "B) Limpieza Docker — builder cache"

BUILDER_SIZE=$(docker builder du 2>/dev/null | tail -1 | awk '{print $1}' || echo "0B")
log_info "Builder cache actual: ${BUILDER_SIZE}"

if docker builder prune -f > /dev/null 2>&1; then
  log_ok "Builder cache limpiado"
  add_action "Docker: builder cache limpiado (era ${BUILDER_SIZE})"
else
  log_warn "docker builder prune falló o sin cache"
fi

# ── C) Logs systemd ──────────────────────────────────────────
log_head "C) Limpieza — logs systemd (>14 días)"

JOURNAL_BEFORE=$(journalctl --disk-usage 2>/dev/null | grep -oP '[\d.]+[KMGT]?B' | head -1 || echo "0B")
log_info "Uso actual journald: ${JOURNAL_BEFORE}"

if journalctl --vacuum-time=14d > /dev/null 2>&1; then
  JOURNAL_AFTER=$(journalctl --disk-usage 2>/dev/null | grep -oP '[\d.]+[KMGT]?B' | head -1 || echo "0B")
  log_ok "Journald limpiado: ${JOURNAL_BEFORE} → ${JOURNAL_AFTER}"
  add_action "Systemd: logs vacuum 14d (${JOURNAL_BEFORE} → ${JOURNAL_AFTER})"
else
  log_warn "journalctl vacuum falló (no crítico)"
fi

# ── D) Archivos temporales /tmp y /var/tmp ────────────────────
log_head "D) Limpieza — archivos temporales (>7 días)"

TMP_BEFORE_KB=$(du -sk /tmp 2>/dev/null | cut -f1 || echo 0)
VARTMP_BEFORE_KB=$(du -sk /var/tmp 2>/dev/null | cut -f1 || echo 0)

# /tmp — archivos y directorios >7 días, excepto lock files activos
REMOVED_TMP=0
while IFS= read -r f; do
  # No eliminar lock files de SGI360 ni de procesos activos
  [ "${f}" = "/tmp/sgi360-housekeeping.lock" ] && continue
  [ "${f}" = "/tmp/sgi360-hetzner-snapshot.lock" ] && continue
  rm -rf "${f}" 2>/dev/null && REMOVED_TMP=$((REMOVED_TMP + 1)) || true
done < <(find /tmp -maxdepth 2 -mtime +7 -not -path "/tmp/sgi360*.lock" 2>/dev/null || true)

# /var/tmp — archivos >7 días
REMOVED_VARTMP=0
while IFS= read -r f; do
  rm -rf "${f}" 2>/dev/null && REMOVED_VARTMP=$((REMOVED_VARTMP + 1)) || true
done < <(find /var/tmp -maxdepth 2 -mtime +7 2>/dev/null || true)

TMP_AFTER_KB=$(du -sk /tmp 2>/dev/null | cut -f1 || echo 0)
VARTMP_AFTER_KB=$(du -sk /var/tmp 2>/dev/null | cut -f1 || echo 0)

log_ok "/tmp: ${REMOVED_TMP} elementos eliminados ($((TMP_BEFORE_KB/1024))MB → $((TMP_AFTER_KB/1024))MB)"
log_ok "/var/tmp: ${REMOVED_VARTMP} elementos eliminados ($((VARTMP_BEFORE_KB/1024))MB → $((VARTMP_AFTER_KB/1024))MB)"
add_action "Temporales: /tmp ${REMOVED_TMP} items, /var/tmp ${REMOVED_VARTMP} items eliminados"

# ── E) Next.js / build cache ──────────────────────────────────
log_head "E) Limpieza — Next.js y build cache"

NEXTJS_CLEANED=0
NEXTJS_PATHS=(
  "/root/friopro/apps/web/.next/cache"
  "/root/friopro/.turbo"
  "/root/friopro/node_modules/.cache"
)

for np in "${NEXTJS_PATHS[@]}"; do
  if [ -d "${np}" ]; then
    SIZE_KB=$(du -sk "${np}" 2>/dev/null | cut -f1 || echo 0)
    if [ "${SIZE_KB}" -gt 51200 ]; then  # Solo si >50MB
      rm -rf "${np}" 2>/dev/null && \
        log_ok "Cache eliminado: ${np} ($((SIZE_KB/1024))MB)" && \
        NEXTJS_CLEANED=$((NEXTJS_CLEANED + SIZE_KB)) || \
        log_warn "No se pudo limpiar: ${np}"
    else
      log_info "Cache pequeño, ignorado: ${np} ($((SIZE_KB/1024))MB)"
    fi
  fi
done

if [ "${NEXTJS_CLEANED}" -gt 0 ]; then
  add_action "Next.js cache: $((NEXTJS_CLEANED/1024))MB limpiados"
fi

# ── F) Logs rotados y comprimidos viejos ──────────────────────
log_head "F) Limpieza — logs rotados >30 días"

set +e  # Desactivar exit-on-error para secciones con find en /var/log

LOG_PATHS=(
  "/var/log"
  "/root/friopro/logs"
)

LOGS_REMOVED=0
LOGS_KB=0

for lp in "${LOG_PATHS[@]}"; do
  [ ! -d "${lp}" ] && continue
  # Usar mapfile para evitar problemas de exit code en la subshell
  mapfile -t OLD_LOG_FILES < <(find "${lp}" -maxdepth 3 \( -name "*.gz" -o -name "*.1" -o -name "*.2" -o -name "*.old" \) -mtime +30 2>/dev/null || true)
  for f in "${OLD_LOG_FILES[@]+"${OLD_LOG_FILES[@]}"}"; do
    [ -z "${f}" ] || [ ! -f "${f}" ] && continue
    SIZE_KB=$(du -sk "${f}" 2>/dev/null | cut -f1 || echo 0)
    if rm -f "${f}" 2>/dev/null; then
      LOGS_REMOVED=$((LOGS_REMOVED + 1))
      LOGS_KB=$((LOGS_KB + SIZE_KB))
    fi
  done
done

# Logs de Docker containers >100MB (truncar, no eliminar)
mapfile -t BIG_LOGS < <(find /var/lib/docker/containers -name "*-json.log" -size +100M 2>/dev/null || true)
for f in "${BIG_LOGS[@]+"${BIG_LOGS[@]}"}"; do
  [ -z "${f}" ] && continue
  log_warn "Log container grande (>100MB): ${f} — truncando"
  truncate -s 50M "${f}" 2>/dev/null || true
  add_action "Docker log truncado: $(basename "$(dirname "${f}")")"
done

set -e  # Reactivar exit-on-error

log_ok "Logs rotados: ${LOGS_REMOVED} archivos eliminados ($((LOGS_KB/1024))MB)"
[ "${LOGS_REMOVED}" -gt 0 ] && add_action "Logs: ${LOGS_REMOVED} archivos rotados eliminados ($((LOGS_KB/1024))MB)"

# ── G) Backups expirados (política de retención) ──────────────
log_head "G) Verificación política retención backups"

set +e  # Desactivar exit-on-error para loops de retención

BACKUP_ROOT="/backups"
RETENTION_DAILY=14
RETENTION_WEEKLY=8
RETENTION_MONTHLY=6

for subdir in postgres uploads docker configs system; do
  DIR="${BACKUP_ROOT}/${subdir}"
  [ ! -d "${DIR}" ] && continue
  COUNT=$(find "${DIR}" -maxdepth 1 -type f 2>/dev/null | wc -l || echo 0)
  log_info "Backups en ${subdir}/: ${COUNT} archivos"

  REMOVED_BACKUPS=0
  mapfile -t SORTED_FILES < <(ls -t "${DIR}/" 2>/dev/null || true)
  FILE_NUM=0
  for f in "${SORTED_FILES[@]+"${SORTED_FILES[@]}"}"; do
    fpath="${DIR}/${f}"
    [ ! -f "${fpath}" ] && continue
    FILE_NUM=$((FILE_NUM + 1))
    [ ${FILE_NUM} -le ${RETENTION_DAILY} ] && continue  # Siempre conservar los últimos N

    fdate=$(echo "${f}" | grep -oP '\d{8}' | head -1 || echo "")
    [ -z "${fdate}" ] && continue

    fday=$(date -d "${fdate}" +%u 2>/dev/null || echo "0")
    fdom=$(date -d "${fdate}" +%d 2>/dev/null || echo "0")
    weeks_ago=$(( ($(date +%s) - $(date -d "${fdate}" +%s 2>/dev/null || date +%s)) / (7*86400) ))
    months_ago=$(( ($(date -d "$(date +%Y-%m-01)" +%s) - $(date -d "${fdate:0:6}01" +%s 2>/dev/null || date +%s)) / (30*86400) ))

    KEEP=false
    [ "${fday}" = "1" ] && [ "${weeks_ago}" -le "${RETENTION_WEEKLY}" ] && KEEP=true
    [ "${fdom}" = "01" ] && [ "${months_ago}" -le "${RETENTION_MONTHLY}" ] && KEEP=true

    if [ "${KEEP}" = "false" ]; then
      rm -f "${fpath}" 2>/dev/null && REMOVED_BACKUPS=$((REMOVED_BACKUPS + 1)) || true
    fi
  done

  [ "${REMOVED_BACKUPS}" -gt 0 ] && \
    log_ok "${subdir}: ${REMOVED_BACKUPS} backups expirados eliminados" && \
    add_action "Retención ${subdir}: ${REMOVED_BACKUPS} archivos eliminados"
done

# Limpiar logs de backup >30 días
OLD_LOGS=$(find "${BACKUP_ROOT}/logs" -name "*.log" -mtime +30 2>/dev/null | wc -l || echo 0)
find "${BACKUP_ROOT}/logs" -name "*.log" -mtime +30 -delete 2>/dev/null || true
find "${BACKUP_ROOT}/manifests" -name "*.json" -mtime +90 -delete 2>/dev/null || true
[ "${OLD_LOGS}" -gt 0 ] && add_action "Logs backup: ${OLD_LOGS} archivos viejos eliminados"
log_info "Logs backup >30d: ${OLD_LOGS} eliminados"

set -e  # Reactivar exit-on-error

# ── POST-CHECKS ───────────────────────────────────────────────
log_head "POST-CHECKS DE VALIDACIÓN"

# Verificar PostgreSQL sigue corriendo
if docker exec "${PG_CONTAINER}" psql -U "${PG_USER}" -d "${PG_DB}" -c "SELECT 1;" > /dev/null 2>&1; then
  log_ok "PostgreSQL: sigue healthy post-housekeeping"
else
  add_error "PostgreSQL no responde POST-housekeeping — verificar urgente"
fi

# Verificar containers críticos
for ct in "${CRITICAL_CONTAINERS[@]}"; do
  STATUS=$(docker inspect --format='{{.State.Status}}' "${ct}" 2>/dev/null || echo "missing")
  [ "${STATUS}" = "running" ] && log_ok "${ct}: running" || log_warn "${ct}: ${STATUS}"
done

# Espacio final
DISK_AFTER_KB=$(disk_free_kb)
DISK_FREED_KB=$((DISK_AFTER_KB - DISK_BEFORE_KB))
DISK_FREED_MB=$((DISK_FREED_KB / 1024))
DISK_USE_AFTER=$(disk_used_pct)

log_info "Espacio antes: $((DISK_BEFORE_KB / 1024)) MB libres"
log_info "Espacio después: $((DISK_AFTER_KB / 1024)) MB libres"
log_ok "Espacio liberado: ${DISK_FREED_MB} MB"
log_info "Uso disco actual: ${DISK_USE_AFTER}%"

# ── Reporte final ─────────────────────────────────────────────
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log_head "REPORTE FINAL HOUSEKEEPING"
log_info "Duración: ${DURATION}s"
log_info "Espacio total liberado: ${DISK_FREED_MB} MB"
log_info "Uso disco post-limpieza: ${DISK_USE_AFTER}%"
log_info ""
log_info "Acciones ejecutadas (${#ACTIONS[@]}):"
for a in "${ACTIONS[@]+"${ACTIONS[@]}"}"; do
  log_info "  ✓ ${a}"
done

if [ "${#ERRORS[@]}" -gt 0 ]; then
  log_warn "Errores (${#ERRORS[@]}):"
  for e in "${ERRORS[@]}"; do
    log_warn "  ✗ ${e}"
  done
else
  log_ok "Sin errores"
fi

log_head "HOUSEKEEPING COMPLETADO — ${TIMESTAMP}"

# ── Items NUNCA tocados (constancia en log) ───────────────────
log_info "PROTEGIDO (nunca tocado):"
log_info "  - PostgreSQL volumes"
log_info "  - /backups/postgres/*.dump (activos)"
log_info "  - /data/sgi360/uploads"
log_info "  - /data/docker/volumes/friopro_api_uploads"
log_info "  - Redis datos productivos"
log_info "  - .env, nginx, prisma schema"
log_info "  - Docker volumes productivos nombrados"
