#!/bin/bash
# ============================================================
# SGI360 — HETZNER CLOUD SNAPSHOT ENTERPRISE
# Versión: 1.0
# Frecuencia: Domingos 03:00 AM (vía cron)
# Cron:  0 3 * * 0 /root/sgi360-hetzner-snapshot.sh
#
# SEGURIDAD: El API token se lee desde /root/.hetzner_api_token
# NUNCA hardcodear el token en este script.
# ============================================================

set -euo pipefail

# ── Configuración ─────────────────────────────────────────────
TOKEN_FILE="/root/.hetzner_api_token"
LOG_FILE="/backups/logs/hetzner-snapshots.log"
LOCK_FILE="/tmp/sgi360-hetzner-snapshot.lock"
MANIFEST_DIR="/backups/manifests"
API_BASE="https://api.hetzner.cloud/v1"

SERVER_NAME="ubuntu-8gb-hel1-1"
SNAPSHOT_RETAIN=4         # Últimos N snapshots a conservar
API_RETRY=3               # Reintentos ante fallo de API
API_RETRY_DELAY=30        # Segundos entre reintentos
SNAPSHOT_TIMEOUT=3600     # 1 hora máximo esperando que el snapshot termine

TIMESTAMP=$(date +"%Y%m%d_%H%M")
SNAPSHOT_NAME="sgi360_snapshot_${TIMESTAMP}"

# ── Colores ───────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── Funciones de log ──────────────────────────────────────────
mkdir -p "$(dirname "${LOG_FILE}")" "${MANIFEST_DIR}"

log() {
  local level="$1"; shift
  local msg="$(date +"%Y-%m-%d %H:%M:%S") [${level}] $*"
  echo -e "${msg}" | tee -a "${LOG_FILE}"
}
log_ok()   { log "${GREEN}OK${NC}"    "$@"; }
log_err()  { log "${RED}ERROR${NC}"  "$@"; }
log_warn() { log "${YELLOW}WARN${NC}" "$@"; }
log_info() { log "${BLUE}INFO${NC}"  "$@"; }

# ── Control de ejecución simultánea ──────────────────────────
if [ -f "${LOCK_FILE}" ]; then
  LOCK_PID=$(cat "${LOCK_FILE}" 2>/dev/null || echo "")
  if [ -n "${LOCK_PID}" ] && kill -0 "${LOCK_PID}" 2>/dev/null; then
    log_warn "Ya hay un snapshot en ejecución (PID ${LOCK_PID}). Abortando."
    exit 0
  else
    log_warn "Lock file obsoleto encontrado — limpiando"
    rm -f "${LOCK_FILE}"
  fi
fi
echo $$ > "${LOCK_FILE}"
trap 'rm -f "${LOCK_FILE}"; log_info "Lock liberado."' EXIT

# ── Cargar API token de forma segura ─────────────────────────
if [ ! -f "${TOKEN_FILE}" ]; then
  log_err "Token file no encontrado: ${TOKEN_FILE}"
  log_err "Ejecutar: echo 'TOKEN' > ${TOKEN_FILE} && chmod 600 ${TOKEN_FILE}"
  exit 1
fi

if [ "$(stat -c %a "${TOKEN_FILE}")" != "600" ]; then
  log_warn "Permisos inseguros en token file — corrigiendo a 600"
  chmod 600 "${TOKEN_FILE}"
fi

HETZNER_TOKEN=$(cat "${TOKEN_FILE}" | tr -d '[:space:]')

if [ -z "${HETZNER_TOKEN}" ]; then
  log_err "Token vacío en ${TOKEN_FILE}"
  exit 1
fi

