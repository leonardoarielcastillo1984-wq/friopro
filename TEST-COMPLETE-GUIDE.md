# SGI 360 - Guía de Prueba Completa

## 🚀 **Inicio Rápido**

### **Paso 1: Iniciar Docker Desktop**
Asegurate que Docker Desktop esté corriendo en tu Mac.

### **Paso 2: Ejecutar el script completo**
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360
./test-complete.sh
```

### **Paso 3: Probar la aplicación**
El script automáticamente:
- ✅ Verifica Docker
- ✅ Libera puertos
- ✅ Inicia PostgreSQL y Redis
- ✅ Configura permisos de base de datos
- ✅ Aplica migraciones Prisma
- ✅ Carga datos de prueba
- ✅ Inicia API y Web
- ✅ Abre el navegador

## 📋 **Accesos y Credenciales**

### **URLs**
- **Web App:** http://localhost:3000
- **API:** http://localhost:3001
- **API Health:** http://localhost:3001/health

### **Usuarios de Prueba**
| Rol | Email | Password |
|-----|-------|----------|
| Administrador | admin@sgi360.com | Admin123! |
| Usuario | usuario@demo.com | User123! |

## 🛑 **Detener Servicios**

```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360
./stop-all.sh
```

## 🔧 **Solución de Problemas**

### **Si Docker no está corriendo**
1. Abrí Docker Desktop
2. Esperá 30 segundos
3. Ejecutá `./test-complete.sh` nuevamente

### **Si los puertos están ocupados**
El script automáticamente libera los puertos, pero si necesitás hacerlo manualmente:
```bash
lsof -ti:5432 | xargs kill -9  # PostgreSQL
lsof -ti:6379 | xargs kill -9  # Redis
lsof -ti:3000 | xargs kill -9  # Web
lsof -ti:3001 | xargs kill -9  # API
```

### **Revisar Logs**
```bash
# Logs de API
tail -f /Users/leonardocastillo/Desktop/APP/SGI\ 360/api.log

# Logs de Web
tail -f /Users/leonardocastillo/Desktop/APP/SGI\ 360/web.log

# Logs de Docker
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360
docker compose -f infra/docker-compose.yml logs postgres
docker compose -f infra/docker-compose.yml logs redis
```

## 🎯 **Qué Prueba el Script**

1. **Infraestructura Docker**
   - PostgreSQL 16 en puerto 5432
   - Redis 7 en puerto 6379

2. **Base de Datos**
   - Permisos correctos para usuario `sgi`
   - Migraciones Prisma aplicadas
   - Datos de seed cargados

3. **Aplicaciones**
   - API en puerto 3001 (Fastify + Prisma)
   - Web en puerto 3000 (Next.js 14)

4. **Funcionalidad**
   - Login con usuarios de prueba
   - Dashboard principal
   - Navegación completa

## 📁 **Archivos Importantes**

- `./test-complete.sh` - Script principal de configuración y prueba
- `./stop-all.sh` - Script para detener todo
- `./api.log` - Logs del servidor API
- `./web.log` - Logs del servidor Web
- `./.api-pid` - PID del proceso API
- `./.web-pid` - PID del proceso Web

## 🔄 **Flujo Completo**

1. **Docker Desktop** → Corriendo
2. **`./test-complete.sh`** → Configura todo
3. **Navegador** → Se abre automáticamente
4. **Login** → Usar credenciales de prueba
5. **Explorar** → Dashboard, módulos, etc.
6. **`./stop-all.sh`** → Detener todo

## 🎉 **Resultado Final**

Si todo funciona correctamente, verás:
- ✅ Docker containers corriendo
- ✅ API respondiendo en health endpoint
- ✅ Web app cargando en navegador
- ✅ Login funcional
- ✅ Dashboard con datos de demo

La aplicación estará lista para uso y prueba completa de todas sus funcionalidades.
