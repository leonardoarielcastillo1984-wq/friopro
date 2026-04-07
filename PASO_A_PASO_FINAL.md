# 📋 PASO A PASO - Implementación Completa 2FA

**Sigue estos pasos en orden. Sin saltarse nada.**

---

## 🎯 FASE 1: SETUP INICIAL (30 min)

### PASO 1: Abre Terminal en tu Proyecto

```bash
cd tu-proyecto
```

✅ Verifica que estés en la carpeta correcta

---

### PASO 2: Ejecuta Script de Copia Automática

```bash
bash /mnt/SGI\ 360/COMPLETE_SETUP.sh $(pwd) https://staging-api.sgi360.com
```

✅ Espera a que termine
✅ Debería mostrar: "✅ Instalación completada!"

---

### PASO 3: Actualiza package.json

Abre `package.json` en tu editor y agrega en la sección `"scripts"`:

```json
"scripts": {
  "test": "vitest",
  "test:unit": "vitest run",
  "test:e2e": "cypress run",
  "test:coverage": "vitest run --coverage",
  "type-check": "tsc --noEmit",
  "lint": "eslint src --ext .ts,.tsx",
  "lint:fix": "eslint src --ext .ts,.tsx --fix",
  "deploy:prod": "bash /mnt/SGI\\ 360/deploy-production.sh"
}
```

✅ Guarda el archivo

---

### PASO 4: Instala Dependencias para Tests

```bash
npm install --save-dev \
  @testing-library/react \
  @testing-library/jest-dom \
  @vitejs/plugin-react \
  @vitest/ui \
  cypress \
  vitest \
  happy-dom \
  jsdom
```

✅ Espera a que termine

---

### PASO 5: Importa CSS en tu main.tsx

Abre `src/main.tsx` y agrega en la PRIMERA línea:

```typescript
import '@/styles/2fa.css';
```

Debería verse así:

```typescript
import '@/styles/2fa.css';  // ← AGREGAR ESTA LÍNEA
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
// ... resto del código
```

✅ Guarda

---

### PASO 6: Actualiza Rutas

**Abre tu archivo de rutas** (busca uno de estos):
- `src/router.tsx`
- `src/App.tsx`
- `src/config/routes.ts`

**Busca la ruta de login:**

```typescript
<Route path="/login" element={<LoginPage />} />
```

**Reemplázala con:**

```typescript
import { LoginWith2FA } from '@/pages/LoginWith2FA';
import { TwoFactorSettings } from '@/pages/Settings/TwoFactorSettings';

// ... dentro de <Routes>
<Route
  path="/login"
  element={<LoginWith2FA onLoginSuccess={() => navigate('/dashboard')} />}
/>
<Route
  path="/settings/security"
  element={<TwoFactorSettings />}
/>
```

✅ Guarda

---

### PASO 7: Copia Tests

```bash
mkdir -p src/test
cp /mnt/SGI\ 360/tests/* src/test/
```

✅ Tests copiados

---

### PASO 8: Copia CI/CD

```bash
cp -r /mnt/SGI\ 360/.github .
```

✅ GitHub Actions workflow copiado

---

## ✅ FASE 2: VERIFICACIÓN (10 min)

### PASO 9: Compila el Proyecto

```bash
npm run build
```

✅ Debería mostrar: "Build successful" sin errores

---

### PASO 10: Inicia Desarrollo

```bash
npm run dev
```

✅ Debería mostrar: "✓ ready in XXXms"

---

### PASO 11: Prueba URLs en Navegador

**Abre 3 tabs:**

1. `http://localhost:3000/login`
   ✅ Debería mostrar formulario de login

2. `http://localhost:3000/settings/security`
   ✅ Debería mostrar "Security Settings"

3. `http://localhost:3000/`
   ✅ Debería mostrar tu app normal

---

## 🧪 FASE 3: TESTING (20 min)

### PASO 12: Corre Tests Unitarios

```bash
npm run test:unit
```

✅ Debería mostrar los tests ejecutándose
✅ Si hay errores, son normales en pruebas (muchas están comentadas)

---

### PASO 13: Abre Cypress para E2E

```bash
npm run test:e2e:open
```

✅ Se abre Cypress
✅ Selecciona: "2fa.e2e.cy.ts"
✅ Click en "Run all specs"

---

### PASO 14: Testing Manual (IMPORTANTE)

En tu navegador que ya tenías abierto (`npm run dev`):

**Test 1: Login Normal**
```
1. Ve a http://localhost:3000/login
2. Email: test@example.com
3. Password: Test123!@#
4. Click "Sign In"
✅ Debería entrar a dashboard
```

**Test 2: Ve a Settings**
```
1. Ve a http://localhost:3000/settings/security
✅ Debería mostrar "Security Settings"
✅ Status: "Disabled"
```

