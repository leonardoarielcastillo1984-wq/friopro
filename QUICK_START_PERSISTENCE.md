# Quick Start: Apply Database Persistence for Simulacros

## TL;DR - Fastest Way to Get It Working

### With Docker (Easiest)
```bash
cd "SGI 360"
docker-compose up
```
Then open http://localhost:3000

**What this does:**
- Creates PostgreSQL database
- Creates all tables (including new emergency tables)
- Starts API server on port 3002
- Starts Frontend on port 3000
- Automatically applies all migrations

### Without Docker
```bash
cd "SGI 360/apps/api"
npm install
npm run prisma:migrate
npm run dev

# In another terminal
cd "SGI 360/apps/web"
npm install
npm run dev
```

## What Changed

### Before
- Create simulacro → ❌ Data disappears on refresh
- Click eye icon → ❌ 404 error
- Dropdown select → ❌ Can't add custom values

### After
- Create simulacro → ✅ Data persists in database
- Click eye icon → ✅ View full details
- Dropdown select → ✅ Add custom values that stick

## Files to Know About

| File | What It Does |
|------|-------------|
| `apps/api/prisma/schema.prisma` | Database schema (added DrillScenario, ContingencyPlan, EmergencyResource models) |
| `apps/api/prisma/migrations/0015_add_emergency_models/migration.sql` | Creates tables in database |
| `apps/api/src/routes/emergency.ts` | API endpoints (now saves to database instead of memory) |
| `apps/web/src/app/(app)/simulacros/page.tsx` | Frontend UI (already working) |
| `apps/web/src/components/ComboSelect.tsx` | Smart dropdown component with custom value support |

## Quick Test

1. Start the app (Docker or npm commands above)
2. Login
3. Go to Simulacros section
4. Click "Nuevo Simulacro" button
5. Fill form and click "Crear"
6. Refresh the page (F5)
7. ✅ Simulacro still appears = SUCCESS!

## If Something Doesn't Work

### Migration Failed
```bash
cd apps/api
npm run prisma migrate status
npm run prisma migrate dev  # Try again
```

### Database Connection Issue
Make sure PostgreSQL is running:
```bash
# Docker: it starts automatically
# Local: check postgresql status
```

### API won't start
```bash
cd apps/api
npm install  # Fix dependencies
npm run prisma:generate  # Generate client
npm run dev
```

### Tables Don't Exist
```bash
cd apps/api
npm run prisma reset  # Recreates all tables (⚠️ deletes data!)
```

## Key Points

1. **Data is now in database** - Not temporary API memory
2. **Multi-tenant safe** - Each organization's data is isolated
3. **Soft deletes** - Deleted items stay in DB for audit
4. **API endpoints exist** - All CRUD operations supported
5. **Custom dropdown values work** - Users can add new options

## Next Steps

Once working, apply this same pattern to:
- Planes de Contingencia (contingency-plans endpoints exist)
- Recursos de Emergencia (resources endpoints exist)
- Other modules that create/store data

All endpoints are ready to use!

---

**Questions?** Check `IMPLEMENTATION_SUMMARY.md` for detailed documentation
