import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(__dirname, '../../prisma/migrations/0015_add_emergency_models/migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('Applying migration...');
    // Split the migration SQL by semicolons to execute individual statements
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);

    for (const statement of statements) {
      const trimmedStmt = statement.trim();
      if (trimmedStmt.length > 0) {
        console.log(`Executing: ${trimmedStmt.substring(0, 100)}...`);
        await prisma.$executeRawUnsafe(trimmedStmt);
      }
    }

    console.log('Recording migration in _prisma_migrations table...');
    // Record the migration as applied
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations" (id, checksum, finished_at, execution_time, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        '0015_add_emergency_models_' || to_char(now(), 'YYYY-MM-DDHH24MISS'),
        'checksum_0015',
        now(),
        0,
        '0015_add_emergency_models',
        '',
        null,
        now(),
        1
      )
      ON CONFLICT DO NOTHING;
    `);

    console.log('Migration applied successfully!');
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration();
