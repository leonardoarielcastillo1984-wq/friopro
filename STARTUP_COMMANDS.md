# 🚀 SGI 360 - COMANDOS PARA INICIAR

## Prerequisitos

Necesitas tener instalado:
- **Node.js** (v18+)
- **npm** (viene con Node.js)
- **Docker** (para PostgreSQL y Redis)
- **Docker Compose** (opcional pero recomendado)

---

## OPCIÓN 1: Usar SETUP.sh (RECOMENDADO - Automático)

Si tienes Docker instalado, simplemente ejecuta:

```bash
cd /ruta/a/SGI\ respaldo\ 360
bash SETUP.sh
```

Esto:
- ✅ Levanta PostgreSQL y Redis en Docker
- ✅ Instala todas las dependencias
- ✅ Ejecuta migraciones de base de datos
- ✅ Carga datos iniciales (admin@sgi360.com / Admin123!)
- ✅ Inicia API en http://localhost:3002
- ✅ Inicia Frontend en http://localhost:3000
- ✅ Abre el navegador automáticamente

---

## OPCIÓN 2: Comandos Manuales (Si prefieres hacerlo paso a paso)

### Terminal 1: Levanta Docker (PostgreSQL + Redis)

```bash
# PostgreSQL
docker run -d \
  --name sgi360-postgres \
  -e POSTGRES_USER=sgi \
  -e POSTGRES_PASSWORD=sgidev123 \
  -e POSTGRES_DB=sgi_dev \
  -p 5432:5432 \
  postgres:16-alpine

# Redis
docker run -d \
  --name sgi360-redis \
  -p 6379:6379 \
  redis:7-alpine redis-server --requirepass sgidev123

# Espera 5 segundos a que se inicien
sleep 5
```

### Terminal 2: Instala dependencias e inicia API

```bash
cd /ruta/a/SGI\ respaldo\ 360/apps/api

# Instala dependencias
npm install

# Genera Prisma client
npx prisma generate

# Corre migraciones
npx prisma migrate deploy

# Carga datos iniciales (admin user)
npm run seed:complete

# Inicia API
npm run dev
```

La API estará en: **http://localhost:3001** (internamente) o **http://localhost:3002** (externamente)

### Terminal 3: Instala dependencias e inicia Frontend

```bash
cd /ruta/a/SGI\ respaldo\ 360/apps/web

# Instala dependencias
npm install

# Inicia web
npm run dev
```

El Frontend estará en: **http://localhost:3000**

---

## Credenciales

Una vez que todo esté iniciado, entra con:

```
Email:    admin@sgi360.com
Password: Admin123!
```

---

## Verificar que TODO funciona

### ✅ PostgreSQL está listo?
```bash
PGPASSWORD=sgidev123 psql -h localhost -U sgi -d sgi_dev -c "SELECT 1"
```
Debería mostrar "1"

### ✅ Redis está listo?
```bash
redis-cli ping
```
Debería mostrar "PONG"

### ✅ API está respondiendo?
```bash
curl http://localhost:3001/health
```
Debería mostrar algo como `{"status":"ok"}`

### ✅ Documentos están cargados?
```bash
curl http://localhost:3001/documents/list
```
Debería mostrar la lista de documentos en `/storage/documents/`

---

## Para DETENER TODO

```bash
# Matar procesos de Node
pkill -f "npm run dev"

# Detener Docker
docker stop sgi360-postgres sgi360-redis
docker rm sgi360-postgres sgi360-redis
```

---

## Troubleshooting

### "EADDRINUSE: address already in use :::3001"
Ya hay algo usando el puerto. Mata los procesos:
```bash
lsof -ti:3000,3001,3002 | xargs kill -9 2>/dev/null || true
```

### "Error: Cannot find module 'prisma/client'"
Falta instalar dependencias:
```bash
cd apps/api
npm install
npx prisma generate
```

### "Error: connect ECONNREFUSED 127.0.0.1:5432"
PostgreSQL no está levantado. Revisa que Docker esté corriendo.

### Login da error 500
Probablemente PostgreSQL no está listo. Espera unos segundos y reintenta.

---

## Dónde ver tus documentos

Una vez logeado:
1. Ve a **http://localhost:3000/documents**
2. Deberías ver todos los archivos de `/storage/documents/`
3. Puedes descargarlos directamente

Los documentos se cargan desde:
- `/storage/documents/` (archivos reales en el servidor)
- Base de datos (documentos que subas desde la UI)
