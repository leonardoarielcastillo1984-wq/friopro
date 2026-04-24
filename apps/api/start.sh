#!/bin/sh
# Start script for API with DB migration
set -e

echo "Running Prisma DB push..."
npx prisma db push --accept-data-loss

echo "Starting API server..."
npx tsx src/main.ts
