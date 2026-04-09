import type { PrismaConfig } from '@prisma/client'

const config: PrismaConfig = {
  adapter: {
    provider: 'postgresql',
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres',
  }
}

export default config
