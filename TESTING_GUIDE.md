# 🧪 Testing Guide - Fixed Login Flow

## ✅ What Was Fixed

We've now created a complete integration between your Next.js frontend and the mock API server:

1. **Next.js Route Handlers** - Created API endpoints that proxy to localhost:3001
   - `/api/auth/login` → forwards to mock API and transforms response
   - `/api/2fa/verify` → forwards to mock API
   - `/api/auth/2fa-complete` → forwards to mock API

2. **Response Translation** - The route handlers translate the mock API response format to what the frontend expects:
   - `accessToken` → `token`
   - `require2FA` → `requires2FA`
   - `usuario` → `user` (with proper field mapping)

3. **Mock API Enhancements** - Updated mock server with:
   - `/auth/logout` endpoint
   - Proper CORS headers allowing all origins
   - All required endpoints for the authentication flow

4. **Login Page Updates** - Fixed token storage to match auth context expectations:
   - Stores `accessToken` in localStorage
   - Stores `user` JSON in localStorage

---

## 🚀 How to Test

### Prerequisites
Make sure you're in the correct project directory:
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360
```

### Step 1: Start Mock API Server
Open **Terminal 1** and run:
```bash
cd apps/web
node --experimental-modules mock-api-server.js
```

You should see:
```
✅ Mock API Server running on http://localhost:3001
📧 Test Credentials:
Email: test@example.com
Password: Test123!@#
```

### Step 2: Start Next.js Dev Server
Open **Terminal 2** and run:
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360/apps/web
npm run dev
```

You should see:
```
▲ Next.js 14.2.15
- Local:        http://localhost:3000
- Environments: .env.local
```

### Step 3: Test Login Flow
1. Open your browser and go to: **http://localhost:3000/login**

2. You should see the login form with:
   - Email input field
   - Password input field
   - "Ingresar" button

3. Enter test credentials:
   - **Email**: `test@example.com`
   - **Password**: `Test123!@#`

4. Click **"Ingresar"**

5. You should be redirected to the dashboard (http://localhost:3000/dashboard)

6. You should see:
   - "Buenos días" / "Buenas tardes" / "Buenas noches" greeting
   - Dashboard statistics and cards
   - Sidebar navigation on the left
   - Top bar with user menu

---

## 🔍 What's Happening Behind the Scenes

```
User enters credentials
         ↓
http://localhost:3000/login (Next.js page)
         ↓
Click "Ingresar" button
         ↓
POST /api/auth/login (Next.js route handler)
         ↓
Next.js route calls http://localhost:3001/api/auth/login (mock API)
         ↓
Mock API returns: { requires2FA: false, accessToken: "...", user: {...} }
         ↓
Next.js route transforms to: { token: "...", requires2FA: false, user: {...} }
         ↓
Frontend receives response
         ↓
localStorage.setItem('accessToken', token)
localStorage.setItem('user', JSON.stringify(user))
         ↓
router.push('/dashboard')
         ↓
AppLayout checks auth via AuthProvider
         ↓
AuthProvider calls /auth/csrf (via apiFetch)
         ↓
AuthProvider calls /auth/me (via apiFetch)
         ↓
apiFetch uses NEXT_PUBLIC_API_URL = http://localhost:3001
         ↓
Mock API returns user data
         ↓
AppLayout renders dashboard with authenticated user info
```

---

## 📋 Expected Behavior

### Login Success
- ✅ Form validates email and password
- ✅ Loading state shows "Ingresando…"
- ✅ After 1-2 seconds, you're redirected to dashboard
- ✅ Dashboard loads with user greeting and stats

### Logout
When you logout from dashboard:
- ✅ User is cleared from context
- ✅ You're redirected back to login page
- ✅ Accessing dashboard redirects to login again

### Error Handling
If you enter wrong credentials:
- ✅ You see error message: "Invalid credentials"
- ✅ Form stays on login page
- ✅ You can try again

---

## 🆘 Troubleshooting

### "Failed to fetch" or "No se pudo obtener"
**Problem**: Mock API server not running or on wrong port

**Solution**:
1. Make sure Terminal 1 is running the mock API
2. Check that it says "running on http://localhost:3001"
3. Try accessing http://localhost:3001/api/auth/login in a new browser tab to test directly

### Dashboard shows "Cargando..." indefinitely
**Problem**: Auth context can't fetch user data

**Solution**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for error messages
4. Check that http://localhost:3001 is accessible
5. Verify mock API is still running

### Getting redirected back to login after successful login
**Problem**: Dashboard page can't authenticate

**Solution**:
1. This means your token is stored but auth context isn't reading it properly
2. Clear localStorage: `localStorage.clear()` in console
3. Log out and try logging in again
4. Make sure `/auth/me` endpoint returns user data in mock API

### Port already in use errors
**Problem**: Port 3000 or 3001 is already running

**Solution**:
```bash
# Find process on port 3000
lsof -i :3000
# Find process on port 3001
lsof -i :3001
# Kill the process (replace PID with actual process ID)
kill -9 <PID>
```

---

## 🧪 Advanced Testing

### Test Invalid Credentials
- Email: `test@example.com`
- Password: `WrongPassword123`
- Expected: Error message "Invalid credentials"

### Test Missing Email
- Leave email empty
- Password: `Test123!@#`
- Expected: Browser validation error

### Test Database State
Check browser DevTools to see what's stored:
```javascript
// In browser console:
localStorage.getItem('accessToken')
JSON.parse(localStorage.getItem('user'))
```

---

## 📝 Files Modified Today

### Created Files
- `/apps/web/src/app/api/auth/login/route.ts` - Login proxy handler
- `/apps/web/src/app/api/auth/2fa-complete/route.ts` - 2FA complete handler
- `/apps/web/src/app/api/2fa/verify/route.ts` - 2FA verify handler

### Updated Files
- `/apps/web/src/app/login/page.tsx` - Fixed token storage
- `/apps/web/mock-api-server.js` - Added logout endpoint

---

## ✨ Next Steps After Testing

Once login is working:

1. **Test 2FA** (optional - currently simplified)
   - Can enable 2FA in settings
   - Test recovery codes
   - Test TOTP code verification

2. **Test Other Features**
   - Document management
   - Normative standards upload
   - Audit analysis
   - Non-conformities
   - Risk management

3. **Deploy to Staging**
   - Replace mock API with real API endpoint
   - Update `NEXT_PUBLIC_API_URL`
   - Test full authentication flow with real backend

---

## 🎯 Success Criteria

You'll know everything is working when:

1. ✅ You can log in with test@example.com / Test123!@#
2. ✅ You're redirected to the dashboard
3. ✅ Dashboard shows user greeting and data
4. ✅ You can navigate to other pages in the app
5. ✅ You can log out and be sent back to login
6. ✅ All without console errors (F12 to check)

---

Need help? Check the browser console (F12) for any error messages!
