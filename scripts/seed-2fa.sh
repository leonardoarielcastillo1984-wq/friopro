#!/bin/bash

# Seed 2FA test data script

set -e

echo "========================================="
echo "SGI 360 - 2FA Test Data Seeder"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if database is running
echo -e "${YELLOW}Checking database connection...${NC}"
if ! docker-compose exec postgres pg_isready -U sgi -d sgi_dev > /dev/null 2>&1; then
    echo -e "${RED}Error: PostgreSQL is not running${NC}"
    echo "Please start services with: docker-compose up postgres redis"
    exit 1
fi
echo -e "${GREEN}✓ Database is running${NC}"

echo ""
echo -e "${YELLOW}Seeding 2FA test data...${NC}"

cd apps/api

# Generate Prisma client first
npm run prisma:generate

# Run the seed script
node --import tsx src/scripts/seed2FA.ts

echo ""
echo -e "${GREEN}✓ 2FA test data seeded successfully!${NC}"
echo ""
echo "Summary:"
echo "  - Test users created with 2FA enabled"
echo "  - Recovery codes generated"
echo "  - Test sessions created"
echo ""
echo "You can now:"
echo "  1. Login with test-2fa@sgi360.local"
echo "  2. Use the TOTP secret in your authenticator app"
echo "  3. Test 2FA verification flows"
echo ""
