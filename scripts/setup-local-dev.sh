#!/bin/bash

# SGI 360 Local Development Setup Script
# Sets up PostgreSQL, Redis, and runs migrations

set -e

echo "========================================="
echo "SGI 360 - Local Development Setup"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker from https://www.docker.com"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker daemon is not running${NC}"
    echo "Please start Docker and try again"
    exit 1
fi

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: docker-compose is not installed${NC}"
    echo "Please install docker-compose or upgrade Docker Desktop"
    exit 1
fi

# Step 1: Copy environment files if they don't exist
echo -e "${YELLOW}Step 1: Setting up environment files...${NC}"
if [ ! -f .env.local ]; then
    cp .env.example .env.local
    echo -e "${GREEN}✓ Created .env.local${NC}"
else
    echo -e "${GREEN}✓ .env.local already exists${NC}"
fi

# Step 2: Install dependencies
echo ""
echo -e "${YELLOW}Step 2: Installing dependencies...${NC}"
if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}Installing pnpm...${NC}"
    npm install -g pnpm
fi

pnpm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Step 3: Start Docker services
echo ""
echo -e "${YELLOW}Step 3: Starting Docker services...${NC}"
docker-compose down 2>/dev/null || true
docker-compose up -d postgres redis

# Wait for services to be ready
echo -e "${YELLOW}Waiting for PostgreSQL to be ready...${NC}"
for i in {1..30}; do
    if docker-compose exec postgres pg_isready -U sgi -d sgi_dev > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 1
done

echo -e "${YELLOW}Waiting for Redis to be ready...${NC}"
for i in {1..30}; do
    if docker-compose exec redis redis-cli -a sgidev123 ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is ready${NC}"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 1
done

# Step 4: Run Prisma migrations
echo ""
echo -e "${YELLOW}Step 4: Running database migrations...${NC}"
cd apps/api
npm run prisma:generate
npm run prisma:migrate -- --name init
echo -e "${GREEN}✓ Migrations completed${NC}"

# Step 5: Seed database
echo ""
echo -e "${YELLOW}Step 5: Seeding test data...${NC}"
npm run seed:all
npm run seed:demo || true
npm run --env=local seed:2fa || echo "2FA seed script not found (optional)"
echo -e "${GREEN}✓ Database seeded${NC}"

cd ..

# Step 6: Start API and Web servers
echo ""
echo -e "${YELLOW}Step 6: Starting application services...${NC}"
docker-compose up -d api web

# Wait for services to start
echo -e "${YELLOW}Waiting for API to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3001/api/healthz > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API is ready${NC}"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 1
done

echo -e "${YELLOW}Waiting for Frontend to be ready...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Frontend is ready${NC}"
        break
    fi
    echo "Waiting... ($i/30)"
    sleep 1
done

# Summary
echo ""
echo "========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "========================================="
echo ""
echo "Services running:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis:      localhost:6379"
echo "  - API:        http://localhost:3001"
echo "  - Frontend:   http://localhost:3000"
echo ""
echo "Database credentials:"
echo "  - User:     sgi"
echo "  - Password: sgidev123"
echo "  - Database: sgi_dev"
echo ""
echo "Default test accounts:"
echo "  - Email:    admin@sgi360.local"
echo "  - Password: (see seedUsers.ts)"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Check logs with: docker-compose logs -f"
echo "  3. Run tests with: npm run test"
echo ""
echo "Useful commands:"
echo "  docker-compose logs api          - View API logs"
echo "  docker-compose logs web          - View Frontend logs"
echo "  docker-compose logs postgres     - View Database logs"
echo "  docker-compose restart api       - Restart API service"
echo "  docker-compose down              - Stop all services"
echo ""
echo "Documentation:"
echo "  - DATABASE_SCHEMA.md             - Database schema details"
echo "  - .env.local                     - Environment variables"
echo "  - docker-compose.yml             - Docker configuration"
echo ""
