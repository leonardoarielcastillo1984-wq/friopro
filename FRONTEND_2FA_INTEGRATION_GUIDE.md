# 🔐 Frontend 2FA Integration Guide

Complete implementation guide for integrating Two-Factor Authentication into your SGI 360 frontend.

---

## Table of Contents

1. [File Structure](#file-structure)
2. [Installation Steps](#installation-steps)
3. [Component Usage](#component-usage)
4. [Integration with Existing Auth](#integration-with-existing-auth)
5. [Styling & Customization](#styling--customization)
6. [Testing](#testing)
7. [Common Issues](#common-issues)

---

## File Structure

Create the following file structure in your React project:

```
src/
├── hooks/
│   ├── use2FA.ts              (NEW - 2FA hooks)
│   ├── useAuth.ts             (UPDATE - add 2FA session state)
│   └── useQuery.ts            (existing)
├── components/
│   ├── TwoFactorSetup.tsx      (NEW - 2FA setup flow)
│   ├── TwoFactorStatus.tsx     (NEW - 2FA status display)
│   ├── TwoFactorDisable.tsx    (NEW - 2FA disable flow)
│   └── ...existing components
├── pages/
│   ├── LoginWith2FA.tsx        (NEW - updated login page)
│   ├── Settings/
│   │   ├── TwoFactorSettings.tsx (NEW - 2FA settings page)
│   │   └── ...other settings
│   └── ...existing pages
├── styles/
│   ├── 2fa.css                (NEW - 2FA component styles)
│   └── ...existing styles
└── App.tsx                     (UPDATE - add routes)
```

---

## Installation Steps

### Step 1: Copy Hook Files

Create `src/hooks/use2FA.ts`:
```bash
Copy the entire "1. hooks/use2FA.ts" section from frontend-2fa-implementation.tsx
```

### Step 2: Update Auth Hook

Update `src/hooks/useAuth.ts`:
```bash
Copy the "2. hooks/useAuth.ts (UPDATED)" section from frontend-2fa-implementation.tsx
Replace your existing useAuth hook or merge the 2FA session state handling
```

**Key additions:**
- `requires2FA` state - flag indicating 2FA step needed
- `sessionToken` state - temporary token for 2FA verification
- `verify2FA` method - handles TOTP/recovery code verification

### Step 3: Create Components

Create the following component files:

**`src/components/TwoFactorSetup.tsx`**
```bash
Copy the "3. components/TwoFactorSetup.tsx" section
```

**`src/components/TwoFactorStatus.tsx`**
```bash
Copy the "4. components/TwoFactorStatus.tsx" section
```

**`src/components/TwoFactorDisable.tsx`**
```bash
Copy the "5. components/TwoFactorDisable.tsx" section
```

### Step 4: Update Login Page

Update or create `src/pages/LoginWith2FA.tsx`:
```bash
Copy the "6. pages/LoginWith2FA.tsx" section
```

This component handles both regular login AND 2FA verification step.

### Step 5: Create Settings Page

Create `src/pages/Settings/TwoFactorSettings.tsx`:
```bash
Copy the "7. pages/Settings/TwoFactorSettings.tsx" section
```

### Step 6: Add Styles

Create `src/styles/2fa.css`:
```bash
Copy the CSS from the bottom of frontend-2fa-implementation.tsx
```

Import in your main stylesheet:
```css
@import './2fa.css';
```

---

## Component Usage

### Basic Usage

```tsx
// Login page with 2FA support
import { LoginWith2FA } from '@/pages/LoginWith2FA';

export function AuthPage() {
  return (
    <LoginWith2FA onLoginSuccess={() => navigate('/dashboard')} />
  );
}
```

### Settings Page

```tsx
// User settings with 2FA management
import { TwoFactorSettings } from '@/pages/Settings/TwoFactorSettings';

export function SettingsPage() {
  return (
    <div>
      <h1>Account Settings</h1>
      <TwoFactorSettings />
    </div>
  );
}
```

### Using Individual Components

```tsx
import { TwoFactorStatus, TwoFactorSetup, TwoFactorDisable } from '@/components';

export function CustomSettings() {
  const [view, setView] = useState<'status' | 'setup' | 'disable'>('status');

  return (
    <div>
      {view === 'status' && (
        <TwoFactorStatus
          onEnableClick={() => setView('setup')}
          onDisableClick={() => setView('disable')}
        />
      )}
      {view === 'setup' && (
        <TwoFactorSetup
          onSetupComplete={() => setView('status')}
          onCancel={() => setView('status')}
        />
      )}
      {view === 'disable' && (
        <TwoFactorDisable
          onDisableComplete={() => setView('status')}
          onCancel={() => setView('status')}
        />
      )}
    </div>
  );
}
```

### Using Hooks Directly

```tsx
import { use2FAStatus, useEnable2FA, useVerify2FA } from '@/hooks/use2FA';

export function Custom2FAComponent() {
  const { data: status, isLoading } = use2FAStatus();
  const setupMutation = useEnable2FA();
  const verifyMutation = useVerify2FA();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <p>2FA Status: {status?.status.isEnabled ? 'Enabled' : 'Disabled'}</p>
      <button onClick={() => setupMutation.mutate()}>
        Enable 2FA
      </button>
    </div>
  );
}
```

---

## Integration with Existing Auth

### Update Your Login Flow

If you have an existing login page, update it to support 2FA:

```tsx
import { useAuth } from '@/hooks/useAuth';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const auth = useAuth();

  // Step 1: Regular login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await auth.login(email, password);
      // If 2FA required, auth.requires2FA will be true
      // If not required, login is complete
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  // Step 2: If 2FA required, show verification form
  if (auth.requires2FA) {
    return (
      <form onSubmit={async (e) => {
        e.preventDefault();
        try {
          await auth.verify2FA(totp);
          // Login complete, redirect to dashboard
          navigate('/dashboard');
        } catch (error) {
          console.error('2FA verification failed:', error);
        }
      }}>
        <input
          type="text"
          value={totp}
          onChange={(e) => setTotp(e.target.value)}
          placeholder="Enter 6-digit code"
          inputMode="numeric"
          maxLength="6"
        />
        <button type="submit">Verify</button>
      </form>
    );
  }

  // Regular login form
  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

### Update Your Auth Context/Store

If using Context API:

```tsx
import { createContext, useContext } from 'react';
import { useAuth } from '@/hooks/useAuth';

const AuthContext = createContext<ReturnType<typeof useAuth> | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuthContext must be used within AuthProvider');
  return context;
}
```

If using Redux/Zustand, update your auth slice:

```ts
// Redux example
import { useAuth } from '@/hooks/useAuth';

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: null,
    requires2FA: false,
    sessionToken: null,
    // ... other fields
  },
  reducers: {
    set2FARequired: (state, action) => {
      state.requires2FA = true;
      state.sessionToken = action.payload;
    },
    clear2FA: (state) => {
      state.requires2FA = false;
      state.sessionToken = null;
    },
  },
});
```

---

## Styling & Customization

### Dark Mode Support

Add dark mode styles to `2fa.css`:

```css
@media (prefers-color-scheme: dark) {
  .2fa-setup-card,
  .2fa-status-card,
  .2fa-disable-card,
  .login-2fa-form {
    background: #1e1e1e;
    color: #e0e0e0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  }

  .2fa-setup-card h2,
  .2fa-status-card h3,
  .2fa-disable-card h2 {
    color: #e0e0e0;
  }

  .totp-input {
    background: #2d2d2d;
    color: #e0e0e0;
    border-color: #444;
  }

  .recovery-codes-list {
    background: #2d2d2d;
    border-color: #444;
  }

  .recovery-code {
    background: #1a1a1a;
    border-color: #444;
    color: #e0e0e0;
  }
}
```

### Tailwind CSS Version

If using Tailwind, replace component classNames:

```tsx
// Before (CSS modules)
<div className="2fa-setup-card">
  <h2>Enable 2FA</h2>
</div>

// After (Tailwind)
<div className="max-w-md mx-auto my-8 p-8 bg-white rounded-lg shadow">
  <h2 className="text-2xl font-bold mb-4">Enable 2FA</h2>
</div>
```

### Custom Theme Variables

```css
:root {
  --color-primary: #007bff;
  --color-primary-hover: #0056b3;
  --color-danger: #dc3545;
  --color-warning: #ffc107;
  --color-success: #28a745;
  --color-background: #ffffff;
  --color-text: #333333;
  --border-radius: 4px;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}
```

---

## Testing

### Unit Tests with Vitest/Jest

```tsx
import { render, screen, userEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TwoFactorSetup } from '@/components/TwoFactorSetup';

describe('TwoFactorSetup', () => {
  const queryClient = new QueryClient();

  it('should display initial setup screen', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <TwoFactorSetup />
      </QueryClientProvider>
    );

    expect(screen.getByText('Enable Two-Factor Authentication')).toBeInTheDocument();
    expect(screen.getByText('Start Setup')).toBeInTheDocument();
  });

  it('should show QR code after setup starts', async () => {
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <TwoFactorSetup />
      </QueryClientProvider>
    );

    await user.click(screen.getByText('Start Setup'));
    // Mock API response would be needed here
    // expect(screen.getByAltText('2FA QR Code')).toBeInTheDocument();
  });

  it('should verify TOTP code', async () => {
    const user = userEvent.setup();
    const onSetupComplete = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <TwoFactorSetup onSetupComplete={onSetupComplete} />
      </QueryClientProvider>
    );

    // Navigate to verify step
    // Enter code and click verify
    // Check onSetupComplete was called
  });
});
```

### E2E Tests with Cypress

```typescript
describe('2FA Flow', () => {
  beforeEach(() => {
    cy.visit('/login');
  });

  it('should complete full 2FA setup flow', () => {
    // Login
    cy.get('input[placeholder="Email"]').type('user@example.com');
    cy.get('input[placeholder="Password"]').type('password123');
    cy.get('button').contains('Sign In').click();

    // Go to settings
    cy.visit('/settings/security');

    // Enable 2FA
    cy.get('button').contains('Enable 2FA').click();
    cy.get('button').contains('Start Setup').click();

    // Scan QR code (simulated)
    cy.get('button').contains("I've Scanned the Code").click();

    // Enter code
    cy.get('input[placeholder="000000"]').type('123456');
    cy.get('button').contains('Verify & Enable').click();

    // Should show recovery codes
    cy.get('h2').contains('2FA Enabled!');
    cy.get('.recovery-codes-list').should('be.visible');
  });

  it('should complete 2FA login flow', () => {
    // ... setup 2FA first ...

    // Login
    cy.get('input[placeholder="Email"]').type('user@example.com');
    cy.get('input[placeholder="Password"]').type('password123');
    cy.get('button').contains('Sign In').click();

    // 2FA verification
    cy.get('h2').contains('Verify Your Identity');
    cy.get('input[placeholder="000000"]').type('654321');
    cy.get('button').contains('Verify').click();

    // Should be logged in
    cy.url().should('include', '/dashboard');
  });
});
```

---

## Common Issues

### Issue: "Cannot find module '@/hooks/use2FA'"

**Solution:** Make sure:
1. TypeScript paths are configured in `tsconfig.json`
2. The hook file is in the correct location
3. You've run `npm install` to install dependencies

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### Issue: QR Code not displaying

**Solution:**
1. Ensure `speakeasy` and `qrcode` packages are installed on backend
2. Backend must be running and accessible at `http://localhost:3001`
3. Check browser console for CORS errors
4. Verify API response includes `qrCodeUrl` field

