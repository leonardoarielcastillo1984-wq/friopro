# ⚡ Quick Integration Guide - Frontend 2FA

**Status:** All components extracted and ready to copy ✅
**Archivos creados:** 8 archivos + 1 guía de CSS

---

## 📁 Estructura de Archivos Creados

```
/mnt/SGI 360/
├── hooks/
│   ├── use2FA.ts                    ← Copy to: src/hooks/use2FA.ts
│   └── useAuth.ts                   ← Copy to: src/hooks/useAuth.ts
├── components/
│   ├── TwoFactorSetup.tsx           ← Copy to: src/components/TwoFactorSetup.tsx
│   ├── TwoFactorStatus.tsx          ← Copy to: src/components/TwoFactorStatus.tsx
│   └── TwoFactorDisable.tsx         ← Copy to: src/components/TwoFactorDisable.tsx
├── pages/
│   ├── LoginWith2FA.tsx             ← Copy to: src/pages/LoginWith2FA.tsx
│   └── Settings/
│       └── TwoFactorSettings.tsx    ← Copy to: src/pages/Settings/TwoFactorSettings.tsx
└── styles/
    └── 2fa.css                      ← Copy to: src/styles/2fa.css (o importar en main.css)
```

---

## 🚀 Pasos de Integración (15 minutos)

### Paso 1: Copiar archivos de hooks (2 min)

```bash
# Desde /mnt/SGI 360/
cp hooks/use2FA.ts tu-proyecto/src/hooks/
cp hooks/useAuth.ts tu-proyecto/src/hooks/
```

**Nota:** Si ya tienes `useAuth.ts`, reemplázalo con la versión nueva que incluye 2FA.

### Paso 2: Copiar componentes (3 min)

```bash
cp components/TwoFactorSetup.tsx tu-proyecto/src/components/
cp components/TwoFactorStatus.tsx tu-proyecto/src/components/
cp components/TwoFactorDisable.tsx tu-proyecto/src/components/
```

### Paso 3: Copiar páginas (3 min)

```bash
cp pages/LoginWith2FA.tsx tu-proyecto/src/pages/
mkdir -p tu-proyecto/src/pages/Settings
cp pages/Settings/TwoFactorSettings.tsx tu-proyecto/src/pages/Settings/
```

### Paso 4: Copiar CSS (2 min)

```bash
cp styles/2fa.css tu-proyecto/src/styles/
```

Luego, importa en tu archivo principal (main.tsx, App.tsx, etc):

```typescript
import '@/styles/2fa.css';
```

### Paso 5: Actualizar las rutas (3 min)

En tu archivo de routing (router.tsx, App.tsx, etc):

```typescript
import { LoginWith2FA } from '@/pages/LoginWith2FA';
import { TwoFactorSettings } from '@/pages/Settings/TwoFactorSettings';

export const routes = [
  // ... otras rutas

  // Reemplazar la ruta de login existente
  {
    path: '/login',
    element: <LoginWith2FA onLoginSuccess={() => navigate('/dashboard')} />,
  },

  // Agregar ruta de settings de seguridad
  {
    path: '/settings/security',
    element: <TwoFactorSettings />,
    // Requires authenticated user
  },

  // ... más rutas
];
```

---

## ✅ Checklist de Integración

- [ ] Archivos de hooks copiados
- [ ] Componentes copiados
- [ ] Páginas copiadas
- [ ] CSS importado
- [ ] Rutas actualizadas
- [ ] Sin errores de import en IDE
- [ ] Frontend compila sin errores

---

## 🔗 Dependencias Requeridas

Verifica que tengas instaladas:

```bash
npm list @tanstack/react-query
npm list react
npm list react-dom
```

Si faltan:

```bash
npm install @tanstack/react-query@latest
```

---

## 🧪 Verificar que todo funciona

### 1. Compilación sin errores

```bash
npm run build
# o
npm run dev
```

Debería compilar sin errores.

### 2. Verificar imports en IDE

Abre `src/pages/LoginWith2FA.tsx` en tu editor. No debería haber líneas rojas en los imports:

```typescript
import { useAuth } from '@/hooks/useAuth';
import { useVerify2FA } from '@/hooks/use2FA';
```

### 3. Verificar rutas

Las rutas `/login` y `/settings/security` deberían cargar sin errores.

---

## 🔄 Workflow Recomendado

1. ✅ Copiar archivos (15 min)
2. ⏳ **Desplegar backend a staging** (30 min)
3. ⏳ Probar login normal SIN 2FA
4. ⏳ Probar setup de 2FA en settings
5. ⏳ Probar login CON 2FA habilitado
6. ⏳ Tests unitarios (opcional)
7. ⏳ Tests E2E (opcional)

---

## ❓ Troubleshooting Común

### Error: "Cannot find module '@/hooks/use2FA'"

**Solución:** Asegúrate que la ruta alias `@` está configurada en tu `tsconfig.json` o `vite.config.ts`.

Debería ser algo como:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

### Error: "useQuery is not exported from @tanstack/react-query"

**Solución:** Instala la versión correcta:

```bash
npm install @tanstack/react-query@^5.0.0
```

### Estilos no se aplican

**Solución:** Asegúrate que importas el CSS:

```typescript
// En tu main.tsx o App.tsx
import '@/styles/2fa.css';
```

Y que React está aplicando los estilos (verifica en DevTools).

---

## 📝 Importes en cada archivo

Para referencia, aquí están los imports que necesita cada archivo:

**use2FA.ts:**
```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
```

**useAuth.ts:**
```typescript
import { useState, useCallback } from 'react';
```

**TwoFactorSetup.tsx:**
```typescript
import React, { useState } from 'react';
import { useEnable2FA, useConfirm2FA } from '@/hooks/use2FA';
```

**TwoFactorStatus.tsx:**
```typescript
import React from 'react';
import { use2FAStatus } from '@/hooks/use2FA';
```

**TwoFactorDisable.tsx:**
```typescript
import React, { useState } from 'react';
import { useDisable2FA } from '@/hooks/use2FA';
```

**LoginWith2FA.tsx:**
```typescript
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useVerify2FA } from '@/hooks/use2FA';
```

**TwoFactorSettings.tsx:**
```typescript
import React, { useState } from 'react';
import { TwoFactorSetup } from '@/components/TwoFactorSetup';
import { TwoFactorStatus } from '@/components/TwoFactorStatus';
import { TwoFactorDisable } from '@/components/TwoFactorDisable';
import { use2FAStatus, useGenerateRecoveryCodes } from '@/hooks/use2FA';
```

---

## 📊 Resumen

| Elemento | Archivos | Estado |
|----------|----------|--------|
| Hooks | 2 | ✅ Listos |
| Componentes | 3 | ✅ Listos |
| Páginas | 2 | ✅ Listos |
| CSS | 1 | ✅ Listos |
| **Total** | **8** | **✅ Completo** |

---

## ⏭️ Próximos pasos

1. **Desplegar backend a staging** (seguir DEPLOYMENT_STAGING_GUIDE.md)
2. Copiar estos archivos al proyecto
3. Actualizar rutas
4. Probar login sin 2FA
5. Probar setup y login con 2FA
6. Escribir tests

---

**Todo está listo para integrar. ¡Comienza con el deployment del backend!** 🚀
