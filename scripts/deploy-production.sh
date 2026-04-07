#!/bin/bash

# ========================================
# Production Deployment Script
# ========================================
# This script handles pre-deployment checks, image pulls, database migrations,
# and deployment verification for the SGI 360 production environment.

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/deploy-$(date +%Y%m%d-%H%M%S).log"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ========================================
# Logging Functions
# ========================================
log() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

# ========================================
# Pre-Deployment Checks
# ========================================
pre_deployment_checks() {
    log "Starting pre-deployment checks..."

    # Check environment file
    if [ ! -f "$PROJECT_ROOT/.env.production" ]; then
        error "Missing .env.production file. Please create it from .env.example"
    fi

    # Check Docker installation
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    log "Docker found: $(docker --version)"

    # Check Docker Compose installation
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    log "Docker Compose found: $(docker-compose --version)"

    # Check required environment variables
    source "$PROJECT_ROOT/.env.production"

    local required_vars=("JWT_SECRET" "DATABASE_URL" "REDIS_URL")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            error "Missing required environment variable: $var"
        fi
    done

    log "Pre-deployment checks passed ✓"
}

# ========================================
# Docker Login
# ========================================
docker_login() {
    log "Logging into Docker registry..."

    source "$PROJECT_ROOT/.env.production"

    if [ -n "$DOCKER_REGISTRY" ] && [ -n "$DOCKER_USERNAME" ] && [ -n "$DOCKER_PASSWORD" ]; then
        echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin "$DOCKER_REGISTRY"
        log "Docker login successful"
    else
        warn "Docker registry credentials not fully configured, skipping login"
    fi
}

# ========================================
# Pull Docker Images
# ========================================
pull_images() {
    log "Pulling Docker images..."

    source "$PROJECT_ROOT/.env.production"

    if [ -z "$DOCKER_REGISTRY" ]; then
        warn "DOCKER_REGISTRY not set, building images locally"
        return
    fi

    docker pull "${DOCKER_REGISTRY}/sgi-api:${API_TAG:-latest}" || warn "Failed to pull API image"
    docker pull "${DOCKER_REGISTRY}/sgi-frontend:${WEB_TAG:-latest}" || warn "Failed to pull Frontend image"

    log "Docker images pulled successfully"
}

# ========================================
# Pre-Deployment Database Checks
# ========================================
pre_db_checks() {
    log "Running pre-deployment database checks..."

    # Start services
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" up -d postgres redis

    # Wait for database to be ready
    log "Waiting for database to be ready..."
    for i in {1..30}; do
        if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres pg_isready -U sgi > /dev/null 2>&1; then
            log "Database is ready"
            return
        fi
        echo -n "."
        sleep 2
    done

    error "Database failed to start"
}

# ========================================
# Database Migrations
# ========================================
run_migrations() {
    log "Running database migrations..."

    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" run --rm api npm run prisma:migrate

    log "Database migrations completed successfully"
}

# ========================================
# Seed Database (Optional)
# ========================================
seed_database() {
    read -p "Do you want to seed the database with initial data? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        log "Seeding database..."
        docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" run --rm api npm run seed:all
        log "Database seeding completed"
    fi
}

# ========================================
# Deploy Services
# ========================================
deploy_services() {
    log "Deploying services..."

    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" up -d

    log "Services deployed. Waiting for health checks..."
}

# ========================================
# Post-Deployment Verification
# ========================================
post_deployment_checks() {
    log "Running post-deployment checks..."

    local max_attempts=30
    local attempt=0

    # Check API health
    log "Checking API health..."
    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:3001/api/healthz > /dev/null 2>&1; then
            log "API is healthy ✓"
            break
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done

    if [ $attempt -ge $max_attempts ]; then
        error "API failed to become healthy"
    fi

    # Check Frontend health
    log "Checking Frontend health..."
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            log "Frontend is healthy ✓"
            break
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done

    if [ $attempt -ge $max_attempts ]; then
        error "Frontend failed to become healthy"
    fi

    log "Post-deployment checks passed ✓"
}

# ========================================
# Deployment Summary
# ========================================
deployment_summary() {
    log "=========================================="
    log "DEPLOYMENT SUMMARY"
    log "=========================================="
    log "Deployment completed successfully!"
    log ""
    log "Services running:"
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" ps
    log ""
    log "Access URLs:"
    log "  Frontend: http://localhost:3000"
    log "  API: http://localhost:3001"
    log "  API Docs: http://localhost:3001/api/docs"
    log ""
    log "Log file: $LOG_FILE"
    log "=========================================="
}

# ========================================
# Rollback Function
# ========================================
rollback() {
    error_msg=$1
    error "Deployment failed: $error_msg"
    log "Rolling back..."
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" down
    exit 1
}

# ========================================
# Main Execution
# ========================================
main() {
    log "=========================================="
    log "SGI 360 Production Deployment"
    log "Started: $(date)"
    log "=========================================="

    trap 'rollback "Deployment interrupted"' INT TERM

    # Execute deployment steps
    pre_deployment_checks || rollback "Pre-deployment checks failed"
    docker_login || rollback "Docker login failed"
    pull_images || rollback "Docker image pull failed"
    pre_db_checks || rollback "Pre-deployment database checks failed"
    run_migrations || rollback "Database migrations failed"
    seed_database
    deploy_services || rollback "Service deployment failed"
    sleep 5  # Give services a moment to start
    post_deployment_checks || rollback "Post-deployment checks failed"
    deployment_summary

    log "=========================================="
    log "Deployment completed successfully!"
    log "Finished: $(date)"
    log "=========================================="
}

# Run main function
main "$@"
