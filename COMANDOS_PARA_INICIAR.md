# 🚀 COMANDOS PARA INICIAR LA API

## Opción 1: RECOMENDADA (Compilar primero)

```bash
# Paso 1: Ir a la carpeta del API
cd apps/api

# Paso 2: Compilar el TypeScript a JavaScript
npm run build

# Paso 3: Ejecutar el JavaScript compilado
node dist/main.js
```

**Ventaja:** Evita problemas de esbuild con arquitectura ARM
**Puerto:** 3001
**Tiempo de inicio:** ~3-5 segundos

---

## Opción 2: Development Mode (Si npm run dev funciona)

```bash
# Ir a la carpeta del API
cd apps/api

# Ejecutar en modo desarrollo con hot-reload
npm run dev
```

**Ventaja:** Hot-reload automático (reinicia si cambias código)
**Puerto:** 3001
**Nota:** Puede fallar si hay problemas de esbuild

---

## Opción 3: Con variables de entorno

```bash
# Si tienes problemas de Prisma, usa:
cd apps/api

PRISMA_SKIP_VALIDATION_CHECK=1 node dist/main.js
```

---

## 📋 Iniciar API + WEB (Completo)

### Terminal 1 - API
```bash
cd apps/api
npm run build  # Compilar una vez
node dist/main.js
# Esperas a ver: "Fastify server is running on http://localhost:3001"
```

### Terminal 2 - WEB
```bash
cd apps/web
npm run dev
# Esperas a ver: "▲ Next.js X.X.X - Local: http://localhost:3000"
```

### Acceder
- **Landing Page:** http://localhost:3000/
- **Admin Panel:** http://localhost:3000/dashboard/admin (requiere login)
- **Plan Selection:** http://localhost:3000/plan-selection (requiere login)

---

## 🔍 Verificar que la API está corriendo

```bash
# En otra terminal, prueba:
curl http://localhost:3001/license/plans

# O si tienes acceso con token:
curl -H "Authorization: Bearer TOKEN" http://localhost:3001/license/plans
```

**Respuesta esperada:**
```json
{
  "plans": [
    {
      "tier": "BASIC",
      "name": "Plan Básico",
      "price": 35,
      "features": {...},
      "limits": {...}
    },
    ...
  ]
}
```

---

## 🛑 Detener la API

```bash
# Si está corriendo en foreground:
Presiona CTRL + C

# Si está corriendo en background:
pkill -f "node dist/main.js"
```

---

## 📝 Script Automático (Para no repetir comandos)

### Crear archivo `start-api.sh`:

```bash
#!/bin/bash
cd "$(dirname "$0")/apps/api"
echo "🔨 Compilando API..."
npm run build
echo "🚀 Iniciando API en puerto 3001..."
node dist/main.js
```

### Hacer ejecutable:
```bash
chmod +x start-api.sh
```

### Ejecutar:
```bash
./start-api.sh
```

---

## 🎯 Flujo Recomendado

### 1️⃣ Primera vez (Compilar)
```bash
cd apps/api
npm run build
```

### 2️⃣ Iniciar API
```bash
node dist/main.js
```

### 3️⃣ En otra terminal, iniciar WEB
```bash
cd apps/web
npm run dev
```

### 4️⃣ Abrir navegador
```
http://localhost:3000/
```

---

## ⚠️ Si tienes errores

### Error: "ENOENT: no such file or directory, open 'dist/main.js'"
**Solución:** Necesitas compilar primero
```bash
npm run build
```

### Error: "FST_ERR_DUPLICATED_ROUTE"
**Solución:** Ya está arreglado en tu código. Usa la última versión.

### Error: "Cannot find module 'prisma'"
**Solución:** Instala dependencias
```bash
npm install
```

### Error: "esbuild" o "tsx"
**Solución:** Usa la compilación previa
```bash
npm run build
node dist/main.js
```

---

## 📊 Checklist Antes de Iniciar

- [ ] ¿Estás en la carpeta `/sessions/clever-confident-cerf/mnt/SGI respaldo 360/`?
- [ ] ¿Existe la carpeta `apps/api/`?
- [ ] ¿Existe la carpeta `apps/api/dist/`? (Si no, ejecuta `npm run build`)
- [ ] ¿Tienes Node.js v18+ instalado? (`node --version`)
- [ ] ¿Tienes npm instalado? (`npm --version`)

---

## 🚀 Comando Rápido (Copiar y Pegar)

```bash
cd apps/api && npm run build && node dist/main.js
```

Este comando:
1. Entra en la carpeta del API
2. Compila el código TypeScript
3. Inicia el servidor en puerto 3001

---

**¡Listo!** 🎉 Ahora tu API debería estar corriendo sin errores.
