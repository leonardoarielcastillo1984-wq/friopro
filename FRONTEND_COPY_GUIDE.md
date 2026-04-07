# 📂 PASO 2: Copiar Componentes React - Guía Visual

**Tiempo:** 15 minutos
**Archivos a copiar:** 8
**Verificación:** Incluida

---

## 📊 Estructura de Carpetas

**Desde:** `/mnt/SGI 360/`
**Hacia:** Tu proyecto React `tu-proyecto/src/`

```
/mnt/SGI 360/                          Tu proyecto (src/)
├── hooks/
│   ├── use2FA.ts             ──→      src/hooks/use2FA.ts
│   └── useAuth.ts            ──→      src/hooks/useAuth.ts
├── components/
│   ├── TwoFactorSetup.tsx    ──→      src/components/TwoFactorSetup.tsx
│   ├── TwoFactorStatus.tsx   ──→      src/components/TwoFactorStatus.tsx
│   └── TwoFactorDisable.tsx  ──→      src/components/TwoFactorDisable.tsx
├── pages/
│   ├── LoginWith2FA.tsx      ──→      src/pages/LoginWith2FA.tsx
│   └── Settings/
│       └── TwoFactorSettings.tsx  ──→ src/pages/Settings/TwoFactorSettings.tsx
└── styles/
    └── 2fa.css               ──→      src/styles/2fa.css
```

---

## 🚀 Paso 1: Copiar Hooks (2 min)

### 1️⃣ Copiar `use2FA.ts`

```bash
# Opción A: Desde terminal
cp /mnt/SGI\ 360/hooks/use2FA.ts tu-proyecto/src/hooks/

# Opción B: Manual
# 1. Abre tu editor (VS Code, etc.)
# 2. Abre /mnt/SGI 360/hooks/use2FA.ts
# 3. Copia todo el contenido (Ctrl+A → Ctrl+C)
# 4. Crea archivo en tu-proyecto/src/hooks/use2FA.ts
# 5. Pega contenido (Ctrl+V)
```

✓ **Resultado esperado:** Archivo `tu-proyecto/src/hooks/use2FA.ts` existe

---

### 2️⃣ Copiar `useAuth.ts` (REEMPLAZA SI EXISTE)

```bash
# Terminal
cp /mnt/SGI\ 360/hooks/useAuth.ts tu-proyecto/src/hooks/

# O manual (como arriba)
# ⚠️ Si ya tienes useAuth.ts, este lo reemplaza (es la versión con 2FA)
```

✓ **Resultado esperado:** Archivo `tu-proyecto/src/hooks/useAuth.ts` con 2FA support

---

## 🎨 Paso 2: Copiar Componentes (3 min)

### 3️⃣ Copiar `TwoFactorSetup.tsx`

```bash
cp /mnt/SGI\ 360/components/TwoFactorSetup.tsx tu-proyecto/src/components/
```

✓ Archivo copiado

---

### 4️⃣ Copiar `TwoFactorStatus.tsx`

```bash
cp /mnt/SGI\ 360/components/TwoFactorStatus.tsx tu-proyecto/src/components/
```

✓ Archivo copiado

---

### 5️⃣ Copiar `TwoFactorDisable.tsx`

```bash
cp /mnt/SGI\ 360/components/TwoFactorDisable.tsx tu-proyecto/src/components/
```

✓ Archivo copiado

---

## 📄 Paso 3: Copiar Páginas (3 min)

### 6️⃣ Copiar `LoginWith2FA.tsx`

```bash
cp /mnt/SGI\ 360/pages/LoginWith2FA.tsx tu-proyecto/src/pages/
```

✓ Archivo copiado

---

### 7️⃣ Copiar `TwoFactorSettings.tsx` (crear carpeta Settings)

```bash
# Primero crear carpeta si no existe
mkdir -p tu-proyecto/src/pages/Settings

# Copiar archivo
cp /mnt/SGI\ 360/pages/Settings/TwoFactorSettings.tsx tu-proyecto/src/pages/Settings/
```

