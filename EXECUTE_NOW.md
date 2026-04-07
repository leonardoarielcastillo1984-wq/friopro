# ⚡ EJECUTA AHORA - Paso a Paso

**Tiempo total:** 30 minutos
**Resultado:** 2FA funcionando en staging + local

---

## 🎯 Paso 1: Copiar Archivos (10 min)

```bash
# En terminal, en la raíz de tu proyecto
cd tu-proyecto

# Opción A: Script automático (Recomendado)
bash /mnt/SGI\ 360/install-frontend-2fa.sh $(pwd)

# Opción B: Manual (si Script no funciona)
cp -r /mnt/SGI\ 360/hooks/* src/hooks/ 2>/dev/null || (mkdir -p src/hooks && cp -r /mnt/SGI\ 360/hooks/* src/hooks/)
cp -r /mnt/SGI\ 360/components/* src/components/ 2>/dev/null || (mkdir -p src/components && cp -r /mnt/SGI\ 360/components/* src/components/)
mkdir -p src/pages/Settings && cp /mnt/SGI\ 360/pages/LoginWith2FA.tsx src/pages/ && cp /mnt/SGI\ 360/pages/Settings/TwoFactorSettings.tsx src/pages/Settings/
cp /mnt/SGI\ 360/styles/2fa.css src/styles/ 2>/dev/null || (mkdir -p src/styles && cp /mnt/SGI\ 360/styles/2fa.css src/styles/)

# Verificar que se copió todo
ls -la src/hooks/use2FA.ts && echo "✓ Hooks OK"
ls -la src/components/TwoFactorSetup.tsx && echo "✓ Componentes OK"
ls -la src/pages/LoginWith2FA.tsx && echo "✓ Páginas OK"
ls -la src/styles/2fa.css && echo "✓ CSS OK"
```

✓ **Cuando veas:** 4 líneas con "✓ OK"

---

## 🎯 Paso 2: Importar CSS (1 min)

Abre `src/main.tsx` (o `src/App.tsx`):

```typescript
// AGREGAR ESTA LÍNEA al inicio del archivo
import '@/styles/2fa.css';

// Resto del código...
```

---

## 🎯 Paso 3: Actualizar Rutas (5 min)

**Encuentra tu archivo de rutas** (uno de estos):
- `src/router.tsx`
- `src/App.tsx`
- `src/config/routes.ts`

### Si es React Router (v6):

Busca:
```typescript
<Route path="/login" element={<LoginPage />} />
```

Reemplaza con:
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

### Si es Next.js:

Actualiza `app/login/page.tsx`:
```typescript
'use client';
import { LoginWith2FA } from '@/pages/LoginWith2FA';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  return <LoginWith2FA onLoginSuccess={() => router.push('/dashboard')} />;
}
```

Crea `app/settings/security/page.tsx`:
```typescript
'use client';
import { TwoFactorSettings } from '@/pages/Settings/TwoFactorSettings';

export default function SecurityPage() {
  return <TwoFactorSettings />;
}
```

---

## 🎯 Paso 4: Compilar (3 min)

```bash
# En raíz del proyecto
npm run dev
```

**Esperado:**
```
✓ ready in 500ms
✓ Local:   http://localhost:5173/
```

Si hay errores, verifica:
- [ ] Todos los archivos copiados correctamente
- [ ] Alias @ configurado en `tsconfig.json`
- [ ] Rutas actualizadas correctamente

---

## 🎯 Paso 5: Probar URLs (2 min)

Abre navegador:

```
1. http://localhost:3000/login (o tu puerto)
   ✓ Debería mostrar formulario de login

2. http://localhost:3000/settings/security
   ✓ Debería mostrar "Security Settings"
```

Si ambas cargan sin errores → ✅ **Frontend listo!**

---

## 🧪 Paso 6: Testing Manual (10 min)

### Test rápido:

```
1. Login con credenciales de test
   Email: test@example.com
   Password: Test123!@#
   ✓ Debería entrar al dashboard

2. Ve a /settings/security
   ✓ Debería mostrar "2FA Disabled"

3. Click "Enable 2FA"
   ✓ Debería mostrar QR code
   ✓ Scan con authenticator app o usa secret manualmente

4. Entra el código de 6 dígitos
   ✓ Debería mostrar recovery codes

5. Logout y relogin
   ✓ Debería pedir código 2FA

6. Entra el código
   ✓ Debería loguear exitosamente
```

Ver guía completa: `MANUAL_TESTING_GUIDE.md`

---

## ✅ Checklist Final

- [ ] Archivos copiados (8 archivos)
- [ ] CSS importado en main
- [ ] Rutas actualizadas (/login + /settings/security)
- [ ] Compila sin errores (`npm run dev`)
- [ ] URLs cargan sin errores
- [ ] Login funciona
- [ ] Settings/security carga
- [ ] Backend está corriendo en staging

---

## 🎉 Si todo funciona

```
✅ BACKEND:     Deployado en Docker en staging
✅ FRONTEND:    Integrado en proyecto local
✅ RUTAS:       /login y /settings/security funcionan
✅ CSS:         Importado y aplicado
✅ TESTING:     Flujo 2FA completo validado

LISTO PARA:     NEXT STEPS (Tests, Producción, etc.)
```

---

## 📚 Guías Completas

Si necesitas más detalles:

```
✅ FRONTEND_COPY_GUIDE.md      → Cómo copiar archivos (detallado)
✅ ROUTES_UPDATE_GUIDE.md      → Actualizar rutas (4 opciones)
✅ MANUAL_TESTING_GUIDE.md     → Tests completos
✅ DOCKER_DEPLOYMENT_GUIDE.md  → Deployment backend
```

---

## ⚡ TL;DR (Muy Rápido)

```bash
# Terminal 1: Copiar archivos
bash /mnt/SGI\ 360/install-frontend-2fa.sh $(pwd)

# Terminal 1: Actualizar rutas en src/router.tsx
# (Copiar 4 líneas del PASO 3 arriba)

# Terminal 1: Importar CSS en src/main.tsx
# (Agregar 1 línea)

# Terminal 1: Compilar
npm run dev

# Terminal 2: Abrir navegador
# http://localhost:3000/login
# http://localhost:3000/settings/security

# Listo! ✅
```

---

## ❓ ¿Dudas?

**Problema:** Error de import
**Solución:** Verificar archivos copiados en carpetas correctas

**Problema:** Rutas no funcionan
**Solución:** Verificar que actualizaste `src/router.tsx` (o similar) correctamente

**Problema:** 2FA no funciona
**Solución:** Verificar que backend está corriendo en staging

---

**¿Listo?** 👉 **Ejecuta los 6 pasos arriba** 🚀

Cuando termines:
1. Avísame que todo funciona ✅
2. Vamos con tests automatizados (opcional)
3. Preparamos para producción
