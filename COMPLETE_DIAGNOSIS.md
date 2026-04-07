# 🔍 Complete Diagnosis Guide

## Status Check

### 1. Mock API Server (Port 3001)
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'
```

**Expected Response:**
```json
{
  "requires2FA": false,
  "accessToken": "token_...",
  "user": {
    "id": "1",
    "email": "test@example.com",
    "name": "Test User"
  }
}
```

### 2. Next.js Route Handler (Port 3000)
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#"}'
```

**Expected Response:**
```json
{
  "token": "token_...",
  "requires2FA": false,
  "user": {
    "id": "1",
    "email": "test@example.com",
    "globalRole": null
  }
}
```

> Note: The key difference is `accessToken` becomes `token`

### 3. Full Login Flow
- Go to http://localhost:3000/login
- Enter credentials:
  - Email: test@example.com
  - Password: Test123!@#
- Click "Ingresar"
- Should redirect to http://localhost:3000/dashboard

## Debugging Steps

### If Mock API is not responding:
```bash
# Kill the old process
lsof -ti:3001 | xargs kill -9

# Start it again
cd "/Users/leonardocastillo/Desktop/APP/SGI 360/apps/web"
node --experimental-modules mock-api-server.js
```

### If Next.js won't start:
```bash
# Kill the old process
lsof -ti:3000 | xargs kill -9

# Clear Next.js cache
rm -rf /Users/leonardocastillo/Desktop/APP/SGI\ 360/apps/web/.next

# Start it again
cd "/Users/leonardocastillo/Desktop/APP/SGI 360/apps/web"
npm run dev
```

### If you get "Failed to fetch" error:
1. Make sure Mock API is running on 3001
2. Make sure Next.js is running on 3000
3. Try this test:
   ```bash
   # This should return data
   curl -X POST http://localhost:3001/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!@#"}'
   ```

### If login works but doesn't redirect:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Paste: `console.log(localStorage.getItem('accessToken'))`
4. You should see a token value like `token_xyz123`
5. If you see `null`, the login response didn't have the token field

### If dashboard shows "Cargando..." forever:
1. Open DevTools (F12)
2. Go to Console tab
3. Look for error messages
4. Most likely issue: `/auth/me` endpoint not returning correct data

## What Each Endpoint Should Do

### `POST /api/auth/login`
- **Input:** `{ email, password }`
- **Process:** Call Mock API → Transform response
- **Output:** `{ token, requires2FA, user }`

### `GET /auth/csrf` (Auto-called by app)
- **Input:** None
- **Output:** `{ csrfToken }`

### `GET /auth/me` (Auto-called by app)
- **Input:** None
- **Output:** `{ id, email, name }`

## File Structure

```
/apps/web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/
│   │   │   │   │   └── route.ts ✅ (transforms response)
│   │   │   │   └── 2fa-complete/
│   │   │   │       └── route.ts ✅
│   │   │   └── 2fa/
│   │   │       └── verify/
│   │   │           └── route.ts ✅
│   │   └── login/
│   │       └── page.tsx ✅ (stores token and redirects)
│   └── lib/
│       ├── api.ts (uses NEXT_PUBLIC_API_URL)
│       └── auth-context.tsx (calls /auth/me)
├── mock-api-server.js ✅ (running on 3001)
└── .env.local ✅ (NEXT_PUBLIC_API_URL=http://localhost:3001)
```

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Failed to fetch" | Mock API not running | `node --experimental-modules mock-api-server.js` |
| Stuck on login page | Dashboard can't authenticate | Check `/auth/me` endpoint returns user data |
| "Login failed" error | Wrong credentials or API error | Use: test@example.com / Test123!@# |
| Port already in use | Previous process still running | `lsof -ti:PORT \| xargs kill -9` |
| SWC binary error | Architecture mismatch | This is a VM issue, use Mac terminal instead |

## Next Steps

1. ✅ Make sure Mock API is running: `node --experimental-modules mock-api-server.js`
2. ✅ Make sure Next.js is running: `npm run dev`
3. ✅ Test Mock API directly with curl
4. ✅ Test login page: http://localhost:3000/login
5. ✅ Check browser DevTools for errors
6. ✅ If stuck, use TEST_LOGIN_API.html to isolate the issue
