# 🚀 SGI 360 - Inicio Automático

## 📦 Scripts Automáticos Creados

### 🎯 Opción 1: Script Terminal (Recomendado)

**Para iniciar todo automáticamente:**
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360
./auto-start.sh
```

**Para detener todo:**
```bash
./auto-stop.sh
```

### 🖱️ Opción 2: Aplicación macOS (Doble clic)

Buscá el archivo `SGI-360-Auto.app` en la carpeta del proyecto y hacé doble clic.

---

## 🎉 Qué hace `auto-start.sh` automáticamente:

### ✅ 1. Verificación de Docker
- Chequea que Docker Desktop esté corriendo
- Si no, te pide que lo inicies

### ✅ 2. Limpieza de Puertos
- Libera los puertos 3000 y 3001 automáticamente
- Mata procesos conflictivos

### ✅ 3. Infraestructura Docker
- Inicia PostgreSQL y Redis
- Espera a que estén healthy
- Reinicia si es necesario

### ✅ 4. Configuración Base de Datos
- Crea usuarios `sgi` y `sgi_auditor`
- Configura permisos automáticamente
- Verifica conexión

### ✅ 5. Preparación de Datos
- Genera cliente Prisma
- Aplica todas las migraciones
- Carga datos de demo completos

### ✅ 6. Configuración de Entorno
- Configura variables de entorno automáticamente
- Configura CORS correctamente
- Optimiza para desarrollo

### ✅ 7. Inicio de Servicios
- Inicia API en background (puerto 3001)
- Inicia Web en background (puerto 3000)
- Espera a que ambos estén listos

### ✅ 8. Acceso Inmediato
- Abre el navegador automáticamente
- Muestra todas las credenciales
- Guarda logs para depuración

---

## 🌐 Accesos al terminar

- **Web**: http://localhost:3000
- **API**: http://localhost:3001
- **Documentación**: http://localhost:3001/docs

## 🔐 Credenciales Automáticas

| Rol | Email | Contraseña |
|---|---|---|
| Super Admin | `admin@sgi360.com` | `Admin123!` |
| Usuario Demo | `usuario@demo.com` | `User123!` |
| Calidad | `calidad@demo.com` | `User123!` |
| Seguridad | `seguridad@demo.com` | `User123!` |
| Ambiente | `ambiente@demo.com` | `User123!` |
| RRHH | `rrhh@demo.com` | `User123!` |

---

## 📋 Logs y Monitoreo

El script genera logs automáticos:
- **API**: `api.log` (en la raíz del proyecto)
- **Web**: `web.log` (en la raíz del proyecto)

Para ver logs en tiempo real:
```bash
tail -f api.log
tail -f web.log
```

---

## 🛑 Cómo detener todo

### Opción 1: Script automático
```bash
./auto-stop.sh
```

### Opción 2: Manual
```bash
# Matar procesos por puerto
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9

# Detener Docker
docker compose -f infra/docker-compose.yml down
```

---

## 🔄 Flujo de Trabajo Ideal

### Para empezar a trabajar:
```bash
./auto-start.sh
```
→ Listo en ~2-3 minutos

### Para terminar:
```bash
./auto-stop.sh
```
→ Todo detenido en ~10 segundos

---

## 🎯 Ventajas del Script Automático

✅ **Cero configuración manual**  
✅ **Manejo automático de errores**  
✅ **Verificación de dependencias**  
✅ **Inicio de navegador automático**  
✅ **Logs para depuración**  
✅ **Detención limpia**  
✅ **Recuperación automática**  

---

## 🚨 Si algo falla

1. **Revisá los logs**: `cat api.log` o `cat web.log`
2. **Ejecutá el script de nuevo**: `./auto-start.sh`
3. **Reset completo**: `./reset.sh && ./auto-start.sh`
4. **Verificá Docker**: Asegurate que Docker Desktop esté corriendo

---

¡Listo! Con estos scripts ya no necesitás usar múltiples terminales ni recordar comandos. 🎉