✓ Archivo copiado en carpeta Settings

---

## 🎨 Paso 4: Copiar Estilos CSS (2 min)

### 8️⃣ Copiar `2fa.css`

```bash
cp /mnt/SGI\ 360/styles/2fa.css tu-proyecto/src/styles/
```

✓ Archivo copiado

---

## ✅ Verificación de Imports (2 min)

Abre tu editor (VS Code, etc.) y verifica que NO hay líneas rojas:

### Archivo: `src/hooks/use2FA.ts`
```typescript
import { useMutation, useQuery } from '@tanstack/react-query';
// ↑ No debe tener línea roja
```

### Archivo: `src/hooks/useAuth.ts`
```typescript
import { useState, useCallback } from 'react';
// ↑ No debe tener línea roja
```

### Archivo: `src/components/TwoFactorSetup.tsx`
```typescript
import React, { useState } from 'react';
import { useEnable2FA, useConfirm2FA } from '@/hooks/use2FA';
// ↑ use2FA importado correctamente
```

### Archivo: `src/pages/LoginWith2FA.tsx`
```typescript
import { useAuth } from '@/hooks/useAuth';
import { useVerify2FA } from '@/hooks/use2FA';
// ↑ Ambos importados correctamente
```

**Si hay líneas rojas:**
```
Posible problema: Ruta alias @ no configurada
Solución: Verificar tsconfig.json o vite.config.ts
```

---

## 🔧 Paso 5: Importar CSS en main (1 min)

En tu archivo principal (`src/main.tsx`, `src/App.tsx`, o similar):

```typescript
// Agregar esta línea al inicio
import '@/styles/2fa.css';

// Resto del código...
```

O si prefieres en tu HTML:
```html
<!-- En index.html, dentro de <head> -->
<link rel="stylesheet" href="/src/styles/2fa.css">
```

---

## 🧪 Paso 6: Compilar y Verificar (1 min)

```bash
# En raíz del proyecto
npm run build
# O para desarrollo:
npm run dev
```

**Esperado:**
```
✓ Build successful (sin errores)
```

**Si hay errores:**
```
❌ Cannot find module '@/hooks/use2FA'
→ Verificar que los archivos están en las carpetas correctas
```

---

## 📋 Checklist Final

- [ ] `src/hooks/use2FA.ts` copiado
- [ ] `src/hooks/useAuth.ts` copiado (reemplazó viejo)
- [ ] `src/components/TwoFactorSetup.tsx` copiado
- [ ] `src/components/TwoFactorStatus.tsx` copiado
- [ ] `src/components/TwoFactorDisable.tsx` copiado
- [ ] `src/pages/LoginWith2FA.tsx` copiado
- [ ] `src/pages/Settings/TwoFactorSettings.tsx` copiado
- [ ] `src/styles/2fa.css` copiado
- [ ] CSS importado en main
- [ ] Compilación sin errores

---

## 🎯 Próximo Paso

Una vez que TODO está copiado y compila:

**PASO 3: Actualizar Rutas**
- Reemplazar `/login` con `LoginWith2FA`
- Agregar `/settings/security`

Ver: `ROUTES_UPDATE_GUIDE.md`

---

## 💡 Tips

**Para copiar rápido desde terminal:**

```bash
# Copiar todos los archivos de una vez
cp -r /mnt/SGI\ 360/hooks/* tu-proyecto/src/hooks/
cp -r /mnt/SGI\ 360/components/* tu-proyecto/src/components/
cp -r /mnt/SGI\ 360/pages/* tu-proyecto/src/pages/
cp /mnt/SGI\ 360/styles/2fa.css tu-proyecto/src/styles/
```

**O si usas Visual Studio Code:**
1. File → Open Folder → `/mnt/SGI 360/`
2. Selecciona los archivos
3. Drag & drop a tu proyecto (en otra ventana)

---

**¿Todos los archivos copiados?** → Próximo paso: Actualizar rutas 🚀
