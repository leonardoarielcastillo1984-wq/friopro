# 🧪 PASO 4: Testing Manual - Flujo Completo 2FA

**Tiempo:** 15-20 minutos
**Objetivo:** Verificar que todo funciona end-to-end
**Requisitos:** Backend deployado en staging + Frontend corriendo localmente

---

## ✅ Pre-Testing Checklist

- [ ] Backend está corriendo en staging (healthz responde)
- [ ] Frontend está corriendo localmente (`npm run dev`)
- [ ] Rutas `/login` y `/settings/security` cargan
- [ ] Usuario de test existe en BD (para login)

---

## 🧪 Test 1: Login Normal (Sin 2FA)

**Objetivo:** Verificar que login normal funciona

### Paso 1: Navegar a login
```
1. Abre http://localhost:3000/login (o tu puerto)
2. Debería ver:
   - Título "Sign In"
   - Input para email
   - Input para password
   - Botón "Sign In"
```

### Paso 2: Ingresar credenciales
```
Email: test@example.com (usuario sin 2FA)
Password: Test123!@#
```

### Paso 3: Hacer click en Sign In
```
✓ Esperado:
- No hay mensaje de error
- Se redirige a /dashboard
- Usuario está logueado
```

### ❌ Si falla:
```
Posible problema: API no accesible
- Verificar que backend está corriendo
- Verificar CORS configurado correctamente
- Ver console (F12) para errores
```

---

## 🧪 Test 2: Setup 2FA

**Objetivo:** Habilitar 2FA en cuenta de test

### Paso 1: Ir a Security Settings
```
1. Desde dashboard, ve a /settings/security
   (O busca opción "Security" en menú)

2. Debería ver:
   - Título "Security Settings"
   - Sección "Two-Factor Authentication"
   - Status badge "Disabled"
   - Botón "Enable 2FA"
```

### Paso 2: Click en "Enable 2FA"
```
✓ Debería ver:
- Página de setup
- Botón "Start Setup"
```

### Paso 3: Click en "Start Setup"
```
✓ Debería ver:
- Título "Scan QR Code"
- QR code imagen
- Opción "Can't scan? Enter manually"
```

### Paso 4: Generar código TOTP

**Opción A: Con app autenticadora (Google Authenticator, Authy, etc.)**
```
1. Abre tu app authenticadora
2. Click en + para agregar cuenta
3. Escanea el QR code
4. Copia el código de 6 dígitos que aparece
```

**Opción B: Con terminal (si tienes speakeasy instalado)**
```bash
node -e "
const speakeasy = require('speakeasy');
// Copiar 'secret' de la página
const secret = 'JBSWY3DPEBLW64TMMQ======';
const code = speakeasy.totp({secret, encoding: 'base32'});
console.log('Código 6 dígitos:', code);
"
```

### Paso 5: Ingresar código TOTP
```
1. Click "I've Scanned the Code"
2. Ingresa el código de 6 dígitos
3. Debería validarse automáticamente
4. Click "Verify & Enable"
```

✓ **Esperado:**
```
- Página muestra "✓ 2FA Enabled!"
- Lista de 10 recovery codes
- Botones "Copy All" y "Download as File"
```

### Paso 6: Guardar Recovery Codes
```
1. Click "Copy All" (debería mostrar "✓ Copied!")
2. O "Download as File" para descargar
3. Guarda los códigos en lugar seguro
```

### Paso 7: Finalizar Setup
```
Click "Done"
```

✓ **Debería regresar a settings y mostrar:**
```
- Status badge "✓ Enabled"
- Fecha de activación
- Recovery Codes: 10 remaining (0 used)
- Botones para generar nuevos codes y deshabilitar
```

---

## 🧪 Test 3: Login con 2FA

**Objetivo:** Verificar flujo de login con 2FA habilitado

### Paso 1: Logout
```
1. Desde dashboard, busca botón "Logout"
2. Click logout
3. Debería regresar a /login
```

### Paso 2: Login con email/password
```
Email: test@example.com
Password: Test123!@#
Click "Sign In"
```

✓ **Esperado (diferente de antes):**
```
- Página cambia a "Verify Your Identity"
- Texto: "Enter the 6-digit code from your authenticator app"
- Input para código
- Botón "Verify"
- Link "Use recovery code instead"
```

### Paso 3: Generar nuevo código TOTP
```
Si usas app authenticadora:
- Abre Google Authenticator / Authy
- Busca tu cuenta SGI 360
- Copia el código de 6 dígitos (cambia cada 30 seg)

Si usas terminal:
node -e "
const speakeasy = require('speakeasy');
const code = speakeasy.totp({
  secret: 'JBSWY3DPEBLW64TMMQ======',
  encoding: 'base32'
});
console.log('Nuevo código:', code);
"
```

### Paso 4: Ingresar código TOTP
```
1. Ingresa el código de 6 dígitos
2. Input debería limitar a 6 caracteres
3. Click "Verify" (o espera validación auto)
```

✓ **Esperado:**
```
- Sin mensaje de error
- Se redirige a /dashboard
- Usuario logueado con 2FA
```

### ❌ Si falla con "Invalid code":
```
Causas posibles:
1. Código expirado (más de 30 segundos)
   → Generar nuevo código y reintentar
2. Secret incorrecto
   → Verificar que copiaste bien el secret
3. Sincronización de reloj desincronizado
   → Sincronizar reloj del sistema
```

---

## 🧪 Test 4: Recovery Codes

