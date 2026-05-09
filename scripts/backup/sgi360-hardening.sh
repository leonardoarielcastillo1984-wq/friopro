#!/bin/bash
# ============================================================
# SGI360 — HARDENING DE PRODUCCIÓN
# Bloquea comandos destructivos en entorno producción
# Ejecutar una vez para instalar las protecciones
# ============================================================

set -euo pipefail

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}✓${NC} $*"; }
log_warn() { echo -e "${YELLOW}⚠${NC}  $*"; }
log_err()  { echo -e "${RED}✗${NC} $*"; }
log_info() { echo -e "ℹ  $*"; }

echo ""
echo "═══════════════════════════════════════════════"
echo "   SGI360 HARDENING DE PRODUCCIÓN"
echo "═══════════════════════════════════════════════"
echo ""

FRIOPRO_PATH="/root/friopro"

# ── 1. Wrapper protegido para docker compose ─────────────────
log_info "Instalando wrapper de protección para docker compose..."

cat > /usr/local/bin/sgi360-safe-compose << 'WRAPPER'
#!/bin/bash
# Wrapper protegido para docker compose en SGI360 producción

DANGEROUS_CMDS=("db push --force-reset" "migrate reset" "migrate:reset" "db drop" "db push.*--force" "rm -f" "volume rm" "system prune")

FULL_CMD="$*"

for dangerous in "${DANGEROUS_CMDS[@]}"; do
  if echo "${FULL_CMD}" | grep -qiE "${dangerous}"; then
    echo ""
    echo "🚨 COMANDO BLOQUEADO POR POLÍTICA DE PRODUCCIÓN SGI360"
    echo "   Comando: ${FULL_CMD}"
    echo "   Razón: Operación potencialmente destructiva"
    echo ""
    echo "   Si REALMENTE necesitás ejecutarlo, usá:"
    echo "   FORCE_DESTRUCTIVE=yes docker compose $*"
    echo ""
    exit 1
  fi
done

exec docker compose "$@"
WRAPPER

chmod +x /usr/local/bin/sgi360-safe-compose
log_ok "Wrapper instalado en /usr/local/bin/sgi360-safe-compose"

# ── 2. Alias de protección en .bashrc ────────────────────────
log_info "Configurando aliases de protección..."

BASHRC_BLOCK='
# ══════════════════════════════════════════
# SGI360 HARDENING — No modificar
# ══════════════════════════════════════════
sgi360_guard() {
  local cmd="$*"
  local dangerous_patterns=(
    "prisma.*db.*push.*force-reset"
    "prisma.*migrate.*reset"
    "prisma.*migrate.*drop"
    "docker.*system.*prune.*-f"
    "docker.*volume.*rm.*friopro"
    "rm.*-rf.*/data"
    "rm.*-rf.*/root/friopro"
    "DROP.*DATABASE.*sgi"
    "DELETE.*FROM.*Tenant"
    "TRUNCATE.*Tenant"
  )
  for pattern in "${dangerous_patterns[@]}"; do
    if echo "${cmd}" | grep -qiE "${pattern}"; then
      echo ""
      echo "🚨 SGI360 GUARD: Comando bloqueado en producción"
      echo "   Patrón peligroso detectado: ${pattern}"
      echo "   Comando: ${cmd}"
      echo ""
      echo "   Para ejecutar comandos destructivos con intención:"
      echo "   export SGI360_BYPASS_GUARD=1 && ${cmd}"
      echo ""
      return 1
    fi
  done
}

# Interceptar npx prisma en producción
prisma() {
  if [ -z "${SGI360_BYPASS_GUARD:-}" ]; then
    sgi360_guard "prisma $*" || return 1
  fi
  npx prisma "$@"
}
export -f prisma 2>/dev/null || true
# ══════════════════════════════════════════
'

if ! grep -q "SGI360 HARDENING" /root/.bashrc 2>/dev/null; then
  echo "${BASHRC_BLOCK}" >> /root/.bashrc
  log_ok "Aliases de protección agregados a /root/.bashrc"
