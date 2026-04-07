# 🚀 SGI 360 - Launcher Automático

## Cómo Usar

### Opción 1: Doble Click (Recomendado)
1. Descomprime el archivo ZIP
2. Haz doble click en **start-app.sh**
3. El navegador se abrirá automáticamente con la app
4. Espera a que termine la autenticación automática

### Opción 2: Desde Terminal
```bash
bash start-app.sh
```

## ¿Qué Hace?

✅ Valida que Node.js y npm estén instalados
✅ Mata procesos antiguos en puertos 3000 y 3001
✅ Inicia Mock API Server (puerto 3001)
✅ Espera a que Mock API esté listo
✅ Inicia Next.js Dev Server (puerto 3000)
✅ Espera a que Next.js esté listo
✅ Valida que ambos servidores estén funcionando
✅ Abre el navegador automáticamente
✅ Hace login automático
✅ Redirige al dashboard

## Credenciales Automáticas

Estas credenciales se usan automáticamente:
- **Email:** test@example.com
- **Contraseña:** Test123!@#

## URLs Importantes

- 🌐 **App Web:** http://localhost:3000
- 🔐 **Login Manual:** http://localhost:3000/login
- 🤖 **Auto-Login:** http://localhost:3000/auto-login
- 📡 **Mock API:** http://localhost:3001

## Logs

Los logs se guardan en:
- `mock-api.log` - Logs del Mock API
- `nextjs.log` - Logs de Next.js
- `mock-api.pid` - ID del proceso Mock API
- `nextjs.pid` - ID del proceso Next.js

## Detener los Servidores

Presiona **Ctrl+C** en la terminal donde ejecutaste el script.

O manualmente:
```bash
kill $(cat launcher/mock-api.pid)
kill $(cat launcher/nextjs.pid)
```

## Requerimientos

- **Node.js** v16 o superior
- **npm** v7 o superior
- **Puerto 3000** disponible
- **Puerto 3001** disponible
- **Navegador web** moderno

## Solución de Problemas

### "Node.js not found"
Instala Node.js desde https://nodejs.org

### "Port already in use"
Otros procesos están usando los puertos. Mata cualquier proceso en 3000 y 3001:
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### El navegador no abre automáticamente
Abre manualmente: http://localhost:3000/auto-login

### Login falla
1. Verifica que ambos servidores están corriendo
2. Revisa los logs: `cat launcher/nextjs.log`
3. Intenta login manual: http://localhost:3000/login

## Estructura del Proyecto

```
SGI 360/
├── apps/web/               # Aplicación Next.js
│   ├── mock-api-server.js # Mock API
│   ├── public/
│   │   └── auto-login.html # Página de auto-login
│   └── src/
│       ├── app/
│       │   ├── api/        # Route handlers
│       │   ├── login/      # Página de login
│       │   └── dashboard/  # Dashboard
│       └── ...
└── launcher/               # Este archivo
    ├── start-app.sh        # Script de inicio
    └── README.md           # Este archivo
```

## ¿Necesitas Ayuda?

Si algo no funciona:
1. Verifica los logs: `cat launcher/nextjs.log`
2. Intenta reiniciar: presiona Ctrl+C y ejecuta de nuevo
3. Verifica que los puertos 3000 y 3001 estén disponibles
4. Revisa que Node.js esté instalado: `node -v`

---

**SGI 360 - Sistema de Gestión Integrado**
Hecho con ❤️ para facilitar tu flujo de trabajo
