#!/bin/bash

# Backup Verification and Disaster Recovery Script for SGI 360
# Automated testing, restore verification, RTO/RPO monitoring

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/sgi360}"
RESTORE_TEST_DIR="${RESTORE_TEST_DIR:-/tmp/sgi360-restore-test}"
DB_NAME="${DB_NAME:-sgi}"
DB_USER="${DB_USER:-sgi}"
LOG_FILE="${LOG_FILE:-/var/log/sgi360-backup-verification.log}"
RTO_THRESHOLD="${RTO_THRESHOLD:-3600}"  # 1 hour
RPO_THRESHOLD="${RPO_THRESHOLD:-3600}"  # 1 hour

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log_info() {
  local msg="$1"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $msg" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [SUCCESS] $1${NC}" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] $1${NC}" | tee -a "$LOG_FILE"
}

# ============================================
# Database Backup Verification
# ============================================

verify_database_backup() {
  log_info "Verifying database backup..."

  local backup_file="${BACKUP_DIR}/database/latest.sql.gz"

  if [[ ! -f "$backup_file" ]]; then
    log_error "Database backup file not found: $backup_file"
    return 1
  fi

  # Check file size
  local file_size=$(du -h "$backup_file" | cut -f1)
  log_info "Backup file size: $file_size"

  # Check file integrity
  if gunzip -t "$backup_file" 2>/dev/null; then
    log_success "Database backup integrity verified"
    return 0
  else
    log_error "Database backup is corrupted"
    return 1
  fi
}

# ============================================
# File System Backup Verification
# ============================================

verify_filesystem_backup() {
  log_info "Verifying filesystem backup..."

  local backup_file="${BACKUP_DIR}/filesystem/latest.tar.gz"

  if [[ ! -f "$backup_file" ]]; then
    log_error "Filesystem backup file not found: $backup_file"
    return 1
  fi

  # Check file integrity
  if tar -tzf "$backup_file" > /dev/null 2>&1; then
    log_success "Filesystem backup integrity verified"
    return 0
  else
    log_error "Filesystem backup is corrupted"
    return 1
  fi
}

# ============================================
# Restore Test - Database
# ============================================

test_database_restore() {
  log_info "Testing database restore..."

  local backup_file="${BACKUP_DIR}/database/latest.sql.gz"
  local test_db="${DB_NAME}_restore_test"

  # Drop test database if exists
  PGPASSWORD="${DB_PASSWORD:-sgi}" psql -U "$DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS $test_db;" 2>/dev/null || true

  # Create test database
  if ! PGPASSWORD="${DB_PASSWORD:-sgi}" psql -U "$DB_USER" -d postgres \
    -c "CREATE DATABASE $test_db;"; then
    log_error "Failed to create test database"
    return 1
  fi

  # Restore backup
  if gunzip -c "$backup_file" | \
    PGPASSWORD="${DB_PASSWORD:-sgi}" psql -U "$DB_USER" \
    -d "$test_db" > /dev/null 2>&1; then
    log_success "Database restore successful"

    # Run integrity checks
    verify_restored_database "$test_db"
    local integrity=$?

    # Clean up
    PGPASSWORD="${DB_PASSWORD:-sgi}" psql -U "$DB_USER" -d postgres \
      -c "DROP DATABASE $test_db;" 2>/dev/null || true

    return $integrity
  else
    log_error "Database restore failed"
    PGPASSWORD="${DB_PASSWORD:-sgi}" psql -U "$DB_USER" -d postgres \
      -c "DROP DATABASE $test_db;" 2>/dev/null || true
    return 1
  fi
}

# ============================================
# Verify Restored Database
# ============================================

