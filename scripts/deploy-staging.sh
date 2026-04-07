#!/bin/bash

# ========================================
# Staging Deployment Script
# ========================================
# This script deploys to staging environment with Docker images

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/deploy-staging-$(date +%Y%m%d-%H%M%S).log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

main() {
    log "=========================================="
    log "SGI 360 Staging Deployment"
    log "Started: $(date)"
    log "=========================================="

    # Load environment
    if [ ! -f "$PROJECT_ROOT/.env.staging" ]; then
        error "Missing .env.staging file"
    fi

    source "$PROJECT_ROOT/.env.staging"

    # Docker login
    log "Authenticating with Docker registry..."
    echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin "$DOCKER_REGISTRY"

    # Pull images
    log "Pulling latest images..."
    docker pull "${DOCKER_REGISTRY}/sgi-api:staging"
    docker pull "${DOCKER_REGISTRY}/sgi-frontend:staging"

    # Deploy via SSH (example)
    log "Deploying to staging server..."

    ssh -i "$DEPLOY_KEY" "$DEPLOY_USER@$DEPLOY_HOST" << 'EOF'
        cd /var/www/sgi-360-staging
        docker-compose -f docker-compose.prod.yml down
        docker-compose -f docker-compose.prod.yml up -d
        docker-compose -f docker-compose.prod.yml exec -T api npm run prisma:migrate
    EOF

    log "Staging deployment completed successfully!"
    log "Finished: $(date)"
}

main "$@"
