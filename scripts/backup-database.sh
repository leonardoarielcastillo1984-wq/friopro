#!/bin/bash

# ========================================
# Database Backup Script
# ========================================
# Creates PostgreSQL backups with compression and retention policy

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/sgi-360-backup-${TIMESTAMP}.sql.gz"

log "Starting database backup..."
log "Backup file: $BACKUP_FILE"

# Create backup
docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres \
    pg_dump -U sgi sgi_prod | gzip > "$BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
    local size=$(du -h "$BACKUP_FILE" | cut -f1)
    log "Backup completed successfully (Size: $size)"
else
    error "Backup failed"
fi

# List backups
log "Available backups:"
ls -lh "$BACKUP_DIR"/sgi-360-backup-*.sql.gz | tail -5

# Clean old backups
log "Cleaning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "sgi-360-backup-*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

# Final count
local backup_count=$(find "$BACKUP_DIR" -name "sgi-360-backup-*.sql.gz" | wc -l)
log "Total backups retained: $backup_count"
