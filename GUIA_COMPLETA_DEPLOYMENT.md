# SGI 360 - GUÍA COMPLETA DE DEPLOYMENT Y MANTENIMIENTO

## TABLA DE CONTENIDOS
1. [Estructura del Proyecto](#estructura)
2. [Puesta en Funcionamiento Local](#local)
3. [Subir a Producción (Web)](#produccion)
4. [Hacer Modificaciones Post-Deployment](#modificaciones)
5. [Troubleshooting](#troubleshooting)

---

## ESTRUCTURA DEL PROYECTO {#estructura}

```
SGI 360/
├── apps/
│   ├── api/                    # Backend - Fastify + Node.js
│   │   ├── src/
│   │   ├── .env               # Variables de entorno
│   │   └── package.json
│   │
│   └── web/                    # Frontend - Next.js + React
│       ├── src/
│       ├── .env               # Variables correctas
│       ├── .env.local         # NUNCA tocar (o eliminar)
│       ├── next.config.mjs    # CRÍTICO - puerto API
│       └── package.json
│
├── infra/
│   └── postgres-init/
│       └── 01-init.sql        # Script de BD
│
└── Docker/Deployment files
```

---

## PUESTA EN FUNCIONAMIENTO LOCAL {#local}

### REQUISITOS
- Node.js 18+ instalado
- PostgreSQL 14+ instalado y corriendo
- Redis instalado y corriendo
- Terminal con acceso a npm

### PASO 1: Preparar Base de Datos

```bash
# Verificar que PostgreSQL está corriendo
# En macOS con Homebrew:
brew services start postgresql@16
redis-server  # O: brew services start redis

# Crear usuario y base de datos
/opt/homebrew/opt/postgresql@16/bin/psql -U postgres << 'EOF'
CREATE USER sgi WITH ENCRYPTED PASSWORD 'sgidev123';
ALTER USER sgi WITH CREATEDB;
CREATE DATABASE sgi_dev OWNER sgi;
GRANT CONNECT ON DATABASE sgi_dev TO sgi;
GRANT USAGE ON SCHEMA public TO sgi_dev;
GRANT CREATE ON SCHEMA public TO sgi;
EOF
```

### PASO 2: Configurar API

```bash
cd ~/Desktop/APP/SGI\ 360/apps/api

# Crear/Verificar .env con contenido exacto:
cat > .env << 'EOF'
PORT=3002
NODE_ENV=development

DATABASE_URL=postgresql://sgi:sgidev123@localhost:5432/sgi_dev?schema=public
DATABASE_URL_AUDITOR=postgresql://sgi:sgidev123@localhost:5432/sgi_dev?schema=public

JWT_SECRET=sgi360-dev-secret-key-min-32-characters-required-xyz
JWT_ISSUER=sgi360
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d

REDIS_URL=redis://localhost:6379

STORAGE_BACKEND=local
STORAGE_LOCAL_PATH=./uploads
MAX_PDF_SIZE_MB=50

CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000

EMAIL_PROVIDER=console
EMAIL_FROM=SGI 360 <noreply@sgi360.app>
APP_URL=http://localhost:3000

LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-20250514
OPENAI_MODEL=gpt-4-turbo
AUDIT_MAX_TOKENS=4000
EOF

# Instalar dependencias
npm install --legacy-peer-deps

# Crear tablas en BD
npx prisma db push --skip-generate

# Crear usuario de prueba
npx ts-node src/scripts/seedUsers.ts
# Responder "y" cuando pregunte
```

### PASO 3: Configurar Frontend

```bash
cd ~/Desktop/APP/SGI\ 360/apps/web

# ELIMINAR .env.local si existe
rm -f .env.local

# Crear .env exacto:
cat > .env << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:3002
EOF

# VERIFICAR next.config.mjs tiene puerto 3002 en línea 22:
# destination: 'http://localhost:3002/:path*',

# Instalar dependencias
npm install --legacy-peer-deps
```

### PASO 4: Iniciar Servicios

```bash
# Terminal 1 - API
cd ~/Desktop/APP/SGI\ 360/apps/api
npm run dev
# Debería mostrar: ✓ SGI 360 API running on port 3002

# Terminal 2 - Frontend
cd ~/Desktop/APP/SGI\ 360/apps/web
npm run dev
# Debería mostrar: ✓ Ready in XXXms
#                  - Local: http://localhost:3000
```

### PASO 5: Probar Login

1. Abrir navegador: `http://localhost:3000/login`
2. Email: `admin@sgi360.com`
3. Contraseña: `Admin123!`
4. Debería entrar al dashboard ✅

---

## SUBIR A PRODUCCIÓN (WEB) {#produccion}

### OPCIÓN A: Render.com (Recomendado - Fácil)

#### Paso 1: Preparar repositorio Git

```bash
cd ~/Desktop/APP/SGI\ 360
git init
git add .
git commit -m "Initial commit - SGI 360"
git branch -M main
```

#### Paso 2: Crear repositorio en GitHub

1. Ir a https://github.com/new
2. Crear repositorio `sgi-360`
3. Push local al remoto:

```bash
git remote add origin https://github.com/TU_USUARIO/sgi-360.git
git push -u origin main
```

#### Paso 3: Desplegar en Render

**Para el API:**
1. Ir a https://render.com/dashboard
2. Click "New" → "Web Service"
3. Conectar repositorio GitHub
4. Configurar:
   - Name: `sgi-360-api`
   - Root Directory: `apps/api`
   - Build Command: `npm install --legacy-peer-deps && npx prisma db push --skip-generate`
   - Start Command: `npm run start` (o `node dist/src/main.js`)
   - Environment Variables:
     ```
     PORT=3002
     NODE_ENV=production
     DATABASE_URL=postgresql://...  # URL de PostgreSQL en nube
     REDIS_URL=redis://...          # URL de Redis en nube
     (otras variables...)
     ```

**Para el Frontend:**
1. Crear otro Web Service
2. Configurar:
   - Name: `sgi-360-web`
   - Root Directory: `apps/web`
   - Build Command: `npm install --legacy-peer-deps && npm run build`
   - Start Command: `npm start`
   - Environment Variables:
     ```
     NEXT_PUBLIC_API_URL=https://sgi-360-api.onrender.com
     ```

### OPCIÓN B: Vercel (Mejor para Next.js)

**Para el Frontend:**
1. Ir a https://vercel.com
2. Click "New Project"
3. Importar repositorio GitHub
4. Configurar:
   - Framework: Next.js
   - Root Directory: `apps/web`
   - Build Command: `npm run build`
   - Environment Variables:
     ```
     NEXT_PUBLIC_API_URL=https://your-api-domain.com
     ```
5. Deploy

**Para el API:**
- Usar una plataforma diferente (Render, Railway, Heroku, etc.)

### OPCIÓN C: DigitalOcean / AWS / Google Cloud (Más control)

1. Crear VM (Ubuntu 22.04)
2. Instalar Node.js, PostgreSQL, Redis
3. Clone repositorio
4. Configure .env con variables de producción
5. Ejecutar:
   ```bash
   cd apps/api && npm install && npm run build && npm start
   cd apps/web && npm install && npm run build && npm start
   ```
6. Usar Nginx como reverse proxy
7. SSL con Let's Encrypt

---

## HACER MODIFICACIONES POST-DEPLOYMENT {#modificaciones}

### Flujo de Desarrollo → Producción

```
Local Development
       ↓
    (Cambios en código)
       ↓
    Git Commit
       ↓
    Git Push a main
       ↓
    Webhook en Render/Vercel
       ↓
    Auto-rebuild y deploy
       ↓
    ✅ Cambios en vivo
```

### Ejemplo: Agregar nuevo campo a usuario

**1. En tu máquina local:**

```bash
# Cambiar código del usuario
# En /apps/api/src/routes/user.ts
# En /apps/web/src/components/UserForm.tsx

# Crear migración de BD
cd apps/api
npx prisma migrate dev --name add_user_field

# Probar localmente
npm run dev

# Si funciona bien:
git add .
git commit -m "feat: Add new user field"
git push origin main
```

**2. Automáticamente:**
- Render/Vercel detecta push
- Ejecuta build command
- Ejecuta migraciones
- Deploy automático

**3. Si hay error:**
- Ver logs en panel de control
- Fix en local
- Push nuevamente

### Patrón de Versionado Seguro

```
main branch (Producción)
  ↑
  └─ pull requests solo desde develop

develop branch (Staging/Testing)
  ↑
  └─ pull requests desde feature branches

feature/nueva-funcionalidad (Desarrollo)
  ↑
  └─ Tu trabajo local
```

### Comandos Git Esenciales

```bash
# Ver cambios
git status
git diff

# Guardar cambios
git add .
git commit -m "descripción clara"
git push

# Crear rama nueva
git checkout -b feature/mi-feature
# ... hacer cambios ...
git push -u origin feature/mi-feature
# (Crear pull request en GitHub)

# Sincronizar con main
git pull origin main
```

---

## TROUBLESHOOTING {#troubleshooting}

### El login no funciona

**Causas comunes:**
1. API no está en puerto 3002
   - Solución: `lsof -i :3002` (verifica si está corriendo)

2. Frontend no apunta a puerto 3002
   - Verificar: `next.config.mjs` línea 22
   - Verificar: `.env.local` NO existe

3. Base de datos vacía (sin usuarios)
   - Solución: `npx ts-node src/scripts/seedUsers.ts`

4. Redis no está corriendo
   - Solución: `redis-server` o `brew services start redis`

### Cambios no se reflejan en producción

**Causas:**
1. No hiciste git push
   - Solución: `git push origin main`

2. Build falló silenciosamente
   - Solución: Ver logs en panel de control (Render/Vercel)

3. Cache del navegador
   - Solución: Ctrl+Shift+R (hard refresh)

### Error: "Database connection refused"

```bash
# Verificar PostgreSQL
psql -U sgi -d sgi_dev

# Si no conecta:
brew services restart postgresql@16

# Verificar variables en .env
# DATABASE_URL debe estar correcto
```

### Error: "Redis connection refused"

```bash
# Verificar Redis
redis-cli ping
# Debería responder: PONG

# Si no responde:
redis-server
# O:
brew services start redis
```

---

## CHECKLIST FINAL

- [ ] PostgreSQL corriendo
- [ ] Redis corriendo
- [ ] .env.local ELIMINADO
- [ ] next.config.mjs con puerto 3002
- [ ] API en terminal 1: `npm run dev` (puerto 3002)
- [ ] Frontend en terminal 2: `npm run dev` (puerto 3000)
- [ ] Login funciona: admin@sgi360.com / Admin123!
- [ ] Dashboard accesible
- [ ] Git repositorio creado
- [ ] Cuenta en Render/Vercel
- [ ] Variables de entorno en producción
- [ ] Deploy automático configurado

---

## RESUMEN

**Local:**
- Cambiar variables, git push, automáticamente se deploya

**Producción:**
- Los cambios fluyen: Local → GitHub → Render/Vercel → En Vivo

**Mantenimiento:**
- Revisar logs regularmente
- Hacer backups de base de datos
- Monitorear performance
- Actualizar dependencias mensualmente

