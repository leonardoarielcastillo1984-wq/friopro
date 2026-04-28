#!/bin/sh
# Merge all Prisma schemas into one complete schema

OUTPUT="/app/apps/api/prisma/schema.prisma"

# Start with root schema (generator + datasource + base enums)
cat /app/prisma/schema.prisma > "$OUTPUT"

echo "" >> "$OUTPUT"

# Add schema API models (skip generator, datasource, and duplicate models)
sed '/^generator client {/,/^}/d' /app/apps/api/prisma/schema-api.prisma | \
sed '/^datasource db {/,/^}/d' | \
sed '/^model MaintenancePlan {/,/^}/d' | \
sed '/^model WorkOrder {/,/^}/d' >> "$OUTPUT"

# Add schema-saas models (skip datasource and duplicate models)
sed '/^datasource db {/,/^}/d' /app/apps/api/prisma/schema-saas.prisma | \
sed '/^model MaintenancePlan {/,/^}/d' | \
sed '/^model WorkOrder {/,/^}/d' >> "$OUTPUT"

# Add schema-project360 models (skip datasource and duplicate models)
sed '/^datasource db {/,/^}/d' /app/apps/api/prisma/schema-project360.prisma | \
sed '/^model MaintenancePlan {/,/^}/d' | \
sed '/^model WorkOrder {/,/^}/d' >> "$OUTPUT"

echo "Schema merged successfully"