verify_restored_database() {
  local db_name="$1"

  log_info "Verifying restored database schema..."

  # Check table count
  local table_count=$(PGPASSWORD="${DB_PASSWORD:-sgi}" psql -U "$DB_USER" \
    -d "$db_name" -c "SELECT COUNT(*) FROM information_schema.tables \
    WHERE table_schema = 'public';" 2>/dev/null | tail -1)

  if [[ $table_count -gt 0 ]]; then
    log_success "Database schema verified ($table_count tables)"

    # Verify key tables
    local required_tables=(
      "users"
      "departments"
      "documents"
      "audit_logs"
      "two_factor_auth"
    )

    for table in "${required_tables[@]}"; do
      if PGPASSWORD="${DB_PASSWORD:-sgi}" psql -U "$DB_USER" \
        -d "$db_name" -c "\dt $table" 2>/dev/null | grep -q "$table"; then
        log_success "Table found: $table"
      else
        log_warning "Table not found: $table"
      fi
    done

    return 0
  else
    log_error "No tables found in restored database"
    return 1
  fi
}

# ============================================
# Restore Test - File System
# ============================================

test_filesystem_restore() {
  log_info "Testing filesystem restore..."

  local backup_file="${BACKUP_DIR}/filesystem/latest.tar.gz"

  # Create test directory
  mkdir -p "$RESTORE_TEST_DIR"

  # Extract backup
  if tar -xzf "$backup_file" -C "$RESTORE_TEST_DIR" 2>/dev/null; then
    log_success "Filesystem restore successful"

    # Verify key files/directories exist
    local key_paths=(
      "apps"
      "infra"
      "package.json"
    )

    for path in "${key_paths[@]}"; do
      if [[ -e "$RESTORE_TEST_DIR/$path" ]]; then
        log_success "Found: $path"
      else
        log_warning "Missing: $path"
      fi
    done

    # Clean up
    rm -rf "$RESTORE_TEST_DIR"
    return 0
  else
    log_error "Filesystem restore failed"
    rm -rf "$RESTORE_TEST_DIR"
    return 1
  fi
}

# ============================================
# RTO/RPO Monitoring
# ============================================

monitor_rto_rpo() {
  log_info "Monitoring RTO/RPO metrics..."

  # Get latest backup timestamp
  local latest_backup=$(stat -c %Y "${BACKUP_DIR}/database/latest.sql.gz" 2>/dev/null || echo 0)
  local current_time=$(date +%s)
  local time_since_backup=$((current_time - latest_backup))

  log_info "Time since last backup: $time_since_backup seconds"

  # Check RPO (Recovery Point Objective)
  if [[ $time_since_backup -le $RPO_THRESHOLD ]]; then
    log_success "RPO acceptable (${time_since_backup}s <= ${RPO_THRESHOLD}s)"
  else
    log_warning "RPO threshold exceeded (${time_since_backup}s > ${RPO_THRESHOLD}s)"
  fi

  # Estimate RTO (Recovery Time Objective)
  local db_size=$(du -sh "${BACKUP_DIR}/database/latest.sql.gz" 2>/dev/null | cut -f1)
  log_info "Estimated database restore time based on size: $db_size"

  # Simulated RTO estimation
  local estimated_rto=$(
    stat -c %s "${BACKUP_DIR}/database/latest.sql.gz" 2>/dev/null | \
    awk '{print int($1 / 10485760)}'  # Assume 10MB/sec restore rate
  )

  if [[ $estimated_rto -le $RTO_THRESHOLD ]]; then
    log_success "RTO acceptable (estimated: ${estimated_rto}s <= ${RTO_THRESHOLD}s)"
  else
    log_warning "RTO may exceed threshold (estimated: ${estimated_rto}s > ${RTO_THRESHOLD}s)"
  fi
}

# ============================================
# Backup Retention Policy
# ============================================

enforce_retention_policy() {
  log_info "Enforcing backup retention policy..."

  # Keep last 7 daily backups
  local retention_days=7
  local retention_seconds=$((retention_days * 86400))

  find "${BACKUP_DIR}" -type f -name "*.gz" -o -name "*.sql" | while read -r backup_file; do
    local file_age=$(
      stat -c %Y "$backup_file" 2>/dev/null | \
      awk -v now="$(date +%s)" '{print now - $1}'
    )

    if [[ $file_age -gt $retention_seconds ]]; then
      log_warning "Deleting old backup: $(basename "$backup_file") (${file_age}s old)"
      rm -f "$backup_file"
    fi
  done

  log_success "Retention policy enforced"
}

# ============================================
# Generate Report
# ============================================

