# 🚀 SGI 360 - Instrucciones del Launcher Automático

## ✅ El Launcher está LISTO

He creado un ejecutable que hace TODO automáticamente con solo un doble click.

## 📦 Descargar el ZIP

El archivo `SGI360-Launcher.zip` está en:
```
/Users/leonardocastillo/Desktop/APP/SGI 360/SGI360-Launcher.zip
```

## 🎯 Cómo Usarlo

### Paso 1: Descomprime el ZIP
1. Abre Finder
2. Ve a `/Users/leonardocastillo/Desktop/APP/SGI 360/`
3. Busca **SGI360-Launcher.zip**
4. Haz doble click para descomprimir
5. Se creará una carpeta **launcher**

### Paso 2: Ejecuta el Launcher

**Opción A: Doble Click (MÁS FÁCIL)**
1. Ve a la carpeta **launcher**
2. Haz doble click en **START_APP.command**
3. Se abrirá una terminal automáticamente
4. Espera a que se abra el navegador

**Opción B: Desde Terminal**
```bash
cd "/Users/leonardocastillo/Desktop/APP/SGI 360/launcher"
bash start-app.sh
```

## ✨ ¿Qué Sucede?

1. ✅ Valida Node.js y npm
2. ✅ Mata procesos antiguos
3. ✅ Inicia Mock API (puerto 3001)
4. ✅ Inicia Next.js (puerto 3000)
5. ✅ Valida que ambos funcionen
6. ✅ **Abre el navegador automáticamente**
7. ✅ **Hace login automático**
8. ✅ **Redirige al dashboard**

## 🔐 Credenciales Automáticas

Se usan automáticamente:
- **Email:** test@example.com
- **Contraseña:** Test123!@#

**No necesitas escribir nada!** Todo es automático.

## 🌐 URLs Disponibles

- 🏠 **Dashboard:** http://localhost:3000/dashboard
- 🔐 **Login Manual:** http://localhost:3000/login
- 🤖 **Auto-Login:** http://localhost:3000/auto-login
- 📡 **Mock API:** http://localhost:3001

## 🛑 Cómo Detener

En la terminal, presiona:
```
Ctrl+C
```

O ejecuta:
```bash
kill $(cat launcher/mock-api.pid)
kill $(cat launcher/nextjs.pid)
```

## 📋 Archivos en el ZIP

```
launcher/
├── start-app.sh          ← Script principal (EJECUTABLE)
├── START_APP.command     ← Para doble click en Mac
├── INSTALL.sh            ← Script de validación
├── README.md             ← Documentación completa
├── mock-api.log          ← Log del API (se crea al correr)
├── nextjs.log            ← Log de Next.js (se crea al correr)
├── mock-api.pid          ← ID del proceso API
└── nextjs.pid            ← ID del proceso Next.js
```

## 🆘 Si Algo Falla

### "Command not found" o Error de Permisos
```bash
chmod +x launcher/start-app.sh
bash launcher/start-app.sh
```

### "Port already in use"
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

### El navegador no abre
Abre manualmente: http://localhost:3000/auto-login

### Login falla
Revisa los logs:
```bash
tail -50 launcher/nextjs.log
```

## 📚 Documentación Completa

Lee `launcher/README.md` para:
- Requerimientos del sistema
- Solución de problemas detallada
- Cómo ver logs
- Cómo detener procesos manualmente

## ✅ Checklist

- [ ] Descargué el archivo SGI360-Launcher.zip
- [ ] Descomprimí el ZIP
- [ ] Ejecuté START_APP.command (o bash start-app.sh)
- [ ] Vi que se abrió una terminal
- [ ] Vi que el navegador se abrió automáticamente
- [ ] Vi la página de auto-login
- [ ] Fui redirigido al dashboard automáticamente
- [ ] Estoy en el dashboard de SGI 360 🎉

## 🎉 ¡Listo!

Si llegaste hasta aquí sin errores, **LA APLICACIÓN ESTÁ 100% FUNCIONAL**.

Puedes:
- Navegar por todas las páginas
- Probar el login manual en http://localhost:3000/login
- Ver los logs en tiempo real
- Detener y reiniciar en cualquier momento

---

**Preguntas o problemas?**

Revisa:
1. Los logs: `cat launcher/nextjs.log`
2. El README: `cat launcher/README.md`
3. Las instrucciones de validación: `bash launcher/INSTALL.sh`

¡Disfruta de SGI 360! 🚀
