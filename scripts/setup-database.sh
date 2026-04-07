#!/bin/bash

# ========================================
# Database Setup Script
# ========================================
# Initializes database, runs migrations, and optionally seeds data

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if services are running
check_services() {
    log "Checking if services are running..."

    if ! docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" ps postgres | grep -q "Up"; then
        log "Starting PostgreSQL..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" up -d postgres
    fi

    # Wait for database
    log "Waiting for database to be ready..."
    for i in {1..30}; do
        if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres \
            pg_isready -U sgi > /dev/null 2>&1; then
            log "Database is ready"
            return
        fi
        echo -n "."
        sleep 2
    done

    error "Database failed to start"
}

# Run Prisma migrations
run_migrations() {
    log "Running database migrations..."

    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" run --rm api \
        npm run prisma:migrate

    log "Migrations completed successfully"
}

# Generate Prisma client
generate_prisma() {
    log "Generating Prisma client..."

    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" run --rm api \
        npm run prisma:generate

    log "Prisma client generated"
}

# Seed database with initial data
seed_database() {
    log "Seeding database with initial data..."

    # Seed plans
    log "Seeding plans..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" run --rm api \
        npm run seed:plans

    # Seed users
    log "Seeding users..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" run --rm api \
        npm run seed:users

    # Seed demo data
    read -p "Seed with demo data? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Seeding demo data..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" run --rm api \
            npm run seed:demo
    fi

    log "Database seeding completed"
}

# Verify database setup
verify_setup() {
    log "Verifying database setup..."

    # Check if tables exist
    local table_count=$(docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres \
        psql -U sgi -d sgi_prod -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")

    if [ "$table_count" -gt 0 ]; then
        log "Found $table_count tables ✓"
    else
        warn "No tables found in database"
    fi

    # Check if migrations were applied
    local migration_count=$(docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres \
        psql -U sgi -d sgi_prod -t -c \
        "SELECT COUNT(*) FROM \"_prisma_migrations\";")

    log "Applied migrations: $migration_count"
}

# Main execution
main() {
    log "=========================================="
    log "Database Setup"
    log "=========================================="

    check_services
    generate_prisma
    run_migrations
    seed_database
    verify_setup

    log "=========================================="
    log "Database setup completed successfully!"
    log "=========================================="
}

main "$@"
