# 🚀 SGI 360 - Launcher Mejorado con Docker & Automatización Completa

## ✨ ¿QUÉ HAY DE NUEVO?

He mejorado completamente el launcher. Ahora **NO NECESITAS HACER NADA EN TERMINAL**. El launcher se encarga de:

✅ **Iniciar Docker** (PostgreSQL + Redis)
✅ **Instalar dependencias** automáticamente
✅ **Ejecutar migraciones** de base de datos
✅ **Iniciar API** (puerto 3002)
✅ **Iniciar Web** (puerto 3000)
✅ **Abrir navegador** automáticamente

---

## 🎯 CÓMO USAR (SUPER SIMPLE)

### Opción 1: Directamente desde la carpeta del proyecto

```bash
cd "/Users/leonardocastillo/Desktop/APP/SGI 360"
bash launcher/start-all.sh
```

**¡ESO ES TODO!** Espera 2-3 minutos y verás:
- Terminal muestra: `✅ APLICACIÓN INICIADA EXITOSAMENTE`
- Navegador abre automáticamente en login

### Opción 2: Descargar el ZIP empaquetado

He creado un ZIP con todos los scripts:
```
SGI360-Launcher-Complete.zip
```

Simplemente:
1. Descomprime el ZIP
2. Abre Terminal
3. `bash launcher/start-all.sh`

---

## 📦 QUÉ INCLUYE EL LAUNCHER

### Scripts Principales
- **`start-all.sh`** ← Ejecuta esto (inicia todo)
- **`stop.sh`** ← Para detener todo
- **`docker-compose.yml`** ← Configuración Docker

### Documentación
- **`COMO-USAR.txt`** ← Guía fácil de leer
- **`LAUNCHER_README.md`** ← Documentación detallada

### Lo que se inicia automáticamente

```
PostgreSQL (BD)
   ↓
Redis (Cache/Queue)
   ↓
API (Fastify) puerto 3002
   ↓
Web (Next.js) puerto 3000
   ↓
Navegador abre login
```

---

## 🌐 URLS DISPONIBLES

Una vez iniciado:

| URL | Descripción |
|-----|------------|
| **http://localhost:3000** | Home/Dashboard |
| **http://localhost:3000/login** | Login |
| **http://localhost:3000/dashboard** | Dashboard Principal |
| **http://localhost:3000/audit** | Motor de IA Auditora 🧠 |
| **http://localhost:3002** | API REST |

---

## 🔐 CREDENCIALES DE PRUEBA

```
Email:     test@example.com
Password:  Test123!@#
```

---

## 🛑 CÓMO DETENER

```bash
bash launcher/stop.sh
```

Esto:
- ✅ Para los servidores Node
- ✅ Detiene los contenedores Docker
- ✅ Limpia procesos

---

## 🐳 DOCKER ESTÁ INTEGRADO

El launcher ahora maneja todo automáticamente:

```bash
# Ver qué está corriendo
docker ps

# Ver logs de PostgreSQL
docker logs sgi360-postgres

# Ver logs de Redis
docker logs sgi360-redis

# Entrar a la BD
docker exec -it sgi360-postgres psql -U sgi360 -d sgi360_db

# Limpiar todo y empezar desde cero
docker-compose -f launcher/docker-compose.yml down -v
bash launcher/start-all.sh
```

---

## 📊 CONTENEDORES DOCKER

### PostgreSQL
- **Imagen:** postgres:16-alpine
- **Container:** sgi360-postgres
- **Puerto:** 5432
- **Usuario:** sgi360
- **Contraseña:** sgi360_dev_pass
- **BD:** sgi360_db

### Redis
- **Imagen:** redis:7-alpine
- **Container:** sgi360-redis
- **Puerto:** 6379
- **Datos persistentes:** Sí

---

## 🔍 SOLUCIÓN DE PROBLEMAS

### ❌ "Docker no está instalado"
```
Descarga: https://www.docker.com/products/docker-desktop
```

### ❌ "El puerto 3000 está en uso"
```bash
bash launcher/stop.sh
# o:
lsof -ti:3000 | xargs kill -9
```

### ❌ "Postgres tarda mucho en iniciar"
Es normal la primera vez (puede tardar 3-5 minutos). El script espera automáticamente.

### ❌ "Quiero ver qué está pasando"
```bash
# Ver logs en tiempo real
tail -f launcher/logs/api.log
tail -f launcher/logs/web.log
tail -f launcher/logs/docker.log
```

### ❌ "Quiero limpiar todo y empezar de cero"
```bash
bash launcher/stop.sh
docker-compose -f launcher/docker-compose.yml down -v
rm -rf apps/api/.next apps/api/node_modules
rm -rf apps/web/.next apps/web/node_modules
bash launcher/start-all.sh
```

---

## 💡 COMANDOS ÚTILES

```bash
# Reiniciar limpio
bash launcher/stop.sh && sleep 2 && bash launcher/start-all.sh

# Ver estado de Docker
docker ps
docker stats

# Ver logs en tiempo real
docker logs -f sgi360-postgres
docker logs -f sgi360-redis

# Entrar a la BD PostgreSQL
docker exec -it sgi360-postgres psql -U sgi360 -d sgi360_db

# Ejecutar comando en API
docker exec sgi360-postgres psql -U sgi360 -d sgi360_db -c "SELECT COUNT(*) FROM \"AiFinding\";"
```

---

## 📚 DOCUMENTACIÓN RELACIONADA

Para detalles sobre el Motor de IA Auditora:
```
/IA_AUDITOR_IMPLEMENTATION_GUIDE.md
```

---

## ✅ CHECKLIST ANTES DE USAR

- [ ] Node.js v18+ instalado
- [ ] Docker Desktop instalado
- [ ] Terminal abierta
- [ ] Estoy en `/Users/leonardocastillo/Desktop/APP/SGI 360`

---

## 🎉 LISTO PARA USAR

Simplemente ejecuta:

```bash
cd "/Users/leonardocastillo/Desktop/APP/SGI 360"
bash launcher/start-all.sh
```

**¡El launcher hará todo lo demás automáticamente!** 🚀

---

**Última actualización:** 2026-03-20
**Versión Launcher:** 2.0 (Con Docker y automatización completa)
