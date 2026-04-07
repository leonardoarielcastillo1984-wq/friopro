# SGI 360 PostgreSQL Implementation - START HERE

## Welcome! 👋

You now have a complete PostgreSQL database implementation for SGI 360. This file guides you through what's been delivered and how to use it.

## 🚀 Get Started in 3 Steps

### Step 1: Open Terminal
Navigate to the SGI 360 project directory:
```bash
cd "/Users/leonardocastillo/Desktop/APP/SGI 360"
```

### Step 2: Run Setup
One command to start everything:
```bash
./scripts/setup-local-dev.sh
```

This will:
- Create environment files
- Start PostgreSQL and Redis
- Run database migrations
- Seed test data (including 2FA)
- Start the API and Frontend

### Step 3: Access Application
Open in browser:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3001
- **Database**: localhost:5432

That's it! ✓

## 📚 Documentation Guide

Read documentation in this order:

### 1. **QUICK_REFERENCE.md** (Start Here!) ⭐
- Quick commands and shortcuts
- Common operations
- URLs and credentials
- Troubleshooting checklist
- **Read this first for quick answers**

### 2. **DATABASE_README.md** (Overview)
- What's included in the implementation
- Architecture overview
- Services description
- Quick start guide
- Working with migrations and seeds
- File structure

### 3. **POSTGRESQL_SETUP_GUIDE.md** (Setup Instructions)
- Detailed setup instructions
- Environment configuration
- Common operations
- Troubleshooting guide
- Performance optimization
- Security best practices

### 4. **DATABASE_SCHEMA.md** (Technical Details)
- Complete table documentation
- Column definitions
- Indexes and constraints
- 2FA implementation details
- Maintenance tasks
- SQL queries

### 5. **DATABASE_INTEGRATION_GUIDE.md** (Backend Development)
- How backend connects to database
- Service integration details
- Database queries reference
- Authentication flow
- Best practices for development
- Testing with database

### 6. **POSTGRES_IMPLEMENTATION_SUMMARY.md** (What Was Built)
- Executive summary
- What was implemented
- Key features
- Files created
- Next steps for production

### 7. **IMPLEMENTATION_CHECKLIST.md** (Verification)
- What was completed
- Files created/modified
- Verification checklist
- Testing readiness

## 🗂️ Key Files You'll Use

| File/Folder | Purpose | When to Use |
|-------------|---------|------------|
| `docker-compose.yml` | Containerization | Starting/stopping services |
| `.env.local` | Environment config | Configuration defaults |
| `scripts/setup-local-dev.sh` | Setup automation | First time setup |
| `scripts/run-migrations.sh` | Database management | Running migrations |
| `scripts/seed-2fa.sh` | Test data | Seeding 2FA data |
| `apps/api/prisma/schema.prisma` | Database schema | Understanding structure |
| `apps/api/src/scripts/seed2FA.ts` | 2FA seed | Generating test data |
| `apps/api/src/services/twoFactorAuth.ts` | 2FA logic | Development |
| `infra/postgres-init/01-init.sql` | Database setup | Container initialization |

## 🔑 Test Credentials

After running setup script:

```
Frontend: http://localhost:3000
API: http://localhost:3001
Database: localhost:5432

Test User Email: test-2fa@sgi360.local
Database User: sgi
Database Password: sgidev123
Database Name: sgi_dev
Redis Password: sgidev123

TOTP Secret: JBSWY3DPEBLW64TMMQ======
Recovery Codes: Generated during seed (see console output)
```

Use the TOTP secret in any authenticator app:
- Google Authenticator
- Authy
- Microsoft Authenticator
- etc.

## 💡 Common Tasks

### Check Services Status
```bash
docker-compose ps
```

### View Logs
```bash
docker-compose logs -f              # All logs
docker-compose logs -f api          # API only
docker-compose logs -f postgres     # Database only
```

### Connect to Database
```bash
docker-compose exec postgres psql -U sgi -d sgi_dev
```

### Run Migrations
```bash
./scripts/run-migrations.sh migrate
```

### Seed 2FA Data
```bash
./scripts/seed-2fa.sh
```

### Reset Everything (⚠️ Deletes Data)
```bash
./scripts/run-migrations.sh reset
```

### Stop Services
```bash
docker-compose down
```

## 🏗️ Architecture

```
Your Application
    ↓
Fastify API (port 3001)
    ↓
Prisma ORM
    ↓
PostgreSQL Database (port 5432)
    ↓
2FA Tables:
  - TwoFactorAuth (TOTP secrets)
  - TwoFactorRecoveryCode (backup codes)
  - TwoFactorSession (verification sessions)
```

## 🔐 2FA System

### How It Works

1. **Setup**
   - User requests 2FA
   - Backend generates TOTP secret
   - User scans QR code
   - User confirms with 6-digit code
   - Recovery codes generated