```bash
npm install speakeasy qrcode  # Backend
```

### Issue: "Failed to verify 2FA - sessionToken expired"

**Solution:**
1. Ensure user completes 2FA within 10 minutes of login
2. Session tokens are stored in `sessionStorage` (not persistent)
3. If session expires, user must login again

### Issue: Recovery codes not working

**Solutions:**
- Ensure code format is correct: `XXXX-XXXX`
- Codes are case-insensitive
- Each code can only be used once
- Check backend logs for hashing issues

### Issue: State not persisting across page reloads

**Solution:** Use `localStorage` for non-sensitive data:

```tsx
// In useAuth hook
useEffect(() => {
  // Save auth state
  localStorage.setItem('auth', JSON.stringify({ user, token }));
}, [user, token]);

// On mount
useEffect(() => {
  const saved = localStorage.getItem('auth');
  if (saved) {
    setAuth(JSON.parse(saved));
  }
}, []);
```

### Issue: TOTP codes always failing

**Solutions:**
1. Check server and client clocks are synchronized
2. Ensure correct secret is being used
3. Try with time window of ±1 (already configured)
4. Use recovery code as fallback if available

---

## Best Practices

### 1. Security

✅ **DO:**
- Store tokens in httpOnly cookies (done in backend)
- Clear auth state on logout
- Validate all inputs on frontend
- Use HTTPS in production

❌ **DON'T:**
- Store sensitive data in localStorage
- Log user tokens/secrets
- Display secrets in UI (except for recovery codes with warning)

### 2. UX

✅ **DO:**
- Show clear error messages
- Provide recovery code fallback
- Display loading states
- Allow users to cancel operations

❌ **DON'T:**
- Require 2FA on every request
- Timeout 2FA without warning
- Force 2FA for guest users

### 3. Performance

✅ **DO:**
- Use React Query for state management
- Cache 2FA status
- Lazy load 2FA components
- Debounce input fields

❌ **DON'T:**
- Fetch 2FA status on every render
- Refetch unnecessarily
- Block UI during verification

---

## Next Steps

1. **Copy all components** from `frontend-2fa-implementation.tsx`
2. **Install dependencies:** `npm install speakeasy qrcode` (backend only)
3. **Update routes:** Add `/settings/security` page
4. **Test thoroughly:** Use provided test examples
5. **Deploy:** Ensure both frontend and backend are deployed

---

## Support

For issues or questions:
- Check browser console for errors
- Review backend logs
- See troubleshooting section above
- Refer to TWO_FACTOR_AUTH_GUIDE.md for backend details

---

**Status:** ✅ Ready for Implementation