**Test 3: Enable 2FA**
```
1. Click "Enable 2FA"
✅ Debería mostrar QR code
✅ Click "I've Scanned the Code"
```

**Test 4: Enter TOTP Code**
```
1. Abre app authenticadora (Google Authenticator, Authy)
   O usa terminal:
   node -e "
   const speakeasy = require('speakeasy');
   const code = speakeasy.totp({
     secret: 'JBSWY3DPEBLW64TMMQ======',
     encoding: 'base32'
   });
   console.log('Código:', code);
   "
2. Copia código de 6 dígitos
3. Pégalo en el formulario
✅ Debería validar y mostrar recovery codes
```

**Test 5: Logout y Re-login**
```
1. Busca botón Logout (generalmente en dashboard)
2. Click Logout
3. Login nuevamente con mismo usuario
✅ Debería pedir código 2FA esta vez
✅ Entra código
✅ Debería loguear exitosamente
```

---

## 🚀 FASE 4: DEPLOYMENT (opcional pero recomendado)

### PASO 15: Setup GitHub Actions (para CI/CD automático)

```bash
# Ver que el archivo está ahí
cat .github/workflows/2fa-tests.yml
```

✅ Archivo existe

---

### PASO 16: Push a GitHub

```bash
git add .
git commit -m "feat: Add 2FA implementation with tests and CI/CD

- Implement 2FA components and hooks
- Add unit tests (Jest/Vitest)
- Add E2E tests (Cypress)
- Add GitHub Actions CI/CD pipeline
- Add production deployment script
- Add monitoring setup"

git push origin main
```

✅ Push exitoso
✅ GitHub Actions debería ejecutar automáticamente

---

### PASO 17: Ver Tests en GitHub (opcional)

1. Ve a tu repo en GitHub
2. Click en "Actions"
3. Debería ver "2FA Tests & Build" ejecutándose
4. Espera a que termine

✅ Todos los tests pasando

---

## 📊 FASE 5: DEPLOYMENT A PRODUCCIÓN (cuando esté listo)

### PASO 18: Deployment Script

Cuando todo esté listo en staging y quieras ir a producción:

```bash
bash /mnt/SGI\ 360/deploy-production.sh \
  https://api.sgi360.com \
  https://app.sgi360.com \
  tu-docker-registry
```

✅ Script maneja todo automáticamente

---

## ✅ CHECKLIST FINAL

- [ ] Paso 1: Terminal abierto en proyecto
- [ ] Paso 2: Script COMPLETE_SETUP.sh ejecutado
- [ ] Paso 3: package.json actualizado
- [ ] Paso 4: Dependencias instaladas
- [ ] Paso 5: CSS importado
- [ ] Paso 6: Rutas actualizadas
- [ ] Paso 7: Tests copiados
- [ ] Paso 8: CI/CD copiado
- [ ] Paso 9: Build exitoso
- [ ] Paso 10: npm run dev ejecutándose
- [ ] Paso 11: URLs funcionan
- [ ] Paso 12: Tests unitarios ejecutados
- [ ] Paso 13: Cypress abierto
- [ ] Paso 14: Tests manuales completados
- [ ] Paso 15: GitHub Actions setup
- [ ] Paso 16: Push a GitHub
- [ ] Paso 17: GitHub Actions ejecutado (opcional)

---

## 🎯 Si algo falla

**Error: "Cannot find module '@/hooks/use2FA'"**
→ Verifica que usaste COMPLETE_SETUP.sh
→ Asegúrate que alias @ está en tsconfig.json

**Error: "Build failed"**
→ Lee el error exacto
→ Verifica imports en rutas
→ Revisa que tsconfig.json está correcto

**Error: "Login no funciona"**
→ Verifica que backend está corriendo en staging
→ Abre console (F12) para ver errores
→ Verifica DATABASE_URL y JWT_SECRET

**Tests faily**
→ Lee el error específico
→ Muchos tests tienen dependencias (necesitan usuario real)
→ Enfócate en que compilación sea correcta

---

## 📞 Cuando termines TODO

Dime:

**✅ Completé todos los pasos**

Y luego:
- Te diré si todo se ve bien
- Podemos debuggear si hay errores
- Discutimos deployment a producción

---

## ⏱️ Tiempo Total

- Fase 1 (Setup): 30 min
- Fase 2 (Verificación): 10 min
- Fase 3 (Testing): 20 min
- Fase 4 (GitHub): 5 min
- **TOTAL: ~65 minutos**

---

**¿Empezamos? Abre terminal y ejecuta PASO 1 ahora** 👉

```bash
cd tu-proyecto
```

Cuando termines, dime qué paso completaste ✅