# ── Función: llamada a API con retry ─────────────────────────
api_call() {
  local method="$1"
  local endpoint="$2"
  local data="${3:-}"
  local attempt=1

  while [ ${attempt} -le ${API_RETRY} ]; do
    if [ -n "${data}" ]; then
      RESPONSE=$(curl -sf \
        -X "${method}" \
        -H "Authorization: Bearer ${HETZNER_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "${data}" \
        "${API_BASE}${endpoint}" 2>/dev/null)
    else
      RESPONSE=$(curl -sf \
        -X "${method}" \
        -H "Authorization: Bearer ${HETZNER_TOKEN}" \
        "${API_BASE}${endpoint}" 2>/dev/null)
    fi

    local exit_code=$?
    if [ ${exit_code} -eq 0 ] && [ -n "${RESPONSE}" ]; then
      echo "${RESPONSE}"
      return 0
    fi

    log_warn "API call falló (intento ${attempt}/${API_RETRY}) — ${method} ${endpoint}"
    attempt=$((attempt + 1))
    [ ${attempt} -le ${API_RETRY} ] && sleep ${API_RETRY_DELAY}
  done

  log_err "API call falló después de ${API_RETRY} intentos — ${method} ${endpoint}"
  return 1
}

# ── Inicio ────────────────────────────────────────────────────
START_TIME=$(date +%s)
log_info "========================================================"
log_info "SGI360 HETZNER SNAPSHOT ENTERPRISE — Inicio: ${TIMESTAMP}"
log_info "========================================================"

# ── Step 1: Obtener ID del servidor ──────────────────────────
log_info "Buscando servidor: ${SERVER_NAME}"

SERVER_RESPONSE=$(api_call GET "/servers?name=${SERVER_NAME}")
SERVER_ID=$(echo "${SERVER_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['servers'][0]['id'])" 2>/dev/null || echo "")
SERVER_STATUS=$(echo "${SERVER_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['servers'][0]['status'])" 2>/dev/null || echo "")

if [ -z "${SERVER_ID}" ]; then
  log_err "No se encontró el servidor: ${SERVER_NAME}"
  exit 1
fi

log_ok "Servidor encontrado — ID: ${SERVER_ID} | Status: ${SERVER_STATUS}"

# ── Step 2: Verificar que no haya snapshot en progreso ───────
log_info "Verificando snapshots existentes..."

SNAPSHOTS_RESPONSE=$(api_call GET "/images?type=snapshot&sort=created:desc")
EXISTING_COUNT=$(echo "${SNAPSHOTS_RESPONSE}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
imgs = [i for i in d.get('images', []) if i.get('name','').startswith('sgi360_snapshot_')]
print(len(imgs))
" 2>/dev/null || echo "0")

log_info "Snapshots SGI360 existentes: ${EXISTING_COUNT}"

# Verificar si hay snapshot en estado "creating" para este server
CREATING=$(echo "${SNAPSHOTS_RESPONSE}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
creating = [i for i in d.get('images', []) if i.get('status') == 'creating' and i.get('name','').startswith('sgi360_')]
print(len(creating))
" 2>/dev/null || echo "0")

if [ "${CREATING}" != "0" ]; then
  log_warn "Hay un snapshot SGI360 en proceso de creación. Abortando para evitar duplicados."
  exit 0
fi

# ── Step 3: Ejecutar backup PostgreSQL previo (sincronizar) ──
log_info "Ejecutando backup PostgreSQL previo al snapshot..."
if [ -x "/root/sgi360-backup.sh" ]; then
  if bash /root/sgi360-backup.sh >> "${LOG_FILE}" 2>&1; then
    log_ok "Backup PostgreSQL/configs completado antes del snapshot"
  else
    log_warn "Backup SGI360 completó con advertencias — continuando con snapshot"
  fi
else
  log_warn "sgi360-backup.sh no encontrado — snapshot sin backup previo"
fi

# ── Step 4: Crear snapshot ────────────────────────────────────
log_info "Creando snapshot: ${SNAPSHOT_NAME}"
log_info "Esto puede tardar varios minutos..."

SNAPSHOT_DATA="{\"description\": \"${SNAPSHOT_NAME}\", \"labels\": {\"project\": \"sgi360\", \"env\": \"production\", \"timestamp\": \"${TIMESTAMP}\"}}"

CREATE_RESPONSE=$(api_call POST "/servers/${SERVER_ID}/actions/create_image" "${SNAPSHOT_DATA}")

ACTION_ID=$(echo "${CREATE_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['action']['id'])" 2>/dev/null || echo "")
IMAGE_ID=$(echo "${CREATE_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['image']['id'])" 2>/dev/null || echo "")

if [ -z "${ACTION_ID}" ]; then
  log_err "No se obtuvo action ID de la API. Respuesta: ${CREATE_RESPONSE}"
  exit 1
fi

log_info "Action ID: ${ACTION_ID} | Image ID: ${IMAGE_ID}"

# ── Step 5: Esperar a que el snapshot termine ─────────────────
log_info "Esperando que el snapshot complete (timeout: ${SNAPSHOT_TIMEOUT}s)..."

ELAPSED=0
POLL_INTERVAL=30
SNAPSHOT_STATUS="running"

while [ "${SNAPSHOT_STATUS}" = "running" ] && [ ${ELAPSED} -lt ${SNAPSHOT_TIMEOUT} ]; do
  sleep ${POLL_INTERVAL}
  ELAPSED=$((ELAPSED + POLL_INTERVAL))

  ACTION_RESPONSE=$(api_call GET "/actions/${ACTION_ID}" || echo '{"action":{"status":"error"}}')
  SNAPSHOT_STATUS=$(echo "${ACTION_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['action']['status'])" 2>/dev/null || echo "error")
  SNAPSHOT_PROGRESS=$(echo "${ACTION_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['action'].get('progress', 0))" 2>/dev/null || echo "0")

  log_info "Estado: ${SNAPSHOT_STATUS} | Progreso: ${SNAPSHOT_PROGRESS}% | Tiempo: ${ELAPSED}s"
done

if [ "${SNAPSHOT_STATUS}" != "success" ]; then
  log_err "Snapshot falló o timeout — estado final: ${SNAPSHOT_STATUS}"
  exit 1
fi

log_ok "Snapshot completado exitosamente"

# ── Step 6: Obtener info del snapshot creado ─────────────────
log_info "Obteniendo información del snapshot creado..."

IMAGE_RESPONSE=$(api_call GET "/images/${IMAGE_ID}")
SNAPSHOT_DESCRIPTION=$(echo "${IMAGE_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['image']['description'])" 2>/dev/null || echo "${SNAPSHOT_NAME}")
SNAPSHOT_SIZE=$(echo "${IMAGE_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['image'].get('image_size', 'N/A'))" 2>/dev/null || echo "N/A")
SNAPSHOT_DISK=$(echo "${IMAGE_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['image'].get('disk_size', 'N/A'))" 2>/dev/null || echo "N/A")
SNAPSHOT_CREATED=$(echo "${IMAGE_RESPONSE}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['image']['created'])" 2>/dev/null || echo "")

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log_ok "Snapshot ID: ${IMAGE_ID}"
log_ok "Nombre: ${SNAPSHOT_DESCRIPTION}"
log_ok "Tamaño: ${SNAPSHOT_SIZE} GB"
log_ok "Disco base: ${SNAPSHOT_DISK} GB"
log_ok "Duración total: ${DURATION}s"

# ── Step 7: Retención — eliminar snapshots viejos ─────────────
log_info "========================================================"
log_info "Aplicando política de retención (conservar últimos ${SNAPSHOT_RETAIN})..."

ALL_SNAPSHOTS=$(api_call GET "/images?type=snapshot&sort=created:desc")

SNAPSHOT_IDS=$(echo "${ALL_SNAPSHOTS}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
imgs = [i for i in d.get('images', []) if i.get('description','').startswith('sgi360_snapshot_')]
imgs.sort(key=lambda x: x['created'], reverse=True)
for img in imgs:
    print(f\"{img['id']}|{img['description']}|{img['created']}\")
" 2>/dev/null || echo "")

COUNT=0
while IFS='|' read -r snap_id snap_name snap_created; do
  [ -z "${snap_id}" ] && continue
  COUNT=$((COUNT + 1))
  if [ ${COUNT} -gt ${SNAPSHOT_RETAIN} ]; then
    log_info "Eliminando snapshot antiguo: ${snap_name} (ID: ${snap_id}, creado: ${snap_created})"
    DELETE_RESPONSE=$(api_call DELETE "/images/${snap_id}" || echo "error")
    if echo "${DELETE_RESPONSE}" | python3 -c "import sys; d=sys.stdin.read(); exit(0 if d == '' or 'error' not in d.lower() else 1)" 2>/dev/null; then
      log_ok "Eliminado: ${snap_name}"
    else
      log_warn "No se pudo eliminar: ${snap_name} (puede requerir permisos adicionales)"
    fi
  else
    log_info "Conservando [${COUNT}/${SNAPSHOT_RETAIN}]: ${snap_name}"
  fi
done <<< "${SNAPSHOT_IDS}"

# ── Step 8: Manifest JSON del snapshot ────────────────────────
SNAPSHOT_MANIFEST="${MANIFEST_DIR}/hetzner_snapshot_${TIMESTAMP}.json"

# Obtener lista final de snapshots
FINAL_SNAPSHOTS=$(api_call GET "/images?type=snapshot&sort=created:desc")
FINAL_LIST=$(echo "${FINAL_SNAPSHOTS}" | python3 -c "
import sys, json
d = json.load(sys.stdin)
imgs = [i for i in d.get('images', []) if i.get('description','').startswith('sgi360_snapshot_')]
imgs.sort(key=lambda x: x['created'], reverse=True)
result = []
for img in imgs:
    result.append({'id': img['id'], 'name': img['description'], 'created': img['created'], 'size_gb': img.get('image_size', 0)})
print(json.dumps(result, indent=2))
" 2>/dev/null || echo "[]")

cat > "${SNAPSHOT_MANIFEST}" << EOF
{
  "timestamp": "${TIMESTAMP}",
  "date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "server_name": "${SERVER_NAME}",
  "server_id": ${SERVER_ID},
  "snapshot": {
    "id": ${IMAGE_ID},
    "name": "${SNAPSHOT_DESCRIPTION}",
    "size_gb": ${SNAPSHOT_SIZE},
    "disk_gb": ${SNAPSHOT_DISK},
    "created": "${SNAPSHOT_CREATED}",
    "status": "success",
    "duration_seconds": ${DURATION},
    "action_id": ${ACTION_ID}
  },
  "retention_policy": {
    "keep_last": ${SNAPSHOT_RETAIN}
  },
  "active_snapshots": ${FINAL_LIST}
}
EOF

log_ok "Manifest snapshot: ${SNAPSHOT_MANIFEST}"

# ── Resumen final ─────────────────────────────────────────────
log_info "========================================================"
log_ok "HETZNER SNAPSHOT ENTERPRISE COMPLETADO"
log_info "  Snapshot: ${SNAPSHOT_DESCRIPTION}"
log_info "  ID: ${IMAGE_ID}"
log_info "  Tamaño: ${SNAPSHOT_SIZE} GB"
log_info "  Duración: ${DURATION}s"
log_info "  Log: ${LOG_FILE}"
log_info "  Manifest: ${SNAPSHOT_MANIFEST}"
log_info "========================================================"
log_info ""
log_info "RECUPERACIÓN DISASTER RECOVERY:"
log_info "  1. Panel Hetzner: https://console.hetzner.cloud"
log_info "  2. Servers → ubuntu-8gb-hel1-1 → Images → Rebuild"
log_info "  3. Seleccionar snapshot: ${SNAPSHOT_DESCRIPTION}"
log_info "  4. Post-restore: verificar Docker, Nginx, PostgreSQL"
log_info "========================================================"
