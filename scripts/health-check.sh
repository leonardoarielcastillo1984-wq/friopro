#!/bin/bash

# ========================================
# Health Check Script
# ========================================
# Performs comprehensive health checks on running services

set -e

API_URL="${API_URL:-http://localhost:3001}"
WEB_URL="${WEB_URL:-http://localhost:3000}"
TIMEOUT=10

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() {
    echo -e "${GREEN}✓${NC} $1"
}

fail() {
    echo -e "${RED}✗${NC} $1"
}

warn() {
    echo -e "${YELLOW}!${NC} $1"
}

check_endpoint() {
    local url=$1
    local name=$2

    if curl -sf --connect-timeout $TIMEOUT "$url" > /dev/null 2>&1; then
        pass "$name is healthy"
        return 0
    else
        fail "$name is not responding"
        return 1
    fi
}

check_api_healthz() {
    if check_endpoint "$API_URL/api/healthz" "API Health Check"; then
        return 0
    else
        return 1
    fi
}

check_api_docs() {
    if check_endpoint "$API_URL/api/docs" "API Documentation"; then
        return 0
    else
        return 1
    fi
}

check_frontend() {
    if check_endpoint "$WEB_URL" "Frontend"; then
        return 0
    else
        return 1
    fi
}

check_database_connection() {
    if docker-compose ps postgres | grep -q "Up"; then
        pass "Database container is running"
        return 0
    else
        fail "Database container is not running"
        return 1
    fi
}

check_redis_connection() {
    if docker-compose ps redis | grep -q "Up"; then
        pass "Redis container is running"
        return 0
    else
        fail "Redis container is not running"
        return 1
    fi
}

check_docker_disk_space() {
    local usage=$(docker system df --format "{{.Containers}}" 2>/dev/null || echo "0")
    if [ "$usage" != "0" ]; then
        pass "Docker has available disk space"
        return 0
    else
        warn "Unable to determine Docker disk usage"
        return 0
    fi
}

check_container_logs() {
    local service=$1
    local error_count=$(docker-compose logs "$service" 2>/dev/null | grep -c "ERROR\|FATAL" || echo "0")

    if [ "$error_count" -eq 0 ]; then
        pass "No critical errors in $service logs"
        return 0
    else
        warn "Found $error_count error(s) in $service logs"
        return 0
    fi
}

print_summary() {
    echo ""
    echo "=========================================="
    echo "Health Check Summary"
    echo "=========================================="
    echo "API URL: $API_URL"
    echo "Web URL: $WEB_URL"
    echo "Timestamp: $(date)"
    echo "=========================================="
}

main() {
    echo "Running health checks..."
    echo ""

    local all_passed=true

    check_database_connection || all_passed=false
    check_redis_connection || all_passed=false
    echo ""

    check_api_healthz || all_passed=false
    check_api_docs || all_passed=false
    check_frontend || all_passed=false
    echo ""

    check_container_logs "api" || true
    check_container_logs "web" || true
    check_docker_disk_space || true

    print_summary

    if [ "$all_passed" = true ]; then
        echo -e "${GREEN}All health checks passed!${NC}"
        return 0
    else
        echo -e "${RED}Some health checks failed!${NC}"
        return 1
    fi
}

main "$@"
