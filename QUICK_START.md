# ⚡ Quick Start - 30 Seconds

## Copy-Paste Commands

### Terminal 1️⃣ - Mock API Server
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360/apps/web && node --experimental-modules mock-api-server.js
```

### Terminal 2️⃣ - Next.js Dev Server
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360/apps/web && npm run dev
```

---

## Test in Browser

**URL**: http://localhost:3000/login

**Credentials**:
- Email: `test@example.com`
- Password: `Test123!@#`

**Expected**: You'll be logged in and see the dashboard!

---

## What Changed Today

✅ Created Next.js route handlers to proxy API calls to localhost:3001
✅ Fixed token storage in localStorage
✅ Added /auth/logout endpoint to mock API
✅ Updated login page to handle correct response format

---

## Common Issues & Fixes

| Problem | Solution |
|---------|----------|
| Port 3001 in use | `lsof -i :3001` then `kill -9 <PID>` |
| Port 3000 in use | `lsof -i :3000` then `kill -9 <PID>` |
| Login doesn't work | Check browser console (F12) for errors |
| Stuck on login page | Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows) |
| "Failed to fetch" | Make sure mock API server is running in Terminal 1 |

---

## Files That Got Fixed

- ✅ `/apps/web/src/app/api/auth/login/route.ts` (NEW)
- ✅ `/apps/web/src/app/api/2fa/verify/route.ts` (NEW)
- ✅ `/apps/web/src/app/api/auth/2fa-complete/route.ts` (NEW)
- ✅ `/apps/web/src/app/login/page.tsx` (UPDATED)
- ✅ `/apps/web/mock-api-server.js` (UPDATED)

---

## What Happens When You Login

1. You enter email & password
2. Form POSTs to `/api/auth/login` (Next.js route)
3. Next.js route calls `http://localhost:3001/api/auth/login` (mock API)
4. Mock API returns data
5. Next.js route transforms it to correct format
6. Browser receives token and stores in localStorage
7. Page redirects to `/dashboard`
8. Dashboard loads with authentication context
9. You see the app dashboard! 🎉

---

That's it! You're ready to test. Run the commands above and let me know what you see! 💪
