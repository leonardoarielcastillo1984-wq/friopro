# SGI 360 - Comandos para Iniciar la App Web

## 🚀 **Forma Más Fácil (Recomendado)**

### **Paso 1: Iniciar Docker Desktop**
Abrí Docker Desktop y esperá que esté corriendo.

### **Paso 2: Ejecutar el script**
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360
./start-simple.sh
```

### **Paso 3: Probar**
- **Web:** http://localhost:3000
- **Login:** admin@sgi360.com / Admin123!

---

## 🔧 **Comandos Manuales (si prefieres control total)**

### **1. Iniciar infraestructura**
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360
docker compose -f infra/docker-compose.yml up -d
```

### **2. Configurar API**
```bash
cd apps/api

# Crear .env si no existe
cp .env.example .env

# Generar Prisma
pnpm prisma:generate

# Resetear y migrar
pnpm prisma:reset --force

# Cargar datos de prueba
pnpm seed:all
```

### **3. Iniciar API**
```bash
cd apps/api
pnpm dev
# API corriendo en http://localhost:3001
```

### **4. Iniciar Web** (en otra terminal)
```bash
cd apps/web
pnpm dev
# Web corriendo en http://localhost:3000
```

---

## 🛑 **Para Detener**

### **Con script (fácil)**
```bash
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360
./stop-simple.sh
```

### **Manual**
```bash
# Detener contenedores
cd /Users/leonardocastillo/Desktop/APP/SGI\ 360
docker compose -f infra/docker-compose.yml down

# Matar procesos (Ctrl+C en cada terminal o)
lsof -ti:3000 | xargs kill -9  # Web
lsof -ti:3001 | xargs kill -9  # API
```

---

## 📋 **Resumen de Puertos**

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| Web App | 3000 | Next.js frontend |
| API | 3001 | Fastify backend |
| PostgreSQL | 5432 | Base de datos |
| Redis | 6379 | Cache/Colas |

---

## 👤 **Usuarios de Prueba**

| Rol | Email | Password |
|-----|-------|----------|
| Administrador | admin@sgi360.com | Admin123! |
| Usuario | usuario@demo.com | User123! |

---

## 🔍 **Verificación**

### **Verificar API**
```bash
curl http://localhost:3001/health
```

### **Verificar Web**
```bash
curl http://localhost:3000
```

---

## ⚠️ **Troubleshooting**

### **Si Docker no funciona:**
- Iniciá Docker Desktop
- Esperá 30 segundos
- Reintentá

### **Si hay error de permisos:**
```bash
cd apps/api
pnpm prisma:reset --force
pnpm seed:all
```

### **Si los puertos están ocupados:**
```bash
lsof -ti:3000 | xargs kill -9
lsof -ti:3001 | xargs kill -9
```

---

## 🎯 **Recomendación**

**Usá `./start-simple.sh`** - Es la forma más fácil y segura de iniciar todo correctamente.
