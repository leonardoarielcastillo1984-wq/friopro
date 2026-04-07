#!/bin/bash

# Run Prisma migrations script
# Usage: ./scripts/run-migrations.sh [migrate|reset|status]

set -e

COMMAND=${1:-migrate}

echo "========================================="
echo "Prisma Migration Manager"
echo "========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd apps/api

case $COMMAND in
    migrate)
        echo -e "${YELLOW}Running migrations...${NC}"
        npm run prisma:migrate
        echo -e "${GREEN}✓ Migrations completed${NC}"
        ;;

    reset)
        echo -e "${RED}WARNING: This will delete all data in the database!${NC}"
        read -p "Are you sure? (yes/no): " -r
        echo
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            echo -e "${YELLOW}Resetting database...${NC}"
            npm run prisma:reset
            echo -e "${GREEN}✓ Database reset complete${NC}"
            echo -e "${YELLOW}Seeding test data...${NC}"
            npm run seed:all
            echo -e "${GREEN}✓ Test data seeded${NC}"
        else
            echo -e "${BLUE}Reset cancelled${NC}"
        fi
        ;;

    status)
        echo -e "${YELLOW}Checking migration status...${NC}"
        npx prisma migrate status
        ;;

    rollback)
        echo -e "${YELLOW}Rolling back last migration...${NC}"
        # Prisma doesn't have native rollback, but we can reset
        echo -e "${YELLOW}Note: Prisma doesn't support rollbacks directly.${NC}"
        echo -e "${YELLOW}You can reset and reseed, or manually edit the migration files.${NC}"
        read -p "Reset database instead? (yes/no): " -r
        echo
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            npm run prisma:reset
            echo -e "${GREEN}✓ Database reset complete${NC}"
        fi
        ;;

    validate)
        echo -e "${YELLOW}Validating schema...${NC}"
        npx prisma validate
        echo -e "${GREEN}✓ Schema is valid${NC}"
        ;;

    generate)
        echo -e "${YELLOW}Generating Prisma client...${NC}"
        npm run prisma:generate
        echo -e "${GREEN}✓ Prisma client generated${NC}"
        ;;

    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        echo ""
        echo "Available commands:"
        echo "  migrate  - Run pending migrations (default)"
        echo "  reset    - Reset database and reseed (⚠️ deletes all data)"
        echo "  status   - Check migration status"
        echo "  rollback - Rollback last migration"
        echo "  validate - Validate schema"
        echo "  generate - Generate Prisma client"
        echo ""
        echo "Usage:"
        echo "  ./scripts/run-migrations.sh [command]"
        exit 1
        ;;
esac

echo ""