generate_report() {
  log_info "Generating backup verification report..."

  local report_file="${BACKUP_DIR}/verification-report-$(date +%Y%m%d_%H%M%S).txt"

  cat > "$report_file" <<EOF
=====================================
SGI 360 Backup Verification Report
Generated: $(date)
=====================================

BACKUP INVENTORY:
-----------------
EOF

  # List backups
  find "${BACKUP_DIR}" -type f -mtime -7 | while read -r file; do
    local size=$(du -h "$file" | cut -f1)
    local mtime=$(date -r "$file" "+%Y-%m-%d %H:%M:%S")
    echo "$mtime - $size - $file" >> "$report_file"
  done

  cat >> "$report_file" <<EOF

VERIFICATION RESULTS:
---------------------
Database Backup: $(verify_database_backup && echo "OK" || echo "FAILED")
Filesystem Backup: $(verify_filesystem_backup && echo "OK" || echo "FAILED")
Database Restore Test: $(test_database_restore && echo "OK" || echo "FAILED")
Filesystem Restore Test: $(test_filesystem_restore && echo "OK" || echo "FAILED")

RTO/RPO STATUS:
---------------
EOF

  monitor_rto_rpo >> "$report_file"

  log_success "Report generated: $report_file"
  cat "$report_file"
}

# ============================================
# Disaster Recovery Runbook
# ============================================

generate_runbook() {
  log_info "Generating disaster recovery runbook..."

  local runbook_file="${BACKUP_DIR}/DISASTER_RECOVERY_RUNBOOK.md"

  cat > "$runbook_file" <<'EOF'
# SGI 360 Disaster Recovery Runbook

## Step 1: Assess Damage
- Identify what data/systems are affected
- Determine if partial or full recovery is needed
- Estimate RTO (target recovery time)

## Step 2: Prepare Environment
- Provision new servers if current infrastructure is damaged
- Ensure database server is running
- Verify network connectivity

## Step 3: Restore Database
```bash
# Download latest backup
aws s3 cp s3://sgi360-backups/database/latest.sql.gz /tmp/

# Decompress and restore
gunzip -c /tmp/latest.sql.gz | psql -U sgi -d sgi

# Verify restoration
psql -U sgi -d sgi -c "SELECT COUNT(*) FROM users;"
```

## Step 4: Restore File System
```bash
# Download filesystem backup
aws s3 cp s3://sgi360-backups/filesystem/latest.tar.gz /tmp/

# Extract to application directory
tar -xzf /tmp/latest.tar.gz -C /opt/sgi360/

# Restore permissions
chown -R sgi360:sgi360 /opt/sgi360/
```

## Step 5: Verify Integrity
```bash
# Run backup verification
./infra/functionality/backup-verification.sh verify

# Check application logs
tail -f /var/log/sgi360/*.log

# Run health checks
curl http://localhost:3001/api/health
```

## Step 6: Notify Stakeholders
- Send status update to management
- Inform affected users
- Provide ETA for full recovery

## Rollback Plan
If recovery fails:
1. Stop current recovery process
2. Notify incident commander
3. Attempt restore from previous backup
4. Consider failover to backup site

## Post-Recovery
- Run comprehensive system tests
- Verify all critical functions
- Check data integrity
- Update incident report
EOF

  log_success "Runbook generated: $runbook_file"
}

# ============================================
# Main Execution
# ============================================

main() {
  log_info "Starting backup verification process..."

  # Create log directory
  mkdir -p "$(dirname "$LOG_FILE")"

  case "${1:-full}" in
    verify)
      verify_database_backup
      verify_filesystem_backup
      ;;

    test)
      test_database_restore
      test_filesystem_restore
      ;;

    monitor)
      monitor_rto_rpo
      ;;

    report)
      generate_report
      ;;

    runbook)
      generate_runbook
      ;;

    full)
      verify_database_backup
      verify_filesystem_backup
      test_database_restore
      test_filesystem_restore
      monitor_rto_rpo
      enforce_retention_policy
      generate_report
      generate_runbook
      log_success "Full backup verification completed"
      ;;

    *)
      echo "Usage: $0 {verify|test|monitor|report|runbook|full}"
      exit 1
      ;;
  esac
}

main "$@"
