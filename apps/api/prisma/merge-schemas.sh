#!/bin/sh
# Merge all Prisma schemas into one complete schema

OUTPUT="/app/apps/api/prisma/schema.prisma"

# Start with root schema (generator + datasource + base enums)
cat /app/prisma/schema.prisma > "$OUTPUT"

# Add a newline
echo "" >> "$OUTPUT"

# Add schema API models (skip generator AND datasource blocks)
sed '/^generator client {/,/^}/d' /app/apps/api/prisma/schema-api.prisma | \
sed '/^datasource db {/,/^}/d' >> "$OUTPUT"

# Add schema-saas models (skip datasource block)
sed '/^datasource db {/,/^}/d' /app/apps/api/prisma/schema-saas.prisma >> "$OUTPUT"

# Add schema-project360 models (skip datasource block)
sed '/^datasource db {/,/^}/d' /app/apps/api/prisma/schema-project360.prisma >> "$OUTPUT"

echo "Schema merged successfully"