**Objetivo:** Verificar que los recovery codes funcionan

### Paso 1: Logout nuevamente
```
1. Desde dashboard, logout
2. Regresa a /login
```

### Paso 2: Login con email/password
```
Email: test@example.com
Password: Test123!@#
```

✓ **Debería aparecer pantalla 2FA**

### Paso 3: Cambiar a Recovery Code
```
1. Click link "Use recovery code instead"
2. Debería cambiar:
   - Placeholder: "XXXX-XXXX"
   - Texto: "Enter one of your recovery codes"
```

### Paso 4: Ingresar Recovery Code
```
1. Abre el archivo de recovery codes que guardaste
2. Copia un código (ej: "ABC123-DEF456")
3. Pega en el input
4. Click "Verify"
```

✓ **Esperado:**
```
- Sin error
- Se redirige a /dashboard
- Usuario logueado con recovery code
```

✓ **Verificar que fue consumido:**
```
1. Logout
2. Ve a /settings/security
3. Status debería mostrar: "9 remaining (1 used)"
```

---

## 🧪 Test 5: Regenerar Recovery Codes

**Objetivo:** Verificar que se pueden generar nuevos recovery codes

### Paso 1: En Settings/Security
```
1. Ve a /settings/security
2. Debería ver botón "Generate New Recovery Codes"
```

### Paso 2: Click en botón
```
1. Debería mostrar confirmación:
   "Regenerate recovery codes? Old codes will still work..."
2. Click OK
3. Debería ver alerta: "New recovery codes generated"
```

✓ **Verificar en UI:**
```
- Código nuevos disponibles
- Count actualizado si necesario
```

---

## 🧪 Test 6: Deshabilitar 2FA

**Objetivo:** Verificar que se puede deshabilitar 2FA

### Paso 1: En Settings/Security
```
1. Ve a /settings/security
2. Status: "✓ Enabled"
3. Botón: "Disable 2FA"
```

### Paso 2: Click en "Disable 2FA"
```
Debería mostrar warning:
"⚠ Disabling 2FA will make your account less secure"

Botones:
- "Continue with Disable" (rojo)
- "Cancel"
```

### Paso 3: Click "Continue with Disable"
```
Debería solicitar password:
"Enter your password to disable 2FA:"
Input: password
Botón: "Disable 2FA"
```

### Paso 4: Ingresar password
```
1. Ingresa tu password
2. Click "Disable 2FA"
```

✓ **Esperado:**
```
- Sin error
- Status actualizado a "Disabled"
- Desaparece la lista de recovery codes
```

### Paso 5: Verificar login sin 2FA
```
1. Logout
2. Login nuevamente
3. Debería mostrar formulario normal de login
4. NO debería pedir código 2FA
5. Login exitoso directo al dashboard
```

---

## 📊 Resumen de Tests

| Test | Acción | Resultado Esperado | ✓ |
|------|--------|-------------------|---|
| 1 | Login normal | Acceso a dashboard | [ ] |
| 2 | Setup 2FA | QR code y recovery codes | [ ] |
| 3 | Login con TOTP | Acceso con código 2FA | [ ] |
| 4 | Recovery code | Acceso con recovery code | [ ] |
| 5 | Regenerar codes | Nuevos códigos generados | [ ] |
| 6 | Deshabilitar 2FA | 2FA deshabilitado | [ ] |

---

## 🆘 Troubleshooting

### Error: "Invalid code" en TOTP
```
Causas: Código expirado, sincronización desincronizada
Solución: Usar código nuevo dentro de 30 segundos
```

### Error: "Failed to confirm 2FA"
```
Causas: Token incorrecto, secreto no guardado
Solución: Reintentar setup desde cero
```

### Error: "2FA session invalid or expired"
```
Causas: Sesión de 2FA expiró (>10 minutos)
Solución: Volver a hacer login
```

### Error: "Database error"
```
Causas: BD no accesible, migrations pendientes
Solución: Verificar DATABASE_URL, ejecutar migrations
```

### Recovery codes no funcionan
```
Causas: Código ya fue usado, formato incorrecto
Solución: Generar nuevos recovery codes
```

---

## 📝 Notas Importantes

✅ **Funciona bien si:**
- Todos los tests pasan
- No hay errores en console (F12)
- Backend logs muestran operaciones exitosas
- Recovery codes se consumen correctamente

⚠️ **Cosas a verificar:**
- Reloj del sistema está sincronizado (importante para TOTP)
- Backend y Frontend están en la misma red/accesibles
- Todas las variables de entorno están configuradas
- DB tiene las migrations ejecutadas

---

## ✅ Si todo funciona

Congratulations! 🎉

2FA está **100% funcional**. Ahora:

1. ✅ Backend deployado
2. ✅ Frontend integrado
3. ✅ Testing completado

### Próximos pasos opcionales:

- [ ] Unit tests
- [ ] E2E tests con Cypress
- [ ] Deployment a producción
- [ ] Monitoreo en producción

---

## 📊 Status Final

```
BACKEND:          ✅ Deployado en staging
FRONTEND:         ✅ Integrado en proyecto
TESTING:          ✅ Completado manualmente
FUNCIONALIDAD:    ✅ Todos los flujos funcionan
SEGURIDAD:        ✅ Validada end-to-end

LISTO PARA:       ✅ PRODUCCIÓN
```

---

**¿Todos los tests pasaron?** → ¡Excelente! 🚀

**¿Algo no funciona?** → Revisa logs y troubleshooting arriba