else
  log_warn "Aliases ya existentes en .bashrc — sin cambios"
fi

# ── 3. Script de verificación pre-deploy ─────────────────────
log_info "Instalando hook de verificación pre-deploy..."

cat > /usr/local/bin/sgi360-predeploy-check << 'PREDEPLOY'
#!/bin/bash
# SGI360 Pre-deploy safety check
echo "═══ SGI360 Pre-Deploy Check ═══"

ERRORS=0

# Verificar que hay backup reciente (< 25 horas)
LATEST_BACKUP=$(find /backups/postgres -name "*.dump" -mmin -1500 2>/dev/null | head -1)
if [ -z "${LATEST_BACKUP}" ]; then
  echo "⚠  ADVERTENCIA: No hay backup de las últimas 25 horas"
  echo "   Ejecutá: /root/sgi360-backup.sh antes de deployar"
  ERRORS=$((ERRORS + 1))
else
  echo "✓ Backup reciente encontrado: $(basename "${LATEST_BACKUP}")"
fi

# Verificar que la API de prod responde
if curl -sf http://localhost:3002/health > /dev/null 2>&1; then
  echo "✓ API producción online"
else
  echo "⚠  API producción no responde"
fi

# Verificar PostgreSQL
if docker exec sgi-postgres psql -U sgi -d sgi -c "SELECT 1;" > /dev/null 2>&1; then
  echo "✓ PostgreSQL producción OK"
else
  echo "✗ PostgreSQL producción — ERROR"
  ERRORS=$((ERRORS + 1))
fi

# Verificar espacio en disco
DISK_FREE=$(df -h / | awk 'NR==2 {print $4}')
DISK_USE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
echo "ℹ  Disco: ${DISK_FREE} libre (${DISK_USE}% usado)"
if [ "${DISK_USE}" -gt 85 ]; then
  echo "⚠  ADVERTENCIA: Disco al ${DISK_USE}% — riesgo de espacio"
  ERRORS=$((ERRORS + 1))
fi

echo ""
if [ "${ERRORS}" -gt 0 ]; then
  echo "⚠  Pre-deploy check: ${ERRORS} advertencia(s). Revisar antes de continuar."
  exit 0  # Warning, no bloquea el deploy
else
  echo "✓ Pre-deploy check: Todo OK"
fi
PREDEPLOY

chmod +x /usr/local/bin/sgi360-predeploy-check
log_ok "Pre-deploy check instalado"

# ── 4. Permisos de archivos críticos ─────────────────────────
log_info "Asegurando permisos de archivos críticos..."

chmod 600 /root/friopro/.env 2>/dev/null && log_ok ".env — permisos 600" || log_warn ".env no encontrado"
chmod 600 /root/friopro/.env.testing 2>/dev/null && log_ok ".env.testing — permisos 600" || true
chmod 700 /backups 2>/dev/null && log_ok "/backups — permisos 700" || true
chmod -R 600 /backups/configs/ 2>/dev/null || true

# ── 5. Logrotate para backups logs ───────────────────────────
log_info "Configurando logrotate..."

cat > /etc/logrotate.d/sgi360-backups << 'LOGROTATE'
/backups/logs/*.log {
  weekly
  rotate 8
  compress
  missingok
  notifempty
  create 640 root root
}
LOGROTATE

log_ok "Logrotate configurado"

# ── Resumen ───────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "   HARDENING COMPLETADO"
echo "═══════════════════════════════════════════════"
echo ""
echo "Protecciones instaladas:"
echo "  ✓ Wrapper sgi360-safe-compose"
echo "  ✓ Guards en .bashrc (prisma destructivo bloqueado)"
echo "  ✓ Pre-deploy check: /usr/local/bin/sgi360-predeploy-check"
echo "  ✓ Permisos 600 en .env"
echo "  ✓ Logrotate para /backups/logs"
echo ""
echo "Para bypass de emergencia: export SGI360_BYPASS_GUARD=1"
echo ""
