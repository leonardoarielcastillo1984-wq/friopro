# 🚀 SGI 360 - Fix & Run Guide (macOS)

## ⚠️ Current Status
- ✅ **Docker Containers**: PostgreSQL & Redis ARE running
- ✅ **Frontend**: Next.js server IS running on http://localhost:3000
- ❌ **API Backend**: Failed to start - npm install error with `husky`

## 🔧 How to Fix (Step-by-Step)

### Step 1: Open Terminal and Navigate to Project
```bash
cd /Users/leonardocastillo/Desktop/APP/"SGI 360"
```

### Step 2: Stop All Current Services
```bash
# Kill any existing Node processes
pkill -f "npm run dev" || true
pkill -f "node" || true

# Stop Docker containers
docker-compose -f launcher/docker-compose.yml down || true
sleep 3
```

### Step 3: Clean npm Cache and Dependencies
```bash
# Remove node_modules from API
rm -rf apps/api/node_modules
rm -rf apps/web/node_modules

# Clear npm cache
npm cache clean --force
```

### Step 4: Install Global Dependencies
```bash
# Install husky globally (fixes the husky: command not found error)
npm install -g husky

# Install pnpm if needed (some projects use it)
npm install -g pnpm
```

### Step 5: Start Docker Containers
```bash
docker-compose -f launcher/docker-compose.yml up -d postgres redis
sleep 15  # Wait for databases to be ready
```

### Step 6: Install API Dependencies
```bash
cd apps/api
npm install --legacy-peer-deps
npm run prisma:generate
npm run prisma:migrate -- --skip-generate || true
npm run seed:complete || true
cd ../..
```

### Step 7: Install Web Dependencies
```bash
cd apps/web
npm install --legacy-peer-deps
cd ../..
```

### Step 8: Start the API Backend (in Terminal Tab 1)
```bash
cd apps/api
npm run dev
```

**You should see:**
```
✓ Server running on http://localhost:3002
```

**Leave this terminal running!** Open a **new terminal tab** and continue...

### Step 9: Start the Frontend (in Terminal Tab 2)
```bash
cd /Users/leonardocastillo/Desktop/APP/"SGI 360"/apps/web
npm run dev
```

**You should see:**
```
- Local: http://localhost:3000
✓ Ready in XXXms
```

### Step 10: Open Browser
Go to: **http://localhost:3000/login**

### Step 11: Log In
- **Email:** `admin@sgi360.com`
- **Password:** `Admin123!`
- **Click:** "INGRESAR"

---

## ✅ Verification Checklist

Before logging in, verify everything is running:

### Check 1: Databases are running
```bash
# In a new terminal:
docker ps
```
You should see:
- `sgi360-postgres` (running)
- `sgi360-redis` (running)

### Check 2: API is responding
```bash
# In a new terminal:
curl http://localhost:3002/health
```
Should return: `{"status":"ok"}`

### Check 3: Frontend is accessible
```bash
# In a new terminal:
curl http://localhost:3000
```
Should return HTML content (not an error)

---

## 🛑 If Something Fails

### If API won't start:
```bash
# Check what's running on port 3002
lsof -i :3002

# If something is using it, kill it
kill -9 <PID>

# Try starting API again
cd apps/api && npm run dev
```

### If Frontend won't start:
```bash
# Check what's running on port 3000
lsof -i :3000

# If something is using it, kill it
kill -9 <PID>

# Try starting frontend again
cd apps/web && npm run dev
```

### If Docker containers won't start:
```bash
# Stop all containers
docker-compose -f launcher/docker-compose.yml down

# Remove volumes and start fresh
docker-compose -f launcher/docker-compose.yml down -v
docker-compose -f launcher/docker-compose.yml up -d postgres redis
```

### If you see "Connection refused" errors:
This usually means the API hasn't started yet. Check the terminal where you ran `npm run dev` for the API. Wait at least 10-15 seconds for everything to initialize.

---

## 📊 Expected Final State

When everything is working:

| Service | URL | Status |
|---------|-----|--------|
| Frontend | http://localhost:3000 | ✅ Running |
| Login Page | http://localhost:3000/login | ✅ Accessible |
| API Backend | http://localhost:3002 | ✅ Running |
| PostgreSQL | localhost:5432 | ✅ Running (Docker) |
| Redis | localhost:6379 | ✅ Running (Docker) |

---

## 🚀 Quick Start Next Time

Once everything is working, you can use this quick command:

```bash
cd /Users/leonardocastillo/Desktop/APP/"SGI 360"

# Terminal 1: API
cd apps/api && npm run dev

# Terminal 2: Frontend (open new terminal)
cd apps/web && npm run dev

# Then open: http://localhost:3000/login
```

---

## ❓ Questions?

If something still doesn't work:
1. Check that all 4 services are running (Docker, API, Frontend, Database)
2. Check the terminal output for error messages
3. Make sure no other services are using ports 3000, 3002, 5432, or 6379
4. Try restarting Docker: `docker restart sgi360-postgres sgi360-redis`
