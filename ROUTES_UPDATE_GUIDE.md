# 🛣️ PASO 3: Actualizar Rutas React

**Tiempo:** 5-10 minutos
**Cambios:** 2 rutas principales

---

## 🎯 Objetivo

- ✅ Reemplazar página de login con `LoginWith2FA`
- ✅ Agregar nueva ruta `/settings/security` para 2FA settings

---

## 📍 Encontrar Archivo de Rutas

**Tu archivo de rutas puede estar en:**

```
tu-proyecto/src/
├── App.tsx                    ← Si las rutas están aquí
├── router.tsx                 ← Si usas React Router así
├── routes.tsx
├── routes/
│   └── index.tsx
├── config/
│   └── routes.ts
└── vite-env.d.ts
```

**Para encontrarlo:**
```bash
# Busca donde están definidas las rutas
grep -r "path.*login" tu-proyecto/src/ --include="*.tsx" --include="*.ts"

# O si usas React Router:
grep -r "Route" tu-proyecto/src/ --include="*.tsx" | grep -i "login"
```

---

## 🔄 Opción A: React Router (v6) - Más Común

### Antes (Actual)

```typescript
// src/router.tsx o src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/Login';  // O similar
import { Dashboard } from '@/pages/Dashboard';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        {/* ... otras rutas */}
      </Routes>
    </BrowserRouter>
  );
}
```

### Después (Con 2FA)

```typescript
// src/router.tsx o src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginWith2FA } from '@/pages/LoginWith2FA';          // ← NEW
import { TwoFactorSettings } from '@/pages/Settings/TwoFactorSettings';  // ← NEW
import { Dashboard } from '@/pages/Dashboard';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Reemplazar login existente */}
        <Route
          path="/login"
          element={<LoginWith2FA onLoginSuccess={() => window.location.href = '/dashboard'} />}
        />

        {/* Agregar nueva ruta de settings */}
        <Route
          path="/settings/security"
          element={<TwoFactorSettings />}
        />

        <Route path="/dashboard" element={<Dashboard />} />
        {/* ... otras rutas */}
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 🔄 Opción B: React Router con Array de Rutas

### Antes

```typescript
// src/config/routes.ts
export const routes = [
  { path: '/login', element: <LoginPage />, layout: 'blank' },
  { path: '/dashboard', element: <Dashboard />, layout: 'default' },
  // ... más rutas
];
```

### Después

```typescript
// src/config/routes.ts
import { LoginWith2FA } from '@/pages/LoginWith2FA';
import { TwoFactorSettings } from '@/pages/Settings/TwoFactorSettings';

export const routes = [
  {
    path: '/login',
    element: <LoginWith2FA onLoginSuccess={() => navigate('/dashboard')} />,
    layout: 'blank'
  },
  {
    path: '/settings/security',
    element: <TwoFactorSettings />,
    layout: 'default',
    requiresAuth: true  // Si usas protección de rutas
  },
  { path: '/dashboard', element: <Dashboard />, layout: 'default' },
  // ... más rutas
];
```

---

## 🔄 Opción C: Next.js App Router

### Antes (`app/login/page.tsx`)

```typescript
// app/login/page.tsx
import { LoginPage } from '@/components/LoginPage';

export default function LoginPageRoute() {
  return <LoginPage />;
}
```

### Después (`app/login/page.tsx`)

```typescript
// app/login/page.tsx
'use client';

import { LoginWith2FA } from '@/pages/LoginWith2FA';
import { useRouter } from 'next/navigation';

export default function LoginPageRoute() {
  const router = useRouter();

  return (
    <LoginWith2FA
      onLoginSuccess={() => router.push('/dashboard')}
    />
  );
}
```

### Agregar Settings (`app/settings/security/page.tsx`)

```typescript
// app/settings/security/page.tsx
'use client';

import { TwoFactorSettings } from '@/pages/Settings/TwoFactorSettings';

export default function SecuritySettingsPage() {
  return <TwoFactorSettings />;
}
```

---

## 🔄 Opción D: Vite + React Router Simple

### Antes

```typescript
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// src/App.tsx
export default function App() {
  const [page, setPage] = useState('login');

  return (
    <>
      {page === 'login' && <LoginPage setPage={setPage} />}
      {page === 'dashboard' && <Dashboard setPage={setPage} />}
    </>
  );
}
```

### Después

```typescript
// src/App.tsx
'use client';

import { useState } from 'react';
import { LoginWith2FA } from '@/pages/LoginWith2FA';
import { TwoFactorSettings } from '@/pages/Settings/TwoFactorSettings';
import { Dashboard } from '@/pages/Dashboard';

export default function App() {
  const [page, setPage] = useState('login');

  return (
    <>
      {page === 'login' && (
        <LoginWith2FA
          onLoginSuccess={() => setPage('dashboard')}
        />
      )}
      {page === 'dashboard' && (
        <Dashboard
          onSecurityClick={() => setPage('security')}
          setPage={setPage}
        />
      )}
      {page === 'security' && (
        <TwoFactorSettings />
      )}
    </>
  );
}
```

---

## 🎯 Resumen de Cambios

| Cambio | Antes | Después |
|--------|-------|---------|
| Import | `import { LoginPage }` | `import { LoginWith2FA }` |
| Ruta /login | `<LoginPage />` | `<LoginWith2FA onLoginSuccess={...} />` |
| Nueva ruta | N/A | `/settings/security` → `<TwoFactorSettings />` |

---

## ✅ Checklist

- [ ] Encontré mi archivo de rutas
- [ ] Importé `LoginWith2FA`
- [ ] Importé `TwoFactorSettings`
- [ ] Reemplacé `/login` route
- [ ] Agregué `/settings/security` route
- [ ] Compilación sin errores
- [ ] Ruta `/login` carga sin errores
- [ ] Ruta `/settings/security` carga sin errores

---

## 🧪 Prueba Rápida

```bash
npm run dev
```

1. Abre http://localhost:3000/login
   - ✓ Debería mostrar login form con inputs para email/password

2. Abre http://localhost:3000/settings/security
   - ✓ Debería mostrar "Security Settings" y estado 2FA (Disabled)

---

## 📞 Si hay Errores

### Error: "Cannot find module '@/pages/LoginWith2FA'"

```
Solución: Verificar que:
1. El archivo existe en src/pages/LoginWith2FA.tsx
2. La ruta alias @ está configurada en tsconfig.json
```

### Error: "Component not rendering"

```
Solución: Verificar que:
1. El componente se importó correctamente
2. No hay typos en el nombre
3. La ruta está configurada correctamente
```

### Error: "onLoginSuccess is not a function"

```
Solución: Pasar callback correcto:
<LoginWith2FA onLoginSuccess={() => navigate('/dashboard')} />
```

---

## 🎯 Próximo Paso

Una vez que ambas rutas funcionan:

**PASO 4: Testing Manual**
1. Login normal (sin 2FA)
2. Setup 2FA en settings
3. Login con 2FA
4. Recovery codes

Ver: `MANUAL_TESTING_GUIDE.md`

---

**¿Rutas actualizadas y compilando?** → Vamos a PASO 4! 🚀