2. **Login**
   - User enters email/password
   - If 2FA enabled:
     - Create temporary session
     - User enters TOTP or recovery code
     - Verify and issue JWT token

3. **Recovery**
   - User can use recovery codes instead of TOTP
   - Each code is one-time use only

### Database Tables

All 2FA data is stored securely:
- Secrets: Base32 encoded
- Recovery codes: SHA256 hashed
- Sessions: Auto-expire after 10 minutes
- Usage: Tracked for audit trail

## ✅ What's Included

- ✓ Docker setup (PostgreSQL, Redis, API, Frontend)
- ✓ Database schema with 2FA tables
- ✓ Prisma ORM with migrations
- ✓ Test data seeding
- ✓ Setup and management scripts
- ✓ 5 comprehensive documentation guides
- ✓ Backend 2FA service (already implemented)
- ✓ 2FA API routes (already implemented)
- ✓ Quick reference card
- ✓ This getting started guide

## ❓ FAQ

**Q: How do I start development?**
A: Run `./scripts/setup-local-dev.sh` and open http://localhost:3000

**Q: Can I use different database credentials?**
A: Yes, edit `.env.local` before running docker-compose

**Q: How do I add more test users?**
A: Edit `apps/api/src/scripts/seedUsers.ts` and run `npm run seed:users`

**Q: Can I use the same database in production?**
A: The schema is production-ready, but update passwords and enable SSL

**Q: How do I backup the database?**
A: `docker-compose exec -T postgres pg_dump -U sgi sgi_dev > backup.sql`

**Q: What if ports are already in use?**
A: Edit `docker-compose.yml` to use different ports

**Q: Can I run without Docker?**
A: Yes, install PostgreSQL separately and update DATABASE_URL in .env.local

## 🚨 Troubleshooting

### Services won't start
1. Check Docker is running: `docker info`
2. Check ports are free: `lsof -i :5432`
3. View logs: `docker-compose logs`

### Database connection errors
1. Check .env.local exists
2. Check DATABASE_URL is correct
3. Test: `psql postgresql://sgi:sgidev123@localhost:5432/sgi_dev`

### Migrations fail
1. Check status: `./scripts/run-migrations.sh status`
2. View errors: `cd apps/api && npm run prisma:migrate`
3. Reset if needed: `./scripts/run-migrations.sh reset`

## 📖 Learn More

- **Quick answers**: QUICK_REFERENCE.md
- **Setup help**: POSTGRESQL_SETUP_GUIDE.md
- **Technical details**: DATABASE_SCHEMA.md
- **Backend integration**: DATABASE_INTEGRATION_GUIDE.md
- **Troubleshooting**: POSTGRESQL_SETUP_GUIDE.md (Troubleshooting section)

## 🎯 Next Steps

### Right Now
1. ✓ Read this file
2. ✓ Run: `./scripts/setup-local-dev.sh`
3. ✓ Open http://localhost:3000

### Today
4. ✓ Explore 2FA setup flow
5. ✓ Test TOTP verification
6. ✓ Review database schema
7. ✓ Check test data in database

### This Week
8. ✓ Implement frontend 2FA UI
9. ✓ Test all flows end-to-end
10. ✓ Review security settings
11. ✓ Configure backups

### Before Production
12. ✓ Change all default passwords
13. ✓ Enable SSL for database
14. ✓ Set up monitoring
15. ✓ Configure automated backups
16. ✓ Test disaster recovery

## 📞 Support

Everything you need is documented. Check:

1. **QUICK_REFERENCE.md** - For quick commands
2. **POSTGRESQL_SETUP_GUIDE.md** - For setup issues
3. **DATABASE_SCHEMA.md** - For database details
4. **DATABASE_INTEGRATION_GUIDE.md** - For backend integration
5. **POSTGRES_IMPLEMENTATION_SUMMARY.md** - For what was built

## 📋 Files Structure

```
SGI 360/
├── START_HERE.md                     ← You are here
├── QUICK_REFERENCE.md                ← Read next
├── DATABASE_README.md                ← Then this
├── DATABASE_SCHEMA.md
├── POSTGRESQL_SETUP_GUIDE.md
├── DATABASE_INTEGRATION_GUIDE.md
├── POSTGRES_IMPLEMENTATION_SUMMARY.md
├── IMPLEMENTATION_CHECKLIST.md
├── docker-compose.yml
├── .env.local
├── scripts/
│   ├── setup-local-dev.sh
│   ├── run-migrations.sh
│   └── seed-2fa.sh
├── infra/
│   └── postgres-init/
│       └── 01-init.sql
└── apps/api/
    └── src/scripts/
        └── seed2FA.ts
```

## 🎉 You're All Set!

Everything is configured and ready to use. 

**Next step**: Run `./scripts/setup-local-dev.sh`

Then open http://localhost:3000 and start developing!

Happy coding! 🚀
